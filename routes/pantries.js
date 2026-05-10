const express = require('express');
const router = express.Router();
const pantryController = require('../controllers/pantryController');
const requireAccessToken = require('../middleware/requireAccessToken');
const injectAuthUser = require('../middleware/injectAuthUser');
const { requireOwner, requireEditor, requireViewer } = require('../middleware/checkPantryAccess');

// List all pantries for user
router.get('/', requireAccessToken, injectAuthUser, pantryController.listPantriesByUser);

// Create new pantry
router.post('/', requireAccessToken, injectAuthUser, pantryController.createPantry);

// Get pantry metadata (viewer+)
router.get('/:pantryId', requireAccessToken, injectAuthUser, requireViewer(), pantryController.getPantryById);

// Delete pantry (owner only)
router.delete('/:pantryId', requireAccessToken, injectAuthUser, requireOwner(), pantryController.deletePantry);

// List items in pantry (viewer+)
router.get('/:pantryId/items', requireAccessToken, injectAuthUser, requireViewer(), pantryController.getPantryItems);

// Add/update item (editor+)
router.post('/:pantryId/items', requireAccessToken, injectAuthUser, requireEditor(), pantryController.upsertPantryItemShared);

// Delete item (editor+)
router.delete('/:pantryId/items/:itemId', requireAccessToken, injectAuthUser, requireEditor(), pantryController.deletePantryItemShared);

// List shares (owner only)
router.get('/:pantryId/shares', requireAccessToken, injectAuthUser, requireOwner(), pantryController.listPantryShares);

// Share pantry (owner only)
router.post('/:pantryId/shares', requireAccessToken, injectAuthUser, requireOwner(), pantryController.sharePantry);

// Update share role (owner only)
router.put('/:pantryId/shares/:targetUserId', requireAccessToken, injectAuthUser, requireOwner(), pantryController.updatePantryShare);

// Remove share (owner only)
router.delete('/:pantryId/shares/:targetUserId', requireAccessToken, injectAuthUser, requireOwner(), pantryController.removePantryShare);

module.exports = router;