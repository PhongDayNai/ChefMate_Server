const aiChatModel = require('../models/aiChatModel');

exports.createSession = async (req, res) => {
    const { userId, title, activeRecipeId, firstMessage, model } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.createSession({
            userId: Number(userId),
            title,
            activeRecipeId: activeRecipeId ? Number(activeRecipeId) : null,
            firstMessage: firstMessage || '',
            model
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in createSession:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to create chat session: ${error.message}`
        });
    }
};

exports.getSessionsByUser = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);
    const page = Number(req.query.page || req.body?.page || 1);
    const limit = Number(req.query.limit || req.body?.limit || 50);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.getSessionsByUser({ userId, page, limit });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSessionsByUser:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get sessions: ${error.message}`
        });
    }
};

exports.getSessionHistory = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);
    const chatSessionId = Number(req.params.sessionId || req.query.sessionId || req.body?.chatSessionId);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!chatSessionId || chatSessionId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'chatSessionId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.getSessionHistory({
            userId,
            chatSessionId
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getSessionHistory:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get session history: ${error.message}`
        });
    }
};

exports.deleteSession = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);
    const chatSessionId = Number(req.params.id || req.params.sessionId || req.body?.chatSessionId);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!chatSessionId || chatSessionId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'chatSessionId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.deleteSession({ userId, chatSessionId });
        if (!result.success) {
            return res.status(404).json(result);
        }
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in deleteSession:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to delete session: ${error.message}`
        });
    }
};

exports.updateSessionTitle = async (req, res) => {
    const { userId, chatSessionId, title } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!chatSessionId || Number(chatSessionId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'chatSessionId is required and must be a positive number'
        });
    }

    if (!title || !String(title).trim()) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'title is required'
        });
    }

    try {
        const result = await aiChatModel.updateSessionTitle({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            title: String(title)
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateSessionTitle:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to update session title: ${error.message}`
        });
    }
};

exports.updateActiveRecipe = async (req, res) => {
    const { userId, chatSessionId, recipeId } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!chatSessionId || Number(chatSessionId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'chatSessionId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.updateActiveRecipe({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            recipeId: recipeId === null || recipeId === undefined ? null : Number(recipeId)
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateActiveRecipe:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to update active recipe: ${error.message}`
        });
    }
};

exports.getRecommendationsFromPantry = async (req, res) => {
    const userId = Number(req.body?.userId || req.query.userId);
    const limit = req.body?.limit ?? req.query.limit;

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.getRecommendationsFromPantry({ userId, limit });
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getRecommendationsFromPantry:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get recommendations: ${error.message}`
        });
    }
};

exports.resolvePreviousSession = async (req, res) => {
    const { userId, previousSessionId, action, pendingUserMessage, model } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!previousSessionId || Number(previousSessionId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'previousSessionId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.resolvePreviousSession({
            userId: Number(userId),
            previousSessionId: Number(previousSessionId),
            action: String(action || ''),
            pendingUserMessage: pendingUserMessage === undefined || pendingUserMessage === null
                ? ''
                : String(pendingUserMessage),
            model
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in resolvePreviousSession:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to resolve previous session: ${error.message}`
        });
    }
};

exports.sendMessage = async (req, res) => {
    const { userId, chatSessionId, message, model, stream, activeRecipeId, useUnifiedSession } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'message is required'
        });
    }

    try {
        const result = await aiChatModel.sendMessage({
            userId: Number(userId),
            chatSessionId: chatSessionId ? Number(chatSessionId) : null,
            message,
            model,
            stream: Boolean(stream),
            activeRecipeId: activeRecipeId === null || activeRecipeId === undefined ? null : Number(activeRecipeId),
            useUnifiedSession: useUnifiedSession === undefined ? true : Boolean(useUnifiedSession)
        });

        if (!result.success && result.code === 'AI_SERVER_BUSY') {
            return res.status(503).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in sendMessage:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to send message: ${error.message}`
        });
    }
};

exports.getUnifiedTimeline = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);
    const beforeMessageId = req.query.beforeMessageId || req.body?.beforeMessageId || null;
    const limit = req.query.limit || req.body?.limit || 30;

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.getUnifiedTimeline({
            userId,
            beforeMessageId,
            limit,
            createIfMissing: true
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getUnifiedTimeline:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get unified chat timeline: ${error.message}`
        });
    }
};
