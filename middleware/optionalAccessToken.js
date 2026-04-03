const { verifyAccessToken } = require('../utils/jwtToken');

module.exports = function optionalAccessToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return next();
    }

    if (typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: invalid Authorization header format'
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
            fullName: payload.fullName || null
        };

        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            data: null,
            message: 'Unauthorized: invalid or expired access token'
        });
    }
};