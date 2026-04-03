const jwt = require('jsonwebtoken');

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || '__CHANGE_ME_JWT_ACCESS_SECRET__';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || '__CHANGE_ME_JWT_REFRESH_SECRET__';
const ACCESS_EXPIRES_IN = process.env.JWT_ACCESS_EXPIRES_IN || '1h';
const REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function buildPayload(user = {}) {
    return {
        userId: Number(user.userId),
        phone: user.phone || null,
        email: user.email || null,
        fullName: user.fullName || null
    };
}

exports.signAccessToken = (user) => jwt.sign(buildPayload(user), ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES_IN
});

exports.signRefreshToken = (user) => jwt.sign(buildPayload(user), REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN
});

exports.verifyAccessToken = (token) => jwt.verify(token, ACCESS_SECRET);
exports.verifyRefreshToken = (token) => jwt.verify(token, REFRESH_SECRET);
