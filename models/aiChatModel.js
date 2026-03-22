const { pool } = require('../config/dbConfig');
const userDietModel = require('./userDietModel');

const DEFAULT_RECOMMENDATION_LIMIT = 10;
const DEFAULT_SESSION_TITLE = 'Phiên chat nấu ăn';
const DEFAULT_AUTO_TITLE_MODEL = process.env.AI_CHAT_TITLE_MODEL || process.env.AI_CHAT_MODEL || 'gemma3:4b';
const DEFAULT_AGENT_NAME = 'Bepes';
const DEFAULT_SESSION_INTRO_MESSAGE = `Xin chào anh, em là ${DEFAULT_AGENT_NAME} – trợ lý nấu ăn của ChefMate. Em có thể gợi ý món theo nguyên liệu hiện có, hướng dẫn từng bước nấu và điều chỉnh theo dị ứng/hạn chế ăn uống của anh.`;

const DEFAULT_AGENTIC_SYSTEM_PROMPT = [
    `Bạn là ${DEFAULT_AGENT_NAME}, trợ lý nấu ăn cá nhân trong ứng dụng ChefMate.`,
    'Mục tiêu: đề xuất món phù hợp, hướng dẫn nấu rõ ràng, an toàn thực phẩm, thực tế với nguyên liệu đang có.',
    'Luôn trả lời bằng tiếng Việt tự nhiên, ngắn gọn, đúng trọng tâm.',
    'Ưu tiên bám theo món đang chọn (active recipe). Nếu người dùng đổi món, cập nhật ngay ngữ cảnh món mới.',
    'Tuyệt đối tôn trọng ghi chú ăn uống (dị ứng/hạn chế). Không gợi ý nguyên liệu hoặc bước nấu vi phạm.',
    'Khi dữ liệu không đủ chắc chắn, hỏi lại ngắn gọn thay vì bịa.',
    'Khi đưa hướng dẫn nấu: trình bày theo từng bước rõ ràng, có mẹo an toàn khi cần.',
    'Nếu người dùng xin gợi ý món từ tủ lạnh: ưu tiên món đủ nấu trước, sau đó món thiếu ít nguyên liệu phụ.',
    'Không tự ý đưa khuyến nghị y khoa chuyên sâu. Với vấn đề sức khỏe nghiêm trọng, nhắc người dùng tham khảo chuyên gia.'
].join(' ');

const COMMON_MISSING_INGREDIENTS = new Set([
    'hành', 'hành lá', 'hành tím', 'hành khô', 'tỏi', 'ớt', 'tiêu', 'muối', 'đường', 'nước mắm',
    'hạt nêm', 'dầu ăn', 'dầu oliu', 'bột ngọt', 'bột canh', 'rau mùi', 'ngò rí', 'gừng', 'chanh'
]);

function normalizeIngredientName(name = '') {
    return String(name)
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ');
}

function shouldBlockRecipeByDiet(ingredients = [], activeDietNotes = []) {
    if (!Array.isArray(activeDietNotes) || activeDietNotes.length === 0) {
        return { blocked: false, matchedNotes: [] };
    }

    const ingredientNames = ingredients.map(ing => normalizeIngredientName(ing.ingredientName));
    const matchedNotes = [];

    for (const note of activeDietNotes) {
        const noteType = String(note.noteType || '').toLowerCase();
        if (noteType !== 'allergy' && noteType !== 'restriction') {
            continue;
        }

        const label = normalizeIngredientName(note.label || '');
        const keywords = Array.isArray(note.keywords)
            ? note.keywords.map(k => normalizeIngredientName(k))
            : [];

        const terms = new Set([label, ...keywords].filter(Boolean));
        if (terms.size === 0) continue;

        const hit = ingredientNames.some(name => {
            for (const term of terms) {
                if (name.includes(term) || term.includes(name)) {
                    return true;
                }
            }
            return false;
        });

        if (hit) {
            matchedNotes.push({
                noteType,
                label: note.label,
                terms: Array.from(terms)
            });
        }
    }

    return {
        blocked: matchedNotes.length > 0,
        matchedNotes
    };
}

function safeParseJson(value) {
    if (!value) return null;

    if (typeof value === 'object') {
        return value;
    }

    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function extractAssistantMessage(apiData) {
    if (!apiData) return null;

    if (typeof apiData.message === 'string') return apiData.message;
    if (typeof apiData.response === 'string') return apiData.response;
    if (typeof apiData.content === 'string') return apiData.content;

    if (typeof apiData.message === 'object' && typeof apiData.message?.content === 'string') {
        return apiData.message.content;
    }

    if (Array.isArray(apiData.choices) && apiData.choices.length > 0) {
        const choice = apiData.choices[0];
        if (choice?.message?.content) {
            return choice.message.content;
        }
        if (typeof choice?.text === 'string') {
            return choice.text;
        }
    }

    if (apiData.data && typeof apiData.data.message === 'string') {
        return apiData.data.message;
    }

    return null;
}

function parseStreamNdjsonToMessage(rawText = '') {
    const lines = String(rawText)
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);

    let combined = '';
    const chunks = [];

    for (const line of lines) {
        try {
            const payload = JSON.parse(line);
            const token = payload?.message?.content || payload?.response || payload?.content || '';
            if (token) {
                combined += token;
            }
            chunks.push(payload);
        } catch (_) {
            // ignore non-json lines
        }
    }

    return {
        assistantMessage: combined || null,
        chunks
    };
}

async function getRecipeContext(recipeId) {
    const parsedRecipeId = Number(recipeId);
    if (!parsedRecipeId || parsedRecipeId <= 0) return null;

    const [recipeRows] = await pool.query(
        `SELECT r.recipeId, r.recipeName, r.cookingTime, r.ration, r.userId, u.fullName AS authorName
         FROM Recipes r
         JOIN Users u ON r.userId = u.userId
         WHERE r.recipeId = ?
         LIMIT 1`,
        [parsedRecipeId]
    );

    if (recipeRows.length === 0) {
        return null;
    }

    const [ingredientRows] = await pool.query(
        `SELECT i.ingredientName, ri.weight, ri.unit
         FROM RecipesIngredients ri
         JOIN Ingredients i ON i.ingredientId = ri.ingredientId
         WHERE ri.recipeId = ?
         ORDER BY ri.weight DESC`,
        [parsedRecipeId]
    );

    const [stepRows] = await pool.query(
        `SELECT indexStep, content
         FROM CookingSteps
         WHERE recipeId = ?
         ORDER BY indexStep ASC`,
        [parsedRecipeId]
    );

    return {
        recipeId: Number(recipeRows[0].recipeId),
        recipeName: recipeRows[0].recipeName,
        cookingTime: recipeRows[0].cookingTime,
        ration: Number(recipeRows[0].ration),
        authorName: recipeRows[0].authorName,
        ingredients: ingredientRows.map(row => ({
            ingredientName: row.ingredientName,
            weight: Number(row.weight),
            unit: row.unit
        })),
        steps: stepRows.map(row => ({
            indexStep: Number(row.indexStep),
            content: row.content
        }))
    };
}

async function getPantryMapByUser(userId) {
    const parsedUserId = Number(userId);
    const [rows] = await pool.query(
        `SELECT i.ingredientName, p.quantity, p.unit
         FROM PantryItems p
         JOIN Ingredients i ON i.ingredientId = p.ingredientId
         WHERE p.userId = ?`,
        [parsedUserId]
    );

    const exactMap = new Map();
    const nameMap = new Map();

    for (const row of rows) {
        const normalizedName = normalizeIngredientName(row.ingredientName);
        const normalizedUnit = String(row.unit || '').trim().toLowerCase();
        const key = `${normalizedName}|${normalizedUnit}`;
        const qty = Number(row.quantity || 0);

        exactMap.set(key, (exactMap.get(key) || 0) + qty);
        nameMap.set(normalizedName, (nameMap.get(normalizedName) || 0) + qty);
    }

    return {
        rows: rows.map(r => ({
            ingredientName: r.ingredientName,
            quantity: Number(r.quantity),
            unit: r.unit
        })),
        exactMap,
        nameMap
    };
}

async function getRecentMessages(chatSessionId, limit = 20) {
    const parsedLimit = Number(limit) > 0 ? Number(limit) : 20;

    const [rows] = await pool.query(
        `SELECT chatMessageId, role, content, metaJson, createdAt
         FROM ChatMessages
         WHERE chatSessionId = ?
         ORDER BY chatMessageId DESC
         LIMIT ?`,
        [chatSessionId, parsedLimit]
    );

    return rows.reverse().map(row => ({
        chatMessageId: Number(row.chatMessageId),
        role: row.role,
        content: row.content,
        meta: safeParseJson(row.metaJson),
        createdAt: row.createdAt
    }));
}

function generateSessionTitleFromMessage(message = '') {
    const normalized = String(message).replace(/\s+/g, ' ').trim();
    if (!normalized) return DEFAULT_SESSION_TITLE;

    const cleaned = normalized
        .replace(/^[\-\*\d\.\)\(\s]+/, '')
        .replace(/[\r\n]+/g, ' ')
        .trim();

    if (!cleaned) return DEFAULT_SESSION_TITLE;

    const maxLen = 48;
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen - 1).trim()}…`;
}

async function generateSessionTitleByAgentApi({
    firstMessage = '',
    model = DEFAULT_AUTO_TITLE_MODEL
}) {
    const normalized = String(firstMessage).replace(/\s+/g, ' ').trim();
    if (!normalized) return DEFAULT_SESSION_TITLE;

    const prompt = [
        'Bạn là bộ tạo tiêu đề ngắn cho phiên chat nấu ăn.',
        'Nhiệm vụ: tạo 1 tiêu đề tiếng Việt ngắn (tối đa 8 từ), dễ hiểu, không dấu ngoặc, không emoji.',
        'Chỉ trả về đúng tiêu đề, không giải thích thêm.',
        `Tin nhắn đầu tiên của người dùng: "${normalized}"`
    ].join('\n');

    try {
        const result = await callAiApi({
            model,
            messages: [
                { role: 'system', content: 'Bạn chỉ được trả về đúng một tiêu đề ngắn.' },
                { role: 'user', content: prompt }
            ],
            stream: false
        });

        const rawTitle = String(result.assistantMessage || '').replace(/\s+/g, ' ').trim();
        if (!rawTitle) {
            return generateSessionTitleFromMessage(firstMessage);
        }

        const cleaned = rawTitle
            .replace(/^['"“”`]+|['"“”`]+$/g, '')
            .replace(/[\r\n]+/g, ' ')
            .trim();

        if (!cleaned) {
            return generateSessionTitleFromMessage(firstMessage);
        }

        const words = cleaned.split(' ').slice(0, 8).join(' ');
        return words || generateSessionTitleFromMessage(firstMessage);
    } catch (_) {
        return generateSessionTitleFromMessage(firstMessage);
    }
}

async function createChatSession({ userId, title = DEFAULT_SESSION_TITLE, activeRecipeId = null }) {
    const parsedUserId = Number(userId);
    const parsedActiveRecipeId = activeRecipeId ? Number(activeRecipeId) : null;

    const finalTitle = title && String(title).trim()
        ? String(title).trim()
        : DEFAULT_SESSION_TITLE;

    const [result] = await pool.query(
        `INSERT INTO ChatSessions (userId, title, activeRecipeId)
         VALUES (?, ?, ?)`,
        [parsedUserId, finalTitle, parsedActiveRecipeId]
    );

    return Number(result.insertId);
}

async function getChatSessionById(chatSessionId, userId) {
    const [rows] = await pool.query(
        `SELECT chatSessionId, userId, title, activeRecipeId, createdAt, updatedAt
         FROM ChatSessions
         WHERE chatSessionId = ? AND userId = ?
         LIMIT 1`,
        [chatSessionId, userId]
    );

    if (rows.length === 0) return null;

    return {
        chatSessionId: Number(rows[0].chatSessionId),
        userId: Number(rows[0].userId),
        title: rows[0].title,
        activeRecipeId: rows[0].activeRecipeId ? Number(rows[0].activeRecipeId) : null,
        createdAt: rows[0].createdAt,
        updatedAt: rows[0].updatedAt
    };
}

async function addChatMessage({ chatSessionId, role, content, meta = null }) {
    await pool.query(
        `INSERT INTO ChatMessages (chatSessionId, role, content, metaJson)
         VALUES (?, ?, ?, ?)`,
        [chatSessionId, role, content, meta ? JSON.stringify(meta) : null]
    );

    await pool.query(
        'UPDATE ChatSessions SET updatedAt = CURRENT_TIMESTAMP WHERE chatSessionId = ?',
        [chatSessionId]
    );
}

async function setActiveRecipe({ chatSessionId, userId, recipeId = null }) {
    const parsedRecipeId = recipeId ? Number(recipeId) : null;

    await pool.query(
        `UPDATE ChatSessions
         SET activeRecipeId = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE chatSessionId = ? AND userId = ?`,
        [parsedRecipeId, chatSessionId, userId]
    );
}

function resolveRecommendationLimit(limit) {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return DEFAULT_RECOMMENDATION_LIMIT;
    }

    return Math.min(Math.floor(parsed), 50);
}

async function getRecipeRecommendationsFromPantry({ userId, limit, activeDietNotes = [] }) {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const finalLimit = resolveRecommendationLimit(limit);

    const { exactMap: pantryExactMap, nameMap: pantryNameMap } = await getPantryMapByUser(parsedUserId);

    const [recipeRows] = await pool.query(
        `SELECT recipeId, recipeName, image, cookingTime, ration, likeQuantity, viewCount
         FROM Recipes
         ORDER BY viewCount DESC, likeQuantity DESC, createdAt DESC
         LIMIT 300`
    );

    const [ingredientRows] = await pool.query(
        `SELECT ri.recipeId, i.ingredientName, ri.weight, ri.unit, ri.isMain, ri.isCommon
         FROM RecipesIngredients ri
         JOIN Ingredients i ON i.ingredientId = ri.ingredientId`
    );

    const recipeIngredientMap = new Map();
    for (const row of ingredientRows) {
        const recipeId = Number(row.recipeId);
        if (!recipeIngredientMap.has(recipeId)) {
            recipeIngredientMap.set(recipeId, []);
        }

        recipeIngredientMap.get(recipeId).push({
            ingredientName: row.ingredientName,
            weight: Number(row.weight || 0),
            unit: row.unit,
            isMain: Number(row.isMain || 0) === 1,
            isCommon: Number(row.isCommon || 0) === 1
        });
    }

    const readyToCook = [];
    const almostReady = [];

    for (const recipe of recipeRows) {
        const recipeId = Number(recipe.recipeId);
        const ingredients = recipeIngredientMap.get(recipeId) || [];
        if (ingredients.length === 0) continue;

        const missing = [];
        let matchedCount = 0;

        for (const ing of ingredients) {
            const unit = String(ing.unit || '').trim().toLowerCase();
            const normalizedName = normalizeIngredientName(ing.ingredientName);
            const key = `${normalizedName}|${unit}`;
            const currentExact = pantryExactMap.get(key) || 0;
            const currentByName = pantryNameMap.get(normalizedName) || 0;
            const current = Math.max(currentExact, currentByName);
            const required = Number(ing.weight || 0);
            const tolerance = required * 0.1;

            if (current + tolerance >= required) {
                matchedCount += 1;
            } else {
                missing.push({
                    ingredientName: ing.ingredientName,
                    need: required,
                    have: current,
                    unit: ing.unit,
                    isMain: Boolean(ing.isMain),
                    isCommon: Boolean(ing.isCommon)
                });
            }
        }

        const completionRate = Math.round((matchedCount / ingredients.length) * 100);

        const dietCheck = shouldBlockRecipeByDiet(ingredients, activeDietNotes);
        if (dietCheck.blocked) {
            continue;
        }

        const basePayload = {
            recipeId,
            recipeName: recipe.recipeName,
            image: recipe.image,
            cookingTime: recipe.cookingTime,
            ration: Number(recipe.ration),
            completionRate,
            missing
        };

        if (missing.length === 0) {
            readyToCook.push(basePayload);
            continue;
        }

        const missingMainCount = missing.filter(item => item.isMain).length;

        const isAlmostReady =
            missingMainCount === 0 &&
            missing.length <= 2 &&
            missing.every(item => item.isCommon || COMMON_MISSING_INGREDIENTS.has(normalizeIngredientName(item.ingredientName)));

        if (isAlmostReady) {
            almostReady.push(basePayload);
        }
    }

    const sortedReady = readyToCook
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, finalLimit);

    const remainLimit = Math.max(finalLimit - sortedReady.length, 0);

    const sortedAlmost = almostReady
        .sort((a, b) => b.completionRate - a.completionRate)
        .slice(0, remainLimit);

    const mergedRecommendations = [...sortedReady, ...sortedAlmost].map((item, index) => ({
        index: index + 1,
        recommendationType: index < sortedReady.length ? 'ready_to_cook' : 'almost_ready',
        ...item
    }));

    return {
        success: true,
        data: {
            recommendationLimit: finalLimit,
            recommendations: mergedRecommendations,
            readyToCook: sortedReady,
            almostReady: sortedAlmost
        },
        message: 'Get recommendations from pantry successfully'
    };
}

async function callAiApi({ model, messages, stream = false }) {
    const apiUrl = process.env.AI_CHAT_API_URL || 'https://your-ai-api-url.com';
    const timeoutMs = Number(process.env.AI_CHAT_TIMEOUT_MS || 20000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ model, messages, stream }),
            signal: controller.signal
        });

        const text = await response.text();

        if (!response.ok) {
            let errorPayload;
            try {
                errorPayload = JSON.parse(text);
            } catch (_) {
                errorPayload = { raw: text };
            }

            const err = new Error(`AI API failed with status ${response.status}`);
            err.status = response.status;
            err.payload = errorPayload;
            throw err;
        }

        if (stream) {
            const streamResult = parseStreamNdjsonToMessage(text);
            return {
                raw: {
                    mode: 'stream',
                    chunks: streamResult.chunks
                },
                assistantMessage: streamResult.assistantMessage
            };
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (_) {
            data = { raw: text };
        }

        return {
            raw: data,
            assistantMessage: extractAssistantMessage(data)
        };
    } finally {
        clearTimeout(timer);
    }
}

exports.createSession = async ({ userId, title, activeRecipeId = null, firstMessage = '', model }) => {
    const autoTitle = title && String(title).trim()
        ? String(title).trim()
        : await generateSessionTitleByAgentApi({ firstMessage, model });

    const chatSessionId = await createChatSession({ userId, title: autoTitle, activeRecipeId });

    await addChatMessage({
        chatSessionId,
        role: 'assistant',
        content: DEFAULT_SESSION_INTRO_MESSAGE,
        meta: {
            agentName: DEFAULT_AGENT_NAME,
            intro: true
        }
    });

    const session = await getChatSessionById(chatSessionId, userId);

    return {
        success: true,
        data: {
            ...session,
            introMessage: DEFAULT_SESSION_INTRO_MESSAGE,
            agentName: DEFAULT_AGENT_NAME
        },
        message: 'Create chat session successfully'
    };
};

exports.getSessionsByUser = async ({ userId, page = 1, limit = 50 }) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const offset = (parsedPage - 1) * parsedLimit;

    const [[countRow]] = await pool.query(
        'SELECT COUNT(*) AS total FROM ChatSessions WHERE userId = ?',
        [parsedUserId]
    );

    const [rows] = await pool.query(
        `SELECT chatSessionId, userId, title, activeRecipeId, createdAt, updatedAt
         FROM ChatSessions
         WHERE userId = ?
         ORDER BY updatedAt DESC
         LIMIT ? OFFSET ?`,
        [parsedUserId, parsedLimit, offset]
    );

    const total = Number(countRow.total || 0);
    const totalPages = Math.max(Math.ceil(total / parsedLimit), 1);

    return {
        success: true,
        data: {
            items: rows.map(r => ({
                chatSessionId: Number(r.chatSessionId),
                userId: Number(r.userId),
                title: r.title,
                activeRecipeId: r.activeRecipeId ? Number(r.activeRecipeId) : null,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt
            })),
            pagination: {
                page: parsedPage,
                limit: parsedLimit,
                total,
                totalPages
            }
        },
        message: 'Get chat sessions successfully'
    };
};

exports.deleteSession = async ({ userId, chatSessionId }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    const [result] = await pool.query(
        'DELETE FROM ChatSessions WHERE chatSessionId = ? AND userId = ?',
        [parsedSessionId, parsedUserId]
    );

    if (!result.affectedRows) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    return {
        success: true,
        data: { chatSessionId: parsedSessionId },
        message: 'Delete chat session successfully'
    };
};

exports.updateSessionTitle = async ({ userId, chatSessionId, title }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    if (!title || !String(title).trim()) {
        throw new Error('title is required');
    }

    const [result] = await pool.query(
        `UPDATE ChatSessions
         SET title = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE chatSessionId = ? AND userId = ?`,
        [String(title).trim(), parsedSessionId, parsedUserId]
    );

    if (!result.affectedRows) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const updated = await getChatSessionById(parsedSessionId, parsedUserId);

    return {
        success: true,
        data: updated,
        message: 'Update chat session title successfully'
    };
};

exports.getSessionHistory = async ({ userId, chatSessionId }) => {
    const session = await getChatSessionById(chatSessionId, userId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const messages = await getRecentMessages(chatSessionId, 200);

    return {
        success: true,
        data: {
            session,
            messages
        },
        message: 'Get chat history successfully'
    };
};

exports.updateActiveRecipe = async ({ userId, chatSessionId, recipeId }) => {
    const session = await getChatSessionById(chatSessionId, userId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    await setActiveRecipe({ chatSessionId, userId, recipeId });

    const updatedSession = await getChatSessionById(chatSessionId, userId);

    return {
        success: true,
        data: updatedSession,
        message: 'Update active recipe successfully'
    };
};

exports.getRecommendationsFromPantry = async ({ userId, limit = 10 }) => {
    const activeDietNotes = await userDietModel.getActiveDietNotes(userId);
    return getRecipeRecommendationsFromPantry({ userId, limit, activeDietNotes });
};

exports.sendMessage = async ({
    userId,
    chatSessionId = null,
    message,
    model = process.env.AI_CHAT_MODEL || 'gemma3:4b',
    stream = false,
    activeRecipeId = null
}) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
        throw new Error('message is required');
    }

    let sessionId = chatSessionId ? Number(chatSessionId) : null;
    let session;

    if (!sessionId) {
        const autoTitle = await generateSessionTitleByAgentApi({ firstMessage: message, model });
        sessionId = await createChatSession({ userId: parsedUserId, title: autoTitle });

        await addChatMessage({
            chatSessionId: sessionId,
            role: 'assistant',
            content: DEFAULT_SESSION_INTRO_MESSAGE,
            meta: {
                agentName: DEFAULT_AGENT_NAME,
                intro: true
            }
        });
    }

    session = await getChatSessionById(sessionId, parsedUserId);
    if (!session) {
        throw new Error('Chat session not found');
    }

    if (activeRecipeId !== null && activeRecipeId !== undefined) {
        await setActiveRecipe({ chatSessionId: sessionId, userId: parsedUserId, recipeId: activeRecipeId });
        session = await getChatSessionById(sessionId, parsedUserId);
    }

    await addChatMessage({
        chatSessionId: sessionId,
        role: 'user',
        content: message.trim()
    });

    const recentMessages = await getRecentMessages(sessionId, 30);
    const { rows: pantryRows } = await getPantryMapByUser(parsedUserId);
    const activeDietNotes = await userDietModel.getActiveDietNotes(parsedUserId);

    const recipeContext = session.activeRecipeId
        ? await getRecipeContext(session.activeRecipeId)
        : null;

    const extraSystemPrompt = process.env.AI_CHAT_SYSTEM_PROMPT || '';

    const contextMessage = {
        role: 'system',
        content: [
            DEFAULT_AGENTIC_SYSTEM_PROMPT,
            extraSystemPrompt,
            `Tủ lạnh hiện tại của user: ${JSON.stringify(pantryRows, null, 2)}`,
            `Ghi chú ăn uống (dị ứng/hạn chế/sở thích) đang hiệu lực: ${JSON.stringify(activeDietNotes, null, 2)}`,
            recipeContext
                ? `Món đang chọn: ${recipeContext.recipeName}. Công thức: ${JSON.stringify(recipeContext, null, 2)}`
                : 'Hiện chưa có món nào được chọn.'
        ].filter(Boolean).join('\n')
    };

    const llmMessages = [
        contextMessage,
        ...recentMessages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({ role: msg.role, content: msg.content }))
    ];

    const fallbackAssistantMessage = 'Máy chủ AI đang bận hoặc tạm thời không khả dụng, anh vui lòng thử lại sau ít phút.';

    try {
        const aiResult = await callAiApi({
            model,
            messages: llmMessages,
            stream
        });

        const assistantMessage = aiResult.assistantMessage || 'Em chưa nhận được phản hồi hợp lệ từ AI, anh thử lại giúp em nhé.';

        await addChatMessage({
            chatSessionId: sessionId,
            role: 'assistant',
            content: assistantMessage,
            meta: {
                model,
                raw: aiResult.raw
            }
        });

        const updatedSession = await getChatSessionById(sessionId, parsedUserId);

        return {
            success: true,
            data: {
                session: updatedSession,
                assistantMessage
            },
            message: 'Chat with AI successfully'
        };
    } catch (error) {
        await addChatMessage({
            chatSessionId: sessionId,
            role: 'assistant',
            content: fallbackAssistantMessage,
            meta: {
                model,
                error: error.message,
                status: error.status || null,
                payload: error.payload || null
            }
        });

        const updatedSession = await getChatSessionById(sessionId, parsedUserId);

        return {
            success: false,
            code: 'AI_SERVER_BUSY',
            data: {
                session: updatedSession,
                assistantMessage: fallbackAssistantMessage
            },
            message: 'AI server is busy'
        };
    }
};
