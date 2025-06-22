const { poolPromise, sql } = require('../config/dbConfig');

exports.likeRecipe = async (userId, recipeId) => {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
        await transaction.begin();

        const checkLikeResult = await transaction.request()
            .input('userId', sql.Int, userId)
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT COUNT(*) AS likeCount FROM UsersLike WHERE userId = @userId AND recipeId = @recipeId");

        const likeCount = checkLikeResult.recordset[0].likeCount;

        if (likeCount > 0) {
            await transaction.rollback();
            return { success: false, message: "User has already liked this recipe" };
        }

        await transaction.request()
            .input('userId', sql.Int, userId)
            .input('recipeId', sql.Int, recipeId)
            .query("INSERT INTO UsersLike (userId, recipeId) VALUES (@userId, @recipeId)");

        const updateResult = await transaction.request()
            .input('recipeId', sql.Int, recipeId)
            .query("UPDATE Recipes SET likeQuantity = likeQuantity + 1 WHERE recipeId = @recipeId");

        const newLikeQuantity = updateResult.recordset[0]?.likeQuantity || 0;

        await transaction.commit();
        return { 
            success: true, 
            data: { count: newLikeQuantity },
            message: "Recipe liked successfully"
        };
    } catch (error) {
        await transaction.rollback();
        console.error("Error in likeRecipe:", error);
        throw new Error("Failed to like recipe");
    }
};

exports.addComment = async (userId, recipeId, content) => {
    const pool = await poolPromise;
    const transaction = pool.transaction();

    try {
        await transaction.begin();

        const userCheck = await transaction.request()
            .input('userId', sql.Int, userId)
            .query("SELECT COUNT(*) AS userCount FROM Users WHERE userId = @userId");
        
        if (userCheck.recordset[0].userCount === 0) {
            throw new Error("User does not exist");
        }

        const recipeCheck = await transaction.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT COUNT(*) AS recipeCount FROM Recipes WHERE recipeId = @recipeId");
        
        if (recipeCheck.recordset[0].recipeCount === 0) {
            await transaction.rollback();
            console.log(`addComment: Recipe ${recipeId} does not exist`);
            throw new Error("Recipe does not exist");
        }

        const commentResult = await transaction.request()
            .input('userId', sql.Int, userId)
            .input('recipeId', sql.Int, recipeId)
            .input('content', sql.NVarChar, content)
            .query("INSERT INTO UsersComment (userId, recipeId, content) OUTPUT INSERTED.ucId VALUES (@userId, @recipeId, @content)");

        const countResult = await transaction.request()
            .input('recipeId', sql.Int, recipeId)
            .query("SELECT COUNT(*) AS commentCount FROM UsersComment WHERE recipeId = @recipeId");

        const newCommentCount = countResult.recordset[0].commentCount;

        const commentsResult = await transaction.request()
            .input('recipeId', sql.Int, recipeId)
            .query(`
                SELECT uc.ucId, uc.userId, u.fullName AS userName, uc.content, uc.createdAt
                FROM UsersComment uc
                JOIN Users u ON uc.userId = u.userId
                WHERE uc.recipeId = @recipeId
                ORDER BY uc.createdAt ASC
            `);

        const comments = commentsResult.recordset.map(comment => ({
            commentId: comment.ucId,
            userId: comment.userId,
            userName: comment.userName,
            content: comment.content,
            createdAt: comment.createdAt.toISOString()
        }));
        await transaction.commit();

        return {
            success: true,
            data: { count: newCommentCount, comments: comments },
            message: "Comment added successfully"
        };
    } catch (error) {
        await transaction.rollback();
        console.error("Error in addComment:", error);
        throw error;
    }
};

exports.increaseViewCount = async (recipeId) => {
    const pool = await poolPromise;

    try {
        if (!recipeId || recipeId <= 0) {
            return {
                success: false,
                data: null,
                message: "Invalid recipeId"
            };
        }

        const result = await pool.request()
            .input('recipeId', sql.Int, recipeId)
            .query(`
                UPDATE Recipes
                SET viewCount = viewCount + 1
                OUTPUT INSERTED.viewCount
                WHERE recipeId = @recipeId;
            `);

        if (result.rowsAffected[0] === 0) {
            return {
                success: false,
                data: null,
                message: "Recipe not found"
            };
        }

        const newViewCount = result.recordset[0]?.viewCount;

        return {
            success: true,
            data: { count: newViewCount },
            message: "Increase view count successfully"
        };
    } catch (error) {
        console.log("error in increaseViewCount:", error);
        return {
            success: false,
            data: null,
            message: "Failed to increase view count: " + error.message
        };
    }
};