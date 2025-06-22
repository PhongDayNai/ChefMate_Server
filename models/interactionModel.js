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

        await transaction.request()
            .input('recipeId', sql.Int, recipeId)
            .query("UPDATE Recipes SET likeQuantity = likeQuantity + 1 WHERE recipeId = @recipeId");

        await transaction.commit();
        return { 
            success: true, 
            data: true,
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
            throw new Error("Recipe does not exist");
        }

        const commentResult = await transaction.request()
            .input('userId', sql.Int, userId)
            .input('recipeId', sql.Int, recipeId)
            .input('content', sql.NVarChar, content)
            .query("INSERT INTO UsersComment (userId, recipeId, content) OUTPUT INSERTED.ucId VALUES (@userId, @recipeId, @content)");

        await transaction.commit();

        return {
            success: true,
            data: true,
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
