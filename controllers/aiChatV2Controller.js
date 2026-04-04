const aiChatV2Model = require('../models/aiChatV2Model');

function isBadRequestError(error) {
    const msg = String(error?.message || '').toLowerCase();

    return [
        'required',
        'must be',
        'invalid',
        'not approved',
        'not found in meal session'
    ].some(keyword => msg.includes(keyword));
}

exports.createMealSession = async (req, res) => {
    const { userId, title, recipeIds, recipes } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatV2Model.createMealSession({
            userId: Number(userId),
            title,
            recipeIds: Array.isArray(recipeIds) ? recipeIds : null,
            recipes: Array.isArray(recipes) ? recipes : null
        });

        return res.status(201).json(result);
    } catch (error) {
        console.error('Error in createMealSession:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to create meal chat session: ${error.message}`
        });
    }
};

exports.replaceMealRecipes = async (req, res) => {
    const { userId, chatSessionId, recipeIds, recipes } = req.body || {};

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
        const result = await aiChatV2Model.replaceMealRecipes({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            recipeIds: Array.isArray(recipeIds) ? recipeIds : null,
            recipes: Array.isArray(recipes) ? recipes : null
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in replaceMealRecipes:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to update meal recipes: ${error.message}`
        });
    }
};

exports.updateMealRecipeStatus = async (req, res) => {
    const { userId, chatSessionId, recipeId, status, note, confirmSwitchPrimary, nextPrimaryRecipeId } = req.body || {};

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

    if (!recipeId || Number(recipeId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'recipeId is required and must be a positive number'
        });
    }

    if (!status || typeof status !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'status is required'
        });
    }

    try {
        const result = await aiChatV2Model.updateMealRecipeStatus({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            recipeId: Number(recipeId),
            status: String(status),
            note: note === null || note === undefined ? null : String(note),
            confirmSwitchPrimary: confirmSwitchPrimary === true,
            nextPrimaryRecipeId: nextPrimaryRecipeId === null || nextPrimaryRecipeId === undefined
                ? null
                : Number(nextPrimaryRecipeId)
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateMealRecipeStatus:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to update meal recipe status: ${error.message}`
        });
    }
};

exports.setMealPrimaryRecipe = async (req, res) => {
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
        const result = await aiChatV2Model.setMealPrimaryRecipe({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            recipeId: recipeId === null || recipeId === undefined ? null : Number(recipeId)
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in setMealPrimaryRecipe:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to set meal primary recipe: ${error.message}`
        });
    }
};

exports.completeMealSession = async (req, res) => {
    const { userId, chatSessionId, completionType, note, markRemainingStatus } = req.body || {};

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
        const result = await aiChatV2Model.completeMealSession({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            completionType: completionType === undefined ? 'completed' : String(completionType),
            note: note === null || note === undefined ? null : String(note),
            markRemainingStatus: markRemainingStatus === null || markRemainingStatus === undefined
                ? null
                : String(markRemainingStatus)
        });

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in completeMealSession:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to complete meal session: ${error.message}`
        });
    }
};

exports.resolveCompletionCheckV2 = async (req, res) => {
    const { userId, chatSessionId, action, pendingUserMessage, nextPrimaryRecipeId, model } = req.body || {};

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

    if (!action || typeof action !== 'string') {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'action is required'
        });
    }

    try {
        const result = await aiChatV2Model.resolveCompletionCheckV2({
            userId: Number(userId),
            chatSessionId: Number(chatSessionId),
            action,
            pendingUserMessage: pendingUserMessage === undefined || pendingUserMessage === null
                ? ''
                : String(pendingUserMessage),
            nextPrimaryRecipeId: nextPrimaryRecipeId === null || nextPrimaryRecipeId === undefined
                ? null
                : Number(nextPrimaryRecipeId),
            model
        });

        if (!result.success && result.code === 'AI_SERVER_BUSY') {
            return res.status(503).json(result);
        }

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in resolveCompletionCheckV2:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to resolve completion check v2: ${error.message}`
        });
    }
};

exports.sendMessageV2 = async (req, res) => {
    const { userId, chatSessionId, message, model, stream, useUnifiedSession } = req.body || {};

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
        const result = await aiChatV2Model.sendMessageV2({
            userId: Number(userId),
            chatSessionId: chatSessionId ? Number(chatSessionId) : null,
            message,
            model,
            stream: Boolean(stream),
            useUnifiedSession: useUnifiedSession === undefined ? true : Boolean(useUnifiedSession)
        });

        if (!result.success && result.code === 'AI_SERVER_BUSY') {
            return res.status(503).json(result);
        }

        if (!result.success) {
            return res.status(404).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in sendMessageV2:', error);
        return res.status(isBadRequestError(error) ? 400 : 500).json({
            success: false,
            data: null,
            message: `Failed to send message v2: ${error.message}`
        });
    }
};
