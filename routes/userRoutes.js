const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/all', userController.getAllUsers);
router.post('/register', userController.createUser);
router.post('/login', userController.login);
router.post('/refresh-token', userController.refreshToken);
router.post('/forgot-password', userController.resetPassword);
router.post('/change-password', userController.changePassword);
router.get('/recipes-view-history', requireAccessToken, injectAuthUser, userController.getRecipesViewHistory);
router.post('/update-user-information', requireAccessToken, injectAuthUser, userController.updateUserInformation);
router.patch('/me', requireAccessToken, injectAuthUser, userController.updateUserInformation);

module.exports = router;
