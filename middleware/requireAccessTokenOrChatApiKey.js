const { verifyAccessToken } = require('../utils/jwtToken');

const REQUIRED_CHAT_API_KEY = process.env.CHAT_API_KEY || '__CHANGE_ME_CHAT_API_KEY__';

module.exports = function requireAccessTokenOrChatApiKey(req, res, next) {
    const authHeader = req.headers.authorization;
    const headerKey = req.headers['x-api-key'];

    // BẮT BUỘC CẢ 2: Bearer JWT + x-api-key
    if (!headerKey || headerKey !== REQUIRED_CHAT_API_KEY) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: missing/invalid x-api-key for chat'
        });
    }

    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: missing Bearer access token for chat'
        });
    }

    const token = authHeader.slice(7).trim();

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
            mode: 'jwt+chat-api-key'
        };

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: invalid or expired access token for chat'
        });
    }
};