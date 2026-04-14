const express = require('express');
const router = express.Router();
const controller = require('../controllers/userEatingProfileController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/me/eating-profile', requireAccessToken, injectAuthUser, controller.getMyEatingProfile);
router.get('/me/eating-insights', requireAccessToken, injectAuthUser, controller.getMyEatingInsights);

module.exports = router;
