const { getPersonalizedRecommendations } = require('../services/recommendationScoringService');
const { appendSignal } = require('../services/userSignalService');

exports.getPersonalizedRecommendations = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const context = String(req.query.context || req.body?.context || 'normal');
    const limit = Number(req.query.limit || req.body?.limit || 10);

    if (!userId || userId <= 0) {
        return res.status(400).json({ success: false, data: null, message: 'userId is required' });
    }

    try {
        const result = await getPersonalizedRecommendations({ userId, context, limit });

        appendSignal({
            userId,
            recipeId: null,
            signalType: 'recommendation_impression',
            source: 'app',
            context: { context, count: result.items.length }
        });

        return res.status(200).json({
            success: true,
            data: {
                context,
                profileConfidence: Number(result.userProfile?.profileConfidence || 0),
                recentPattern: result.userProfile?.balanceSignals || {},
                items: result.items
            },
            message: 'Get personalized recommendations successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: null, message: 'Failed to get personalized recommendations' });
    }
};

exports.submitRecommendationFeedback = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const recipeId = Number(req.body?.recipeId || 0);
    const feedbackType = String(req.body?.feedbackType || '').trim();

    const allowedMap = {
        positive: 'feedback_positive',
        negative: 'feedback_negative',
        too_spicy: 'feedback_too_spicy',
        too_oily: 'feedback_too_oily',
        too_heavy: 'feedback_too_heavy',
        light_preferred: 'feedback_light_preferred',
        accept: 'recommendation_accept',
        click: 'recommendation_click'
    };

    if (!userId || userId <= 0 || !recipeId || recipeId <= 0 || !allowedMap[feedbackType]) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId, recipeId, and a valid feedbackType are required'
        });
    }

    try {
        await appendSignal({
            userId,
            recipeId,
            signalType: allowedMap[feedbackType],
            source: 'app',
            context: { feedbackType }
        });

        return res.status(200).json({
            success: true,
            data: { recipeId, feedbackType },
            message: 'Recommendation feedback captured successfully'
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, data: null, message: 'Failed to capture recommendation feedback' });
    }
};
