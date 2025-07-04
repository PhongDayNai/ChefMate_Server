const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeController = require('../controllers/recipeController');

router.get('/all', recipeController.getAllRecipes);
router.post('/create', upload.single('image'), recipeController.createRecipe);
router.post('/search', recipeController.searchRecipe);
router.get('/ingredients', recipeController.getAllIngredients);
router.post('/top-trending', recipeController.getTopTrending);
router.get('/tags', recipeController.getAllTags);
router.post('/search-by-tag', recipeController.searchRecipesByTag);
router.post('/user-recipes', recipeController.getRecipesByUserId);
router.get('/growth-report', recipeController.getRecipeGrowthByMonth);

module.exports = router;
