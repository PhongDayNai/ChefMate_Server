const userEatingSignalModel = require('../models/userEatingSignalModel');
const { SIGNAL_WEIGHTS } = require('./recommendationConstants');
const { recomputeUserTasteProfile } = require('./userTasteAggregationService');
const { refreshInsightsForUser } = require('./eatingInsightService');

const STRONG_SIGNALS_FOR_IMMEDIATE_REFRESH = new Set([
    'cook_started',
    'cook_completed',
    'cook_abandoned',
    'recommendation_accept',
    'feedback_positive',
    'feedback_negative',
    'feedback_too_spicy',
    'feedback_too_oily',
    'feedback_too_heavy',
    'feedback_light_preferred'
]);

function triggerProfileRefreshBestEffort(userId, signalType) {
    if (!STRONG_SIGNALS_FOR_IMMEDIATE_REFRESH.has(String(signalType || '').trim())) {
        return;
    }

    Promise.resolve()
        .then(() => recomputeUserTasteProfile(userId))
        .then(profile => refreshInsightsForUser(userId, profile))
        .catch((error) => {
            console.error('Best-effort profile refresh after signal failed:', error.message);
        });
}

async function appendSignal({ userId, recipeId = null, signalType, source = 'app', context = null, signalWeight = null }) {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0 || !signalType) {
        return false;
    }

    const finalWeight = signalWeight === null || signalWeight === undefined
        ? Number(SIGNAL_WEIGHTS[signalType] || 1)
        : Number(signalWeight || 1);

    try {
        await userEatingSignalModel.appendSignal({
            userId: parsedUserId,
            recipeId,
            signalType,
            signalWeight: finalWeight,
            source,
            context
        });

        triggerProfileRefreshBestEffort(parsedUserId, signalType);
        return true;
    } catch (error) {
        console.error('Best-effort user signal append failed:', error.message);
        return false;
    }
}

module.exports = {
    appendSignal
};
