const pantryModel = require('../models/pantryModel');

/**
 * Middleware factory for pantry access control
 * @param {Array<string>} allowedRoles - Array of allowed roles: ['owner', 'editor', 'viewer']
 * @returns {Function} Express middleware
 */
function checkPantryAccess(allowedRoles = []) {
    return async (req, res, next) => {
        const userId = Number(req.auth?.userId || req.userId || 0);
        const pantryId = Number(req.params.pantryId || req.body?.pantryId || 0);

        if (!userId || userId <= 0) {
            return res.status(401).json({
                success: false,
                error: 'UNAUTHORIZED',
                message: 'Authentication required'
            });
        }

        if (!pantryId || pantryId <= 0) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_PANTRY_ID',
                message: 'pantryId is required'
            });
        }

        try {
            const access = await pantryModel.getUserPantryAccess(pantryId, userId);

            if (!access) {
                return res.status(403).json({
                    success: false,
                    error: 'ACCESS_DENIED',
                    message: 'You do not have access to this pantry'
                });
            }

            if (!allowedRoles.includes(access)) {
                return res.status(403).json({
                    success: false,
                    error: 'INSUFFICIENT_PERMISSION',
                    message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
                });
            }

            // Attach access level to request for use in controller
            req.pantryAccess = access;
            next();
        } catch (error) {
            console.error('checkPantryAccess error:', error);
            return res.status(500).json({
                success: false,
                error: 'INTERNAL_ERROR',
                message: 'Failed to verify pantry access'
            });
        }
    };
}

// Convenience middleware for each access level
const requireOwner = () => checkPantryAccess(['owner']);
const requireEditor = () => checkPantryAccess(['owner', 'editor']);
const requireViewer = () => checkPantryAccess(['owner', 'editor', 'viewer']);

module.exports = {
    checkPantryAccess,
    requireOwner,
    requireEditor,
    requireViewer
};