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
    if (!row) return null;
    return {
        userId: Number(row.userId),
        tasteVector: safeParse(row.tasteVectorJson, {}),
        recentTasteVector: safeParse(row.recentTasteVectorJson, {}),
        balanceSignals: safeParse(row.balanceSignalsJson, {}),
        profileConfidence: row.profileConfidence === null || row.profileConfidence === undefined ? null : Number(row.profileConfidence),
        lastSignalAt: row.lastSignalAt,
        computedAt: row.computedAt,
        version: Number(row.version || 1)
    };
}

exports.getByUserId = async (userId) => {
    const [rows] = await pool.query(
        `SELECT userId, tasteVectorJson, recentTasteVectorJson, balanceSignalsJson,
                profileConfidence, lastSignalAt, computedAt, version
         FROM UserTasteProfiles
         WHERE userId = ?
         LIMIT 1`,
        [userId]
    );

    return mapRow(rows[0] || null);
};

exports.upsert = async ({
    userId,
    tasteVector = {},
    recentTasteVector = {},
    balanceSignals = {},
    profileConfidence = null,
    lastSignalAt = null,
    version = 1
}) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    await pool.query(
        `INSERT INTO UserTasteProfiles (
            userId,
            tasteVectorJson,
            recentTasteVectorJson,
            balanceSignalsJson,
            profileConfidence,
            lastSignalAt,
            computedAt,
            version
        ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
        ON DUPLICATE KEY UPDATE
            tasteVectorJson = VALUES(tasteVectorJson),
            recentTasteVectorJson = VALUES(recentTasteVectorJson),
            balanceSignalsJson = VALUES(balanceSignalsJson),
            profileConfidence = VALUES(profileConfidence),
            lastSignalAt = VALUES(lastSignalAt),
            computedAt = CURRENT_TIMESTAMP,
            version = VALUES(version)`,
        [
            parsedUserId,
            JSON.stringify(tasteVector || {}),
            JSON.stringify(recentTasteVector || {}),
            JSON.stringify(balanceSignals || {}),
            profileConfidence,
            lastSignalAt,
            Number(version || 1)
        ]
    );

    return this.getByUserId(parsedUserId);
};
