const { pool } = require('../config/dbConfig');

function safeParse(value, fallback) {
    if (!value) return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function mapRow(row) {
    return {
        insightId: Number(row.insightId),
        userId: Number(row.userId),
        insightType: row.insightType,
        title: row.title,
        message: row.message,
        priority: Number(row.priority || 0),
        meta: safeParse(row.metaJson, null),
        validFrom: row.validFrom,
        validUntil: row.validUntil,
        generatedAt: row.generatedAt
    };
}

exports.replaceInsightsForUser = async (userId, insights = []) => {
    const parsedUserId = Number(userId);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM UserEatingInsights WHERE userId = ?', [parsedUserId]);

        for (const insight of insights) {
            await conn.query(
                `INSERT INTO UserEatingInsights (
                    userId, insightType, title, message, priority, metaJson, validFrom, validUntil
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    parsedUserId,
                    insight.insightType,
                    insight.title,
                    insight.message,
                    Number(insight.priority || 0),
                    insight.meta ? JSON.stringify(insight.meta) : null,
                    insight.validFrom || new Date(),
                    insight.validUntil || null
                ]
            );
        }

        await conn.commit();
        return this.listActiveInsightsByUser(parsedUserId);
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.listActiveInsightsByUser = async (userId, { limit = 10 } = {}) => {
    const parsedUserId = Number(userId);
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 50);
    const [rows] = await pool.query(
        `SELECT insightId, userId, insightType, title, message, priority, metaJson, validFrom, validUntil, generatedAt
         FROM UserEatingInsights
         WHERE userId = ?
           AND (validUntil IS NULL OR validUntil >= NOW())
         ORDER BY priority DESC, generatedAt DESC
         LIMIT ?`,
        [parsedUserId, parsedLimit]
    );

    return rows.map(mapRow);
};
