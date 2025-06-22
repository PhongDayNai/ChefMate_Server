const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeController = require('../controllers/recipeController');

router.get('/all', recipeController.getAllRecipes);
router.post('/create', upload.single('image'), recipeController.createRecipe);
router.post('/search', recipeController.searchRecipe);
router.get('/ingredients', recipeController.getAllIngredients);
router.get('/top-trending', recipeController.getTopTrending);
router.get('/tags', recipeController.getAllTags);
router.post('/search-by-tag', recipeController.searchRecipesByTag);

module.exports = router;
