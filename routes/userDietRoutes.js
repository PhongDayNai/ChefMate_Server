const express = require('express');
const router = express.Router();
const userDietController = require('../controllers/userDietController');

router.get('/', userDietController.getDietNotesByUser);
router.post('/upsert', userDietController.upsertDietNote);
router.delete('/delete', userDietController.deleteDietNote);

module.exports = router;
