const { pool } = require('../config/dbConfig');

function parseJsonArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean);
    try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) return parsed.map(v => String(v).trim()).filter(Boolean);
        return [];
    } catch (_) {
        return [];
    }
}

exports.getDietNotesByUser = async (userId) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const [rows] = await pool.query(
        `SELECT noteId, userId, noteType, label, keywordsJson, instruction, isActive, startAt, endAt, createdAt, updatedAt
         FROM UserDietNotes
         WHERE userId = ?
         ORDER BY isActive DESC, updatedAt DESC`,
        [parsedUserId]
    );

    return {
        success: true,
        data: rows.map(r => ({
            noteId: Number(r.noteId),
            userId: Number(r.userId),
            noteType: r.noteType,
            label: r.label,
            keywords: parseJsonArray(r.keywordsJson),
            instruction: r.instruction,
            isActive: Number(r.isActive) === 1,
            startAt: r.startAt,
            endAt: r.endAt,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt
        })),
        message: 'Get diet notes successfully'
    };
};

exports.upsertDietNote = async ({
    userId,
    noteId = null,
    noteType,
    label,
    keywords = [],
    instruction = null,
    isActive = true,
    startAt = null,
    endAt = null
}) => {
    const parsedUserId = Number(userId);
    const parsedNoteId = noteId ? Number(noteId) : null;

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const allowedTypes = new Set(['allergy', 'restriction', 'preference', 'health_note']);
    if (!allowedTypes.has(String(noteType || '').trim())) {
        throw new Error('noteType is invalid');
    }

    if (!label || !String(label).trim()) {
        throw new Error('label is required');
    }

    const normalizedKeywords = parseJsonArray(keywords);

    if (parsedNoteId) {
        await pool.query(
            `UPDATE UserDietNotes
             SET noteType = ?, label = ?, keywordsJson = ?, instruction = ?, isActive = ?, startAt = ?, endAt = ?, updatedAt = CURRENT_TIMESTAMP
             WHERE noteId = ? AND userId = ?`,
            [
                noteType,
                String(label).trim(),
                JSON.stringify(normalizedKeywords),
                instruction,
                isActive ? 1 : 0,
                startAt,
                endAt,
                parsedNoteId,
                parsedUserId
            ]
        );
    } else {
        await pool.query(
            `INSERT INTO UserDietNotes (userId, noteType, label, keywordsJson, instruction, isActive, startAt, endAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                parsedUserId,
                noteType,
                String(label).trim(),
                JSON.stringify(normalizedKeywords),
                instruction,
                isActive ? 1 : 0,
                startAt,
                endAt
            ]
        );
    }

    return this.getDietNotesByUser(parsedUserId);
};

exports.deleteDietNote = async ({ userId, noteId }) => {
    const parsedUserId = Number(userId);
    const parsedNoteId = Number(noteId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedNoteId || parsedNoteId <= 0) {
        throw new Error('noteId must be a positive number');
    }

    await pool.query('DELETE FROM UserDietNotes WHERE noteId = ? AND userId = ?', [parsedNoteId, parsedUserId]);

    return this.getDietNotesByUser(parsedUserId);
};

exports.getActiveDietNotes = async (userId) => {
    const parsedUserId = Number(userId);
    const [rows] = await pool.query(
        `SELECT noteId, noteType, label, keywordsJson, instruction, isActive, startAt, endAt
         FROM UserDietNotes
         WHERE userId = ?
           AND isActive = 1
           AND (startAt IS NULL OR startAt <= NOW())
           AND (endAt IS NULL OR endAt >= NOW())
         ORDER BY updatedAt DESC`,
        [parsedUserId]
    );

    return rows.map(r => ({
        noteId: Number(r.noteId),
        noteType: r.noteType,
        label: r.label,
        keywords: parseJsonArray(r.keywordsJson),
        instruction: r.instruction,
        isActive: Number(r.isActive) === 1,
        startAt: r.startAt,
        endAt: r.endAt
    }));
};
