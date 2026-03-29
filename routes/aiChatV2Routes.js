const express = require('express');
const router = express.Router();
const aiChatV2Controller = require('../controllers/aiChatV2Controller');

router.post('/sessions/meal', aiChatV2Controller.createMealSession);
router.patch('/sessions/meal/recipes', aiChatV2Controller.replaceMealRecipes);
router.patch('/sessions/meal/recipes/status', aiChatV2Controller.updateMealRecipeStatus);
router.post('/messages', aiChatV2Controller.sendMessageV2);

module.exports = router;
