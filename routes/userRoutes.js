const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

router.get('/all', userController.getAllUsers);
router.post('/register', userController.createUser);
router.post('/login', userController.login);
router.post('/forgot-password', userController.resetPassword);
router.post('/change-password', userController.changePassword);

module.exports = router;
