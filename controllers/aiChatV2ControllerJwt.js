const aiChatV2Controller = require('./aiChatV2Controller');

function withAuthUser(req) {
    req.body = req.body || {};
    req.query = req.query || {};
    const userId = Number(req.auth?.userId || req.userId || 0);
    req.body.userId = userId;
    req.query.userId = userId;
}

exports.createMealSession = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.createMealSession(req, res);
};

exports.replaceMealRecipes = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.replaceMealRecipes(req, res);
};

exports.updateMealRecipeStatus = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.updateMealRecipeStatus(req, res);
};

exports.setMealPrimaryRecipe = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.setMealPrimaryRecipe(req, res);
};

exports.completeMealSession = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.completeMealSession(req, res);
};

exports.sendMessageV2 = (req, res) => {
    withAuthUser(req);
    return aiChatV2Controller.sendMessageV2(req, res);
};
