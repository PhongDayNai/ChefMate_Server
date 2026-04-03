module.exports = function injectAuthUser(req, _res, next) {
    const userId = Number(req.auth?.userId || 0);

    req.userId = userId;
    req.body = req.body || {};
    req.query = req.query || {};

    // Always override incoming userId to prevent spoofing
    req.body.userId = userId;
    req.query.userId = userId;

    return next();
};
