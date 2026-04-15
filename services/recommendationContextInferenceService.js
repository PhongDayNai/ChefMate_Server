function inferAutoContext({ userProfile, pantryItems = [], recentSignals = [] }) {
    const balanceSignals = userProfile?.balanceSignals || {};
    const recentTaste = userProfile?.recentTasteVector || {};

    let pantryBias = 0;
    let quickMealBias = 0;
    let lightBias = 0;
    let balanceRecoveryBias = 0;
    const reasons = [];

    const nearExpiryCount = (pantryItems || []).filter(item => {
        if (!item?.expiresAt) return false;
        const days = (new Date(item.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
        return days >= 0 && days <= 3;
    }).length;

    if ((pantryItems || []).length >= 5) pantryBias += 0.25;
    if (nearExpiryCount >= 2) {
        pantryBias += 0.5;
        reasons.push('pantry has multiple near-expiration items');
    }

    if (Number(balanceSignals.heavyWeekDetected ? 1 : 0) > 0) {
        lightBias += 0.55;
        balanceRecoveryBias += 0.65;
        reasons.push('recent meal pattern is relatively heavy');
    }

    if (Number(balanceSignals.oilinessOverloadScore || 0) >= 0.55) {
        lightBias += 0.35;
        balanceRecoveryBias += 0.25;
        reasons.push('recent meals appear somewhat oily');
    }

    if (Number(balanceSignals.spicyOverloadScore || 0) >= 0.55) {
        lightBias += 0.15;
        reasons.push('recent meals appear somewhat spicy');
    }

    if (Number(recentTaste.quick_meal || 0) >= 0.5) {
        quickMealBias += 0.4;
        reasons.push('recent behavior suggests preference for quicker meals');
    }

    const recentCookSignals = (recentSignals || []).filter(signal => ['cook_started', 'cook_completed'].includes(signal.signalType));
    if (recentCookSignals.length === 0) {
        quickMealBias += 0.15;
    }

    const candidates = [
        { context: 'after_heavy_week', score: balanceRecoveryBias },
        { context: 'light', score: lightBias },
        { context: 'pantry_first', score: pantryBias },
        { context: 'quick_meal', score: quickMealBias },
        { context: 'normal', score: 0.1 }
    ].sort((a, b) => b.score - a.score);

    const top = candidates[0];
    const appliedContext = top.score >= 0.35 ? top.context : 'normal';

    return {
        mode: 'auto',
        context: appliedContext,
        biases: {
            pantryBias: Number(pantryBias.toFixed(2)),
            quickMealBias: Number(quickMealBias.toFixed(2)),
            lightBias: Number(lightBias.toFixed(2)),
            balanceRecoveryBias: Number(balanceRecoveryBias.toFixed(2))
        },
        reasons: Array.from(new Set(reasons)).slice(0, 4)
    };
}

function resolveContext({ requestedContext, userProfile, pantryItems = [], recentSignals = [] }) {
    const normalized = String(requestedContext || '').trim();
    if (normalized) {
        return {
            mode: 'manual',
            context: normalized,
            biases: null,
            reasons: ['client provided explicit context override']
        };
    }

    return inferAutoContext({ userProfile, pantryItems, recentSignals });
}

module.exports = {
    inferAutoContext,
    resolveContext
};
