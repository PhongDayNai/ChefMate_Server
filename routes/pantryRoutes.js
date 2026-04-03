const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantryController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');

router.get('/', requireAccessToken, injectAuthUser, pantryController.getPantryByUser);
router.post('/upsert', requireAccessToken, injectAuthUser, pantryController.upsertPantryItem);
router.delete('/delete', requireAccessToken, injectAuthUser, pantryController.deletePantryItem);

module.exports = router;
