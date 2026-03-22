const { pool } = require('../config/dbConfig');

function normalizeIngredientName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .join(' ');
}

async function getOrCreateIngredientId(conn, ingredientName) {
    const normalizedName = normalizeIngredientName(ingredientName);

    const [existingRows] = await conn.query(
        'SELECT ingredientId FROM Ingredients WHERE LOWER(TRIM(ingredientName)) = ? LIMIT 1',
        [normalizedName]
    );

    if (existingRows.length > 0) {
        return Number(existingRows[0].ingredientId);
    }

    const displayName = normalizedName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    const [insertResult] = await conn.query(
        'INSERT INTO Ingredients (ingredientName) VALUES (?)',
        [displayName]
    );

    return Number(insertResult.insertId);
}

exports.listPantryByUser = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const [rows] = await pool.query(
        `SELECT 
            p.pantryItemId,
            p.userId,
            p.ingredientId,
            i.ingredientName,
            p.quantity,
            p.unit,
            p.expiresAt,
            p.createdAt,
            p.updatedAt
         FROM PantryItems p
         JOIN Ingredients i ON p.ingredientId = i.ingredientId
         WHERE p.userId = ?
         ORDER BY i.ingredientName ASC`,
        [parsedUserId]
    );

    return {
        success: true,
        data: rows.map(row => ({
            pantryItemId: Number(row.pantryItemId),
            userId: Number(row.userId),
            ingredientId: Number(row.ingredientId),
            ingredientName: row.ingredientName,
            quantity: Number(row.quantity),
            unit: row.unit,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        })),
        message: 'Get pantry successfully'
    };
};

exports.upsertPantryItem = async ({ userId, ingredientName, quantity, unit, expiresAt = null }) => {
    const parsedUserId = Number(userId);
    const parsedQuantity = Number(quantity);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!ingredientName || typeof ingredientName !== 'string') {
        throw new Error('ingredientName is required');
    }

    if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
        throw new Error('quantity must be a non-negative number');
    }

    if (!unit || typeof unit !== 'string') {
        throw new Error('unit is required');
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const ingredientId = await getOrCreateIngredientId(conn, ingredientName);

        const [existingRows] = await conn.query(
            'SELECT pantryItemId FROM PantryItems WHERE userId = ? AND ingredientId = ? AND unit = ? LIMIT 1',
            [parsedUserId, ingredientId, unit]
        );

        if (existingRows.length > 0) {
            await conn.query(
                'UPDATE PantryItems SET quantity = ?, expiresAt = ? WHERE pantryItemId = ?',
                [parsedQuantity, expiresAt, existingRows[0].pantryItemId]
            );
        } else {
            await conn.query(
                `INSERT INTO PantryItems (userId, ingredientId, quantity, unit, expiresAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [parsedUserId, ingredientId, parsedQuantity, unit, expiresAt]
            );
        }

        await conn.commit();

        return module.exports.listPantryByUser(parsedUserId);
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.deletePantryItem = async ({ userId, pantryItemId }) => {
    const parsedUserId = Number(userId);
    const parsedPantryItemId = Number(pantryItemId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedPantryItemId || parsedPantryItemId <= 0) {
        throw new Error('pantryItemId must be a positive number');
    }

    await pool.query(
        'DELETE FROM PantryItems WHERE pantryItemId = ? AND userId = ?',
        [parsedPantryItemId, parsedUserId]
    );

    return module.exports.listPantryByUser(parsedUserId);
};
