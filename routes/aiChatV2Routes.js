const express = require('express');
const router = express.Router();
const aiChatV2Controller = require('../controllers/aiChatV2ControllerJwt');
const requireAccessTokenOrChatApiKey = require('../middleware/requireAccessTokenOrChatApiKey');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/sessions/meal', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.createMealSession);
router.patch('/sessions/meal/recipes', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.replaceMealRecipes);
router.patch('/sessions/meal/recipes/status', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.updateMealRecipeStatus);
router.patch('/sessions/meal/primary-recipe', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.setMealPrimaryRecipe);
router.patch('/sessions/meal/complete', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.completeMealSession);
router.post('/messages', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.sendMessageV2);
router.post('/sessions/meal/resolve-completion-check', requireAccessTokenOrChatApiKey, injectAuthUser, aiChatV2Controller.resolveCompletionCheckV2);

module.exports = router;
