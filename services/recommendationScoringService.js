const userDietModel = require('../models/userDietModel');
const pantryModel = require('../models/pantryModel');
const recipeProfileModel = require('../models/recipeProfileModel');
const recipeModel = require('../models/recipeModel');
const recommendationSnapshotModel = require('../models/recommendationSnapshotModel');
const { getOrRefreshUserTasteProfile } = require('./userTasteAggregationService');
const { refreshInsightsForUser } = require('./eatingInsightService');

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
        score -= Number(recipeDimensions.heavy || 0) * 1.2;
        score -= Number(recipeDimensions.oiliness || 0) * 1.1;
    }

    if (Number(balanceSignals.spicyOverloadScore || 0) >= 0.6) {
        score -= Number(recipeDimensions.spicy || 0) * 0.9;
    }

    return clamp(score, -3, 3);
}

function scorePantry(recipe, pantryItems) {
    const ingredients = recipe.ingredients || [];
    if (ingredients.length === 0) return { score: 0, usedAvailableCount: 0, nearExpiryCount: 0, missingMainCount: 0 };

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
        missingMainCount
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

function buildReasons({ recipeDimensions, pantryScore, balanceSignals, activeDietNotes }) {
    const reasons = [];
    if (Number(recipeDimensions.seafood || 0) >= 0.45) reasons.push('matches your stronger seafood preference');
    if (Number(recipeDimensions.soup || 0) >= 0.45 || Number(recipeDimensions.light || 0) >= 0.5) reasons.push('lighter than your recent meal pattern');
    if (pantryScore.usedAvailableCount > 0) reasons.push('uses ingredients currently available in your pantry');
    if (pantryScore.nearExpiryCount > 0) reasons.push('helps use pantry items that are nearing expiration');
    if ((activeDietNotes || []).length > 0) reasons.push('fits your active dietary notes');
    if (balanceSignals.heavyWeekDetected && Number(recipeDimensions.vegetable || 0) >= 0.45) reasons.push('supports a more balanced choice after several heavier dishes');
    return Array.from(new Set(reasons)).slice(0, 4);
}

async function getPersonalizedRecommendations({ userId, context = 'normal', limit = 10 }) {
    const parsedUserId = Number(userId);
    const parsedLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const [recipesResult, activeDietNotes, pantryResult, userProfile] = await Promise.all([
        recipeModel.getAllRecipes(),
        userDietModel.getActiveDietNotes(parsedUserId),
        pantryModel.listPantryByUser(parsedUserId).catch(() => ({ success: true, data: [] })),
        getOrRefreshUserTasteProfile(parsedUserId)
    ]);

    await refreshInsightsForUser(parsedUserId, userProfile);

    const recipes = recipesResult?.data || [];
    const pantryItems = pantryResult?.data || [];
    const recipeIds = recipes.map(recipe => Number(recipe.recipeId));
    const profiles = await recipeProfileModel.listByRecipeIds(recipeIds);
    const profileMap = new Map(profiles.map(profile => [Number(profile.recipeId), profile]));

    const items = [];
    for (const recipe of recipes) {
        if (hasDietConflict(recipe, activeDietNotes)) continue;
        const profile = profileMap.get(Number(recipe.recipeId));
        if (!profile) continue;

        const recipeDimensions = mergeDimensions(profile);
        const preference = scorePreference(userProfile.tasteVector || {}, recipeDimensions);
        const balance = scoreBalance(userProfile.balanceSignals || {}, recipeDimensions, context);
        const pantryScore = scorePantry(recipe, pantryItems);
        const contextScore = context === 'quick_meal'
            ? Number(recipeDimensions.quick_meal || 0) * 1.2
            : context === 'pantry_first'
                ? Math.max(0, pantryScore.score) * 0.6
                : context === 'light'
                    ? Number(recipeDimensions.light || 0) * 1.0
                    : 0;
        const diversity = 0;
        const penalty = Math.max(0, Number(recipeDimensions.heavy || 0) * (userProfile.balanceSignals?.heavyWeekDetected ? 0.9 : 0));
        const finalScore = Number((preference + balance + pantryScore.score + contextScore + diversity - penalty).toFixed(2));

        items.push({
            recipeId: Number(recipe.recipeId),
            recipeName: recipe.recipeName,
            image: recipe.image,
            recommendationType: balance > preference ? 'balance_recovery' : (pantryScore.score > preference ? 'pantry_optimized' : 'preference_match'),
            score: finalScore,
            reasons: buildReasons({
                recipeDimensions,
                pantryScore,
                balanceSignals: userProfile.balanceSignals || {},
                activeDietNotes
            }),
            scoreBreakdown: {
                preference: Number(preference.toFixed(2)),
                balance: Number(balance.toFixed(2)),
                pantry: Number(pantryScore.score.toFixed(2)),
                context: Number(contextScore.toFixed(2)),
                diversity: Number(diversity.toFixed(2)),
                penalty: Number(penalty.toFixed(2))
            }
        });
    }

    items.sort((a, b) => b.score - a.score);

    const topItems = items.slice(0, parsedLimit);

    recommendationSnapshotModel.createSnapshot({
        userId: parsedUserId,
        requestContext: context,
        inputMeta: {
            pantryCount: pantryItems.length,
            activeDietNotesCount: activeDietNotes.length,
            recipeCandidateCount: recipes.length,
            profileConfidence: userProfile.profileConfidence
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
        userProfile,
        items: topItems
    };
}

module.exports = {
    getPersonalizedRecommendations
};
