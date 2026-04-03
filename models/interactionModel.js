const { pool } = require('../config/dbConfig');

exports.likeRecipe = async (userId, recipeId) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [recipeRows] = await conn.query(
            "SELECT likeQuantity FROM Recipes WHERE recipeId = ? AND status = 'approved' LIMIT 1",
            [recipeId]
        );

        if (recipeRows.length === 0) {
            await conn.rollback();
            return {
                success: false,
                data: null,
                message: 'Recipe not found'
            };
        }

        const [checkRows] = await conn.query(
            'SELECT COUNT(*) AS likeCount FROM UsersLike WHERE userId = ? AND recipeId = ?',
            [userId, recipeId]
        );

        const likeCount = Number(checkRows[0]?.likeCount || 0);
        let liked = false;

        if (likeCount > 0) {
            await conn.query(
                'DELETE FROM UsersLike WHERE userId = ? AND recipeId = ?',
                [userId, recipeId]
            );
            await conn.query(
                'UPDATE Recipes SET likeQuantity = GREATEST(likeQuantity - 1, 0) WHERE recipeId = ?',
                [recipeId]
            );
            liked = false;
        } else {
            await conn.query(
                'INSERT INTO UsersLike (userId, recipeId) VALUES (?, ?)',
                [userId, recipeId]
            );
            await conn.query(
                'UPDATE Recipes SET likeQuantity = likeQuantity + 1 WHERE recipeId = ?',
                [recipeId]
            );
            liked = true;
        }

        const [countRows] = await conn.query(
            'SELECT likeQuantity FROM Recipes WHERE recipeId = ? LIMIT 1',
            [recipeId]
        );

        const newLikeQuantity = Number(countRows[0]?.likeQuantity || 0);

        await conn.commit();
        return {
            success: true,
            data: {
                count: newLikeQuantity,
                liked
            },
            message: liked ? 'Recipe liked successfully' : 'Recipe unliked successfully'
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error in likeRecipe:', error);
        throw new Error('Failed to toggle like recipe');
    } finally {
        conn.release();
    }
};

exports.addComment = async (userId, recipeId, content) => {
    const conn = await pool.getConnection();

    try {
        await conn.beginTransaction();

        const [userRows] = await conn.query(
            'SELECT COUNT(*) AS userCount FROM Users WHERE userId = ?',
            [userId]
        );

        if (Number(userRows[0]?.userCount || 0) === 0) {
            throw new Error('User does not exist');
        }

        const [recipeRows] = await conn.query(
            "SELECT COUNT(*) AS recipeCount FROM Recipes WHERE recipeId = ? AND status = 'approved'",
            [recipeId]
        );

        if (Number(recipeRows[0]?.recipeCount || 0) === 0) {
            await conn.rollback();
            throw new Error('Recipe does not exist');
        }

        await conn.query(
            'INSERT INTO UsersComment (userId, recipeId, content) VALUES (?, ?, ?)',
            [userId, recipeId, content]
        );

        const [countRows] = await conn.query(
            'SELECT COUNT(*) AS commentCount FROM UsersComment WHERE recipeId = ?',
            [recipeId]
        );

        const newCommentCount = Number(countRows[0]?.commentCount || 0);

        const [commentsRows] = await conn.query(
            `SELECT uc.ucId, uc.userId, u.fullName AS userName, uc.content, uc.createdAt
             FROM UsersComment uc
             JOIN Users u ON uc.userId = u.userId
             WHERE uc.recipeId = ?
             ORDER BY uc.createdAt ASC`,
            [recipeId]
        );

        const comments = commentsRows.map(comment => ({
            commentId: Number(comment.ucId),
            userId: Number(comment.userId),
            userName: comment.userName,
            content: comment.content,
            createdAt: comment.createdAt instanceof Date
                ? comment.createdAt.toISOString()
                : comment.createdAt
        }));

        await conn.commit();

        return {
            success: true,
            data: { count: newCommentCount, comments },
            message: 'Comment added successfully'
        };
    } catch (error) {
        await conn.rollback();
        console.error('Error in addComment:', error);
        throw error;
    } finally {
        conn.release();
    }
};

exports.increaseViewCount = async (recipeId) => {
    try {
        if (!recipeId || recipeId <= 0) {
            return {
                success: false,
                data: null,
                message: 'Invalid recipeId'
            };
        }

        const [updateResult] = await pool.query(
            "UPDATE Recipes SET viewCount = viewCount + 1 WHERE recipeId = ? AND status = 'approved'",
            [recipeId]
        );

        if (Number(updateResult.affectedRows || 0) === 0) {
            return {
                success: false,
                data: null,
                message: 'Recipe not found'
            };
        }

        const [rows] = await pool.query(
            'SELECT viewCount FROM Recipes WHERE recipeId = ? LIMIT 1',
            [recipeId]
        );

        const newViewCount = Number(rows[0]?.viewCount || 0);

        return {
            success: true,
            data: { count: newViewCount },
            message: 'Increase view count successfully'
        };
    } catch (error) {
        console.log('error in increaseViewCount:', error);
        return {
            success: false,
            data: null,
            message: 'Failed to increase view count: ' + error.message
        };
    }
};

exports.getAllComments = async () => {
    try {
        const [rows] = await pool.query(`
            SELECT 
                uc.ucId,
                uc.recipeId,
                uc.userId AS commentUserId,
                u1.fullName AS commentUserName,
                uc.content,
                uc.createdAt,
                r.userId AS recipeUserId,
                u2.fullName AS recipeUserName
            FROM UsersComment uc
            JOIN Users u1 ON uc.userId = u1.userId
            JOIN Recipes r ON uc.recipeId = r.recipeId
            JOIN Users u2 ON r.userId = u2.userId
            ORDER BY uc.createdAt DESC
        `);

        const comments = rows.map(comment => ({
            commentId: Number(comment.ucId),
            recipeId: Number(comment.recipeId),
            commentUser: {
                userId: Number(comment.commentUserId),
                fullName: comment.commentUserName
            },
            content: comment.content,
            createdAt: comment.createdAt,
            recipeUser: {
                userId: Number(comment.recipeUserId),
                fullName: comment.recipeUserName
            }
        }));

        return {
            success: true,
            data: comments,
            message: 'Get all comments successfully'
        };
    } catch (error) {
        console.error('Error in getAllComments:', error);
        throw error;
    }
};

exports.deleteComment = async (commentId, userId = null) => {
    try {
        const parsedCommentId = Number(commentId);
        const parsedUserId = userId === null || userId === undefined ? null : Number(userId);

        if (!parsedCommentId || parsedCommentId <= 0) {
            throw new Error('commentId is required');
        }

        let result;
        if (parsedUserId) {
            const [deleteResult] = await pool.query(
                'DELETE FROM UsersComment WHERE ucId = ? AND userId = ?',
                [parsedCommentId, parsedUserId]
            );
            result = deleteResult;
        } else {
            const [deleteResult] = await pool.query(
                'DELETE FROM UsersComment WHERE ucId = ?',
                [parsedCommentId]
            );
            result = deleteResult;
        }

        if (!Number(result.affectedRows || 0)) {
            return {
                success: false,
                data: null,
                message: 'Comment not found or not owned by user'
            };
        }

        return {
            success: true,
            data: true,
            message: 'Delete comment successfully'
        };
    } catch (error) {
        console.error('Error in deleteComment:', error);
        throw error;
    }
};
