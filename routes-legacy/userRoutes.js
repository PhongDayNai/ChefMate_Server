const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/all', userController.getAllUsers);
router.post('/register', userController.createUser);
router.post('/login', userController.login);
router.post('/forgot-password', userController.resetPassword);
router.post('/change-password', userController.changePassword);
router.post('/refresh-token', userController.refreshToken);

// Protected routes (require JWT auth)
router.get('/recipes-view-history', requireAccessToken, injectAuthUser, userController.getRecipesViewHistory);
router.post('/update-user-information', requireAccessToken, injectAuthUser, userController.updateUserInformation);

module.exports = router;
