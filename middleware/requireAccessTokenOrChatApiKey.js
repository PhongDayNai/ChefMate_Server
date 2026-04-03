const { verifyAccessToken } = require('../utils/jwtToken');

const REQUIRED_CHAT_API_KEY = process.env.CHAT_API_KEY || '__CHANGE_ME_CHAT_API_KEY__';

module.exports = function requireAccessTokenOrChatApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    const headerKey = req.headers['x-api-key'];

    // 1) Try Bearer access token first
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        const token = authHeader.slice(7).trim();

        // backward compatibility: allow Authorization: Bearer <CHAT_API_KEY>
        if (token && token === REQUIRED_CHAT_API_KEY) {
            const inferredUserId = Number(req.body?.userId || req.query?.userId || 0);
            req.auth = {
                userId: inferredUserId > 0 ? inferredUserId : null,
                mode: 'chat-api-key'
            };
            return next();
        }

        try {
            const payload = verifyAccessToken(token);
            if (!payload?.userId || Number(payload.userId) <= 0) {
                return res.status(401).json({
                    success: false,
                    data: null,
                    message: 'Unauthorized: invalid token payload'
                });
            }

            req.auth = {
                userId: Number(payload.userId),
                phone: payload.phone || null,
                email: payload.email || null,
                fullName: payload.fullName || null,
                mode: 'jwt'
            };

            return next();
        } catch (_) {
            // continue checking x-api-key below
        }
    }

    // 2) x-api-key mode for legacy chat compatibility
    if (headerKey && headerKey === REQUIRED_CHAT_API_KEY) {
        const inferredUserId = Number(req.body?.userId || req.query?.userId || 0);
        req.auth = {
            userId: inferredUserId > 0 ? inferredUserId : null,
            mode: 'chat-api-key'
        };
        return next();
    }

    return res.status(401).json({
        success: false,
        data: null,
        message: 'Unauthorized: missing/invalid access token or chat api key'
    });
};