const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatControllerJwt');
const requireAccessTokenOrChatApiKey = require('../middleware/requireAccessTokenOrChatApiKey');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/sessions', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.createSession);
router.get('/sessions', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.getSessionsByUser);
router.get('/sessions/:sessionId', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.getSessionHistory);
router.delete('/sessions/:id', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.deleteSession);
router.patch('/sessions/title', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.updateSessionTitle);
router.patch('/sessions/active-recipe', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.updateActiveRecipe);
router.post('/recommendations-from-pantry', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.getRecommendationsFromPantry);
router.get('/recommendations-from-pantry', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.getRecommendationsFromPantry);
router.post('/sessions/resolve-previous', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.resolvePreviousSession);
router.post('/messages', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.sendMessage);
router.get('/messages', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatController.getUnifiedTimeline);

module.exports = router;
