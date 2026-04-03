const aiChatController = require('./aiChatController');

function withAuthUser(req) {
    req.body = req.body || {};
    req.query = req.query || {};
    const userId = Number(req.auth?.userId || req.userId || 0);
    req.body.userId = userId;
    req.query.userId = userId;
}

exports.createSession = (req, res) => {
    withAuthUser(req);
    return aiChatController.createSession(req, res);
};

exports.getSessionsByUser = (req, res) => {
    withAuthUser(req);
    return aiChatController.getSessionsByUser(req, res);
};

exports.getSessionHistory = (req, res) => {
    withAuthUser(req);
    return aiChatController.getSessionHistory(req, res);
};

exports.deleteSession = (req, res) => {
    withAuthUser(req);
    return aiChatController.deleteSession(req, res);
};

exports.updateSessionTitle = (req, res) => {
    withAuthUser(req);
    return aiChatController.updateSessionTitle(req, res);
};

exports.updateActiveRecipe = (req, res) => {
    withAuthUser(req);
    return aiChatController.updateActiveRecipe(req, res);
};

exports.getRecommendationsFromPantry = (req, res) => {
    withAuthUser(req);
    return aiChatController.getRecommendationsFromPantry(req, res);
};

exports.resolvePreviousSession = (req, res) => {
    withAuthUser(req);
    return aiChatController.resolvePreviousSession(req, res);
};

exports.sendMessage = (req, res) => {
    withAuthUser(req);
    return aiChatController.sendMessage(req, res);
};

exports.getUnifiedTimeline = (req, res) => {
    withAuthUser(req);
    return aiChatController.getUnifiedTimeline(req, res);
};
