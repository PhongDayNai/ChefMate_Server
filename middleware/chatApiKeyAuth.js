const REQUIRED_CHAT_API_KEY = process.env.CHAT_API_KEY || '__CHANGE_ME_CHAT_API_KEY__';

module.exports = function chatApiKeyAuth(req, res, next) {
    const headerKey = req.headers['x-api-key'];
    const authHeader = req.headers.authorization;

    let bearerKey = null;
    if (authHeader && typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
        bearerKey = authHeader.slice(7).trim();
    }

    const providedKey = headerKey || bearerKey || req.query?.authKey || req.body?.authKey;

    if (!providedKey || providedKey !== REQUIRED_CHAT_API_KEY) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: invalid or missing chat auth key'
        });
    }

    return next();
};
