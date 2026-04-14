const { getOrRefreshUserTasteProfile } = require('../services/userTasteAggregationService');
const userEatingInsightModel = require('../models/userEatingInsightModel');
const { refreshInsightsForUser } = require('../services/eatingInsightService');

exports.getMyEatingProfile = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    if (!userId || userId <= 0) {
        return res.status(400).json({ success: false, data: null, message: 'userId is required' });
    }

    try {
        const profile = await getOrRefreshUserTasteProfile(userId);
        return res.status(200).json({
            success: true,
            data: {
                tasteProfile: profile.tasteVector || {},
                recentPattern: profile.balanceSignals || {},
                recentTasteProfile: profile.recentTasteVector || {},
                confidence: Number(profile.profileConfidence || 0),
                computedAt: profile.computedAt
            },
            message: 'Get eating profile successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: null, message: 'Failed to get eating profile' });
    }
};

exports.getMyEatingInsights = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    if (!userId || userId <= 0) {
        return res.status(400).json({ success: false, data: null, message: 'userId is required' });
    }

    try {
        const profile = await getOrRefreshUserTasteProfile(userId);
        const insights = await refreshInsightsForUser(userId, profile);
        return res.status(200).json({
            success: true,
            data: insights.map(item => ({
                type: item.insightType,
                title: item.title,
                message: item.message,
                priority: item.priority,
                meta: item.meta
            })),
            message: 'Get eating insights successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: null, message: 'Failed to get eating insights' });
    }
};
