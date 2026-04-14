const express = require('express');
const router = express.Router();
const controller = require('../controllers/recommendationController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/personalized', requireAccessToken, injectAuthUser, controller.getPersonalizedRecommendations);
router.get('/personalized/explain', requireAccessToken, injectAuthUser, controller.explainPersonalizedRecommendation);
router.get('/feedback/summary', requireAccessToken, injectAuthUser, controller.getRecommendationFeedbackSummary);
router.post('/feedback', requireAccessToken, injectAuthUser, controller.submitRecommendationFeedback);

module.exports = router;
