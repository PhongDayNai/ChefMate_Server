const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/like', requireAccessToken, injectAuthUser, interactionController.likeRecipe);
router.post('/comment', requireAccessToken, injectAuthUser, interactionController.addComment);
router.post('/increase-view-count', interactionController.increaseViewCount);
router.get('/comments', interactionController.getAllComments);
router.delete('/comment', requireAccessToken, injectAuthUser, interactionController.deleteComment);

module.exports = router;
