const { poolPromise, sql } = require('../config/dbConfig');

exports.getAllRecipes = async () => {
    const pool = await poolPromise;

    try {
        const recipesResult = await pool.request().query(`
            SELECT 
                r.recipeId,
                r.recipeName,
                r.image,
                r.cookingTime,
                r.ration,
                r.viewCount,
                r.likeQuantity
            FROM Recipes r;
        `);

        const cookingStepsResult = await pool.request().query(`
            SELECT 
                cs.recipeId,
                cs.indexStep,
                cs.content AS stepContent
            FROM CookingSteps cs
            ORDER BY cs.recipeId, cs.indexStep;
        `);

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

        const recipes = recipesResult.recordset.map(recipe => {
            const cookingSteps = cookingStepsResult.recordset.filter(
                step => step.recipeId === recipe.recipeId
            );

            const ingredients = ingredientsResult.recordset.filter(
                ingredient => ingredient.recipeId === recipe.recipeId
            );

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
            data: recipes,
            message: "Get all recipes successfully"
        };
    } catch (error) {
        console.error("Error in getAllRecipes:", error);
        throw error;
    }
};

exports.createRecipe = async (recipeName, image, cookingTime, ration, ingredients, cookingSteps, userId) => {
    const pool = await poolPromise;

    const transaction = pool.transaction();
    try {
        await transaction.begin();

        const recipeResult = await transaction.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .input('image', sql.NVarChar, image)
            .input('cookingTime', sql.NVarChar, cookingTime)
            .input('ration', sql.Int, ration)
            .input('userId', sql.Int, userId)
            .query(`
                INSERT INTO Recipes (recipeName, image, cookingTime, ration, likeQuantity, userId)
                OUTPUT INSERTED.recipeId
                VALUES (@recipeName, @image, @cookingTime, @ration, 0, @userId)
            `);

        const recipeId = recipeResult.recordset[0].recipeId;

        await transaction.request()
            .input('userId', sql.Int, userId)
            .query(`
                UPDATE Users
                SET recipeCount = recipeCount + 1
                WHERE userId = @userId
            `);


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
            data: recipeId,
            message: "Recipe created successfully"
        };
    } catch (error) {
        await transaction.rollback();
        console.error('Error creating recipe:', error);
        throw new Error('Failed to create recipe');
    }
};

exports.searchRecipe = async (recipeName, userId = null) => {
    const pool = await poolPromise;

    try {
        console.log('recipeName:', recipeName);
        console.log('userId:', userId);

        const recipesResult = await pool.request()
            .input('recipeName', sql.NVarChar, recipeName)
            .query(`
                SELECT 
                    r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                    r.viewCount, r.likeQuantity, r.createdAt,
                    u.fullName AS userName
                FROM Recipes r
                JOIN Users u ON r.userId = u.userId
                WHERE r.recipeName COLLATE SQL_Latin1_General_CP1_CI_AI 
                      LIKE '%' + @recipeName COLLATE SQL_Latin1_General_CP1_CI_AI + '%'
                ORDER BY r.viewCount DESC;
            `);

        const recipeIds = recipesResult.recordset.map(r => r.recipeId);
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: "No recipes found"
            };
        }

        const cookingStepsResult = await pool.request()
            .query(`
                SELECT recipeId, indexStep, content AS stepContent
                FROM CookingSteps
                WHERE recipeId IN (${recipeIds.join(',')})
                ORDER BY recipeId, indexStep;
            `);

        const ingredientsResult = await pool.request()
            .query(`
                SELECT ri.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit
                FROM RecipesIngredients ri
                JOIN Ingredients i ON ri.ingredientId = i.ingredientId
                WHERE ri.recipeId IN (${recipeIds.join(',')})
                ORDER BY ri.recipeId;
            `);

        const commentsResult = await pool.request()
            .query(`
                SELECT uc.ucId, uc.recipeId, uc.userId, u.fullName, uc.content, uc.createdAt
                FROM UsersComment uc
                JOIN Users u ON uc.userId = u.userId
                WHERE uc.recipeId IN (${recipeIds.join(',')})
                ORDER BY uc.createdAt DESC;
            `);

        let likedRecipes = new Set();
        if (userId) {
            const likeResult = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT recipeId 
                    FROM UsersLike 
                    WHERE userId = @userId AND recipeId IN (${recipeIds.join(',')});
                `);
            likedRecipes = new Set(likeResult.recordset.map(row => row.recipeId));
        }

        const recipes = recipesResult.recordset.map(recipe => {
            const cookingSteps = cookingStepsResult.recordset
                .filter(step => step.recipeId === recipe.recipeId)
                .map(step => ({
                    indexStep: step.indexStep,
                    stepContent: step.stepContent
                }));

            const ingredients = ingredientsResult.recordset
                .filter(ing => ing.recipeId === recipe.recipeId)
                .map(ing => ({
                    ingredientId: ing.ingredientId,
                    ingredientName: ing.ingredientName,
                    weight: ing.weight,
                    unit: ing.unit
                }));

            const comments = commentsResult.recordset
                .filter(c => c.recipeId === recipe.recipeId)
                .map(comment => ({
                    commentId: comment.ucId,
                    userId: comment.userId,
                    userName: comment.fullName,
                    content: comment.content,
                    createdAt: comment.createdAt
                }));

            return {
                recipeId: recipe.recipeId,
                image: recipe.image,
                recipeName: recipe.recipeName,
                userName: recipe.userName,
                likeQuantity: recipe.likeQuantity,
                viewCount: recipe.viewCount,
                cookingTime: recipe.cookingTime,
                ration: recipe.ration,
                ingredients,
                cookingSteps,
                comments,
                isLiked: userId ? likedRecipes.has(recipe.recipeId) : false,
                createdAt: recipe.createdAt
            };
        });

        return {
            success: true,
            data: recipes,
            message: "Search recipe successfully"
        };
    } catch (error) {
        console.error("error in searchRecipe:", error);
        throw error;
    }
};


exports.getDirectRecipe = async (recipeId, userId = null) => {
    const pool = await poolPromise;

    try {
        const recipeResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration, r.viewCount, r.likeQuantity FROM Recipes r WHERE r.recipeId = @recipeId;");

        const cookingStepsResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, cs.indexStep, cs.content AS stepContent FROM Recipes r LEFT JOIN CookingSteps cs ON r.recipeId = cs.recipeId WHERE r.recipeId = @recipeId ORDER BY cs.indexStep;");

        const ingredientsResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT r.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit FROM Recipes r LEFT JOIN RecipesIngredients ri ON r.recipeId = ri.recipeId LEFT JOIN Ingredients i ON ri.ingredientId = i.ingredientId WHERE r.recipeId = @recipeId");

        const commentsResult = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query(`
                SELECT uc.ucId, uc.recipeId, uc.userId, u.fullName, uc.content, uc.createdAt
                FROM UsersComment uc
                JOIN Users u ON uc.userId = u.userId
                WHERE uc.recipeId = @recipeId
                ORDER BY uc.createdAt DESC;
            `);

        let isLiked = false;
        if (userId && recipeResult.recordset.length > 0) {
            const likeResult = await pool.request()
                .input('userId', sql.Int, userId)
                .input('recipeId', sql.Int, recipeId)
                .query("SELECT COUNT(*) AS likeCount FROM UsersLike WHERE userId = @userId AND recipeId = @recipeId");
            isLiked = likeResult.recordset[0].likeCount > 0;
        }

        const recipes = recipeResult.recordset.map(recipe => ({
            ...recipe,
            cookingSteps: cookingStepsResult.recordset.map(step => ({
                indexStep: step.indexStep,
                stepContent: step.stepContent
            })),
            ingredients: ingredientsResult.recordset.map(ingredient => ({
                ingredientId: ingredient.ingredientId,
                ingredientName: ingredient.ingredientName,
                weight: ingredient.weight,
                unit: ingredient.unit
            })),
            comments: commentsResult.recordset.map(comment => ({
                commentId: comment.ucId,
                userId: comment.userId,
                userName: comment.fullName,
                content: comment.content,
                createdAt: comment.createdAt
            })),
            ...(userId && { isLiked })
        }));

        console.log('recipesResult:', recipeResult.recordset);
        console.log('cookingStepsResult:', cookingStepsResult.recordset);
        console.log('ingredientsResult:', ingredientsResult.recordset);
        console.log('commentsResult:', commentsResult.recordset);

        return {
            success: true,
            data: recipes,
            message: "Get direct recipe successfully"
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
            data: ingredientsResult.recordset,
            message: "Get all ingredients successfully"
        };
    } catch (error) {
        console.log("error: ", error);
        throw error;
    }
};

exports.getTopTrending = async (userId = null) => {
    const pool = await poolPromise;

    try {
        const topTrendingResult = await pool.request()
            .query(`
                SELECT TOP 30 
                    r.recipeId, 
                    r.recipeName, 
                    r.image, 
                    r.cookingTime, 
                    r.ration, 
                    r.viewCount, 
                    r.likeQuantity,
                    r.userId,
                    r.createdAt,
                    u.fullName AS userName
                FROM Recipes r
                JOIN Users u ON r.userId = u.userId
                ORDER BY r.viewCount DESC;
            `);

        const recipeIds = topTrendingResult.recordset.map(r => r.recipeId);
        if (recipeIds.length === 0) {
            return { success: true, data: [], message: "No trending recipes found" };
        }

        const cookingStepsResult = await pool.request()
            .query(`
                SELECT recipeId, indexStep, content AS stepContent
                FROM CookingSteps
                WHERE recipeId IN (${recipeIds.join(',')})
                ORDER BY recipeId, indexStep;
            `);

        const ingredientsResult = await pool.request()
            .query(`
                SELECT ri.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit
                FROM RecipesIngredients ri
                JOIN Ingredients i ON ri.ingredientId = i.ingredientId
                WHERE ri.recipeId IN (${recipeIds.join(',')})
                ORDER BY ri.recipeId;
            `);

        const commentsResult = await pool.request()
            .query(`
                SELECT uc.ucId, uc.recipeId, uc.userId, u.fullName, uc.content, uc.createdAt
                FROM UsersComment uc
                JOIN Users u ON uc.userId = u.userId
                WHERE uc.recipeId IN (${recipeIds.join(',')})
                ORDER BY uc.createdAt DESC;
            `);

        let likedRecipes = new Set();
        if (userId) {
            const likeResult = await pool.request()
                .input('userId', sql.Int, userId)
                .query(`
                    SELECT recipeId 
                    FROM UsersLike 
                    WHERE userId = @userId AND recipeId IN (${recipeIds.join(',')});
                `);
            likedRecipes = new Set(likeResult.recordset.map(row => row.recipeId));
        }

        const recipes = topTrendingResult.recordset.map(recipe => {
            const cookingSteps = cookingStepsResult.recordset.filter(
                step => step.recipeId === recipe.recipeId
            );
            const ingredients = ingredientsResult.recordset.filter(
                ing => ing.recipeId === recipe.recipeId
            );
            const comments = commentsResult.recordset.filter(
                comment => comment.recipeId === recipe.recipeId
            ).map(comment => ({
                commentId: comment.ucId,
                userId: comment.userId,
                userName: comment.fullName,
                content: comment.content,
                createdAt: comment.createdAt
            }));

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
                })),
                comments,
                ...(userId && { isLiked: likedRecipes.has(recipe.recipeId) })
            };
        });

        return {
            success: true,
            data: recipes,
            message: "Get top trending successfully"
        };
    } catch (error) {
        console.log("error in getTopTrending:", error);
        throw error;
    }
};

exports.increaseViewCount = async (recipeId) => {
    const pool = await poolPromise;

    try {
        await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query(`
                UPDATE Recipes
                SET viewCount = viewCount + 1
                WHERE recipeId = @recipeId;
            `);

        return {
            success: true,
            data: true,
            message: "Increase view count successfully"
        };
    } catch (error) {
        console.log("error in increaseViewCount:", error);
        throw error;
    }
};
