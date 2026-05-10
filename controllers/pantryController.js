const pantryModel = require('../models/pantryModel');

exports.getPantryByUser = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || req.query.userId || req.body?.userId || 0);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await pantryModel.listPantryByUser(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getPantryByUser:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get pantry: ${error.message}`
        });
    }
};

exports.upsertPantryItem = async (req, res) => {
    const { ingredientName, quantity, unit, expiresAt } = req.body || {};
    const userId = Number(req.auth?.userId || req.userId || req.body?.userId || 0);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        // Legacy: use default pantry
        const pantryId = await pantryModel.getOrCreateDefaultPantryId(userId);
        const result = await pantryModel.upsertPantryItem({
            pantryId,
            userId: Number(userId),
            ingredientName,
            quantity: Number(quantity),
            unit,
            expiresAt: expiresAt || null
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in upsertPantryItem:', error);

        if (error.message && (
            error.message.includes('userId') ||
            error.message.includes('ingredientName') ||
            error.message.includes('quantity') ||
            error.message.includes('unit')
        )) {
            return res.status(400).json({
                success: false,
                data: null,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to update pantry: ${error.message}`
        });
    }
};

exports.deletePantryItem = async (req, res) => {
    const { userId, pantryItemId } = req.body || {};
    const parsedUserId = Number(req.auth?.userId || req.userId || req.body?.userId || userId || 0);

    if (!parsedUserId || parsedUserId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    if (!pantryItemId || Number(pantryItemId) <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'pantryItemId is required and must be a positive number'
        });
    }

    try {
        // Legacy: use default pantry
        const pantryId = await pantryModel.getOrCreateDefaultPantryId(parsedUserId);
        const result = await pantryModel.deletePantryItem({
            pantryId,
            userId: parsedUserId,
            pantryItemId: Number(pantryItemId)
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in deletePantryItem:', error);

        if (error.message && (error.message.includes('userId') || error.message.includes('pantryItemId'))) {
            return res.status(400).json({
                success: false,
                data: null,
                message: error.message
            });
        }

        if (error.message && error.message.includes('not found')) {
            return res.status(404).json({
                success: false,
                data: null,
                message: error.message
            });
        }

        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to delete pantry item: ${error.message}`
        });
    }
};

// ============================================================
// NEW PANTRY SHARING CONTROLLER FUNCTIONS
// ============================================================

exports.listPantriesByUser = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);

    if (!userId || userId <= 0) {
        return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication required'
        });
    }

    try {
        const result = await pantryModel.listPantriesByUser(userId);
        return res.status(200).json(result);
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: error.message
        });
    }
};

exports.createPantry = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const { name } = req.body || {};

    if (!userId || userId <= 0) {
        return res.status(401).json({
            success: false,
            error: 'UNAUTHORIZED',
            message: 'Authentication required'
        });
    }

    try {
        const result = await pantryModel.createPantry({ ownerUserId: userId, name });
        return res.status(201).json(result);
    } catch (error) {
        return res.status(400).json({
            success: false,
            error: 'INVALID_INPUT',
            message: error.message
        });
    }
};

exports.getPantryById = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);

    try {
        const result = await pantryModel.getPantryById(pantryId, userId);
        return res.status(200).json(result);
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 :
                       error.message.includes('not found') ? 404 : 500;
        return res.status(status).json({
            success: false,
            error: status === 403 ? 'ACCESS_DENIED' :
                  status === 404 ? 'PANTRY_NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message
        });
    }
};

exports.deletePantry = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);

    try {
        const result = await pantryModel.deletePantry({ pantryId, userId });
        return res.status(200).json(result);
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'INSUFFICIENT_PERMISSION',
            message: error.message
        });
    }
};

exports.getPantryItems = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);

    try {
        const result = await pantryModel.listPantryItemsByPantryIdPaginated(
            pantryId, userId, { page, limit }
        );
        return res.status(200).json(result);
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 : 500;
        return res.status(status).json({
            success: false,
            error: status === 403 ? 'ACCESS_DENIED' : 'INTERNAL_ERROR',
            message: error.message
        });
    }
};

exports.upsertPantryItemShared = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const { ingredientName, quantity, unit, expiresAt } = req.body || {};

    try {
        const result = await pantryModel.upsertPantryItem({
            pantryId, userId, ingredientName, quantity, unit, expiresAt
        });
        return res.status(200).json(result);
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 :
                       error.message.includes('not found') ? 404 : 500;
        return res.status(status).json({
            success: false,
            error: status === 403 ? 'INSUFFICIENT_PERMISSION' :
                  status === 404 ? 'ITEM_NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message
        });
    }
};

exports.deletePantryItemShared = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const itemId = Number(req.params.itemId || 0);

    try {
        const result = await pantryModel.deletePantryItem({
            pantryId, userId, pantryItemId: itemId
        });
        return res.status(200).json(result);
    } catch (error) {
        const status = error.message.includes('Access denied') ? 403 :
                       error.message.includes('not found') ? 404 : 500;
        return res.status(status).json({
            success: false,
            error: status === 403 ? 'INSUFFICIENT_PERMISSION' :
                  status === 404 ? 'ITEM_NOT_FOUND' : 'INTERNAL_ERROR',
            message: error.message
        });
    }
};

exports.listPantryShares = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);

    try {
        const result = await pantryModel.listPantryShares({ pantryId, ownerUserId: userId });
        return res.status(200).json(result);
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'INSUFFICIENT_PERMISSION',
            message: error.message
        });
    }
};

exports.sharePantry = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const { targetUserId, role } = req.body || {};

    try {
        const result = await pantryModel.sharePantry({
            pantryId, ownerUserId: userId, targetUserId, role
        });
        return res.status(200).json(result);
    } catch (error) {
        let status = 400;
        let errorCode = 'INVALID_INPUT';
        if (error.message.includes('yourself')) {
            errorCode = 'SELF_SHARE_NOT_ALLOWED';
        } else if (error.message.includes('Only owner')) {
            status = 403;
            errorCode = 'INSUFFICIENT_PERMISSION';
        }
        return res.status(status).json({ success: false, error: errorCode, message: error.message });
    }
};

exports.updatePantryShare = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const targetUserId = Number(req.params.targetUserId || 0);
    const { role } = req.body || {};

    try {
        const result = await pantryModel.updatePantryShareRole({
            pantryId, ownerUserId: userId, targetUserId, role
        });
        return res.status(200).json(result);
    } catch (error) {
        let status = 400;
        let errorCode = 'INVALID_INPUT';
        if (error.message.includes('not found')) {
            status = 404;
            errorCode = 'SHARE_NOT_FOUND';
        } else if (error.message.includes('Only owner')) {
            status = 403;
            errorCode = 'INSUFFICIENT_PERMISSION';
        }
        return res.status(status).json({ success: false, error: errorCode, message: error.message });
    }
};

exports.removePantryShare = async (req, res) => {
    const userId = Number(req.auth?.userId || req.userId || 0);
    const pantryId = Number(req.params.pantryId || 0);
    const targetUserId = Number(req.params.targetUserId || 0);

    try {
        const result = await pantryModel.removePantryShare({
            pantryId, ownerUserId: userId, targetUserId
        });
        return res.status(200).json({ success: true, data: null, message: 'Share revoked successfully' });
    } catch (error) {
        return res.status(403).json({
            success: false,
            error: 'INSUFFICIENT_PERMISSION',
            message: error.message
        });
    }
};
