const recipeProfileModel = require('../models/recipeProfileModel');
const { PROFILE_DIMENSIONS } = require('./recommendationConstants');
const { enrichRecipeProfileWithAI } = require('./aiRecommendationEnrichmentService');

const KEYWORDS = {
    spicy: ['ớt', 'sa tế', 'cay', 'tiêu xanh', 'tiêu đen', 'kim chi'],
    salty: ['nước mắm', 'mắm', 'xì dầu', 'muối', 'nước tương'],
    sweet: ['đường', 'mật ong', 'sữa đặc', 'caramel'],
    sour: ['chanh', 'me', 'giấm', 'sấu', 'khế', 'dứa'],
    fried: ['chiên', 'rán', 'fried', 'deep fry'],
    stir_fried: ['xào', 'stir fry', 'stir-fry'],
    boiled: ['luộc', 'boil', 'boiled'],
    steamed: ['hấp', 'steam', 'steamed'],
    soup: ['canh', 'súp', 'soup', 'cháo', 'lẩu'],
    grilled: ['nướng', 'grill', 'grilled'],
    vegetable: ['rau', 'cải', 'bắp cải', 'xà lách', 'cà chua', 'bí', 'nấm', 'đậu hũ', 'đậu phụ'],
    seafood: ['tôm', 'cua', 'cá', 'mực', 'nghêu', 'sò', 'seafood', 'salmon'],
    red_meat: ['bò', 'heo', 'lợn', 'cừu', 'thịt ba chỉ'],
    plant_protein: ['đậu hũ', 'đậu phụ', 'đậu nành', 'đậu gà', 'đậu lăng'],
    light: ['luộc', 'hấp', 'canh', 'súp', 'salad', 'thanh đạm', 'nhẹ'],
    heavy: ['chiên', 'rán', 'xào', 'nướng', 'bơ', 'phô mai', 'kem'],
    quick_meal: ['nhanh', 'quick', '15 phút', '20 phút']
};

function clamp01(value) {
    return Math.max(0, Math.min(1, Number(value || 0)));
}

function normalizedHaystack(recipe) {
    const recipeName = String(recipe.recipeName || '').toLowerCase();
    const tags = (recipe.tags || []).map(tag => String(tag.tagName || tag || '').toLowerCase()).join(' ');
    const ingredients = (recipe.ingredients || []).map(ing => String(ing.ingredientName || '').toLowerCase()).join(' ');
    const steps = (recipe.cookingSteps || []).map(step => String(step.stepContent || step.content || '').toLowerCase()).join(' ');
    return `${recipeName} ${tags} ${ingredients} ${steps}`.trim();
}

function countKeywordHits(text, keywords = []) {
    return keywords.reduce((count, keyword) => count + (text.includes(String(keyword).toLowerCase()) ? 1 : 0), 0);
}

function inferCookingMethods(text) {
    const methods = {
        fried: 0,
        stir_fried: 0,
        boiled: 0,
        steamed: 0,
        soup: 0,
        grilled: 0
    };

    for (const key of Object.keys(methods)) {
        methods[key] = clamp01(countKeywordHits(text, KEYWORDS[key] || []) * 0.5);
    }

    return methods;
}

function inferFlavor(text, methods) {
    const spicy = clamp01(countKeywordHits(text, KEYWORDS.spicy) * 0.35);
    const salty = clamp01(countKeywordHits(text, KEYWORDS.salty) * 0.25);
    const sweet = clamp01(countKeywordHits(text, KEYWORDS.sweet) * 0.3);
    const sour = clamp01(countKeywordHits(text, KEYWORDS.sour) * 0.3);
    const light = clamp01((countKeywordHits(text, KEYWORDS.light) * 0.25) + (methods.boiled * 0.3) + (methods.steamed * 0.35) + (methods.soup * 0.3));
    const heavy = clamp01((countKeywordHits(text, KEYWORDS.heavy) * 0.25) + (methods.fried * 0.4) + (methods.stir_fried * 0.2) + (methods.grilled * 0.2));
    const oiliness = clamp01((methods.fried * 0.8) + (methods.stir_fried * 0.35) + (heavy * 0.25));

    return { spicy, salty, sweet, sour, light, heavy, oiliness };
}

function inferNutritionSignals(text, flavor, methods) {
    const vegetable = clamp01((countKeywordHits(text, KEYWORDS.vegetable) * 0.2) + (flavor.light * 0.2));
    const seafood = clamp01(countKeywordHits(text, KEYWORDS.seafood) * 0.35);
    const red_meat = clamp01(countKeywordHits(text, KEYWORDS.red_meat) * 0.35);
    const plant_protein = clamp01(countKeywordHits(text, KEYWORDS.plant_protein) * 0.45);
    const quick_meal = clamp01((countKeywordHits(text, KEYWORDS.quick_meal) * 0.35) + (flavor.light * 0.1));

    return {
        vegetable,
        seafood,
        red_meat,
        plant_protein,
        quick_meal,
        oiliness: flavor.oiliness,
        heavy: flavor.heavy,
        light: flavor.light,
        fried: methods.fried,
        stir_fried: methods.stir_fried,
        boiled: methods.boiled,
        steamed: methods.steamed,
        soup: methods.soup,
        grilled: methods.grilled,
        spicy: flavor.spicy,
        salty: flavor.salty,
        sweet: flavor.sweet,
        sour: flavor.sour
    };
}

function inferMealContexts(text, flavor, methods, nutritionSignals) {
    return {
        breakfast: clamp01(text.includes('bữa sáng') || text.includes('breakfast') ? 1 : 0),
        lunch: clamp01(text.includes('bữa trưa') || text.includes('lunch') ? 1 : 0.2),
        dinner: clamp01(text.includes('bữa tối') || text.includes('dinner') ? 1 : 0.3),
        light: clamp01(flavor.light),
        quick_meal: clamp01(nutritionSignals.quick_meal),
        weekend: clamp01(methods.grilled * 0.4 + flavor.heavy * 0.2)
    };
}

function inferWellnessFlags(flavor, nutritionSignals) {
    return {
        light_meal_friendly: flavor.light >= 0.45,
        heavy_meal: flavor.heavy >= 0.55,
        vegetable_forward: nutritionSignals.vegetable >= 0.45,
        seafood_forward: nutritionSignals.seafood >= 0.45,
        easy_digestion: flavor.light >= 0.55 && flavor.oiliness <= 0.35
    };
}

function buildProfileFromRecipe(recipe) {
    const text = normalizedHaystack(recipe);
    const cookingMethods = inferCookingMethods(text);
    const flavor = inferFlavor(text, cookingMethods);
    const nutritionSignals = inferNutritionSignals(text, flavor, cookingMethods);
    const mealContexts = inferMealContexts(text, flavor, cookingMethods, nutritionSignals);
    const wellnessFlags = inferWellnessFlags(flavor, nutritionSignals);

    const matchedDimensions = PROFILE_DIMENSIONS.filter(dim => {
        if (flavor[dim] >= 0.2) return true;
        if (cookingMethods[dim] >= 0.2) return true;
        if (nutritionSignals[dim] >= 0.2) return true;
        return false;
    }).length;

    const confidenceScore = clamp01(0.35 + (matchedDimensions / PROFILE_DIMENSIONS.length) * 0.65);

    return {
        flavor,
        cookingMethods,
        nutritionSignals,
        mealContexts,
        wellnessFlags,
        difficultyScore: null,
        profilingSource: 'rule',
        confidenceScore
    };
}

async function profileRecipe(recipe) {
    const baseProfile = buildProfileFromRecipe(recipe);
    const profile = await enrichRecipeProfileWithAI({ recipe, baseProfile });
    return recipeProfileModel.upsert({
        recipeId: recipe.recipeId,
        ...profile
    });
}

module.exports = {
    PROFILE_DIMENSIONS,
    buildProfileFromRecipe,
    profileRecipe
};
