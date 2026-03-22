const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');

router.post('/sessions', aiChatController.createSession);
router.get('/sessions', aiChatController.getSessionsByUser);
router.get('/sessions/:sessionId', aiChatController.getSessionHistory);
router.delete('/sessions/:id', aiChatController.deleteSession);
router.patch('/sessions/title', aiChatController.updateSessionTitle);
router.patch('/sessions/active-recipe', aiChatController.updateActiveRecipe);
router.post('/recommendations-from-pantry', aiChatController.getRecommendationsFromPantry);
router.post('/messages', aiChatController.sendMessage);

module.exports = router;
