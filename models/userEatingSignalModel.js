const { pool } = require('../config/dbConfig');

exports.findRecentDuplicateSignal = async ({
    userId,
    recipeId = null,
    signalType,
    source = 'app',
    windowSeconds = 120
}) => {
    const parsedUserId = Number(userId);
    const parsedRecipeId = recipeId === null || recipeId === undefined ? null : Number(recipeId);
    const [rows] = await pool.query(
        `SELECT signalId, createdAt
         FROM UserEatingSignals
         WHERE userId = ?
           AND ((recipeId IS NULL AND ? IS NULL) OR recipeId = ?)
           AND signalType = ?
           AND source = ?
           AND createdAt >= (NOW() - INTERVAL ? SECOND)
         ORDER BY signalId DESC
         LIMIT 1`,
        [
            parsedUserId,
            parsedRecipeId && parsedRecipeId > 0 ? parsedRecipeId : null,
            parsedRecipeId && parsedRecipeId > 0 ? parsedRecipeId : null,
            signalType,
            source,
            Number(windowSeconds || 120)
        ]
    );

    return rows[0] || null;
};

exports.appendSignal = async ({
    userId,
    recipeId = null,
    signalType,
    signalWeight = 1,
    source = 'app',
    context = null
}) => {
    const parsedUserId = Number(userId);
    const parsedRecipeId = recipeId === null || recipeId === undefined ? null : Number(recipeId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    await pool.query(
        `INSERT INTO UserEatingSignals (userId, recipeId, signalType, signalWeight, source, contextJson)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
            parsedUserId,
            parsedRecipeId && parsedRecipeId > 0 ? parsedRecipeId : null,
            signalType,
            Number(signalWeight || 1),
            source,
            context ? JSON.stringify(context) : null
        ]
    );

    return true;
};

exports.listSignalsByUser = async (userId, { limit = 200 } = {}) => {
    const parsedUserId = Number(userId);
    const parsedLimit = Math.min(Math.max(Number(limit) || 200, 1), 1000);

    const [rows] = await pool.query(
        `SELECT signalId, userId, recipeId, signalType, signalWeight, source, contextJson, createdAt
         FROM UserEatingSignals
         WHERE userId = ?
         ORDER BY createdAt DESC, signalId DESC
         LIMIT ?`,
        [parsedUserId, parsedLimit]
    );

    return rows.map(row => ({
        signalId: Number(row.signalId),
        userId: Number(row.userId),
        recipeId: row.recipeId === null || row.recipeId === undefined ? null : Number(row.recipeId),
        signalType: row.signalType,
        signalWeight: Number(row.signalWeight || 0),
        source: row.source,
        context: safeParse(row.contextJson, null),
        createdAt: row.createdAt
    }));
};

function safeParse(value, fallback) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}
