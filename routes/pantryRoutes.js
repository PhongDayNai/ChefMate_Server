const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantryController');

router.get('/', pantryController.getPantryByUser);
router.post('/upsert', pantryController.upsertPantryItem);
router.delete('/delete', pantryController.deletePantryItem);

module.exports = router;
