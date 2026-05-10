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

// ============================================================
// NEW PANTRY SHARING FUNCTIONS
// ============================================================

/**
 * Get user's access level to a pantry
 * @param {number} pantryId
 * @param {number} userId
 * @returns {'owner'|'editor'|'viewer'|null} access level or null if no access
 */
exports.getUserPantryAccess = async (pantryId, userId) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    // Check if user is owner (short-circuit)
    const [ownerRows] = await pool.query(
        'SELECT 1 FROM Pantries WHERE pantryId = ? AND ownerUserId = ? LIMIT 1',
        [parsedPantryId, parsedUserId]
    );
    if (ownerRows.length > 0) return 'owner';

    // Check PantryShares for editor/viewer role
    const [shareRows] = await pool.query(
        'SELECT role FROM PantryShares WHERE pantryId = ? AND userId = ? LIMIT 1',
        [parsedPantryId, parsedUserId]
    );
    if (shareRows.length > 0) return shareRows[0].role;

    return null;
};

/**
 * Get or create default pantry for a user
 * @param {number} userId
 * @returns {Promise<number>} pantryId
 */
exports.getOrCreateDefaultPantryId = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    // Check if default pantry exists
    const [existingRows] = await pool.query(
        'SELECT pantryId FROM Pantries WHERE ownerUserId = ? AND name = ? LIMIT 1',
        [parsedUserId, 'My Pantry']
    );

    if (existingRows.length > 0) {
        return Number(existingRows[0].pantryId);
    }

    // Create new default pantry
    const [insertResult] = await pool.query(
        'INSERT INTO Pantries (name, ownerUserId) VALUES (?, ?)',
        ['My Pantry', parsedUserId]
    );

    return Number(insertResult.insertId);
};

/**
 * List all pantries a user can access (owned + shared)
 * @param {number} userId
 * @returns {Promise<{success: boolean, data: Array}>}
 */
exports.listPantriesByUser = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const [rows] = await pool.query(
        `SELECT DISTINCT
            p.pantryId,
            p.name,
            p.ownerUserId,
            p.createdAt,
            CASE
                WHEN p.ownerUserId = ? THEN 'owner'
                ELSE ps.role
            END as userRole
         FROM Pantries p
         LEFT JOIN PantryShares ps ON p.pantryId = ps.pantryId AND ps.userId = ?
         WHERE p.ownerUserId = ? OR ps.userId = ?
         ORDER BY p.createdAt DESC`,
        [parsedUserId, parsedUserId, parsedUserId, parsedUserId]
    );

    // Get item count for each pantry
    const pantriesWithCount = await Promise.all(
        rows.map(async (row) => {
            const [countResult] = await pool.query(
                'SELECT COUNT(*) as itemCount FROM PantryItems WHERE pantryId = ?',
                [row.pantryId]
            );
            return {
                pantryId: Number(row.pantryId),
                name: row.name,
                ownerUserId: Number(row.ownerUserId),
                userRole: row.userRole,
                itemCount: Number(countResult[0].itemCount),
                createdAt: row.createdAt
            };
        })
    );

    return {
        success: true,
        data: pantriesWithCount
    };
};

/**
 * Get pantry metadata
 * @param {number} pantryId
 * @param {number} userId
 * @returns {Promise<{success: boolean, data: Object}>}
 */
exports.getPantryById = async (pantryId, userId) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const access = await exports.getUserPantryAccess(parsedPantryId, parsedUserId);
    if (!access) {
        throw new Error('Access denied');
    }

    const [rows] = await pool.query(
        'SELECT pantryId, name, ownerUserId, createdAt FROM Pantries WHERE pantryId = ?',
        [parsedPantryId]
    );

    if (rows.length === 0) {
        throw new Error('Pantry not found');
    }

    return {
        success: true,
        data: {
            pantryId: Number(rows[0].pantryId),
            name: rows[0].name,
            ownerUserId: Number(rows[0].ownerUserId),
            userRole: access,
            createdAt: rows[0].createdAt
        }
    };
};

/**
 * Create a new pantry
 * @param {{ ownerUserId: number, name: string }} params
 * @returns {Promise<{success: boolean, data: Object}>}
 */
exports.createPantry = async ({ ownerUserId, name }) => {
    const parsedOwnerUserId = Number(ownerUserId);
    const parsedName = String(name || '').trim();

    if (!parsedOwnerUserId || parsedOwnerUserId <= 0) {
        throw new Error('ownerUserId must be a positive number');
    }
    if (!parsedName) {
        throw new Error('Pantry name is required');
    }

    const [result] = await pool.query(
        'INSERT INTO Pantries (name, ownerUserId) VALUES (?, ?)',
        [parsedName, parsedOwnerUserId]
    );

    return {
        success: true,
        data: {
            pantryId: Number(result.insertId),
            name: parsedName,
            ownerUserId: parsedOwnerUserId
        }
    };
};

/**
 * Delete a pantry (owner only)
 * @param {{ pantryId: number, userId: number }} params
 * @returns {Promise<{success: boolean}>}
 */
exports.deletePantry = async ({ pantryId, userId }) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const access = await exports.getUserPantryAccess(parsedPantryId, parsedUserId);
    if (access !== 'owner') {
        throw new Error('Only owner can delete pantry');
    }

    await pool.query('DELETE FROM Pantries WHERE pantryId = ?', [parsedPantryId]);

    return { success: true };
};

/**
 * Share a pantry with another user (owner only)
 * @param {{ pantryId: number, ownerUserId: number, targetUserId: number, role: string }} params
 * @returns {Promise<{success: boolean, data: Object}>}
 */
exports.sharePantry = async ({ pantryId, ownerUserId, targetUserId, role }) => {
    const parsedPantryId = Number(pantryId);
    const parsedOwnerUserId = Number(ownerUserId);
    const parsedTargetUserId = Number(targetUserId);
    const parsedRole = String(role || 'viewer').toLowerCase();

    if (!['viewer', 'editor'].includes(parsedRole)) {
        throw new Error('Invalid role. Must be "viewer" or "editor"');
    }
    if (parsedTargetUserId === parsedOwnerUserId) {
        throw new Error('Cannot share pantry with yourself');
    }

    // Verify owner
    const [ownerRows] = await pool.query(
        'SELECT 1 FROM Pantries WHERE pantryId = ? AND ownerUserId = ? LIMIT 1',
        [parsedPantryId, parsedOwnerUserId]
    );
    if (ownerRows.length === 0) {
        throw new Error('Only owner can share pantry');
    }

    // Insert or update share
    await pool.query(
        `INSERT INTO PantryShares (pantryId, userId, role) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE role = ?`,
        [parsedPantryId, parsedTargetUserId, parsedRole, parsedRole]
    );

    const [shareRows] = await pool.query(
        'SELECT createdAt FROM PantryShares WHERE pantryId = ? AND userId = ?',
        [parsedPantryId, parsedTargetUserId]
    );

    return {
        success: true,
        data: {
            pantryId: parsedPantryId,
            userId: parsedTargetUserId,
            role: parsedRole,
            sharedAt: shareRows[0]?.createdAt
        }
    };
};

/**
 * List all shares for a pantry (owner only)
 * @param {{ pantryId: number, ownerUserId: number }} params
 * @returns {Promise<{success: boolean, data: Array}>}
 */
exports.listPantryShares = async ({ pantryId, ownerUserId }) => {
    const parsedPantryId = Number(pantryId);
    const parsedOwnerUserId = Number(ownerUserId);

    // Verify owner
    const [ownerRows] = await pool.query(
        'SELECT 1 FROM Pantries WHERE pantryId = ? AND ownerUserId = ? LIMIT 1',
        [parsedPantryId, parsedOwnerUserId]
    );
    if (ownerRows.length === 0) {
        throw new Error('Only owner can list shares');
    }

    const [rows] = await pool.query(
        `SELECT ps.userId, u.fullName, ps.role, ps.createdAt
         FROM PantryShares ps
         JOIN Users u ON ps.userId = u.userId
         WHERE ps.pantryId = ?
         ORDER BY ps.createdAt DESC`,
        [parsedPantryId]
    );

    return {
        success: true,
        data: rows.map(row => ({
            userId: Number(row.userId),
            fullName: row.fullName,
            role: row.role,
            sharedAt: row.createdAt
        }))
    };
};

/**
 * Remove a share from a pantry (owner only)
 * @param {{ pantryId: number, ownerUserId: number, targetUserId: number }} params
 * @returns {Promise<{success: boolean}>}
 */
exports.removePantryShare = async ({ pantryId, ownerUserId, targetUserId }) => {
    const parsedPantryId = Number(pantryId);
    const parsedOwnerUserId = Number(ownerUserId);
    const parsedTargetUserId = Number(targetUserId);

    // Verify owner
    const [ownerRows] = await pool.query(
        'SELECT 1 FROM Pantries WHERE pantryId = ? AND ownerUserId = ? LIMIT 1',
        [parsedPantryId, parsedOwnerUserId]
    );
    if (ownerRows.length === 0) {
        throw new Error('Only owner can remove shares');
    }

    await pool.query(
        'DELETE FROM PantryShares WHERE pantryId = ? AND userId = ?',
        [parsedPantryId, parsedTargetUserId]
    );

    return { success: true };
};

/**
 * Update a share role (owner only)
 * @param {{ pantryId: number, ownerUserId: number, targetUserId: number, role: string }} params
 * @returns {Promise<{success: boolean}>}
 */
exports.updatePantryShareRole = async ({ pantryId, ownerUserId, targetUserId, role }) => {
    const parsedPantryId = Number(pantryId);
    const parsedOwnerUserId = Number(ownerUserId);
    const parsedTargetUserId = Number(targetUserId);
    const parsedRole = String(role || 'viewer').toLowerCase();

    if (!['viewer', 'editor'].includes(parsedRole)) {
        throw new Error('Invalid role. Must be "viewer" or "editor"');
    }
    if (parsedTargetUserId === parsedOwnerUserId) {
        throw new Error('Cannot share pantry with yourself');
    }

    // Verify owner
    const [ownerRows] = await pool.query(
        'SELECT 1 FROM Pantries WHERE pantryId = ? AND ownerUserId = ? LIMIT 1',
        [parsedPantryId, parsedOwnerUserId]
    );
    if (ownerRows.length === 0) {
        throw new Error('Only owner can update shares');
    }

    const [updateResult] = await pool.query(
        'UPDATE PantryShares SET role = ? WHERE pantryId = ? AND userId = ?',
        [parsedRole, parsedPantryId, parsedTargetUserId]
    );

    if (Number(updateResult.affectedRows || 0) === 0) {
        throw new Error('Share not found');
    }

    return { success: true };
};

/**
 * Get pantry items by pantryId with pagination
 * @param {number} pantryId
 * @param {number} userId
 * @param {{ page?: number, limit?: number }} options
 * @returns {Promise<{success: boolean, data: Array, meta: Object}>}
 */
exports.listPantryItemsByPantryIdPaginated = async (pantryId, userId, { page = 1, limit = 20 } = {}) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);
    const offset = (Number(page) - 1) * Number(limit);
    const pageLimit = Math.min(Math.max(Number(limit) || 20, 1), 100);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    // Verify access
    const access = await exports.getUserPantryAccess(parsedPantryId, parsedUserId);
    if (!access) {
        throw new Error('Access denied');
    }

    // Get total count
    const [countResult] = await pool.query(
        'SELECT COUNT(*) as total FROM PantryItems WHERE pantryId = ?',
        [parsedPantryId]
    );
    const total = Number(countResult[0].total);

    // Get paginated items
    const [rows] = await pool.query(
        `SELECT pi.pantryItemId, pi.pantryId, pi.ingredientId,
                i.ingredientName, pi.quantity, pi.unit, pi.expiresAt
         FROM PantryItems pi
         JOIN Ingredients i ON pi.ingredientId = i.ingredientId
         WHERE pi.pantryId = ?
         ORDER BY i.ingredientName ASC
         LIMIT ? OFFSET ?`,
        [parsedPantryId, pageLimit, offset]
    );

    return {
        success: true,
        data: rows.map(row => ({
            pantryItemId: Number(row.pantryItemId),
            pantryId: Number(row.pantryId),
            ingredientId: Number(row.ingredientId),
            ingredientName: row.ingredientName,
            quantity: Number(row.quantity),
            unit: row.unit,
            expiresAt: row.expiresAt
        })),
        meta: {
            page: Number(page),
            limit: pageLimit,
            total,
            hasMore: offset + rows.length < total
        }
    };
};

/**
 * Upsert pantry item with pantryId and access control
 * @param {{ pantryId: number, userId: number, ingredientName: string, quantity: number, unit: string, expiresAt?: string }} params
 * @returns {Promise<{success: boolean, data: Array}>}
 */
exports.upsertPantryItem = async ({ pantryId, userId, ingredientName, quantity, unit, expiresAt = null }) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);
    const parsedQuantity = Number(quantity);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
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

    // Check access - must be owner or editor
    const access = await exports.getUserPantryAccess(parsedPantryId, parsedUserId);
    if (!access) {
        throw new Error('Access denied');
    }
    if (access === 'viewer') {
        throw new Error('Edit access denied');
    }

    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const ingredientId = await getOrCreateIngredientId(conn, ingredientName);

        const [existingRows] = await conn.query(
            'SELECT pantryItemId FROM PantryItems WHERE pantryId = ? AND ingredientId = ? AND unit = ? LIMIT 1',
            [parsedPantryId, ingredientId, unit]
        );

        if (existingRows.length > 0) {
            await conn.query(
                'UPDATE PantryItems SET quantity = ?, expiresAt = ? WHERE pantryItemId = ?',
                [parsedQuantity, expiresAt, existingRows[0].pantryItemId]
            );
        } else {
            await conn.query(
                `INSERT INTO PantryItems (pantryId, ingredientId, quantity, unit, expiresAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [parsedPantryId, ingredientId, parsedQuantity, unit, expiresAt]
            );
        }

        await conn.commit();

        return exports.listPantryItemsByPantryIdPaginated(parsedPantryId, parsedUserId, { page: 1, limit: 100 });
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

/**
 * Delete pantry item with access control
 * @param {{ pantryId: number, userId: number, pantryItemId: number }} params
 * @returns {Promise<{success: boolean}>}
 */
exports.deletePantryItem = async ({ pantryId, userId, pantryItemId }) => {
    const parsedPantryId = Number(pantryId);
    const parsedUserId = Number(userId);
    const parsedPantryItemId = Number(pantryItemId);

    if (!parsedPantryId || parsedPantryId <= 0) {
        throw new Error('pantryId must be a positive number');
    }
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }
    if (!parsedPantryItemId || parsedPantryItemId <= 0) {
        throw new Error('pantryItemId must be a positive number');
    }

    // Check access - must be owner or editor
    const access = await exports.getUserPantryAccess(parsedPantryId, parsedUserId);
    if (!access) {
        throw new Error('Access denied');
    }
    if (access === 'viewer') {
        throw new Error('Edit access denied');
    }

    const [deleteResult] = await pool.query(
        'DELETE FROM PantryItems WHERE pantryItemId = ? AND pantryId = ?',
        [parsedPantryItemId, parsedPantryId]
    );

    if (Number(deleteResult.affectedRows || 0) === 0) {
        throw new Error('Pantry item not found');
    }

    return { success: true };
};

// ============================================================
// LEGACY FUNCTIONS (for backward compatibility)
// ============================================================

/**
 * @deprecated Use listPantriesByUser and getOrCreateDefaultPantryId instead
 */
exports.listPantryByUser = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    // Get default pantry ID for user
    const pantryId = await exports.getOrCreateDefaultPantryId(parsedUserId);

    // Get items for that pantry
    const [rows] = await pool.query(
        `SELECT
            p.pantryItemId,
            p.pantryId,
            p.ingredientId,
            i.ingredientName,
            p.quantity,
            p.unit,
            p.expiresAt,
            p.createdAt,
            p.updatedAt
         FROM PantryItems p
         JOIN Ingredients i ON p.ingredientId = i.ingredientId
         WHERE p.pantryId = ?
         ORDER BY i.ingredientName ASC`,
        [pantryId]
    );

    return {
        success: true,
        data: rows.map(row => ({
            pantryItemId: Number(row.pantryItemId),
            pantryId: Number(row.pantryId),
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
