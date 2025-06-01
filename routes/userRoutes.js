const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/all', userController.getAllUsers);
router.post('/register', userController.createUser);
router.post('/login', userController.login);
router.post('/forgot-password', userController.resetPassword);
router.post('/change-password', userController.changePassword);
router.get('/recipes-view-history', userController.getRecipesViewHistory);
router.post('/update-user-information', userController.updateUserInformation);

module.exports = router;
