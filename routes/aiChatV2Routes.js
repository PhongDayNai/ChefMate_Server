const express = require('express');
const router = express.Router();
const aiChatV2Controller = require('../controllers/aiChatV2ControllerJwt');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/sessions/meal', requireAccessToken, injectAuthUser, aiChatV2Controller.createMealSession);
router.patch('/sessions/meal/recipes', requireAccessToken, injectAuthUser, aiChatV2Controller.replaceMealRecipes);
router.patch('/sessions/meal/recipes/status', requireAccessToken, injectAuthUser, aiChatV2Controller.updateMealRecipeStatus);
router.patch('/sessions/meal/primary-recipe', requireAccessToken, injectAuthUser, aiChatV2Controller.setMealPrimaryRecipe);
router.patch('/sessions/meal/complete', requireAccessToken, injectAuthUser, aiChatV2Controller.completeMealSession);
router.post('/messages', requireAccessToken, injectAuthUser, aiChatV2Controller.sendMessageV2);

module.exports = router;
