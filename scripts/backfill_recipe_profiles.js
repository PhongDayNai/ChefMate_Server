require('dotenv').config();
const recipeModel = require('../models/recipeModel');
const { profileRecipe } = require('../services/recipeProfilingService');

async function main() {
    const result = await recipeModel.getAllRecipes();
    const recipes = result?.data || [];

    let successCount = 0;
    for (const recipe of recipes) {
        try {
            await profileRecipe(recipe);
            successCount += 1;
            console.log(`Profiled recipe ${recipe.recipeId} - ${recipe.recipeName}`);
        } catch (error) {
            console.error(`Failed to profile recipe ${recipe.recipeId}:`, error.message);
        }
    }

    console.log(`Backfill completed. Profiled ${successCount}/${recipes.length} recipes.`);
    process.exit(0);
}

main().catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
});
