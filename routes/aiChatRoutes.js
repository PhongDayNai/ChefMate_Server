const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatControllerJwt');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/sessions', requireAccessToken, injectAuthUser, aiChatController.createSession);
router.get('/sessions', requireAccessToken, injectAuthUser, aiChatController.getSessionsByUser);
router.get('/sessions/:sessionId', requireAccessToken, injectAuthUser, aiChatController.getSessionHistory);
router.delete('/sessions/:id', requireAccessToken, injectAuthUser, aiChatController.deleteSession);
router.patch('/sessions/title', requireAccessToken, injectAuthUser, aiChatController.updateSessionTitle);
router.patch('/sessions/active-recipe', requireAccessToken, injectAuthUser, aiChatController.updateActiveRecipe);
router.post('/recommendations-from-pantry', requireAccessToken, injectAuthUser, aiChatController.getRecommendationsFromPantry);
router.get('/recommendations-from-pantry', requireAccessToken, injectAuthUser, aiChatController.getRecommendationsFromPantry);
router.post('/sessions/resolve-previous', requireAccessToken, injectAuthUser, aiChatController.resolvePreviousSession);
router.post('/messages', requireAccessToken, injectAuthUser, aiChatController.sendMessage);
router.get('/messages', requireAccessToken, injectAuthUser, aiChatController.getUnifiedTimeline);

module.exports = router;
