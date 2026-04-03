const express = require('express');
const router = express.Router();
const userDietController = require('../controllers/userDietController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/', requireAccessToken, injectAuthUser, userDietController.getDietNotesByUser);
router.post('/upsert', requireAccessToken, injectAuthUser, userDietController.upsertDietNote);
router.delete('/delete', requireAccessToken, injectAuthUser, userDietController.deleteDietNote);

module.exports = router;
