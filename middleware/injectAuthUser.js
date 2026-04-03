module.exports = function injectAuthUser(req, _res, next) {
    req.body = req.body || {};
    req.query = req.query || {};

    const authUserId = Number(req.auth?.userId || 0);
    const incomingUserId = Number(req.body.userId || req.query.userId || 0);

    // JWT mode: bắt buộc lấy từ token
    // chat-api-key mode: fallback cho phép lấy từ body/query để tương thích client cũ
    const finalUserId = authUserId > 0 ? authUserId : (incomingUserId > 0 ? incomingUserId : 0);

    req.userId = finalUserId;
    req.body.userId = finalUserId;
    req.query.userId = finalUserId;

    return next();
};
