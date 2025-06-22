const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');

router.post('/like', interactionController.likeRecipe);
router.post('/comment', interactionController.addComment);
router.post('/increase-view-count', interactionController.increaseViewCount);

module.exports = router;
