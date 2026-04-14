const { pool } = require('../config/dbConfig');

exports.createSnapshot = async ({ userId, requestContext, inputMeta = null, output = null }) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    await pool.query(
        `INSERT INTO RecommendationSnapshots (userId, requestContext, inputMetaJson, outputJson)
         VALUES (?, ?, ?, ?)`,
        [
            parsedUserId,
            String(requestContext || 'normal'),
            inputMeta ? JSON.stringify(inputMeta) : null,
            JSON.stringify(output || {})
        ]
    );

    return true;
};
