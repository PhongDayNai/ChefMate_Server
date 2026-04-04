const { pool } = require('../config/dbConfig');

exports.getAllUsers = async () => {
    const [rows] = await pool.query(
        'SELECT userId, fullName, gender, phone, email, followCount, recipeCount, createdAt FROM Users'
    );

    return {
        success: true,
        data: rows,
        message: 'Get all users successfully'
    };
};

exports.createUser = async (fullName, phone, email, passwordHash, gender = 'unknown') => {
    const normalizedGender = ['male', 'female', 'other', 'unknown'].includes(String(gender || '').toLowerCase())
        ? String(gender).toLowerCase()
        : 'unknown';

    const [result] = await pool.query(
        'INSERT INTO Users (fullName, gender, phone, email, passwordHash) VALUES (?, ?, ?, ?, ?)',
        [fullName, normalizedGender, phone, email, passwordHash]
    );

    return {
        success: true,
        data: { userId: result.insertId },
        message: 'User created successfully'
    };
};

exports.resetPassword = async (phone, passwordHash) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            'UPDATE Users SET passwordHash = ? WHERE phone = ?',
            [passwordHash, phone]
        );

        await conn.commit();

        const user = await this.getUserByPhone(phone);
        return {
            success: true,
            data: user,
            message: 'Reset password successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.changePassword = async (phone, passwordHash) => {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query(
            'UPDATE Users SET passwordHash = ? WHERE phone = ?',
            [passwordHash, phone]
        );

        await conn.commit();

        const user = await this.getUserByPhone(phone);
        return {
            success: true,
            data: user,
            message: 'Change password successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.getPasswordHash = async (phone) => {
    const [rows] = await pool.query(
        'SELECT passwordHash FROM Users WHERE phone = ?',
        [phone]
    );

    return rows.length > 0 ? rows[0].passwordHash : null;
};

exports.getUserByPhone = async (phone) => {
    const [rows] = await pool.query(
        'SELECT * FROM Users WHERE phone = ?',
        [phone]
    );

    return rows.length > 0 ? rows[0] : null;
};

exports.getUserByIdentifier = async (identifier) => {
    const [rows] = await pool.query(
        'SELECT * FROM Users WHERE phone = ? OR email = ?',
        [identifier, identifier]
    );

    return rows.length > 0 ? rows[0] : null;
};

exports.getUserById = async (userId) => {
    const [rows] = await pool.query(
        'SELECT * FROM Users WHERE userId = ? LIMIT 1',
        [userId]
    );

    return rows.length > 0 ? rows[0] : null;
};

exports.updateUserInformation = async (userId, fullName, phone, email, gender = null) => {
    const existingPhone = await this.getUserByPhone(phone);

    if (existingPhone !== null && Number(existingPhone.userId) !== Number(userId)) {
        return {
            success: false,
            data: null,
            message: 'This phone is already exist'
        };
    }

    const normalizedGender = gender === null || gender === undefined
        ? null
        : (['male', 'female', 'other', 'unknown'].includes(String(gender || '').toLowerCase())
            ? String(gender).toLowerCase()
            : 'unknown');

    if (normalizedGender === null) {
        await pool.query(
            'UPDATE Users SET fullName = ?, phone = ?, email = ? WHERE userId = ?',
            [fullName, phone, email, userId]
        );
    } else {
        await pool.query(
            'UPDATE Users SET fullName = ?, phone = ?, email = ?, gender = ? WHERE userId = ?',
            [fullName, phone, email, normalizedGender, userId]
        );
    }

    const user = await this.getUserByPhone(phone);
    if (!user) {
        return {
            success: false,
            data: null,
            message: 'User not found after update'
        };
    }

    const { passwordHash, ...safeUser } = user;

    return {
        success: true,
        data: safeUser,
        message: 'Update user information successfully'
    };
};

// Keep backward compatibility for typo used in controller
exports.updateUserInforamtion = exports.updateUserInformation;

exports.getRecipesViewHistory = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const [rows] = await pool.query(
        `SELECT 
            r.recipeId,
            r.recipeName,
            r.image,
            r.cookingTime,
            r.ration,
            r.viewCount,
            r.likeQuantity,
            r.createdAt,
            u.fullName AS userName
         FROM Recipes r
         JOIN Users u ON r.userId = u.userId
         WHERE r.userId = ?
         ORDER BY r.viewCount DESC, r.createdAt DESC`,
        [parsedUserId]
    );

    return {
        success: true,
        data: rows,
        message: 'Get recipes view history successfully'
    };
};
