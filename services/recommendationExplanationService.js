function normalizeReason(text) {
    return String(text || '').trim();
}

function buildExplanationPayload({ recipe, recommendation, userProfile, profile, context = 'normal' }) {
    const reasons = Array.isArray(recommendation?.reasons)
        ? recommendation.reasons.map(normalizeReason).filter(Boolean)
        : [];

    return {
        recipeId: Number(recipe?.recipeId || recommendation?.recipeId || 0),
        recipeName: recipe?.recipeName || recommendation?.recipeName || null,
        context,
        recommendationType: recommendation?.recommendationType || null,
        reasons,
        score: Number(recommendation?.score || 0),
        scoreBreakdown: recommendation?.scoreBreakdown || {},
        fitDimensions: {
            flavor: profile?.flavor || {},
            cookingMethods: profile?.cookingMethods || {},
            nutritionSignals: profile?.nutritionSignals || {}
        },
        userProfileSummary: {
            confidence: Number(userProfile?.profileConfidence || 0),
            balanceSignals: userProfile?.balanceSignals || {},
            recentTasteVector: userProfile?.recentTasteVector || {}
        }
    };
}

module.exports = {
    buildExplanationPayload
};
