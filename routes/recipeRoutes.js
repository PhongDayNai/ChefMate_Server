const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeController = require('../controllers/recipeController');
const requireAccessToken = require('../middleware/requireAccessToken');
const optionalAccessToken = require('../middleware/optionalAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/all', recipeController.getAllRecipes);
router.post('/create', requireAccessToken, injectAuthUser, upload.single('image'), recipeController.createRecipe);
router.post('/search', optionalAccessToken, recipeController.searchRecipe);
router.get('/search', optionalAccessToken, recipeController.searchRecipe);
router.get('/ingredients', recipeController.getAllIngredients);
router.post('/top-trending', requireAccessToken, injectAuthUser, recipeController.getTopTrending);
router.get('/top-trending', requireAccessToken, injectAuthUser, recipeController.getTopTrending);
// JWT app canonical:
// - /v2/recipes/trending        => behavior cũ của trending-v2
// - /v2/recipes/trending-v1     => behavior cũ của trending
// - /v2/recipes/trending-v2     => alias tương thích tạm thời
router.get('/trending', optionalAccessToken, recipeController.getTrendingV2);
router.get('/trending-v1', optionalAccessToken, recipeController.getTrendingFeed);
router.get('/trending-v2', optionalAccessToken, recipeController.getTrendingV2);
router.get('/tags', recipeController.getAllTags);
router.post('/search-by-tag', optionalAccessToken, recipeController.searchRecipesByTag);
router.get('/by-tag', optionalAccessToken, recipeController.searchRecipesByTag);
router.post('/user-recipes', requireAccessToken, injectAuthUser, recipeController.getRecipesByUserId);
router.get('/me', requireAccessToken, injectAuthUser, recipeController.getRecipesByUserId);
router.get('/admin/pending', requireAccessToken, injectAuthUser, recipeController.getPendingRecipes);
router.patch('/admin/review', recipeController.reviewRecipe);
router.get('/growth-report', recipeController.getRecipeGrowthByMonth);

module.exports = router;
