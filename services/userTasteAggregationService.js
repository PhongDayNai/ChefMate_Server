const { pool } = require('../config/dbConfig');
const userTasteProfileModel = require('../models/userTasteProfileModel');
const recipeProfileModel = require('../models/recipeProfileModel');
const { PROFILE_DIMENSIONS } = require('./recommendationConstants');

function initVector() {
    return PROFILE_DIMENSIONS.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
    }, {});
}

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value || 0)));
}

function getTimeDecay(createdAt, recentOnly = false) {
    const now = Date.now();
    const time = new Date(createdAt).getTime();
    const ageDays = (now - time) / (1000 * 60 * 60 * 24);

    if (recentOnly && ageDays > 7) return 0;
    if (ageDays <= 3) return 1.0;
    if (ageDays <= 7) return 0.8;
    if (ageDays <= 30) return 0.5;
    return 0.2;
}

function mergeProfileDimensions(profile) {
    return {
        ...(profile?.flavor || {}),
        ...(profile?.cookingMethods || {}),
        ...(profile?.nutritionSignals || {})
    };
}

function normalizeVector(weighted, totalWeight) {
    const output = {};
    for (const key of PROFILE_DIMENSIONS) {
        output[key] = totalWeight > 0 ? clamp01(weighted[key] / totalWeight) : 0;
    }
    return output;
}

function computeBalanceSignals(recentVector) {
    const heavyMealStreakScore = clamp01((recentVector.heavy * 0.5) + (recentVector.oiliness * 0.35) + (recentVector.fried * 0.15));
    const lightMealNeedScore = clamp01((recentVector.heavy * 0.4) + (recentVector.oiliness * 0.3) - (recentVector.light * 0.2) + 0.2);
    const vegetableRecoveryNeedScore = clamp01(0.9 - recentVector.vegetable);
    const spicyOverloadScore = clamp01(recentVector.spicy * 0.95);
    const oilinessOverloadScore = clamp01(recentVector.oiliness * 0.95);
    const balanceNeedScore = clamp01((lightMealNeedScore * 0.35) + (vegetableRecoveryNeedScore * 0.35) + (spicyOverloadScore * 0.15) + (oilinessOverloadScore * 0.15));

    return {
        balanceNeedScore,
        lightMealNeedScore,
        vegetableRecoveryNeedScore,
        heavyMealStreakScore,
        spicyOverloadScore,
        oilinessOverloadScore,
        heavyWeekDetected: heavyMealStreakScore >= 0.55,
        lowVegetablePattern: recentVector.vegetable < 0.35
    };
}

async function loadSignals(userId, limit = 500) {
    const [rows] = await pool.query(
        `SELECT signalId, userId, recipeId, signalType, signalWeight, createdAt
         FROM UserEatingSignals
         WHERE userId = ? AND recipeId IS NOT NULL
         ORDER BY createdAt DESC, signalId DESC
         LIMIT ?`,
        [Number(userId), Number(limit)]
    );
    return rows;
}

async function recomputeUserTasteProfile(userId) {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const signals = await loadSignals(parsedUserId, 500);
    if (signals.length === 0) {
        return userTasteProfileModel.upsert({
            userId: parsedUserId,
            tasteVector: initVector(),
            recentTasteVector: initVector(),
            balanceSignals: {
                balanceNeedScore: 0,
                lightMealNeedScore: 0,
                vegetableRecoveryNeedScore: 0,
                heavyMealStreakScore: 0,
                spicyOverloadScore: 0,
                oilinessOverloadScore: 0,
                heavyWeekDetected: false,
                lowVegetablePattern: false
            },
            profileConfidence: 0,
            lastSignalAt: null,
            version: 1
        });
    }

    const recipeIds = Array.from(new Set(signals.map(s => Number(s.recipeId)).filter(id => id > 0)));
    const profiles = await recipeProfileModel.listByRecipeIds(recipeIds);
    const profileMap = new Map(profiles.map(profile => [Number(profile.recipeId), profile]));

    const weighted = initVector();
    const recentWeighted = initVector();
    let totalWeight = 0;
    let recentTotalWeight = 0;

    for (const signal of signals) {
        const profile = profileMap.get(Number(signal.recipeId));
        if (!profile) continue;

        const dimensions = mergeProfileDimensions(profile);
        const signalWeight = Number(signal.signalWeight || 1);
        const decay = getTimeDecay(signal.createdAt, false);
        const recentDecay = getTimeDecay(signal.createdAt, true);
        const effectiveWeight = Math.max(0, signalWeight) * decay;
        const recentEffectiveWeight = Math.max(0, signalWeight) * recentDecay;

        if (effectiveWeight > 0) {
            totalWeight += effectiveWeight;
            for (const key of PROFILE_DIMENSIONS) {
                weighted[key] += Number(dimensions[key] || 0) * effectiveWeight;
            }
        }

        if (recentEffectiveWeight > 0) {
            recentTotalWeight += recentEffectiveWeight;
            for (const key of PROFILE_DIMENSIONS) {
                recentWeighted[key] += Number(dimensions[key] || 0) * recentEffectiveWeight;
            }
        }
    }

    const tasteVector = normalizeVector(weighted, totalWeight);
    const recentTasteVector = normalizeVector(recentWeighted, recentTotalWeight);
    const balanceSignals = computeBalanceSignals(recentTasteVector);
    const signalCountFactor = Math.min(signals.length / 20, 1);
    const recentSignalFactor = Math.min(signals.filter(s => getTimeDecay(s.createdAt, true) > 0).length / 10, 1);
    const profileConfidence = clamp01((signalCountFactor * 0.65) + (recentSignalFactor * 0.35));
    const lastSignalAt = signals[0]?.createdAt || null;

    return userTasteProfileModel.upsert({
        userId: parsedUserId,
        tasteVector,
        recentTasteVector,
        balanceSignals,
        profileConfidence,
        lastSignalAt,
        version: 1
    });
}

async function getOrRefreshUserTasteProfile(userId, { maxAgeHours = 12 } = {}) {
    const existing = await userTasteProfileModel.getByUserId(userId);
    if (!existing?.computedAt) {
        return recomputeUserTasteProfile(userId);
    }

    const ageMs = Date.now() - new Date(existing.computedAt).getTime();
    if (ageMs > Number(maxAgeHours || 12) * 60 * 60 * 1000) {
        return recomputeUserTasteProfile(userId);
    }

    return existing;
}

module.exports = {
    recomputeUserTasteProfile,
    getOrRefreshUserTasteProfile
};
