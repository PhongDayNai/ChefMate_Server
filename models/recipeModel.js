const { poolPromise, sql } = require('../config/dbConfig');

exports.getAllRecipes = async () => {
    const pool = await poolPromise;

    try {
        // Truy vấn 1: Lấy thông tin công thức
        const recipesResult = await pool.request().query(`
            SELECT 
                r.recipeId,
                r.recipeName,
                r.image,
                r.likeQuantity
            FROM Recipes r;
        `);

        // Truy vấn 2: Lấy các bước nấu ăn
        const cookingStepsResult = await pool.request().query(`
            SELECT 
                cs.recipeId,
                cs.indexStep,
                cs.content AS stepContent
            FROM CookingSteps cs
            ORDER BY cs.recipeId, cs.indexStep;
        `);

        // Truy vấn 3: Lấy danh sách nguyên liệu
        const ingredientsResult = await pool.request().query(`
            SELECT 
                ri.recipeId,
                i.ingredientId,
                i.ingredientName,
                ri.weight,
                ri.unit
            FROM RecipesIngredients ri
            JOIN Ingredients i ON ri.ingredientId = i.ingredientId
            ORDER BY ri.recipeId;
        `);

        // Gộp dữ liệu
        const recipes = recipesResult.recordset.map(recipe => {
            // Tìm các bước nấu ăn của công thức này
            const cookingSteps = cookingStepsResult.recordset.filter(
                step => step.recipeId === recipe.recipeId
            );

            // Tìm nguyên liệu của công thức này
            const ingredients = ingredientsResult.recordset.filter(
                ingredient => ingredient.recipeId === recipe.recipeId
            );

            // Trả về công thức với cookingSteps và ingredients
            return {
                ...recipe,
                cookingSteps: cookingSteps.map(step => ({
                    indexStep: step.indexStep,
                    stepContent: step.stepContent
                })),
                ingredients: ingredients.map(ingredient => ({
                    ingredientId: ingredient.ingredientId,
                    ingredientName: ingredient.ingredientName,
                    weight: ingredient.weight,
                    unit: ingredient.unit
                }))
            };
        });

        return {
            success: true,
            recipes
        };
    } catch (error) {
        console.error("Error in getAllRecipes:", error);
        throw error;
    }
};

exports.createRecipe = async (recipeName, image, ingredients, cookingSteps) => {
    const pool = await poolPromise;

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        const recipeResult = await transaction.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .input('image', sql.NVarChar, image)
            .query(`
                INSERT INTO Recipes (recipeName, image, likeQuantity)
                OUTPUT INSERTED.recipeId
                VALUES (@recipeName, @image, 0)
            `);

        const recipeId = recipeResult.recordset[0].recipeId;

        for (const ingredient of ingredients) {
            let ingredientId;
            const existingIngredient = await transaction.request()
                .input('ingredientName', sql.NVarChar, ingredient.ingredientName)
                .query(`
                    SELECT ingredientId 
                    FROM Ingredients 
                    WHERE ingredientName = @ingredientName
                `);

            if (existingIngredient.recordset.length > 0) {
                ingredientId = existingIngredient.recordset[0].ingredientId;
            } else {
                const ingredientResult = await transaction.request()
                    .input('ingredientName', sql.NVarChar, ingredient.ingredientName)
                    .query(`
                        INSERT INTO Ingredients (ingredientName)
                        OUTPUT INSERTED.ingredientId
                        VALUES (@ingredientName)
                    `);
                ingredientId = ingredientResult.recordset[0].ingredientId;
            }

            await transaction.request()
                .input('recipeId', sql.Int, recipeId)
                .input('ingredientId', sql.Int, ingredientId)
                .input('weight', sql.Int, ingredient.weight)
                .input('unit', sql.NVarChar, ingredient.unit)
                .query(`
                    INSERT INTO RecipesIngredients (recipeId, ingredientId, weight, unit)
                    VALUES (@recipeId, @ingredientId, @weight, @unit)
                `);
        }

        for (const [index, step] of cookingSteps.entries()) {
            await transaction.request()
                .input('recipeId', sql.Int, recipeId)
                .input('indexStep', sql.Int, index + 1)
                .input('content', sql.NVarChar, step.content)
                .query(`
                    INSERT INTO CookingSteps (recipeId, indexStep, content)
                    VALUES (@recipeId, @indexStep, @content)
                `);
        }

        await transaction.commit();

        return {
            success: true,
            recipeId,
            message: 'Recipe created successfully'
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating recipe:', error);
        throw new Error('Failed to create recipe');
    }
};

exports.searchRecipe = async (recipeName) => {
    const pool = await poolPromise;

    try {
        console.log('recipeName:', recipeName);

        const recipesResult = await pool.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .query("SELECT r.recipeId, r.recipeName, r.image, r.likeQuantity FROM Recipes r WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + @recipeName COLLATE SQL_Latin1_General_CP1_CI_AI + '%';");
        
        const cookingStepsResult = await pool.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .query("SELECT r.recipeId, cs.indexStep, cs.content AS stepContent FROM Recipes r LEFT JOIN CookingSteps cs ON r.recipeId = cs.recipeId WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + @recipeName COLLATE SQL_Latin1_General_CP1_CI_AI + '%' ORDER BY cs.indexStep;");

        const ingredientsResult = await pool.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .query("SELECT r.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit FROM Recipes r LEFT JOIN RecipesIngredients ri ON r.recipeId = ri.recipeId LEFT JOIN Ingredients i ON ri.ingredientId = i.ingredientId WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI LIKE '%' + @recipeName COLLATE SQL_Latin1_General_CP1_CI_AI + '%' ORDER BY r.recipeId;");

        console.log('recipesResult:', recipesResult.recordset);
        console.log('cookingStepsResult:', cookingStepsResult.recordset);
        console.log('ingredientsResult:', ingredientsResult.recordset);

        const recipes = recipesResult.recordset.map(recipe => {
            // Tìm các bước nấu ăn của công thức này
            const cookingSteps = cookingStepsResult.recordset.filter(
                step => step.recipeId === recipe.recipeId
            );

            // Tìm nguyên liệu của công thức này
            const ingredients = ingredientsResult.recordset.filter(
                ingredient => ingredient.recipeId === recipe.recipeId
            );

            // Trả về công thức với cookingSteps và ingredients
            return {
                ...recipe,
                cookingSteps: cookingSteps.map(step => ({
                    indexStep: step.indexStep,
                    stepContent: step.stepContent
                })),
                ingredients: ingredients.map(ingredient => ({
                    ingredientId: ingredient.ingredientId,
                    ingredientName: ingredient.ingredientName,
                    weight: ingredient.weight,
                    unit: ingredient.unit
                }))
            };
        });

        return {
            success: true,
            // recipes: recipesResult.recordset,
            // ingredients: ingredientsResult.recordset,
            // cookingSteps: cookingStepsResult.recordset
            recipes
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
};

exports.getDirectRecipe = async (recipeId) => {
    const pool = await poolPromise;

    try {
        const recipeResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, r.recipeName, r.image, r.likeQuantity FROM Recipes r WHERE r.recipeId = @recipeId;");

        const cookingStepsResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, cs.indexStep, cs.content AS stepContent FROM Recipes r LEFT JOIN CookingSteps cs ON r.recipeId = cs.recipeId WHERE r.recipeId = @recipeId ORDER BY cs.indexStep;");

        const ingredientsResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit FROM Recipes r LEFT JOIN RecipesIngredients ri ON r.recipeId = ri.recipeId LEFT JOIN Ingredients i ON ri.ingredientId = i.ingredientId WHERE r.recipeId = @recipeId");

        console.log('recipesResult:', recipeResult.recordset);
        console.log('cookingStepsResult:', cookingStepsResult.recordset);
        console.log('ingredientsResult:', ingredientsResult.recordset);

        return {
            success: true,
            recipes: recipeResult.recordset,
            ingredients: ingredientsResult.recordset,
            cookingSteps: cookingStepsResult.recordset
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
};

exports.getAllIngredients = async () => {
    const pool = await poolPromise;

    try {
        const ingredientsResult = await pool.request()
            .query("SELECT * FROM Ingredients;");

        console.log('ingredientsResult:', ingredientsResult.recordset);

        return {
            success: true,
            ingredients: ingredientsResult.recordset
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
};

exports.getTopTrending = async () => {
    const pool = await poolPromise;

    try {
        const topTrendingResult = await pool.request()
            .query("SELECT TOP 10 r.recipeId, r.recipeName, r.image, r.likeQuantity, COUNT(uvr.recipeId) AS viewCount FROM Recipes r LEFT JOIN UsersViewRecipesHistory uvr ON r.recipeId = uvr.recipeId GROUP BY r.recipeId, r.recipeName, r.image, r.likeQuantity ORDER BY viewCount DESC;");

        return {
            success: true,
            topTrending: topTrendingResult
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
}
