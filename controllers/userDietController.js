const userDietModel = require('../models/userDietModel');

exports.getDietNotesByUser = async (req, res) => {
    const userId = Number(req.query.userId || req.body?.userId);

    if (!userId || userId <= 0) {
        return res.status(400).json({
            success: false,
            data: null,
            message: 'userId is required and must be a positive number'
        });
    }

    try {
        const result = await userDietModel.getDietNotesByUser(userId);
        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in getDietNotesByUser:', error);
        return res.status(500).json({
            success: false,
            data: null,
            message: `Failed to get diet notes: ${error.message}`
        });
    }
};

exports.upsertDietNote = async (req, res) => {
    const payload = req.body || {};

    try {
        const result = await userDietModel.upsertDietNote({
            userId: Number(payload.userId),
            noteId: payload.noteId ? Number(payload.noteId) : null,
            noteType: payload.noteType,
            label: payload.label,
            keywords: payload.keywords || [],
            instruction: payload.instruction || null,
            isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
            startAt: payload.startAt || null,
            endAt: payload.endAt || null
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in upsertDietNote:', error);

        if (error.message && (
            error.message.includes('userId') ||
            error.message.includes('noteType') ||
            error.message.includes('label')
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
            message: `Failed to upsert diet note: ${error.message}`
        });
    }
};

exports.deleteDietNote = async (req, res) => {
    const { userId, noteId } = req.body || {};

    try {
        const result = await userDietModel.deleteDietNote({
            userId: Number(userId),
            noteId: Number(noteId)
        });

        return res.status(200).json(result);
    } catch (error) {
        console.error('Error in deleteDietNote:', error);

        if (error.message && (
            error.message.includes('userId') ||
            error.message.includes('noteId')
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
            message: `Failed to delete diet note: ${error.message}`
        });
    }
};
