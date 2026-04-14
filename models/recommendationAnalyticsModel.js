const { pool } = require('../config/dbConfig');

exports.getFeedbackSummaryByUser = async (userId, { days = 30 } = {}) => {
    const parsedUserId = Number(userId);
    const parsedDays = Math.min(Math.max(Number(days) || 30, 1), 365);

    const [rows] = await pool.query(
        `SELECT signalType, COUNT(*) AS total
         FROM UserEatingSignals
         WHERE userId = ?
           AND signalType IN (
             'recommendation_impression',
             'recommendation_click',
             'recommendation_accept',
             'recommendation_ignore',
             'feedback_positive',
             'feedback_negative',
             'feedback_too_spicy',
             'feedback_too_oily',
             'feedback_too_heavy',
             'feedback_light_preferred'
           )
           AND createdAt >= (NOW() - INTERVAL ? DAY)
         GROUP BY signalType`,
        [parsedUserId, parsedDays]
    );

    const summary = rows.reduce((acc, row) => {
        acc[row.signalType] = Number(row.total || 0);
        return acc;
    }, {});

    const impressions = Number(summary.recommendation_impression || 0);
    const clicks = Number(summary.recommendation_click || 0);
    const accepts = Number(summary.recommendation_accept || 0);
    const ignores = Number(summary.recommendation_ignore || 0);

    return {
        windowDays: parsedDays,
        counts: {
            recommendation_impression: impressions,
            recommendation_click: clicks,
            recommendation_accept: accepts,
            recommendation_ignore: ignores,
            feedback_positive: Number(summary.feedback_positive || 0),
            feedback_negative: Number(summary.feedback_negative || 0),
            feedback_too_spicy: Number(summary.feedback_too_spicy || 0),
            feedback_too_oily: Number(summary.feedback_too_oily || 0),
            feedback_too_heavy: Number(summary.feedback_too_heavy || 0),
            feedback_light_preferred: Number(summary.feedback_light_preferred || 0)
        },
        ratios: {
            clickThroughRate: impressions > 0 ? Number((clicks / impressions).toFixed(4)) : 0,
            acceptRate: impressions > 0 ? Number((accepts / impressions).toFixed(4)) : 0,
            ignoreRate: impressions > 0 ? Number((ignores / impressions).toFixed(4)) : 0
        }
    };
};
