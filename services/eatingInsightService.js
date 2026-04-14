const userEatingInsightModel = require('../models/userEatingInsightModel');
const { enrichInsightMessages } = require('./aiRecommendationEnrichmentService');

function generateInsightsFromProfile(profile) {
    const recent = profile?.recentTasteVector || {};
    const balance = profile?.balanceSignals || {};
    const insights = [];

    if (balance.heavyWeekDetected) {
        insights.push({
            insightType: 'weekly_pattern',
            title: 'Recent meals are relatively heavy',
            message: 'You have recently leaned toward heavier or oilier dishes. A lighter option may fit better today.',
            priority: 9,
            meta: {
                heavyMealStreakScore: balance.heavyMealStreakScore,
                lightMealNeedScore: balance.lightMealNeedScore
            }
        });
    }

    if (balance.lowVegetablePattern || Number(balance.vegetableRecoveryNeedScore || 0) >= 0.6) {
        insights.push({
            insightType: 'balance_alert',
            title: 'Recent meals could use more vegetables',
            message: 'Your recent meal pattern appears low in vegetable-forward dishes. A more balanced choice may fit well now.',
            priority: 8,
            meta: {
                vegetableRecoveryNeedScore: balance.vegetableRecoveryNeedScore,
                vegetableAffinityRecent: recent.vegetable || 0
            }
        });
    }

    if (Number(recent.seafood || 0) >= 0.55) {
        insights.push({
            insightType: 'habit_summary',
            title: 'You often choose seafood-based dishes',
            message: 'Seafood appears frequently in your recent preferences, so similar recipes may fit you well.',
            priority: 6,
            meta: {
                recentSeafoodAffinity: recent.seafood
            }
        });
    }

    if (Number(recent.spicy || 0) >= 0.6) {
        insights.push({
            insightType: 'habit_summary',
            title: 'You recently prefer spicy dishes',
            message: 'Spicy dishes show up often in your recent pattern, though balance logic may sometimes favor gentler options.',
            priority: 5,
            meta: {
                recentSpicyAffinity: recent.spicy
            }
        });
    }

    return insights.slice(0, 5);
}

async function refreshInsightsForUser(userId, profile) {
    const insights = generateInsightsFromProfile(profile);
    const enrichedInsights = await enrichInsightMessages(insights, profile);
    return userEatingInsightModel.replaceInsightsForUser(userId, enrichedInsights);
}

module.exports = {
    generateInsightsFromProfile,
    refreshInsightsForUser
};
