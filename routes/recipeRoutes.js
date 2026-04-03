const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeController = require('../controllers/recipeController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/all', recipeController.getAllRecipes);
router.post('/create', requireAccessToken, injectAuthUser, upload.single('image'), recipeController.createRecipe);
router.post('/search', recipeController.searchRecipe);
router.get('/search', recipeController.searchRecipe);
router.get('/ingredients', recipeController.getAllIngredients);
router.post('/top-trending', requireAccessToken, injectAuthUser, recipeController.getTopTrending);
router.get('/top-trending', requireAccessToken, injectAuthUser, recipeController.getTopTrending);
router.get('/trending', recipeController.getTrendingFeed);
router.get('/trending-v2', recipeController.getTrendingV2);
router.get('/tags', recipeController.getAllTags);
router.post('/search-by-tag', recipeController.searchRecipesByTag);
router.get('/by-tag', recipeController.searchRecipesByTag);
router.post('/user-recipes', requireAccessToken, injectAuthUser, recipeController.getRecipesByUserId);
router.get('/me', requireAccessToken, injectAuthUser, recipeController.getRecipesByUserId);
router.get('/admin/pending', requireAccessToken, injectAuthUser, recipeController.getPendingRecipes);
router.patch('/admin/review', recipeController.reviewRecipe);
router.get('/growth-report', recipeController.getRecipeGrowthByMonth);

module.exports = router;
