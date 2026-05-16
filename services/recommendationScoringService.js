const userDietModel = require('../models/userDietModel');
const pantryModel = require('../models/pantryModel');
const recipeProfileModel = require('../models/recipeProfileModel');
const recipeModel = require('../models/recipeModel');
const recommendationSnapshotModel = require('../models/recommendationSnapshotModel');
const userEatingSignalModel = require('../models/userEatingSignalModel');
const { getOrRefreshUserTasteProfile } = require('./userTasteAggregationService');
const { refreshInsightsForUser } = require('./eatingInsightService');
const { buildExplanationPayload } = require('./recommendationExplanationService');
const { resolveContext } = require('./recommendationContextInferenceService');

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value || 0)));
}

function normalizeText(value) {
    return String(value || '').toLowerCase();
}

function mergeDimensions(profile) {
    return {
        ...(profile?.flavor || {}),
        ...(profile?.cookingMethods || {}),
        ...(profile?.nutritionSignals || {})
    };
}

function scorePreference(profileVector, recipeDimensions) {
    const keys = Object.keys(profileVector || {});
    if (keys.length === 0) return 0;
    let score = 0;
    let count = 0;

    for (const key of keys) {
        const userValue = Number(profileVector[key] || 0);
        const recipeValue = Number(recipeDimensions[key] || 0);
        if (userValue <= 0 && recipeValue <= 0) continue;
        score += Math.min(userValue, recipeValue);
        count += 1;
    }

    return count > 0 ? (score / count) * 4 : 0;
}

function scoreBalance(balanceSignals, recipeDimensions, context) {
    let score = 0;

    if (balanceSignals.heavyWeekDetected || context === 'after_heavy_week' || context === 'light') {
        score += Number(recipeDimensions.light || 0) * 1.8;
        score += Number(recipeDimensions.vegetable || 0) * 1.4;
        score += Number(recipeDimensions.soup || 0) * 0.8;
        score -= Number(recipeDimensions.heavy || 0) * 1.2;
        score -= Number(recipeDimensions.oiliness || 0) * 1.1;
    }

    if (Number(balanceSignals.spicyOverloadScore || 0) >= 0.6) {
        score -= Number(recipeDimensions.spicy || 0) * 0.9;
    }

    if (Number(balanceSignals.oilinessOverloadScore || 0) >= 0.6) {
        score -= Number(recipeDimensions.oiliness || 0) * 0.8;
        score += Number(recipeDimensions.light || 0) * 0.4;
    }

    return clamp(score, -3, 3);
}

function scorePantry(recipe, pantryItems) {
    const ingredients = recipe.ingredients || [];
    if (ingredients.length === 0) return { score: 0, usedAvailableCount: 0, nearExpiryCount: 0, missingMainCount: 0, coverage: 0 };

    const pantryNames = new Map();
    for (const item of pantryItems || []) {
        pantryNames.set(normalizeText(item.ingredientName), item);
    }

    let usedAvailableCount = 0;
    let nearExpiryCount = 0;
    let missingMainCount = 0;

    for (const ingredient of ingredients) {
        const pantryItem = pantryNames.get(normalizeText(ingredient.ingredientName));
        if (pantryItem) {
            usedAvailableCount += 1;
            if (pantryItem.expiresAt) {
                const days = (new Date(pantryItem.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
                if (days >= 0 && days <= 3) nearExpiryCount += 1;
            }
        } else if (ingredient.isMain) {
            missingMainCount += 1;
        }
    }

    const coverage = usedAvailableCount / ingredients.length;
    let score = coverage * 2.5;
    score += nearExpiryCount * 0.4;
    score -= missingMainCount * 0.45;

    return {
        score: clamp(score, -2, 3),
        usedAvailableCount,
        nearExpiryCount,
        missingMainCount,
        coverage: Number(coverage.toFixed(2))
    };
}

function hasDietConflict(recipe, activeDietNotes) {
    const haystack = normalizeText([
        recipe.recipeName,
        ...(recipe.ingredients || []).map(ing => ing.ingredientName),
        ...(recipe.tags || []).map(tag => tag.tagName)
    ].join(' '));

    for (const note of activeDietNotes || []) {
        if (!['allergy', 'restriction'].includes(String(note.noteType || '').toLowerCase())) continue;
        const keywords = Array.isArray(note.keywords) ? note.keywords : [];
        const candidates = [note.label, ...keywords].filter(Boolean).map(normalizeText);
        if (candidates.some(keyword => keyword && haystack.includes(keyword))) {
            return true;
        }
    }

    return false;
}

function buildReasons({ recipeDimensions, pantryScore, balanceSignals, activeDietNotes, context, fatiguePenalty, adaptiveAdjustment }) {
    const reasons = [];
    if (Number(recipeDimensions.seafood || 0) >= 0.45) reasons.push('matches your stronger seafood preference');
    if (Number(recipeDimensions.soup || 0) >= 0.45 || Number(recipeDimensions.light || 0) >= 0.5) reasons.push('lighter than your recent meal pattern');
    if (pantryScore.usedAvailableCount > 0) reasons.push('uses ingredients currently available in your pantry');
    if (pantryScore.nearExpiryCount > 0) reasons.push('helps use pantry items that are nearing expiration');
    if ((activeDietNotes || []).length > 0) reasons.push('fits your active dietary notes');
    if (balanceSignals.heavyWeekDetected && Number(recipeDimensions.vegetable || 0) >= 0.45) reasons.push('supports a more balanced choice after several heavier dishes');
    if (context === 'quick_meal' && Number(recipeDimensions.quick_meal || 0) >= 0.45) reasons.push('fits a quicker meal context');
    if (context === 'pantry_first' && pantryScore.coverage >= 0.4) reasons.push('covers a useful portion of your pantry ingredients');
    if (fatiguePenalty > 0.2) reasons.push('rank adjusted to avoid repetition from very recent meals');
    if (adaptiveAdjustment >= 0.4) reasons.push('similar patterns have received positive feedback recently');
    if (adaptiveAdjustment <= -0.4) reasons.push('similar patterns have received weaker feedback recently');
    return Array.from(new Set(reasons)).slice(0, 4);
}

function scoreContext(recipeDimensions, pantryScore, context) {
    switch (context) {
        case 'quick_meal':
            return Number(recipeDimensions.quick_meal || 0) * 1.2;
        case 'pantry_first':
            return Math.max(0, pantryScore.score) * 0.6;
        case 'light':
            return Number(recipeDimensions.light || 0) * 1.0;
        case 'after_heavy_week':
            return (Number(recipeDimensions.light || 0) * 0.8) + (Number(recipeDimensions.vegetable || 0) * 0.5);
        default:
            return 0;
    }
}

function buildRecentRecipePenaltyMap(signals = []) {
    const penaltyMap = new Map();
    for (const signal of signals) {
        const recipeId = Number(signal.recipeId || 0);
        if (!recipeId) continue;
        const current = Number(penaltyMap.get(recipeId) || 0);
        const signalType = String(signal.signalType || '');
        let delta = 0;
        if (signalType === 'cook_completed') delta = 0.8;
        else if (signalType === 'cook_started') delta = 0.45;
        else if (signalType === 'recommendation_accept') delta = 0.35;
        else if (signalType === 'recommendation_ignore') delta = 0.2;
        else if (signalType === 'recipe_view') delta = 0.1;
        penaltyMap.set(recipeId, clamp(current + delta, 0, 1.5));
    }
    return penaltyMap;
}

function buildDimensionExposure(signals = [], profileMap = new Map()) {
    const exposure = {};
    for (const signal of signals) {
        const profile = profileMap.get(Number(signal.recipeId || 0));
        if (!profile) continue;
        const dims = mergeDimensions(profile);
        for (const [key, value] of Object.entries(dims)) {
            exposure[key] = Number(exposure[key] || 0) + Number(value || 0);
        }
    }
    return exposure;
}

function scoreDiversity(recipeDimensions, recentExposure = {}) {
    let score = 0;
    if (Number(recentExposure.heavy || 0) > 1.5) score += Number(recipeDimensions.light || 0) * 0.7;
    if (Number(recentExposure.spicy || 0) > 1.2) score += (1 - Number(recipeDimensions.spicy || 0)) * 0.4;
    if (Number(recentExposure.vegetable || 0) < 0.8) score += Number(recipeDimensions.vegetable || 0) * 0.5;
    if (Number(recentExposure.soup || 0) < 0.5) score += Number(recipeDimensions.soup || 0) * 0.3;
    return clamp(score, 0, 1.5);
}

function buildAdaptiveFeedbackProfile(signals = [], profileMap = new Map()) {
    const profile = {
        positiveDimensions: {},
        negativeDimensions: {},
        recipeAdjustments: new Map()
    };

    for (const signal of signals) {
        const recipeId = Number(signal.recipeId || 0);
        const signalType = String(signal.signalType || '');
        const recipeProfile = profileMap.get(recipeId);
        const dimensions = recipeProfile ? mergeDimensions(recipeProfile) : {};
        let recipeDelta = 0;
        let targetBucket = null;

        if (signalType === 'feedback_positive' || signalType === 'recommendation_accept' || signalType === 'cook_completed') {
            recipeDelta = signalType === 'cook_completed' ? 0.35 : 0.5;
            targetBucket = 'positiveDimensions';
        } else if (signalType === 'feedback_negative' || signalType === 'recommendation_ignore') {
            recipeDelta = -0.45;
            targetBucket = 'negativeDimensions';
        } else if (signalType === 'feedback_too_spicy') {
            profile.negativeDimensions.spicy = Number(profile.negativeDimensions.spicy || 0) + 0.8;
            recipeDelta = -0.5;
        } else if (signalType === 'feedback_too_oily') {
            profile.negativeDimensions.oiliness = Number(profile.negativeDimensions.oiliness || 0) + 0.8;
            recipeDelta = -0.5;
        } else if (signalType === 'feedback_too_heavy') {
            profile.negativeDimensions.heavy = Number(profile.negativeDimensions.heavy || 0) + 0.8;
            recipeDelta = -0.5;
        } else if (signalType === 'feedback_light_preferred') {
            profile.positiveDimensions.light = Number(profile.positiveDimensions.light || 0) + 0.7;
            recipeDelta = 0.25;
        }

        if (targetBucket) {
            for (const [key, value] of Object.entries(dimensions)) {
                profile[targetBucket][key] = Number(profile[targetBucket][key] || 0) + Number(value || 0);
            }
        }

        if (recipeId > 0 && recipeDelta !== 0) {
            const current = Number(profile.recipeAdjustments.get(recipeId) || 0);
            profile.recipeAdjustments.set(recipeId, clamp(current + recipeDelta, -1.5, 1.5));
        }
    }

    return profile;
}

function scoreAdaptiveAdjustment(recipeId, recipeDimensions, adaptiveFeedbackProfile) {
    const recipeAdjustment = Number(adaptiveFeedbackProfile.recipeAdjustments.get(Number(recipeId)) || 0);
    let dimensionAdjustment = 0;

    for (const [key, value] of Object.entries(recipeDimensions || {})) {
        dimensionAdjustment += Number(adaptiveFeedbackProfile.positiveDimensions[key] || 0) * Number(value || 0) * 0.08;
        dimensionAdjustment -= Number(adaptiveFeedbackProfile.negativeDimensions[key] || 0) * Number(value || 0) * 0.1;
    }

    return clamp(recipeAdjustment + dimensionAdjustment, -2, 2);
}

async function buildRecommendationContext(parsedUserId, pantryId = null) {
    const [recipesResult, activeDietNotes, pantryResult, userProfile, recentSignals] = await Promise.all([
        recipeModel.getAllRecipes(),
        userDietModel.getActiveDietNotes(parsedUserId),
        pantryId
            ? pantryModel.listPantryItemsByPantryIdPaginated(pantryId, parsedUserId, { page: 1, limit: 500 })
                .catch(() => ({ success: true, data: [] }))
            : pantryModel.listPantryByUser(parsedUserId)
                .catch(() => ({ success: true, data: [] })),
        getOrRefreshUserTasteProfile(parsedUserId),
        userEatingSignalModel.listSignalsByUser(parsedUserId, { limit: 100 })
    ]);

    const recipes = recipesResult?.data || [];
    const pantryItems = pantryResult?.data || [];
    const recipeIds = recipes.map(recipe => Number(recipe.recipeId));
    const profiles = await recipeProfileModel.listByRecipeIds(recipeIds);
    const profileMap = new Map(profiles.map(profile => [Number(profile.recipeId), profile]));
    const recentRecipePenaltyMap = buildRecentRecipePenaltyMap(recentSignals);
    const recentDimensionExposure = buildDimensionExposure(recentSignals, profileMap);
    const adaptiveFeedbackProfile = buildAdaptiveFeedbackProfile(recentSignals, profileMap);
    const insights = await refreshInsightsForUser(parsedUserId, userProfile);

    return {
        recipes,
        activeDietNotes,
        pantryItems,
        userProfile,
        profileMap,
        recentSignals,
        recentRecipePenaltyMap,
        recentDimensionExposure,
        adaptiveFeedbackProfile,
        insights
    };
}

async function getPersonalizedRecommendations({ userId, context = '', limit = 10, includeReasons = true, pantryId = null }) {
    const parsedUserId = Number(userId);
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const recommendationContext = await buildRecommendationContext(parsedUserId, pantryId);
    const {
        recipes,
        activeDietNotes,
        pantryItems,
        userProfile,
        profileMap,
        recentSignals,
        recentRecipePenaltyMap,
        recentDimensionExposure,
        adaptiveFeedbackProfile,
        insights
    } = recommendationContext;

    const appliedContext = resolveContext({
        requestedContext: context,
        userProfile,
        pantryItems,
        recentSignals
    });
    const effectiveContext = appliedContext.context;

    const items = [];
    for (const recipe of recipes) {
        if (hasDietConflict(recipe, activeDietNotes)) continue;
        const profile = profileMap.get(Number(recipe.recipeId));
        if (!profile) continue;

        const recipeDimensions = mergeDimensions(profile);
        const preference = scorePreference(userProfile.tasteVector || {}, recipeDimensions);
        const balance = scoreBalance(userProfile.balanceSignals || {}, recipeDimensions, effectiveContext);
        const pantryScore = scorePantry(recipe, pantryItems);
        const contextScore = scoreContext(recipeDimensions, pantryScore, effectiveContext);
        const diversity = scoreDiversity(recipeDimensions, recentDimensionExposure);
        const adaptiveAdjustment = scoreAdaptiveAdjustment(Number(recipe.recipeId), recipeDimensions, adaptiveFeedbackProfile);
        const heavyPenalty = Math.max(0, Number(recipeDimensions.heavy || 0) * (userProfile.balanceSignals?.heavyWeekDetected ? 0.9 : 0));
        const fatiguePenalty = Number(recentRecipePenaltyMap.get(Number(recipe.recipeId)) || 0);
        const finalScore = Number((preference + balance + pantryScore.score + contextScore + diversity + adaptiveAdjustment - heavyPenalty - fatiguePenalty).toFixed(2));
        const recommendationType = balance >= preference && balance > pantryScore.score
            ? 'balance_recovery'
            : pantryScore.score > preference
                ? 'pantry_optimized'
                : 'preference_match';

        items.push({
            recipeId: Number(recipe.recipeId),
            recipeName: recipe.recipeName,
            image: recipe.image,
            recommendationType,
            score: finalScore,
            reasons: includeReasons ? buildReasons({
                recipeDimensions,
                pantryScore,
                balanceSignals: userProfile.balanceSignals || {},
                activeDietNotes,
                context: effectiveContext,
                fatiguePenalty,
                adaptiveAdjustment
            }) : [],
            scoreBreakdown: {
                preference: Number(preference.toFixed(2)),
                balance: Number(balance.toFixed(2)),
                pantry: Number(pantryScore.score.toFixed(2)),
                context: Number(contextScore.toFixed(2)),
                diversity: Number(diversity.toFixed(2)),
                adaptive: Number(adaptiveAdjustment.toFixed(2)),
                penalty: Number((heavyPenalty + fatiguePenalty).toFixed(2))
            }
        });
    }

    items.sort((a, b) => b.score - a.score);
    const topItems = items.slice(0, parsedLimit).map(item => ({
        recipeId: item.recipeId,
        recipeName: item.recipeName,
        image: item.image,
        recommendationType: item.recommendationType,
        score: item.score,
        reasons: item.reasons,
        scoreBreakdown: item.scoreBreakdown
    }));

    recommendationSnapshotModel.createSnapshot({
        userId: parsedUserId,
        requestContext: effectiveContext,
        inputMeta: {
            pantryCount: pantryItems.length,
            activeDietNotesCount: activeDietNotes.length,
            recipeCandidateCount: recipes.length,
            profileConfidence: userProfile.profileConfidence,
            recentSignalCount: recommendationContext.recentSignals.length
        },
        output: {
            count: topItems.length,
            items: topItems.map(item => ({
                recipeId: item.recipeId,
                recommendationType: item.recommendationType,
                score: item.score,
                scoreBreakdown: item.scoreBreakdown
            }))
        }
    }).catch((error) => {
        console.error('Failed to save recommendation snapshot:', error.message);
    });

    return {
        context: effectiveContext,
        appliedContext,
        userProfile,
        insights,
        items: topItems
    };
}

async function explainPersonalizedRecommendation({ userId, recipeId, context = '', pantryId = null }) {
    const parsedUserId = Number(userId);
    const targetRecipeId = Number(recipeId);
    if (!targetRecipeId || targetRecipeId <= 0) {
        throw new Error('recipeId must be a positive number');
    }

    const recommendationContext = await buildRecommendationContext(parsedUserId, pantryId);
    const {
        recipes,
        activeDietNotes,
        pantryItems,
        userProfile,
        profileMap,
        recentSignals,
        recentRecipePenaltyMap,
        recentDimensionExposure,
        adaptiveFeedbackProfile
    } = recommendationContext;

    const appliedContext = resolveContext({
        requestedContext: context,
        userProfile,
        pantryItems,
        recentSignals
    });
    const effectiveContext = appliedContext.context;

    const recipe = recipes.find(item => Number(item.recipeId) === targetRecipeId) || null;
    if (!recipe || hasDietConflict(recipe, activeDietNotes)) {
        return null;
    }

    const profile = profileMap.get(targetRecipeId) || await recipeProfileModel.getByRecipeId(targetRecipeId);
    if (!profile) {
        return null;
    }

    const recipeDimensions = mergeDimensions(profile);
    const preference = scorePreference(userProfile.tasteVector || {}, recipeDimensions);
    const balance = scoreBalance(userProfile.balanceSignals || {}, recipeDimensions, effectiveContext);
    const pantryScore = scorePantry(recipe, pantryItems);
    const contextScore = scoreContext(recipeDimensions, pantryScore, effectiveContext);
    const diversity = scoreDiversity(recipeDimensions, recentDimensionExposure);
    const adaptiveAdjustment = scoreAdaptiveAdjustment(targetRecipeId, recipeDimensions, adaptiveFeedbackProfile);
    const heavyPenalty = Math.max(0, Number(recipeDimensions.heavy || 0) * (userProfile.balanceSignals?.heavyWeekDetected ? 0.9 : 0));
    const fatiguePenalty = Number(recentRecipePenaltyMap.get(targetRecipeId) || 0);
    const recommendationType = balance >= preference && balance > pantryScore.score
        ? 'balance_recovery'
        : pantryScore.score > preference
            ? 'pantry_optimized'
            : 'preference_match';

    const recommendation = {
        recipeId: targetRecipeId,
        recipeName: recipe.recipeName,
        recommendationType,
        score: Number((preference + balance + pantryScore.score + contextScore + diversity + adaptiveAdjustment - heavyPenalty - fatiguePenalty).toFixed(2)),
        reasons: buildReasons({
            recipeDimensions,
            pantryScore,
            balanceSignals: userProfile.balanceSignals || {},
            activeDietNotes,
            context: effectiveContext,
            fatiguePenalty,
            adaptiveAdjustment
        }),
        scoreBreakdown: {
            preference: Number(preference.toFixed(2)),
            balance: Number(balance.toFixed(2)),
            pantry: Number(pantryScore.score.toFixed(2)),
            context: Number(contextScore.toFixed(2)),
            diversity: Number(diversity.toFixed(2)),
            adaptive: Number(adaptiveAdjustment.toFixed(2)),
            penalty: Number((heavyPenalty + fatiguePenalty).toFixed(2))
        }
    };

    return buildExplanationPayload({
        recipe,
        recommendation,
        userProfile,
        profile,
        context: effectiveContext
    });
}

module.exports = {
    getPersonalizedRecommendations,
    explainPersonalizedRecommendation
};
