const aiChatModel = require('../models/aiChatModel');

exports.createSession = async (req, res) => {
    const { userId, pantryId, title, activeRecipeId, firstMessage, model } = req.body || {};

    if (!userId || Number(userId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    // Validate viewer cannot create session with pantryId
    if (pantryId) {
        const pantryModel = require('../models/pantryModel');
        const access = await pantryModel.getUserPantryAccess(Number(pantryId), Number(userId));
        if (access === 'viewer') {
            return res.status(403).json({
                success: false,
                data: null,
                message: 'Access denied: viewer cannot create chat sessions'
            });
        }
    }

    try {
        const result = await aiChatModel.createSession({
            userId: Number(userId),
            pantryId: pantryId ? Number(pantryId) : null,
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

exports.updateSessionPantry = async (req, res) => {
    const userId = Number(req.body?.userId);
    const chatSessionId = Number(req.params?.sessionId || req.params?.id || req.body?.chatSessionId);
    const pantryIdRaw = req.body && Object.prototype.hasOwnProperty.call(req.body, 'pantryId')
        ? req.body.pantryId
        : undefined;

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

    if (pantryIdRaw === undefined) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'pantryId is required (use null to detach the pantry)'
        });
    }

    try {
        const result = await aiChatModel.updateSessionPantry({
            userId,
            chatSessionId,
            pantryId: pantryIdRaw
        });

        if (!result.success) {
            const message = String(result.message || '').toLowerCase();
            if (message.includes('access denied')) {
                return res.status(403).json(result);
            }
            if (message.includes('not found')) {
                return res.status(404).json(result);
            }
            return res.status(400).json(result);
        }

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in updateSessionPantry:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to update session pantry: ${error.message}`
        });
    }
};

exports.getRecommendationsFromPantry = async (req, res) => {
    const userId = Number(req.body?.userId || req.query.userId);
    const limit = req.body?.limit ?? req.query.limit;
    const pantryId = req.body?.pantryId ?? req.query.pantryId;

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await aiChatModel.getRecommendationsFromPantry({ userId, pantryId, limit });
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

    // If chatSessionId provided, check if user is viewer of that session's pantry
    if (chatSessionId) {
        const aiChatModel = require('../models/aiChatModel');
        const session = await aiChatModel.getChatSessionById(Number(chatSessionId), Number(userId));
        if (session && session.pantryId) {
            const pantryModel = require('../models/pantryModel');
            const access = await pantryModel.getUserPantryAccess(session.pantryId, Number(userId));
            if (access === 'viewer') {
                return res.status(403).json({
                    success: false,
                    data: null,
                    message: 'Access denied: viewer cannot send messages'
                });
            }
        }
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

/**
 * Streaming variant of sendMessage. Responds with line-delimited JSON (NDJSON):
 *   {"type":"session", "session": {...}}
 *   {"type":"delta", "content":"..."}
 *   ...repeated...
 *   {"type":"done", "assistantMessage":"...", "session":{...}}
 *   on error: {"type":"error", "code":"...", "message":"..."}
 *
 * The client should read the response body as a stream, split on \n, and parse
 * each non-empty line as JSON.
 */
exports.sendMessageStream = async (req, res) => {
    const { userId, chatSessionId, message, model, activeRecipeId, useUnifiedSession } = req.body || {};

    const respondJsonError = (status, payload) => {
        if (res.headersSent) {
            try {
                res.write(JSON.stringify({ type: 'error', ...payload }) + '\n');
                res.end();
            } catch (_) {}
            return;
        }
        return res.status(status).json({ success: false, data: null, message: payload.message });
    };

    if (!userId || Number(userId) <= 0) {
        return respondJsonError(400, { code: 'INVALID_USER_ID', message: 'userId is required and must be a positive number' });
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
        return respondJsonError(400, { code: 'INVALID_MESSAGE', message: 'message is required' });
    }

    if (chatSessionId) {
        const session = await aiChatModel.getChatSessionById(Number(chatSessionId), Number(userId));
        if (session && session.pantryId) {
            const pantryModel = require('../models/pantryModel');
            const access = await pantryModel.getUserPantryAccess(session.pantryId, Number(userId));
            if (access === 'viewer') {
                return respondJsonError(403, { code: 'VIEWER_FORBIDDEN', message: 'Access denied: viewer cannot send messages' });
            }
        }
    }

    // Open a chunked NDJSON response. Disable any proxy buffering so deltas
    // arrive at the client as they're produced.
    res.status(200);
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    if (typeof res.flushHeaders === 'function') {
        try { res.flushHeaders(); } catch (_) {}
    }

    const writeEvent = (event) => {
        try {
            res.write(JSON.stringify(event) + '\n');
        } catch (_) {}
    };

    let clientGone = false;
    req.on('close', () => { clientGone = true; });

    try {
        const result = await aiChatModel.sendMessageStream({
            userId: Number(userId),
            chatSessionId: chatSessionId ? Number(chatSessionId) : null,
            message,
            model,
            activeRecipeId: activeRecipeId === null || activeRecipeId === undefined ? null : Number(activeRecipeId),
            useUnifiedSession: useUnifiedSession === undefined ? true : Boolean(useUnifiedSession),
            onDelta: (token) => {
                if (clientGone) return;
                writeEvent({ type: 'delta', content: token });
            }
        });

        if (clientGone) {
            try { res.end(); } catch (_) {}
            return;
        }

        if (!result?.success && result?.code === 'AI_SERVER_BUSY') {
            writeEvent({
                type: 'error',
                code: 'AI_SERVER_BUSY',
                message: result?.message || 'AI server is busy',
                session: result?.data?.session || null,
                assistantMessage: result?.data?.assistantMessage || null
            });
            return res.end();
        }

        writeEvent({
            type: 'done',
            assistantMessage: result?.data?.assistantMessage || '',
            session: result?.data?.session || null
        });
        res.end();
    } catch (error) {
        console.error('Error in sendMessageStream:', error);
        writeEvent({
            type: 'error',
            code: 'INTERNAL_ERROR',
            message: `Failed to stream message: ${error.message}`
        });
        try { res.end(); } catch (_) {}
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
