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

        const commentsResult = await pool.request()
            .query(`
                SELECT uc.ucId, uc.recipeId, uc.userId, u.fullName, uc.content, uc.createdAt
                FROM UsersComment uc
                JOIN Users u ON uc.userId = u.userId
                ORDER BY uc.createdAt DESC;
            `);

        const tagsResult = await pool.request().query(`
            SELECT 
                rt.recipeId,
                t.tagId,
                t.tagName
            FROM RecipesTags rt
            JOIN Tags t ON rt.tagId = t.tagId
            ORDER BY rt.recipeId;
        `);

        const recipes = recipesResult.recordset.map(recipe => {
            const cookingSteps = cookingStepsResult.recordset.filter(
                step => step.recipeId === recipe.recipeId
            );

            const ingredients = ingredientsResult.recordset.filter(
                ingredient => ingredient.recipeId === recipe.recipeId
            );

            const comments = commentsResult.recordset.filter(
                c => c.recipeId === recipe.recipeId
            );

            const tags = tagsResult.recordset.filter(
                tag => tag.recipeId === recipe.recipeId
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
                })),
                comments: comments.map(comment => ({
                    commentId: comment.ucId,
                    userId: comment.userId,
                    userName: comment.fullName,
                    content: comment.content,
                    createdAt: comment.createdAt
                })),
                tags: tags.map(tag => ({
                    tagId: tag.tagId,
                    tagName: tag.tagName
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

exports.createRecipe = async (recipeName, image, cookingTime, ration, ingredients, cookingSteps, userId, tags = []) => {
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

        for (const tag of tags) {
            let tagId;
            const existingTag = await transaction.request()
                .input('tagName', sql.NVarChar, tag.tagName)
                .query(`
                    SELECT tagId 
                    FROM Tags 
                    WHERE tagName = @tagName
                `);

            if (existingTag.recordset.length > 0) {
                tagId = existingTag.recordset[0].tagId;
            } else {
                const tagResult = await transaction.request()
                    .input('tagName', sql.NVarChar, tag.tagName)
                    .query(`
                        INSERT INTO Tags (tagName)
                        OUTPUT INSERTED.tagId
                        VALUES (@tagName)
                    `);
                tagId = tagResult.recordset[0].tagId;
            }
            
            await transaction.request()
                .input('recipeId', sql.Int, recipeId)
                .input('tagId', sql.Int, tagId)
                .query(`
                    INSERT INTO RecipesTags (recipeId, tagId)
                    VALUES (@recipeId, @tagId)
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

        const tagsResult = await pool.request()
            .query(`
                SELECT rt.recipeId, t.tagId, t.tagName
                FROM RecipesTags rt
                JOIN Tags t ON rt.tagId = t.tagId
                WHERE rt.recipeId IN (${recipeIds.join(',')})
                ORDER BY rt.recipeId;
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

            const tags = tagsResult.recordset
                .filter(t => t.recipeId === recipe.recipeId)
                .map(tag => ({
                    tagId: tag.tagId,
                    tagName: tag.tagName
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
                tags,
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

exports.getAllIngredients = async () => {
    const pool = await poolPromise;

    try {
        const ingredientsResult = await pool.request()
            .query("SELECT * FROM Ingredients;");

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

        const tagsResult = await pool.request()
            .query(`
                SELECT rt.recipeId, t.tagId, t.tagName
                FROM RecipesTags rt
                JOIN Tags t ON rt.tagId = t.tagId
                WHERE rt.recipeId IN (${recipeIds.join(',')})
                ORDER BY rt.recipeId;
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
            const tags = tagsResult.recordset.filter(
                tag => tag.recipeId === recipe.recipeId
            ).map(tag => ({
                tagId: tag.tagId,
                tagName: tag.tagName
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
                tags,
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

exports.getAllTags = async () => {
    const pool = await poolPromise;

    try {
        const tagsResult = await pool.request().query(`
            SELECT tagId, tagName
            FROM Tags
            ORDER BY tagName;
        `);

        return {
            success: true,
            data: tagsResult.recordset,
            message: "Get all tags successfully"
        };
    } catch (error) {
        console.error("Error in getAllTags:", error);
        return {
            success: false,
            data: null,
            message: `Failed to get tags: ${error.message}`
        };
    }
};

exports.searchRecipesByTag = async (tagName, userId = null) => {
    const pool = await poolPromise;

    try {
        const recipesResult = await pool.request()
            .input('tagName', sql.NVarChar, tagName)
            .query(`
                SELECT 
                    r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                    r.viewCount, r.likeQuantity, r.createdAt,
                    u.fullName AS userName
                FROM Recipes r
                JOIN Users u ON r.userId = u.userId
                JOIN RecipesTags rt ON r.recipeId = rt.recipeId
                JOIN Tags t ON rt.tagId = t.tagId
                WHERE t.tagName COLLATE SQL_Latin1_General_CP1_CI_AI 
                      LIKE '%' + @tagName COLLATE SQL_Latin1_General_CP1_CI_AI + '%'
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

        const tagsResult = await pool.request()
            .query(`
                SELECT rt.recipeId, t.tagId, t.tagName
                FROM RecipesTags rt
                JOIN Tags t ON rt.tagId = t.tagId
                WHERE rt.recipeId IN (${recipeIds.join(',')})
                ORDER BY rt.recipeId;
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

            const tags = tagsResult.recordset
                .filter(t => t.recipeId === recipe.recipeId)
                .map(tag => ({
                    tagId: tag.tagId,
                    tagName: tag.tagName
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
                tags,
                isLiked: userId ? likedRecipes.has(recipe.recipeId) : false,
                createdAt: recipe.createdAt
            };
        });

        return {
            success: true,
            data: recipes,
            message: "Search recipes by tag successfully"
        };
    } catch (error) {
        console.error("Error in searchRecipesByTag:", error);
        return {
            success: false,
            data: null,
            message: `Failed to search recipes: ${error.message}`
        };
    }
};

exports.getRecipesByUserId = async (userId) => {
    const pool = await poolPromise;

    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('userId must be a positive number');
        }

        const recipesResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT 
                    r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                    r.viewCount, r.likeQuantity, r.createdAt,
                    u.fullName AS userName
                FROM Recipes r
                JOIN Users u ON r.userId = u.userId
                WHERE r.userId = @userId
                ORDER BY r.createdAt DESC;
            `);

        const recipeIds = recipesResult.recordset.map(r => r.recipeId);
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: "No recipes found for this user"
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
                ORDER BY uc.createdAt ASC;
            `);

        const tagsResult = await pool.request()
            .query(`
                SELECT rt.recipeId, t.tagId, t.tagName
                FROM RecipesTags rt
                JOIN Tags t ON rt.tagId = t.tagId
                WHERE rt.recipeId IN (${recipeIds.join(',')})
                ORDER BY rt.recipeId;
            `);

        const likeResult = await pool.request()
            .input('userId', sql.Int, userId)
            .query(`
                SELECT recipeId 
                FROM UsersLike 
                WHERE userId = @userId AND recipeId IN (${recipeIds.join(',')});
            `);
        const likedRecipes = new Set(likeResult.recordset.map(row => row.recipeId));

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

            const tags = tagsResult.recordset
                .filter(t => t.recipeId === recipe.recipeId)
                .map(tag => ({
                    tagId: tag.tagId,
                    tagName: tag.tagName
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
                tags,
                isLiked: likedRecipes.has(recipe.recipeId),
                createdAt: recipe.createdAt
            };
        });

        return {
            success: true,
            data: recipes,
            message: "Recipes retrieved successfully"
        };
    } catch (error) {
        console.error("Error in getRecipesByUserId:", error);
        throw error;
    }
};

exports.getRecipeGrowthByMonth = async () => {
    const pool = await poolPromise;

    try {
        const result = await pool.request().query(`
            SELECT 
                YEAR(createdAt) AS year,
                MONTH(createdAt) AS month,
                COUNT(*) AS recipeCount
            FROM Recipes
            GROUP BY YEAR(createdAt), MONTH(createdAt)
            ORDER BY YEAR(createdAt) DESC, MONTH(createdAt) DESC;
        `);

        const report = result.recordset.map(row => ({
            year: row.year,
            month: row.month,
            recipeCount: row.recipeCount
        }));

        return {
            success: true,
            data: report,
            message: "Recipe growth report retrieved successfully"
        };
    } catch (error) {
        console.error("Error in getRecipeGrowthByMonth:", error);
        throw new Error(`Database query failed: ${error.message}`);
    }
};
