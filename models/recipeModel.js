const { pool } = require('../config/dbConfig');

const RECIPE_STATUS = {
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected'
};

const ALLOWED_REVIEW_STATUS = new Set([
    RECIPE_STATUS.APPROVED,
    RECIPE_STATUS.REJECTED,
    RECIPE_STATUS.PENDING
]);

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
            WHERE r.status = ?
            ORDER BY r.createdAt DESC
        `, [RECIPE_STATUS.APPROVED]);

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
            `INSERT INTO Recipes (recipeName, image, cookingTime, ration, likeQuantity, userId, status)
             VALUES (?, ?, ?, ?, 0, ?, ?)`,
            [recipeName, image, cookingTime, ration, userId, RECIPE_STATUS.PENDING]
        );

        const recipeId = recipeResult.insertId;

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
             WHERE r.status = ?
               AND (
                    r.recipeName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
                    OR EXISTS (
                        SELECT 1
                        FROM RecipesIngredients ri
                        JOIN Ingredients i ON ri.ingredientId = i.ingredientId
                        WHERE ri.recipeId = r.recipeId
                          AND i.ingredientName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM CookingSteps cs
                        WHERE cs.recipeId = r.recipeId
                          AND cs.content LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM RecipesTags rt
                        JOIN Tags t ON rt.tagId = t.tagId
                        WHERE rt.recipeId = r.recipeId
                          AND t.tagName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
                    )
               )
             ORDER BY r.viewCount DESC`,
            [RECIPE_STATUS.APPROVED, recipeName, recipeName, recipeName, recipeName]
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

function resolvePeriodDays(period = 'all') {
    const p = String(period || 'all').toLowerCase();
    if (p === '7d') return 7;
    if (p === '30d') return 30;
    if (p === '90d') return 90;
    return null;
}

function resolveTimeBucket(hour) {
    if (hour >= 5 && hour <= 10) return 'breakfast';
    if (hour >= 11 && hour <= 13) return 'lunch';
    if (hour >= 14 && hour <= 17) return 'afternoon';
    if (hour >= 18 && hour <= 21) return 'dinner';
    return 'late-night';
}

function parseCookingTimeToMinutes(cookingTime) {
    const text = String(cookingTime || '').toLowerCase().trim();
    if (!text) return null;

    const hourMatch = text.match(/(\d+)\s*(giờ|hour|hours|hr|h)/i);
    const minMatch = text.match(/(\d+)\s*(phút|minute|minutes|min|mins|m)/i);

    const hours = hourMatch ? Number(hourMatch[1]) : 0;
    const minutes = minMatch ? Number(minMatch[1]) : 0;

    if (!hours && !minutes) {
        const onlyNumber = text.match(/\d+/);
        return onlyNumber ? Number(onlyNumber[0]) : null;
    }

    return (hours * 60) + minutes;
}

function calcMealTimeBonus({ recipeName, tags = [], cookingTime, hour }) {
    const bucket = resolveTimeBucket(hour);
    const haystack = `${String(recipeName || '').toLowerCase()} ${tags.map(t => String(t || '').toLowerCase()).join(' ')}`;

    const hasAny = (keywords) => keywords.some(k => haystack.includes(k));

    const kw = {
        breakfast: ['bữa sáng', 'breakfast', 'toast', 'bánh mì', 'trứng', 'yến mạch', 'pancake', 'cháo', 'phở'],
        lunch: ['bữa trưa', 'lunch', 'cơm', 'mì', 'bún', 'salad', 'canh'],
        afternoon: ['ăn vặt', 'snack', 'tráng miệng', 'dessert', 'bánh ngọt', 'trà', 'cà phê', 'sinh tố'],
        dinner: ['bữa tối', 'dinner', 'cà ri', 'hầm', 'nướng', 'lẩu', 'súp', 'cá', 'gà', 'bò'],
        lateNight: ['súp', 'cháo', 'salad', 'nhẹ', 'healthy', 'detox', 'sữa chua']
    };

    const match = {
        breakfast: hasAny(kw.breakfast),
        lunch: hasAny(kw.lunch),
        afternoon: hasAny(kw.afternoon),
        dinner: hasAny(kw.dinner),
        lateNight: hasAny(kw.lateNight)
    };

    const cookingMinutes = parseCookingTimeToMinutes(cookingTime);
    let score = 0;

    if (bucket === 'breakfast') {
        if (match.breakfast) score += 24;
        if (match.lunch) score += 3;
        if (match.afternoon) score -= 10;
        if (match.dinner) score -= 14;

        if (cookingMinutes !== null) {
            if (cookingMinutes <= 25) score += 7;
            else if (cookingMinutes <= 40) score += 3;
            else if (cookingMinutes > 70) score -= 8;
        }
    } else if (bucket === 'lunch') {
        if (match.lunch) score += 24;
        if (match.dinner) score += 4;
        if (match.afternoon) score -= 6;

        if (cookingMinutes !== null) {
            if (cookingMinutes <= 40) score += 4;
            else if (cookingMinutes > 120) score -= 5;
        }
    } else if (bucket === 'afternoon') {
        if (match.afternoon) score += 22;
        if (match.breakfast) score += 3;
        if (match.dinner) score -= 7;

        if (cookingMinutes !== null) {
            if (cookingMinutes <= 25) score += 5;
            else if (cookingMinutes > 60) score -= 4;
        }
    } else if (bucket === 'dinner') {
        if (match.dinner) score += 24;
        if (match.lunch) score += 4;
        if (match.afternoon) score -= 8;

        if (cookingMinutes !== null) {
            if (cookingMinutes >= 25 && cookingMinutes <= 90) score += 5;
            else if (cookingMinutes <= 15) score -= 3;
        }
    } else {
        if (match.lateNight) score += 20;
        if (match.afternoon) score -= 6;
        if (match.dinner) score -= 8;

        if (cookingMinutes !== null) {
            if (cookingMinutes <= 20) score += 8;
            else if (cookingMinutes > 45) score -= 7;
        }
    }

    return {
        score,
        bucket,
        cookingMinutes
    };
}

exports.getTrendingFeed = async ({ userId = null, page = 1, limit = 20, period = 'all' } = {}) => {
    try {
        const parsedPage = Math.max(Number(page) || 1, 1);
        const parsedLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
        const offset = (parsedPage - 1) * parsedLimit;
        const periodDays = resolvePeriodDays(period);

        const periodClause = periodDays
            ? 'WHERE r.status = ? AND r.createdAt >= DATE_SUB(NOW(), INTERVAL ? DAY)'
            : 'WHERE r.status = ?';
        const baseParams = periodDays ? [RECIPE_STATUS.APPROVED, periodDays] : [RECIPE_STATUS.APPROVED];

        const [allRows] = await pool.query(
            `SELECT
                r.recipeId,
                r.recipeName,
                r.image,
                r.cookingTime,
                r.ration,
                r.viewCount,
                r.likeQuantity,
                r.createdAt,
                u.fullName AS userName,
                ROUND(
                    (r.viewCount * 0.60) +
                    (r.likeQuantity * 2.00) +
                    GREATEST(0, 20 - TIMESTAMPDIFF(DAY, r.createdAt, NOW()))
                , 2) AS trendScore
             FROM Recipes r
             JOIN Users u ON r.userId = u.userId
             ${periodClause}`,
            baseParams
        );

        const total = Number(allRows.length || 0);
        const totalPages = Math.max(Math.ceil(total / parsedLimit), 1);

        const [[timeRow]] = await pool.query('SELECT HOUR(NOW()) AS serverHour');
        const serverHour = Number(timeRow?.serverHour ?? new Date().getHours());

        if (total === 0) {
            return {
                success: true,
                data: {
                    items: [],
                    pagination: {
                        page: parsedPage,
                        limit: parsedLimit,
                        total,
                        totalPages,
                        hasMore: false
                    },
                    period: periodDays ? `${periodDays}d` : 'all',
                    timeContext: {
                        serverHour,
                        bucket: resolveTimeBucket(serverHour)
                    }
                },
                message: 'Get trending feed successfully'
            };
        }

        const allRecipeIds = allRows.map(r => Number(r.recipeId));
        const { placeholders, params } = makeInClauseParams(allRecipeIds);
        const [tagsRows] = await pool.query(
            `SELECT rt.recipeId, t.tagName
             FROM RecipesTags rt
             JOIN Tags t ON rt.tagId = t.tagId
             WHERE rt.recipeId IN (${placeholders})`,
            params
        );

        const tagsByRecipeId = new Map();
        for (const row of tagsRows) {
            const rid = Number(row.recipeId);
            if (!tagsByRecipeId.has(rid)) tagsByRecipeId.set(rid, []);
            tagsByRecipeId.get(rid).push(row.tagName);
        }

        const rankedRows = allRows
            .map(r => {
                const rid = Number(r.recipeId);
                const tags = tagsByRecipeId.get(rid) || [];
                const meal = calcMealTimeBonus({
                    recipeName: r.recipeName,
                    tags,
                    cookingTime: r.cookingTime,
                    hour: serverHour
                });

                const baseTrendScore = Number(r.trendScore || 0);
                const finalTrendScore = Number((baseTrendScore + meal.score).toFixed(2));

                return {
                    ...r,
                    trendScore: finalTrendScore
                };
            })
            .sort((a, b) => {
                if (Number(b.trendScore) !== Number(a.trendScore)) {
                    return Number(b.trendScore) - Number(a.trendScore);
                }
                return Number(b.recipeId) - Number(a.recipeId);
            });

        const pageRows = rankedRows.slice(offset, offset + parsedLimit);
        const pageRecipeIds = pageRows.map(r => Number(r.recipeId));

        let items = [];
        if (pageRecipeIds.length > 0) {
            const related = await fetchRecipeRelatedData(pageRecipeIds, userId);
            items = pageRows.map(recipe =>
                mapRecipePayload(
                    recipe,
                    related.cookingStepsRows,
                    related.ingredientsRows,
                    related.commentsRows,
                    related.tagsRows,
                    related.likedRecipes
                )
            );
        }

        return {
            success: true,
            data: {
                items,
                pagination: {
                    page: parsedPage,
                    limit: parsedLimit,
                    total,
                    totalPages,
                    hasMore: parsedPage < totalPages
                },
                period: periodDays ? `${periodDays}d` : 'all',
                timeContext: {
                    serverHour,
                    bucket: resolveTimeBucket(serverHour)
                }
            },
            message: 'Get trending feed successfully'
        };
    } catch (error) {
        console.log('error in getTrendingFeed:', error);
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
             WHERE r.status = ?
             ORDER BY r.viewCount DESC
             LIMIT 30`,
            [RECIPE_STATUS.APPROVED]
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
             WHERE r.status = ?
               AND t.tagName LIKE CONCAT('%', ?, '%') COLLATE utf8mb4_unicode_ci
             ORDER BY r.viewCount DESC`,
            [RECIPE_STATUS.APPROVED, tagName]
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
               AND r.status = ?
             ORDER BY r.createdAt DESC`,
            [userId, RECIPE_STATUS.APPROVED]
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

exports.getPendingRecipes = async ({ userId = null } = {}) => {
    try {
        const [recipesRows] = await pool.query(
            `SELECT
                r.recipeId,
                r.recipeName,
                r.image,
                r.cookingTime,
                r.ration,
                r.viewCount,
                r.likeQuantity,
                r.createdAt,
                r.status,
                u.fullName AS userName
             FROM Recipes r
             JOIN Users u ON r.userId = u.userId
             WHERE r.status = ?
             ORDER BY r.createdAt ASC`,
            [RECIPE_STATUS.PENDING]
        );

        const recipeIds = recipesRows.map(r => Number(r.recipeId));
        if (recipeIds.length === 0) {
            return {
                success: true,
                data: [],
                message: 'No pending recipes found'
            };
        }

        const related = await fetchRecipeRelatedData(recipeIds, userId);

        const recipes = recipesRows.map(recipe => ({
            ...mapRecipePayload(
                recipe,
                related.cookingStepsRows,
                related.ingredientsRows,
                related.commentsRows,
                related.tagsRows,
                related.likedRecipes
            ),
            status: recipe.status
        }));

        return {
            success: true,
            data: recipes,
            message: 'Get pending recipes successfully'
        };
    } catch (error) {
        console.error('Error in getPendingRecipes:', error);
        throw error;
    }
};

exports.reviewRecipe = async ({ recipeId, status }) => {
    const parsedRecipeId = Number(recipeId);
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (!parsedRecipeId || parsedRecipeId <= 0) {
        throw new Error('recipeId must be a positive number');
    }

    if (!ALLOWED_REVIEW_STATUS.has(normalizedStatus)) {
        throw new Error('status must be one of: approved, rejected, pending');
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [recipeRows] = await conn.query(
            `SELECT recipeId, userId, status
             FROM Recipes
             WHERE recipeId = ?
             LIMIT 1
             FOR UPDATE`,
            [parsedRecipeId]
        );

        if (recipeRows.length === 0) {
            await conn.rollback();
            return {
                success: false,
                data: null,
                message: 'Recipe not found'
            };
        }

        const currentStatus = String(recipeRows[0].status || '').toLowerCase();
        const ownerUserId = Number(recipeRows[0].userId);

        if (currentStatus === normalizedStatus) {
            await conn.commit();
            return {
                success: true,
                data: {
                    recipeId: parsedRecipeId,
                    status: normalizedStatus
                },
                message: 'Recipe status updated successfully'
            };
        }

        await conn.query(
            'UPDATE Recipes SET status = ? WHERE recipeId = ?',
            [normalizedStatus, parsedRecipeId]
        );

        if (currentStatus !== RECIPE_STATUS.APPROVED && normalizedStatus === RECIPE_STATUS.APPROVED) {
            await conn.query(
                'UPDATE Users SET recipeCount = recipeCount + 1 WHERE userId = ?',
                [ownerUserId]
            );
        }

        if (currentStatus === RECIPE_STATUS.APPROVED && normalizedStatus !== RECIPE_STATUS.APPROVED) {
            await conn.query(
                'UPDATE Users SET recipeCount = GREATEST(recipeCount - 1, 0) WHERE userId = ?',
                [ownerUserId]
            );
        }

        await conn.commit();

        return {
            success: true,
            data: {
                recipeId: parsedRecipeId,
                status: normalizedStatus
            },
            message: 'Recipe status updated successfully'
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error in reviewRecipe:', error);
        throw error;
    } finally {
        conn.release();
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
            WHERE status = ?
            GROUP BY YEAR(createdAt), MONTH(createdAt)
            ORDER BY YEAR(createdAt) DESC, MONTH(createdAt) DESC
        `, [RECIPE_STATUS.APPROVED]);

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
