const pantryModel = require('../models/pantryModel');

exports.getPantryByUser = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);

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
    const { userId, ingredientName, quantity, unit, expiresAt } = req.body || {};

    try {
        const result = await pantryModel.upsertPantryItem({
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

    try {
        const result = await pantryModel.deletePantryItem({
            userId: Number(userId),
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
