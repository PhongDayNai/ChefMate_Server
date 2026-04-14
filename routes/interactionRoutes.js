const express = require('express');
const router = express.Router();
const interactionController = require('../controllers/interactionController');
const requireAccessToken = require('../middleware/requireAccessToken');
const optionalAccessToken = require('../middleware/optionalAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.post('/like', requireAccessToken, injectAuthUser, interactionController.likeRecipe);
router.post('/comment', requireAccessToken, injectAuthUser, interactionController.addComment);
router.post('/increase-view-count', optionalAccessToken, injectAuthUser, interactionController.increaseViewCount);
router.get('/comments', interactionController.getAllComments);
router.delete('/comment', requireAccessToken, injectAuthUser, interactionController.deleteComment);

module.exports = router;
