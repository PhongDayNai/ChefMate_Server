const { pool } = require('../config/dbConfig');

function mapRow(row) {
    if (!row) return null;
    return {
        recipeProfileId: Number(row.recipeProfileId),
        recipeId: Number(row.recipeId),
        flavor: safeParse(row.flavorJson, {}),
        cookingMethods: safeParse(row.cookingMethodsJson, {}),
        nutritionSignals: safeParse(row.nutritionSignalsJson, {}),
        mealContexts: safeParse(row.mealContextsJson, {}),
        wellnessFlags: safeParse(row.wellnessFlagsJson, {}),
        difficultyScore: row.difficultyScore === null || row.difficultyScore === undefined ? null : Number(row.difficultyScore),
        profilingSource: row.profilingSource,
        confidenceScore: row.confidenceScore === null || row.confidenceScore === undefined ? null : Number(row.confidenceScore),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function safeParse(value, fallback) {
    if (value === null || value === undefined || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

exports.getByRecipeId = async (recipeId) => {
    const [rows] = await pool.query(
        `SELECT recipeProfileId, recipeId, flavorJson, cookingMethodsJson, nutritionSignalsJson,
                mealContextsJson, wellnessFlagsJson, difficultyScore, profilingSource,
                confidenceScore, createdAt, updatedAt
         FROM RecipeProfiles
         WHERE recipeId = ?
         LIMIT 1`,
        [recipeId]
    );

    return mapRow(rows[0] || null);
};

exports.listByRecipeIds = async (recipeIds) => {
    const ids = Array.from(new Set((recipeIds || []).map(Number).filter(id => id > 0)));
    if (ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
        `SELECT recipeProfileId, recipeId, flavorJson, cookingMethodsJson, nutritionSignalsJson,
                mealContextsJson, wellnessFlagsJson, difficultyScore, profilingSource,
                confidenceScore, createdAt, updatedAt
         FROM RecipeProfiles
         WHERE recipeId IN (${placeholders})`,
        ids
    );

    return rows.map(mapRow);
};

exports.upsert = async ({
    recipeId,
    flavor = {},
    cookingMethods = {},
    nutritionSignals = {},
    mealContexts = null,
    wellnessFlags = null,
    difficultyScore = null,
    profilingSource = 'rule',
    confidenceScore = null
}) => {
    const parsedRecipeId = Number(recipeId);
    if (!parsedRecipeId || parsedRecipeId <= 0) {
        throw new Error('recipeId must be a positive number');
    }

    await pool.query(
        `INSERT INTO RecipeProfiles (
            recipeId,
            flavorJson,
            cookingMethodsJson,
            nutritionSignalsJson,
            mealContextsJson,
            wellnessFlagsJson,
            difficultyScore,
            profilingSource,
            confidenceScore
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
            flavorJson = VALUES(flavorJson),
            cookingMethodsJson = VALUES(cookingMethodsJson),
            nutritionSignalsJson = VALUES(nutritionSignalsJson),
            mealContextsJson = VALUES(mealContextsJson),
            wellnessFlagsJson = VALUES(wellnessFlagsJson),
            difficultyScore = VALUES(difficultyScore),
            profilingSource = VALUES(profilingSource),
            confidenceScore = VALUES(confidenceScore),
            updatedAt = CURRENT_TIMESTAMP`,
        [
            parsedRecipeId,
            JSON.stringify(flavor || {}),
            JSON.stringify(cookingMethods || {}),
            JSON.stringify(nutritionSignals || {}),
            mealContexts ? JSON.stringify(mealContexts) : null,
            wellnessFlags ? JSON.stringify(wellnessFlags) : null,
            difficultyScore,
            profilingSource,
            confidenceScore
        ]
    );

    return this.getByRecipeId(parsedRecipeId);
};
