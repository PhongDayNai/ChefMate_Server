const { pool } = require('../config/dbConfig');

function makeInClauseParams(values) {
    return {
        placeholders: values.map(() => '?').join(','),
        params: values
    };
}

function mapRecipePayload(recipe, cookingStepsRows, ingredientsRows, commentsRows, tagsRows, likedRecipes = new Set()) {
    const recipeId = Number(recipe.recipeId);

    const cookingSteps = cookingStepsRows
        .filter(step => Number(step.recipeId) === recipeId)
        .map(step => ({
            indexStep: Number(step.indexStep),
            stepContent: step.stepContent
        }));

    const ingredients = ingredientsRows
        .filter(ing => Number(ing.recipeId) === recipeId)
        .map(ing => ({
            ingredientId: Number(ing.ingredientId),
            ingredientName: ing.ingredientName,
            weight: Number(ing.weight),
            unit: ing.unit,
            isMain: Number(ing.isMain || 0) === 1,
            isCommon: Number(ing.isCommon || 0) === 1
        }));

    const comments = commentsRows
        .filter(c => Number(c.recipeId) === recipeId)
        .map(comment => ({
            commentId: Number(comment.ucId),
            userId: Number(comment.userId),
            userName: comment.fullName,
            content: comment.content,
            createdAt: comment.createdAt
        }));

    const tags = tagsRows
        .filter(t => Number(t.recipeId) === recipeId)
        .map(tag => ({
            tagId: Number(tag.tagId),
            tagName: tag.tagName
        }));

    return {
        recipeId,
        image: recipe.image,
        recipeName: recipe.recipeName,
        userName: recipe.userName,
        likeQuantity: Number(recipe.likeQuantity || 0),
        viewCount: Number(recipe.viewCount || 0),
        cookingTime: recipe.cookingTime,
        ration: Number(recipe.ration),
        ingredients,
        cookingSteps,
        comments,
        tags,
        isLiked: likedRecipes.has(recipeId),
        createdAt: recipe.createdAt
    };
}

async function fetchRecipeRelatedData(recipeIds, userId = null) {
    const { placeholders, params } = makeInClauseParams(recipeIds);

    const [cookingStepsRows] = await pool.query(
        `SELECT recipeId, indexStep, content AS stepContent
         FROM CookingSteps
         WHERE recipeId IN (${placeholders})
         ORDER BY recipeId, indexStep`,
        params
    );

    const [ingredientsRows] = await pool.query(
        `SELECT ri.recipeId, i.ingredientId, i.ingredientName, ri.weight, ri.unit, ri.isMain, ri.isCommon
         FROM RecipesIngredients ri
         JOIN Ingredients i ON ri.ingredientId = i.ingredientId
         WHERE ri.recipeId IN (${placeholders})
         ORDER BY ri.recipeId`,
        params
    );

    const [commentsRows] = await pool.query(
        `SELECT uc.ucId, uc.recipeId, uc.userId, u.fullName, uc.content, uc.createdAt
         FROM UsersComment uc
         JOIN Users u ON uc.userId = u.userId
         WHERE uc.recipeId IN (${placeholders})
         ORDER BY uc.createdAt DESC`,
        params
    );

    const [tagsRows] = await pool.query(
        `SELECT rt.recipeId, t.tagId, t.tagName
         FROM RecipesTags rt
         JOIN Tags t ON rt.tagId = t.tagId
         WHERE rt.recipeId IN (${placeholders})
         ORDER BY rt.recipeId`,
        params
    );

    let likedRecipes = new Set();
    if (userId) {
        const [likedRows] = await pool.query(
            `SELECT recipeId
             FROM UsersLike
             WHERE userId = ? AND recipeId IN (${placeholders})`,
            [userId, ...params]
        );
        likedRecipes = new Set(likedRows.map(r => Number(r.recipeId)));
    }

    return { cookingStepsRows, ingredientsRows, commentsRows, tagsRows, likedRecipes };
}

exports.getAllRecipes = async () => {
    try {
        const [recipesRows] = await pool.query(`
            SELECT 
                r.recipeId,
                r.recipeName,
                r.image,
                r.cookingTime,
                r.ration,
                r.viewCount,
                r.likeQuantity,
                r.createdAt,
                u.fullName AS userName
            FROM Recipes r
            JOIN Users u ON r.userId = u.userId
            ORDER BY r.createdAt DESC
        `);

        const recipeIds = recipesRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: 'Get all recipes successfully'
            };
        }

        const { cookingStepsRows, ingredientsRows, commentsRows, tagsRows } = await fetchRecipeRelatedData(recipeIds);

        const recipes = recipesRows.map(recipe =>
            mapRecipePayload(recipe, cookingStepsRows, ingredientsRows, commentsRows, tagsRows)
        );

        return {
            success: true,
            data: recipes,
            message: 'Get all recipes successfully'
        };
    } catch (error) {
        console.error('Error in getAllRecipes:', error);
        throw error;
    }
};

exports.createRecipe = async (recipeName, image, cookingTime, ration, ingredients, cookingSteps, userId, tags = []) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [recipeResult] = await conn.query(
            `INSERT INTO Recipes (recipeName, image, cookingTime, ration, likeQuantity, userId)
             VALUES (?, ?, ?, ?, 0, ?)`,
            [recipeName, image, cookingTime, ration, userId]
        );

        const recipeId = recipeResult.insertId;

        await conn.query(
            'UPDATE Users SET recipeCount = recipeCount + 1 WHERE userId = ?',
            [userId]
        );

        for (const ingredient of ingredients) {
            let ingredientId;

            const [existingIngredientRows] = await conn.query(
                'SELECT ingredientId FROM Ingredients WHERE ingredientName = ? LIMIT 1',
                [ingredient.ingredientName]
            );

            if (existingIngredientRows.length > 0) {
                ingredientId = existingIngredientRows[0].ingredientId;
            } else {
                const [ingredientResult] = await conn.query(
                    'INSERT INTO Ingredients (ingredientName) VALUES (?)',
                    [ingredient.ingredientName]
                );
                ingredientId = ingredientResult.insertId;
            }

            await conn.query(
                `INSERT INTO RecipesIngredients (recipeId, ingredientId, weight, unit, isMain, isCommon)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    recipeId,
                    ingredientId,
                    ingredient.weight,
                    ingredient.unit,
                    ingredient.isMain ? 1 : 0,
                    ingredient.isCommon ? 1 : 0
                ]
            );
        }

        for (const [index, step] of cookingSteps.entries()) {
            await conn.query(
                'INSERT INTO CookingSteps (recipeId, indexStep, content) VALUES (?, ?, ?)',
                [recipeId, index + 1, step.content]
            );
        }

        for (const tag of tags) {
            let tagId;

            const [existingTagRows] = await conn.query(
                'SELECT tagId FROM Tags WHERE tagName = ? LIMIT 1',
                [tag.tagName]
            );

            if (existingTagRows.length > 0) {
                tagId = existingTagRows[0].tagId;
            } else {
                const [tagResult] = await conn.query(
                    'INSERT INTO Tags (tagName) VALUES (?)',
                    [tag.tagName]
                );
                tagId = tagResult.insertId;
            }

            await conn.query(
                'INSERT INTO RecipesTags (recipeId, tagId) VALUES (?, ?)',
                [recipeId, tagId]
            );
        }

        await conn.commit();

        return {
            success: true,
            data: recipeId,
            message: 'Recipe created successfully'
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error creating recipe:', error);
        throw new Error('Failed to create recipe');
    } finally {
        conn.release();
    }
};

exports.searchRecipe = async (recipeName, userId = null) => {
    try {
        const [recipesRows] = await pool.query(
            `SELECT 
                r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                r.viewCount, r.likeQuantity, r.createdAt,
                u.fullName AS userName
             FROM Recipes r
             JOIN Users u ON r.userId = u.userId
             WHERE r.recipeName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
             ORDER BY r.viewCount DESC`,
            [recipeName]
        );

        const recipeIds = recipesRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: 'No recipes found'
            };
        }

        const related = await fetchRecipeRelatedData(recipeIds, userId);

        const recipes = recipesRows.map(recipe =>
            mapRecipePayload(
                recipe,
                related.cookingStepsRows,
                related.ingredientsRows,
                related.commentsRows,
                related.tagsRows,
                related.likedRecipes
            )
        );

        return {
            success: true,
            data: recipes,
            message: 'Search recipe successfully'
        };
    } catch (error) {
        console.error('error in searchRecipe:', error);
        throw error;
    }
};

exports.getAllIngredients = async () => {
    try {
        const [rows] = await pool.query('SELECT * FROM Ingredients');

        return {
            success: true,
            data: rows,
            message: 'Get all ingredients successfully'
        };
    } catch (error) {
        console.log('error: ', error);
        throw error;
    }
};

exports.getTopTrending = async (userId = null) => {
    try {
        const [topRows] = await pool.query(
            `SELECT 
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
             ORDER BY r.viewCount DESC
             LIMIT 30`
        );

        const recipeIds = topRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return { success: true, data: [], message: 'No trending recipes found' };
        }

        const related = await fetchRecipeRelatedData(recipeIds, userId);

        const recipes = topRows.map(recipe =>
            mapRecipePayload(
                recipe,
                related.cookingStepsRows,
                related.ingredientsRows,
                related.commentsRows,
                related.tagsRows,
                related.likedRecipes
            )
        );

        return {
            success: true,
            data: recipes,
            message: 'Get top trending successfully'
        };
    } catch (error) {
        console.log('error in getTopTrending:', error);
        throw error;
    }
};

exports.getAllTags = async () => {
    try {
        const [rows] = await pool.query(
            'SELECT tagId, tagName FROM Tags ORDER BY tagName'
        );

        return {
            success: true,
            data: rows,
            message: 'Get all tags successfully'
        };
    } catch (error) {
        console.error('Error in getAllTags:', error);
        return {
            success: false,
            data: null,
            message: `Failed to get tags: ${error.message}`
        };
    }
};

exports.searchRecipesByTag = async (tagName, userId = null) => {
    try {
        const [recipesRows] = await pool.query(
            `SELECT 
                r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                r.viewCount, r.likeQuantity, r.createdAt,
                u.fullName AS userName
             FROM Recipes r
             JOIN Users u ON r.userId = u.userId
             JOIN RecipesTags rt ON r.recipeId = rt.recipeId
             JOIN Tags t ON rt.tagId = t.tagId
             WHERE t.tagName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
             ORDER BY r.viewCount DESC`,
            [tagName]
        );

        const recipeIds = recipesRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: 'No recipes found'
            };
        }

        const related = await fetchRecipeRelatedData(recipeIds, userId);

        const recipes = recipesRows.map(recipe =>
            mapRecipePayload(
                recipe,
                related.cookingStepsRows,
                related.ingredientsRows,
                related.commentsRows,
                related.tagsRows,
                related.likedRecipes
            )
        );

        return {
            success: true,
            data: recipes,
            message: 'Search recipes by tag successfully'
        };
    } catch (error) {
        console.error('Error in searchRecipesByTag:', error);
        return {
            success: false,
            data: null,
            message: `Failed to search recipes: ${error.message}`
        };
    }
};

exports.getRecipesByUserId = async (userId) => {
    try {
        if (!userId || typeof userId !== 'number' || userId <= 0) {
            throw new Error('userId must be a positive number');
        }

        const [recipesRows] = await pool.query(
            `SELECT 
                r.recipeId, r.recipeName, r.image, r.cookingTime, r.ration,
                r.viewCount, r.likeQuantity, r.createdAt,
                u.fullName AS userName
             FROM Recipes r
             JOIN Users u ON r.userId = u.userId
             WHERE r.userId = ?
             ORDER BY r.createdAt DESC`,
            [userId]
        );

        const recipeIds = recipesRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: 'No recipes found for this user'
            };
        }

        const related = await fetchRecipeRelatedData(recipeIds, userId);

        const recipes = recipesRows.map(recipe =>
            mapRecipePayload(
                recipe,
                related.cookingStepsRows,
                related.ingredientsRows,
                related.commentsRows,
                related.tagsRows,
                related.likedRecipes
            )
        );

        return {
            success: true,
            data: recipes,
            message: 'Recipes retrieved successfully'
        };
    } catch (error) {
        console.error('Error in getRecipesByUserId:', error);
        throw error;
    }
};

exports.getRecipeGrowthByMonth = async () => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                YEAR(createdAt) AS year,
                MONTH(createdAt) AS month,
                COUNT(*) AS recipeCount
            FROM Recipes
            GROUP BY YEAR(createdAt), MONTH(createdAt)
            ORDER BY YEAR(createdAt) DESC, MONTH(createdAt) DESC
        `);

        const report = rows.map(row => ({
            year: Number(row.year),
            month: Number(row.month),
            recipeCount: Number(row.recipeCount)
        }));

        return {
            success: true,
            data: report,
            message: 'Recipe growth report retrieved successfully'
        };
    } catch (error) {
        console.error('Error in getRecipeGrowthByMonth:', error);
        throw new Error(`Database query failed: ${error.message}`);
    }
};
