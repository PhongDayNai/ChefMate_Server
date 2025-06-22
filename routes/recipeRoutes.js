const express = require('express');
const router = express.Router();
const upload = require('../middleware/multer');
const recipeController = require('../controllers/recipeController');

router.get('/all', recipeController.getAllRecipes);
router.post('/create', upload.single('image'), recipeController.createRecipe);
router.post('/search', recipeController.searchRecipe);
router.post('/direct', recipeController.getDirectRecipe);
router.get('/ingredients', recipeController.getAllIngredients);
router.get('/top-trending', recipeController.getTopTrending);

module.exports = router;
