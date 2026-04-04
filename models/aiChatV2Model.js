const { pool } = require('../config/dbConfig');
const userDietModel = require('./userDietModel');

const DEFAULT_AGENT_NAME = 'Bepes';
const DEFAULT_SESSION_TITLE = 'Bữa ăn nhiều món';
const DEFAULT_MODEL = process.env.AI_CHAT_MODEL || 'gemma3:4b';
const DEFAULT_SESSION_INTRO_MESSAGE = `Xin chào anh, em là ${DEFAULT_AGENT_NAME} – trợ lý nấu ăn của ChefMate. Em sẽ hỗ trợ anh lên kế hoạch nấu nhiều món cho cùng một bữa, tối ưu thứ tự nấu và nguyên liệu dùng chung.`;

const ALLOWED_MEAL_RECIPE_STATUS = new Set(['pending', 'cooking', 'done', 'skipped']);

const MEAL_V2_COMPLETION_REMINDER_MINUTES = Number(process.env.MEAL_V2_COMPLETION_REMINDER_MINUTES || 60);
const MEAL_V2_COMPLETION_REMINDER_STRONG_MINUTES = Number(process.env.MEAL_V2_COMPLETION_REMINDER_STRONG_MINUTES || 180);
const MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES = Number(process.env.MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES || 30);
const MEAL_V2_COMPLETION_REMINDER_MAX_PER_DAY = Number(process.env.MEAL_V2_COMPLETION_REMINDER_MAX_PER_DAY || 3);

function safeParseJson(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;

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
        if (choice?.message?.content) return choice.message.content;
        if (typeof choice?.text === 'string') return choice.text;
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
            if (token) combined += token;
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

async function callAiPrimary({ apiUrl, model, messages, stream, timeoutMs }) {
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

            const err = new Error(`Primary AI API failed with status ${response.status}`);
            err.status = response.status;
            err.payload = errorPayload;
            throw err;
        }

        if (stream) {
            const streamResult = parseStreamNdjsonToMessage(text);
            return {
                raw: {
                    provider: 'primary',
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
            raw: {
                provider: 'primary',
                payload: data
            },
            assistantMessage: extractAssistantMessage(data)
        };
    } finally {
        clearTimeout(timer);
    }
}

async function callAiFallbackOpenAI({ apiUrl, apiKey, model, messages, timeoutMs }) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model,
                messages,
                stream: false,
                temperature: 0.7
            }),
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

            const err = new Error(`Fallback AI API failed with status ${response.status}`);
            err.status = response.status;
            err.payload = errorPayload;
            throw err;
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (_) {
            data = { raw: text };
        }

        const assistantMessage =
            data?.choices?.[0]?.message?.content ||
            data?.choices?.[0]?.delta?.content ||
            extractAssistantMessage(data) ||
            '';

        return {
            raw: {
                provider: 'fallback',
                payload: data
            },
            assistantMessage: String(assistantMessage || '').trim()
        };
    } finally {
        clearTimeout(timer);
    }
}

async function callAiApi({ model, messages, stream = false }) {
    const primaryApiUrl = process.env.AI_CHAT_API_URL || 'https://your-ai-api-url.com';
    const timeoutMs = Number(process.env.AI_CHAT_TIMEOUT_MS || 20000);

    const fallbackApiUrl = process.env.AI_CHAT_FALLBACK_API_URL || 'https://your-ai-fallback-api-url.com';
    const fallbackApiKey = process.env.AI_CHAT_FALLBACK_API_KEY || process.env.OPENAI_API_KEY || '';
    const fallbackModel = process.env.AI_CHAT_FALLBACK_MODEL || 'gpt-4.1-mini';

    try {
        return await callAiPrimary({
            apiUrl: primaryApiUrl,
            model,
            messages,
            stream,
            timeoutMs
        });
    } catch (primaryError) {
        if (!fallbackApiUrl || !fallbackApiKey) {
            throw primaryError;
        }

        const fallbackResult = await callAiFallbackOpenAI({
            apiUrl: fallbackApiUrl,
            apiKey: fallbackApiKey,
            model: fallbackModel,
            messages,
            timeoutMs
        });

        return fallbackResult;
    }
}

function normalizeRecipeSelectionInput({ recipes = null, recipeIds = null }) {
    if (Array.isArray(recipes)) {
        return recipes
            .map((item, index) => {
                if (typeof item === 'number' || typeof item === 'string') {
                    const recipeId = Number(item);
                    return {
                        recipeId,
                        sortOrder: index + 1,
                        status: 'pending',
                        servingsOverride: null,
                        note: null
                    };
                }

                const recipeId = Number(item?.recipeId);
                const status = String(item?.status || 'pending').trim().toLowerCase();

                return {
                    recipeId,
                    sortOrder: Number(item?.sortOrder || index + 1),
                    status: ALLOWED_MEAL_RECIPE_STATUS.has(status) ? status : 'pending',
                    servingsOverride: item?.servingsOverride === null || item?.servingsOverride === undefined
                        ? null
                        : Number(item.servingsOverride),
                    note: item?.note ? String(item.note).trim() : null
                };
            })
            .filter(item => item.recipeId > 0);
    }

    if (Array.isArray(recipeIds)) {
        return recipeIds
            .map((recipeId, index) => ({
                recipeId: Number(recipeId),
                sortOrder: index + 1,
                status: 'pending',
                servingsOverride: null,
                note: null
            }))
            .filter(item => item.recipeId > 0);
    }

    return [];
}

async function ensureRecipesApproved(recipeIds = [], conn = null) {
    if (!Array.isArray(recipeIds) || recipeIds.length === 0) {
        return [];
    }

    const uniqueIds = Array.from(new Set(recipeIds.map(Number).filter(id => id > 0)));
    if (uniqueIds.length === 0) {
        return [];
    }

    const placeholders = uniqueIds.map(() => '?').join(',');
    const executor = conn || pool;
    const [rows] = await executor.query(
        `SELECT recipeId
         FROM Recipes
         WHERE recipeId IN (${placeholders})
           AND status = 'approved'`,
        uniqueIds
    );

    const approvedSet = new Set(rows.map(r => Number(r.recipeId)));
    const invalidIds = uniqueIds.filter(id => !approvedSet.has(id));

    if (invalidIds.length > 0) {
        throw new Error(`Some recipes are not approved or not found: ${invalidIds.join(', ')}`);
    }

    return uniqueIds;
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

async function getLatestChatSessionByUser(userId) {
    const [rows] = await pool.query(
        `SELECT chatSessionId, userId, title, activeRecipeId, createdAt, updatedAt
         FROM ChatSessions
         WHERE userId = ?
         ORDER BY updatedAt DESC, chatSessionId DESC
         LIMIT 1`,
        [userId]
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

async function addChatMessage({ chatSessionId, role, content, meta = null, conn = null }) {
    const executor = conn || pool;

    await executor.query(
        `INSERT INTO ChatMessages (chatSessionId, role, content, metaJson)
         VALUES (?, ?, ?, ?)`,
        [chatSessionId, role, content, meta ? JSON.stringify(meta) : null]
    );

    await executor.query(
        'UPDATE ChatSessions SET updatedAt = CURRENT_TIMESTAMP WHERE chatSessionId = ?',
        [chatSessionId]
    );
}

async function getMealSwitchCandidates(chatSessionId, conn = null) {
    const executor = conn || pool;

    const [rows] = await executor.query(
        `SELECT recipeId, sortOrder
         FROM ChatSessionRecipes
         WHERE chatSessionId = ?
           AND status IN ('pending', 'cooking')
         ORDER BY sortOrder ASC, chatSessionRecipeId ASC`,
        [chatSessionId]
    );

    return rows.map(row => ({
        recipeId: Number(row.recipeId),
        sortOrder: Number(row.sortOrder)
    }));
}

async function setSessionPrimaryRecipe(chatSessionId, userId, recipeId = null, conn = null) {
    const executor = conn || pool;
    const parsedRecipeId = recipeId === null || recipeId === undefined ? null : Number(recipeId);

    await executor.query(
        `UPDATE ChatSessions
         SET activeRecipeId = ?, updatedAt = CURRENT_TIMESTAMP
         WHERE chatSessionId = ? AND userId = ?`,
        [parsedRecipeId, chatSessionId, userId]
    );

    return parsedRecipeId;
}

async function setSessionPrimaryRecipeByMeal(chatSessionId, userId, conn = null) {
    const candidates = await getMealSwitchCandidates(chatSessionId, conn);
    const nextPrimary = candidates.length > 0 ? candidates[0].recipeId : null;
    await setSessionPrimaryRecipe(chatSessionId, userId, nextPrimary, conn);
    return nextPrimary;
}

async function createChatSessionWithIntro({ userId, title = DEFAULT_SESSION_TITLE, activeRecipeId = null }, conn = null) {
    const executor = conn || pool;

    const finalTitle = title && String(title).trim() ? String(title).trim() : DEFAULT_SESSION_TITLE;
    const parsedActiveRecipeId = activeRecipeId ? Number(activeRecipeId) : null;

    const [result] = await executor.query(
        `INSERT INTO ChatSessions (userId, title, activeRecipeId)
         VALUES (?, ?, ?)`,
        [userId, finalTitle, parsedActiveRecipeId]
    );

    const chatSessionId = Number(result.insertId);

    await addChatMessage({
        chatSessionId,
        role: 'assistant',
        content: DEFAULT_SESSION_INTRO_MESSAGE,
        meta: {
            agentName: DEFAULT_AGENT_NAME,
            intro: true,
            flow: 'meal_v2'
        },
        conn: executor
    });

    return chatSessionId;
}

async function replaceMealRecipesInternal({ chatSessionId, userId, selections = [], autoRecomputePrimary = true }, conn = null) {
    const executor = conn || pool;

    const normalized = selections
        .map((item, idx) => ({
            recipeId: Number(item.recipeId),
            sortOrder: Number(item.sortOrder || idx + 1),
            status: ALLOWED_MEAL_RECIPE_STATUS.has(String(item.status || '').toLowerCase())
                ? String(item.status).toLowerCase()
                : 'pending',
            servingsOverride: item.servingsOverride === null || item.servingsOverride === undefined
                ? null
                : Number(item.servingsOverride),
            note: item.note ? String(item.note).trim() : null
        }))
        .filter(item => item.recipeId > 0);

    await ensureRecipesApproved(normalized.map(item => item.recipeId), executor);

    await executor.query('DELETE FROM ChatSessionRecipes WHERE chatSessionId = ?', [chatSessionId]);

    if (normalized.length > 0) {
        const values = normalized.map(() => '(?, ?, ?, ?, ?, ?, NULL)').join(',');
        const params = [];

        normalized.forEach(item => {
            params.push(
                chatSessionId,
                item.recipeId,
                item.sortOrder,
                item.status,
                item.servingsOverride,
                item.note
            );
        });

        await executor.query(
            `INSERT INTO ChatSessionRecipes (chatSessionId, recipeId, sortOrder, status, servingsOverride, note, resolvedAt)
             VALUES ${values}`,
            params
        );
    }

    if (autoRecomputePrimary) {
        return setSessionPrimaryRecipeByMeal(chatSessionId, userId, executor);
    }

    return null;
}

async function getMealRecipesBySession(chatSessionId) {
    const [rows] = await pool.query(
        `SELECT csr.chatSessionRecipeId, csr.chatSessionId, csr.recipeId, csr.sortOrder, csr.status,
                csr.servingsOverride, csr.note, csr.selectedAt, csr.resolvedAt,
                r.recipeName, r.image, r.cookingTime, r.ration
         FROM ChatSessionRecipes csr
         JOIN Recipes r ON r.recipeId = csr.recipeId
         WHERE csr.chatSessionId = ?
         ORDER BY csr.sortOrder ASC, csr.chatSessionRecipeId ASC`,
        [chatSessionId]
    );

    return rows.map(row => ({
        chatSessionRecipeId: Number(row.chatSessionRecipeId),
        chatSessionId: Number(row.chatSessionId),
        recipeId: Number(row.recipeId),
        sortOrder: Number(row.sortOrder),
        status: row.status,
        servingsOverride: row.servingsOverride === null ? null : Number(row.servingsOverride),
        note: row.note,
        selectedAt: row.selectedAt,
        resolvedAt: row.resolvedAt,
        recipe: {
            recipeId: Number(row.recipeId),
            recipeName: row.recipeName,
            image: row.image,
            cookingTime: row.cookingTime,
            ration: Number(row.ration)
        }
    }));
}

async function getRecentMessages(chatSessionId, limit = 30) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);

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

async function getLatestMessageBySession(chatSessionId) {
    const [rows] = await pool.query(
        `SELECT chatMessageId, role, content, metaJson, createdAt
         FROM ChatMessages
         WHERE chatSessionId = ?
         ORDER BY chatMessageId DESC
         LIMIT 1`,
        [chatSessionId]
    );

    if (!rows.length) return null;

    return {
        chatMessageId: Number(rows[0].chatMessageId),
        role: rows[0].role,
        content: rows[0].content,
        meta: safeParseJson(rows[0].metaJson),
        createdAt: rows[0].createdAt
    };
}

function getMinutesSince(dateInput) {
    if (!dateInput) return null;
    const ts = new Date(dateInput).getTime();
    if (!Number.isFinite(ts)) return null;
    const diffMs = Date.now() - ts;
    return Math.floor(diffMs / (1000 * 60));
}

function containsBroadMealIntent(message = '') {
    const normalized = String(message || '').toLowerCase();
    if (!normalized) return false;

    const broadKeywords = [
        'toàn bộ bữa',
        'toan bo bua',
        'cả bữa',
        'ca bua',
        'tat ca mon',
        'tất cả món',
        'so sánh',
        'so sanh',
        'các món',
        'cac mon',
        'thứ tự nấu',
        'thu tu nau',
        'kế hoạch bữa',
        'ke hoach bua'
    ];

    return broadKeywords.some(keyword => normalized.includes(keyword));
}

function getLastMealV2CompletionReminderMeta(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message.role !== 'assistant') continue;
        const meta = message.meta || {};
        if (meta.flow === 'meal_v2' && meta.completionReminderV2) {
            return {
                message,
                meta: meta.completionReminderV2
            };
        }
    }

    return null;
}

function getDayKey(dateInput = new Date()) {
    const date = new Date(dateInput);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getMealV2CompletionReminderPayload({
    session,
    mealItems = [],
    minutesSinceLastMessage,
    pendingUserMessage = '',
    recentMessages = []
}) {
    const minMinutes = MEAL_V2_COMPLETION_REMINDER_MINUTES;
    if (!Number.isFinite(minMinutes) || minutesSinceLastMessage === null || minutesSinceLastMessage < minMinutes) {
        return null;
    }

    const hasUnfinished = mealItems.some(item => item.status === 'pending' || item.status === 'cooking');
    if (!hasUnfinished) return null;

    if (containsBroadMealIntent(pendingUserMessage)) return null;

    const activeRecipeId = session?.activeRecipeId ? Number(session.activeRecipeId) : null;
    if (!activeRecipeId) return null;

    const activeMealItem = mealItems.find(item => Number(item.recipeId) === activeRecipeId);
    if (!activeMealItem || (activeMealItem.status !== 'pending' && activeMealItem.status !== 'cooking')) {
        return null;
    }

    const lastReminder = getLastMealV2CompletionReminderMeta(recentMessages);
    if (lastReminder) {
        const minutesSinceReminder = getMinutesSince(lastReminder.message?.createdAt);
        if (
            Number.isFinite(MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES) &&
            minutesSinceReminder !== null &&
            minutesSinceReminder < MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES
        ) {
            return null;
        }

        const todayKey = getDayKey();
        const reminderDayKey = String(lastReminder.meta?.dayKey || '');
        const reminderCount = Number(lastReminder.meta?.countToday || 0);

        if (
            Number.isFinite(MEAL_V2_COMPLETION_REMINDER_MAX_PER_DAY) &&
            reminderDayKey === todayKey &&
            reminderCount >= MEAL_V2_COMPLETION_REMINDER_MAX_PER_DAY
        ) {
            return null;
        }
    }

    const isStrongReminder = Number.isFinite(MEAL_V2_COMPLETION_REMINDER_STRONG_MINUTES)
        ? minutesSinceLastMessage >= MEAL_V2_COMPLETION_REMINDER_STRONG_MINUTES
        : false;

    const recipeName = activeMealItem?.recipe?.recipeName || `món #${activeRecipeId}`;

    const reminderMessage = isStrongReminder
        ? `Anh đang để dở món "${recipeName}" khoảng ${minutesSinceLastMessage} phút rồi. Anh đã nấu xong món này chưa để em cập nhật tiếp cho đúng tiến độ bữa?`
        : `Anh đang nấu món "${recipeName}". Trước khi tiếp tục, anh xác nhận giúp em là món này đã xong chưa nhé?`;

    const todayKey = getDayKey();
    const previousCount = Number(lastReminder?.meta?.countToday || 0);
    const nextCount = String(lastReminder?.meta?.dayKey || '') === todayKey ? previousCount + 1 : 1;

    return {
        success: true,
        code: 'PENDING_MEAL_V2_COMPLETION_CHECK',
        data: {
            session,
            meal: {
                totalRecipes: mealItems.length,
                items: mealItems
            },
            completionCheck: {
                recipeId: activeRecipeId,
                recipeName,
                minutesSinceLastMessage,
                isStrongReminder,
                reminderMessage,
                pendingUserMessage: String(pendingUserMessage || ''),
                actions: [
                    { id: 'mark_done', label: 'Đã xong món này' },
                    { id: 'mark_skipped', label: 'Bỏ qua món này' },
                    { id: 'continue_current', label: 'Chưa xong, tiếp tục món này' }
                ],
                countToday: nextCount,
                dayKey: todayKey,
                cooldownMinutes: MEAL_V2_COMPLETION_REMINDER_COOLDOWN_MINUTES
            }
        },
        message: isStrongReminder
            ? 'Meal v2 completion check (strong reminder)'
            : 'Meal v2 completion check'
    };
}

async function getPantryRowsByUser(userId) {
    const [rows] = await pool.query(
        `SELECT i.ingredientName, p.quantity, p.unit
         FROM PantryItems p
         JOIN Ingredients i ON i.ingredientId = p.ingredientId
         WHERE p.userId = ?`,
        [userId]
    );

    return rows.map(row => ({
        ingredientName: row.ingredientName,
        quantity: Number(row.quantity || 0),
        unit: row.unit
    }));
}

async function getRecipeContexts(recipeIds = []) {
    const normalized = Array.from(new Set(recipeIds.map(Number).filter(id => id > 0)));
    if (normalized.length === 0) return [];

    const placeholders = normalized.map(() => '?').join(',');

    const [recipeRows] = await pool.query(
        `SELECT r.recipeId, r.recipeName, r.cookingTime, r.ration, u.fullName AS authorName
         FROM Recipes r
         JOIN Users u ON u.userId = r.userId
         WHERE r.recipeId IN (${placeholders})
           AND r.status = 'approved'`,
        normalized
    );

    if (recipeRows.length === 0) return [];

    const [ingredientRows] = await pool.query(
        `SELECT ri.recipeId, i.ingredientName, ri.weight, ri.unit
         FROM RecipesIngredients ri
         JOIN Ingredients i ON i.ingredientId = ri.ingredientId
         WHERE ri.recipeId IN (${placeholders})
         ORDER BY ri.recipeId ASC, ri.weight DESC`,
        normalized
    );

    const [stepRows] = await pool.query(
        `SELECT recipeId, indexStep, content
         FROM CookingSteps
         WHERE recipeId IN (${placeholders})
         ORDER BY recipeId ASC, indexStep ASC`,
        normalized
    );

    const ingredientMap = new Map();
    ingredientRows.forEach(row => {
        const rid = Number(row.recipeId);
        if (!ingredientMap.has(rid)) ingredientMap.set(rid, []);
        ingredientMap.get(rid).push({
            ingredientName: row.ingredientName,
            weight: Number(row.weight || 0),
            unit: row.unit
        });
    });

    const stepMap = new Map();
    stepRows.forEach(row => {
        const rid = Number(row.recipeId);
        if (!stepMap.has(rid)) stepMap.set(rid, []);
        stepMap.get(rid).push({
            indexStep: Number(row.indexStep),
            content: row.content
        });
    });

    return recipeRows
        .map(row => ({
            recipeId: Number(row.recipeId),
            recipeName: row.recipeName,
            cookingTime: row.cookingTime,
            ration: Number(row.ration),
            authorName: row.authorName,
            ingredients: ingredientMap.get(Number(row.recipeId)) || [],
            steps: stepMap.get(Number(row.recipeId)) || []
        }))
        .sort((a, b) => normalized.indexOf(a.recipeId) - normalized.indexOf(b.recipeId));
}

function normalizeInboundUserMessage(message = '') {
    const raw = String(message || '').trim();
    if (!raw) return '';

    const focusedMessagePattern = /^Ngữ cảnh phiên nấu hiện tại:[\s\S]*?Yêu cầu của người dùng:\s*([\s\S]+)$/u;
    const focusedMatch = raw.match(focusedMessagePattern);

    if (focusedMatch && focusedMatch[1] && focusedMatch[1].trim()) {
        return focusedMatch[1].trim();
    }

    return raw;
}

function buildMealPrompt({
    mealItems = [],
    recipeContexts = [],
    pantryRows = [],
    activeDietNotes = [],
    activeRecipeId = null,
    focusedRecipeContext = null
}) {
    const recipeStatusSummary = mealItems.map(item => ({
        recipeId: item.recipeId,
        recipeName: item.recipe?.recipeName || null,
        sortOrder: item.sortOrder,
        status: item.status,
        servingsOverride: item.servingsOverride,
        note: item.note
    }));

    const activeFocusLine = activeRecipeId
        ? `Current focus recipeId: ${activeRecipeId}`
        : 'Current focus recipeId: null';

    const focusedRecipeLine = focusedRecipeContext
        ? `Focused recipe detail (ưu tiên cao nhất): ${JSON.stringify(focusedRecipeContext, null, 2)}`
        : 'Focused recipe detail (ưu tiên cao nhất): null';

    return [
        `Bạn là ${DEFAULT_AGENT_NAME}, trợ lý nấu ăn của ChefMate.`,
        'Luôn trả lời tiếng Việt tự nhiên, rõ ràng, thực tế và an toàn.',
        'Người dùng có thể nấu nhiều món trong một bữa, hãy tối ưu thứ tự nấu và tái sử dụng nguyên liệu/dụng cụ.',
        'Ưu tiên đưa kế hoạch theo timeline (chuẩn bị trước, món làm song song, món làm sau).',
        'Tuyệt đối tôn trọng dị ứng/hạn chế ăn uống. Nếu thiếu dữ liệu thì hỏi lại ngắn gọn.',
        'QUY TẮC CỨNG VỀ FOCUS: nếu session có activeRecipeId và user KHÔNG nêu rõ món khác hoặc không hỏi toàn bộ bữa, phải trả lời theo món đang focus.',
        'Chỉ trả lời theo toàn meal (nhiều món) khi user yêu cầu rõ ràng kiểu: toàn bộ bữa, thứ tự cả bữa, so sánh các món.',
        activeFocusLine,
        focusedRecipeLine,
        `Meal items hiện tại: ${JSON.stringify(recipeStatusSummary, null, 2)}`,
        `Chi tiết công thức các món: ${JSON.stringify(recipeContexts, null, 2)}`,
        `Pantry hiện tại: ${JSON.stringify(pantryRows, null, 2)}`,
        `Diet notes đang hiệu lực: ${JSON.stringify(activeDietNotes, null, 2)}`
    ].join('\n');
}

exports.createMealSession = async ({ userId, title, recipeIds = null, recipes = null }) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const selections = normalizeRecipeSelectionInput({ recipes, recipeIds });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (selections.length > 0) {
            await ensureRecipesApproved(selections.map(item => item.recipeId), conn);
        }

        const defaultPrimary = selections.length === 1 ? Number(selections[0].recipeId) : null;

        const chatSessionId = await createChatSessionWithIntro({
            userId: parsedUserId,
            title: title || DEFAULT_SESSION_TITLE,
            activeRecipeId: defaultPrimary
        }, conn);

        await replaceMealRecipesInternal({
            chatSessionId,
            userId: parsedUserId,
            selections,
            autoRecomputePrimary: false
        }, conn);

        await conn.commit();

        const session = await getChatSessionById(chatSessionId, parsedUserId);
        const mealItems = await getMealRecipesBySession(chatSessionId);

        return {
            success: true,
            data: {
                session,
                meal: {
                    totalRecipes: mealItems.length,
                    items: mealItems
                },
                focus: {
                    activeRecipeId: session?.activeRecipeId || null,
                    needsSelection: selections.length > 1 && !session?.activeRecipeId
                }
            },
            message: 'Create meal chat session successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.replaceMealRecipes = async ({ userId, chatSessionId, recipeIds = null, recipes = null }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const selections = normalizeRecipeSelectionInput({ recipes, recipeIds });

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await replaceMealRecipesInternal({
            chatSessionId: parsedSessionId,
            userId: parsedUserId,
            selections,
            autoRecomputePrimary: false
        }, conn);

        if (selections.length === 0) {
            await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, null, conn);
        } else if (selections.length === 1) {
            await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, selections[0].recipeId, conn);
        } else {
            // nhiều món: giữ primary cũ nếu còn tồn tại & còn pending/cooking, nếu không thì để null để client hỏi user chọn focus
            const currentPrimary = session.activeRecipeId ? Number(session.activeRecipeId) : null;
            const currentStillValid = currentPrimary
                ? selections.some(item => item.recipeId === currentPrimary && (item.status === 'pending' || item.status === 'cooking'))
                : false;

            if (!currentStillValid) {
                await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, null, conn);
            }
        }

        await addChatMessage({
            chatSessionId: parsedSessionId,
            role: 'assistant',
            content: selections.length > 0
                ? `Đã cập nhật danh sách món cho bữa này: ${selections.length} món.`
                : 'Đã xoá toàn bộ món khỏi kế hoạch bữa này.',
            meta: {
                mealPlanUpdate: true,
                flow: 'meal_v2',
                totalRecipes: selections.length
            },
            conn
        });

        await conn.commit();

        const updatedSession = await getChatSessionById(parsedSessionId, parsedUserId);
        const mealItems = await getMealRecipesBySession(parsedSessionId);

        return {
            success: true,
            data: {
                session: updatedSession,
                meal: {
                    totalRecipes: mealItems.length,
                    items: mealItems
                },
                focus: {
                    activeRecipeId: updatedSession?.activeRecipeId || null,
                    needsSelection: mealItems.length > 1 && !updatedSession?.activeRecipeId
                }
            },
            message: 'Update meal recipes successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.updateMealRecipeStatus = async ({ userId, chatSessionId, recipeId, status, note = null, confirmSwitchPrimary = false, nextPrimaryRecipeId = null }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);
    const parsedRecipeId = Number(recipeId);
    const normalizedStatus = String(status || '').trim().toLowerCase();

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    if (!parsedRecipeId || parsedRecipeId <= 0) {
        throw new Error('recipeId must be a positive number');
    }

    if (!ALLOWED_MEAL_RECIPE_STATUS.has(normalizedStatus)) {
        throw new Error('status must be one of: pending, cooking, done, skipped');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [updateResult] = await conn.query(
            `UPDATE ChatSessionRecipes
             SET status = ?,
                 note = ?,
                 resolvedAt = CASE WHEN ? IN ('done', 'skipped') THEN CURRENT_TIMESTAMP ELSE NULL END
             WHERE chatSessionId = ? AND recipeId = ?`,
            [
                normalizedStatus,
                note ? String(note).trim() : null,
                normalizedStatus,
                parsedSessionId,
                parsedRecipeId
            ]
        );

        if (!Number(updateResult.affectedRows || 0)) {
            await conn.rollback();
            return {
                success: false,
                data: null,
                message: 'Recipe is not linked to this meal session'
            };
        }

        const currentSession = await getChatSessionById(parsedSessionId, parsedUserId);
        const currentPrimary = currentSession?.activeRecipeId ? Number(currentSession.activeRecipeId) : null;
        const isClosingCurrentPrimary = Boolean(currentPrimary && currentPrimary === parsedRecipeId && (normalizedStatus === 'done' || normalizedStatus === 'skipped'));

        const switchCandidates = await getMealSwitchCandidates(parsedSessionId, conn);

        let pendingPrimarySwitch = null;

        if (isClosingCurrentPrimary && switchCandidates.length > 0) {
            if (!confirmSwitchPrimary) {
                await conn.rollback();

                const mealItemsPreview = await getMealRecipesBySession(parsedSessionId);

                return {
                    success: true,
                    code: 'PENDING_PRIMARY_RECIPE_SWITCH_CONFIRMATION',
                    data: {
                        session: currentSession,
                        recipe: mealItemsPreview.find(item => item.recipeId === parsedRecipeId) || null,
                        meal: {
                            totalRecipes: mealItemsPreview.length,
                            items: mealItemsPreview
                        },
                        pendingSwitch: {
                            reason: 'current_primary_recipe_finished',
                            closedRecipeId: parsedRecipeId,
                            closedRecipeStatus: normalizedStatus,
                            currentPrimaryRecipeId: currentPrimary,
                            candidateNextPrimaryRecipeIds: switchCandidates.map(item => item.recipeId),
                            suggestedNextPrimaryRecipeId: switchCandidates[0].recipeId,
                            confirmField: 'confirmSwitchPrimary',
                            chooseField: 'nextPrimaryRecipeId'
                        }
                    },
                    message: 'Need confirmation before switching primary recipe'
                };
            }

            const candidateRecipeIds = new Set(switchCandidates.map(item => item.recipeId));
            let chosenPrimary = nextPrimaryRecipeId ? Number(nextPrimaryRecipeId) : switchCandidates[0].recipeId;

            if (!candidateRecipeIds.has(chosenPrimary)) {
                throw new Error('nextPrimaryRecipeId is not found in meal session pending/cooking items');
            }

            await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, chosenPrimary, conn);
            pendingPrimarySwitch = {
                fromRecipeId: currentPrimary,
                toRecipeId: chosenPrimary,
                confirmed: true
            };
        } else if (isClosingCurrentPrimary) {
            await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, null, conn);
            pendingPrimarySwitch = {
                fromRecipeId: currentPrimary,
                toRecipeId: null,
                confirmed: true
            };
        }

        await addChatMessage({
            chatSessionId: parsedSessionId,
            role: 'assistant',
            content: `Đã cập nhật trạng thái món #${parsedRecipeId} thành ${normalizedStatus}.`,
            meta: {
                mealRecipeStatusUpdate: true,
                flow: 'meal_v2',
                recipeId: parsedRecipeId,
                status: normalizedStatus,
                primarySwitch: pendingPrimarySwitch
            },
            conn
        });

        await conn.commit();

        const updatedSession = await getChatSessionById(parsedSessionId, parsedUserId);
        const mealItems = await getMealRecipesBySession(parsedSessionId);
        const updatedItem = mealItems.find(item => item.recipeId === parsedRecipeId) || null;

        return {
            success: true,
            data: {
                session: updatedSession,
                recipe: updatedItem,
                meal: {
                    totalRecipes: mealItems.length,
                    items: mealItems
                },
                focus: {
                    activeRecipeId: updatedSession?.activeRecipeId || null,
                    needsSelection: mealItems.length > 1 && !updatedSession?.activeRecipeId
                },
                primarySwitch: pendingPrimarySwitch
            },
            message: 'Update meal recipe status successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.setMealPrimaryRecipe = async ({ userId, chatSessionId, recipeId = null }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const parsedRecipeId = recipeId === null || recipeId === undefined ? null : Number(recipeId);

    if (parsedRecipeId !== null && (!Number.isFinite(parsedRecipeId) || parsedRecipeId <= 0)) {
        throw new Error('recipeId must be null or a positive number');
    }

    if (parsedRecipeId !== null) {
        const [rows] = await pool.query(
            `SELECT recipeId, status
             FROM ChatSessionRecipes
             WHERE chatSessionId = ? AND recipeId = ?
             LIMIT 1`,
            [parsedSessionId, parsedRecipeId]
        );

        if (rows.length === 0) {
            throw new Error('nextPrimaryRecipeId is not found in meal session pending/cooking items');
        }

        const status = String(rows[0].status || '').toLowerCase();
        if (status !== 'pending' && status !== 'cooking') {
            throw new Error('nextPrimaryRecipeId is not found in meal session pending/cooking items');
        }
    }

    await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, parsedRecipeId);

    const updatedSession = await getChatSessionById(parsedSessionId, parsedUserId);
    const mealItems = await getMealRecipesBySession(parsedSessionId);

    return {
        success: true,
        data: {
            session: updatedSession,
            meal: {
                totalRecipes: mealItems.length,
                items: mealItems
            },
            focus: {
                activeRecipeId: updatedSession?.activeRecipeId || null,
                needsSelection: mealItems.length > 1 && !updatedSession?.activeRecipeId
            }
        },
        message: 'Set meal primary recipe successfully'
    };
};

exports.completeMealSession = async ({
    userId,
    chatSessionId,
    completionType = 'completed',
    note = null,
    markRemainingStatus = null
}) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    const normalizedCompletionType = String(completionType || 'completed').trim().toLowerCase();
    if (normalizedCompletionType !== 'completed' && normalizedCompletionType !== 'abandoned') {
        throw new Error('completionType must be one of: completed, abandoned');
    }

    const normalizedMarkRemainingStatus = markRemainingStatus === null || markRemainingStatus === undefined
        ? null
        : String(markRemainingStatus).trim().toLowerCase();

    if (normalizedMarkRemainingStatus !== null && normalizedMarkRemainingStatus !== 'done' && normalizedMarkRemainingStatus !== 'skipped') {
        throw new Error('markRemainingStatus must be null or one of: done, skipped');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        if (normalizedMarkRemainingStatus) {
            await conn.query(
                `UPDATE ChatSessionRecipes
                 SET status = ?,
                     resolvedAt = CURRENT_TIMESTAMP
                 WHERE chatSessionId = ?
                   AND status IN ('pending', 'cooking')`,
                [normalizedMarkRemainingStatus, parsedSessionId]
            );
        }

        await setSessionPrimaryRecipe(parsedSessionId, parsedUserId, null, conn);

        await addChatMessage({
            chatSessionId: parsedSessionId,
            role: 'assistant',
            content: normalizedCompletionType === 'completed'
                ? 'Đã hoàn thành phiên nấu cho bữa này. Khi cần mình có thể bắt đầu kế hoạch bữa mới ngay.'
                : 'Đã đóng phiên nấu hiện tại. Khi cần mình có thể mở kế hoạch mới cho anh.',
            meta: {
                flow: 'meal_v2',
                mealSessionCompleted: true,
                completion: {
                    type: normalizedCompletionType,
                    note: note ? String(note).trim() : null,
                    markRemainingStatus: normalizedMarkRemainingStatus,
                    completedAt: new Date().toISOString()
                }
            },
            conn
        });

        await conn.commit();

        const updatedSession = await getChatSessionById(parsedSessionId, parsedUserId);
        const mealItems = await getMealRecipesBySession(parsedSessionId);

        return {
            success: true,
            data: {
                session: updatedSession,
                meal: {
                    totalRecipes: mealItems.length,
                    items: mealItems
                },
                focus: {
                    activeRecipeId: updatedSession?.activeRecipeId || null,
                    needsSelection: mealItems.length > 1 && !updatedSession?.activeRecipeId
                },
                completion: {
                    type: normalizedCompletionType,
                    note: note ? String(note).trim() : null,
                    markRemainingStatus: normalizedMarkRemainingStatus
                }
            },
            message: 'Complete meal session successfully'
        };
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
    }
};

exports.resolveCompletionCheckV2 = async ({
    userId,
    chatSessionId,
    action,
    pendingUserMessage = '',
    nextPrimaryRecipeId = null,
    model = DEFAULT_MODEL
}) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(chatSessionId);
    const normalizedAction = String(action || '').trim().toLowerCase();
    const normalizedPendingUserMessage = String(pendingUserMessage || '').trim();

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('chatSessionId must be a positive number');
    }

    if (!normalizedAction) {
        throw new Error('action is required');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const mealItems = await getMealRecipesBySession(parsedSessionId);

    const activeRecipeId = session?.activeRecipeId ? Number(session.activeRecipeId) : null;
    const targetMealItem = activeRecipeId
        ? mealItems.find(item => Number(item.recipeId) === activeRecipeId)
        : mealItems.find(item => item.status === 'pending' || item.status === 'cooking') || null;

    if (normalizedAction === 'mark_done' || normalizedAction === 'mark_skipped') {
        if (!targetMealItem?.recipeId) {
            return {
                success: false,
                data: null,
                message: 'No active recipe to update'
            };
        }

        const updateResult = await exports.updateMealRecipeStatus({
            userId: parsedUserId,
            chatSessionId: parsedSessionId,
            recipeId: Number(targetMealItem.recipeId),
            status: normalizedAction === 'mark_done' ? 'done' : 'skipped',
            confirmSwitchPrimary: true,
            nextPrimaryRecipeId: nextPrimaryRecipeId === null || nextPrimaryRecipeId === undefined
                ? null
                : Number(nextPrimaryRecipeId)
        });

        if (!updateResult.success) {
            return updateResult;
        }

        if (!normalizedPendingUserMessage) {
            return {
                success: true,
                data: {
                    ...updateResult.data,
                    completionCheckAction: normalizedAction
                },
                message: 'Completion check action handled successfully'
            };
        }

        return exports.sendMessageV2({
            userId: parsedUserId,
            chatSessionId: parsedSessionId,
            message: normalizedPendingUserMessage,
            model,
            stream: false,
            useUnifiedSession: false,
            skipCompletionCheck: true
        });
    }

    if (normalizedAction === 'continue_current') {
        if (!normalizedPendingUserMessage) {
            return {
                success: true,
                data: {
                    session,
                    meal: {
                        totalRecipes: mealItems.length,
                        items: mealItems
                    },
                    completionCheckAction: normalizedAction
                },
                message: 'Completion check action handled successfully'
            };
        }

        return exports.sendMessageV2({
            userId: parsedUserId,
            chatSessionId: parsedSessionId,
            message: normalizedPendingUserMessage,
            model,
            stream: false,
            useUnifiedSession: false,
            skipCompletionCheck: true
        });
    }

    throw new Error('action must be one of: mark_done, mark_skipped, continue_current');
};

exports.sendMessageV2 = async ({
    userId,
    chatSessionId = null,
    message,
    model = DEFAULT_MODEL,
    stream = false,
    useUnifiedSession = true,
    skipCompletionCheck = false
}) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!message || typeof message !== 'string' || !message.trim()) {
        throw new Error('message is required');
    }

    const normalizedUserMessage = normalizeInboundUserMessage(message);
    if (!normalizedUserMessage) {
        throw new Error('message is required');
    }

    let sessionId = chatSessionId ? Number(chatSessionId) : null;
    let session = null;

    if (sessionId) {
        session = await getChatSessionById(sessionId, parsedUserId);
        if (!session) {
            return {
                success: false,
                data: null,
                message: 'Chat session not found'
            };
        }
    } else if (useUnifiedSession) {
        session = await getLatestChatSessionByUser(parsedUserId);
        if (!session) {
            const createdId = await createChatSessionWithIntro({
                userId: parsedUserId,
                title: DEFAULT_SESSION_TITLE,
                activeRecipeId: null
            });
            session = await getChatSessionById(createdId, parsedUserId);
        }
        sessionId = session.chatSessionId;
    } else {
        const createdId = await createChatSessionWithIntro({
            userId: parsedUserId,
            title: DEFAULT_SESSION_TITLE,
            activeRecipeId: null
        });
        session = await getChatSessionById(createdId, parsedUserId);
        sessionId = session.chatSessionId;
    }

    const [mealItemsBeforeCheck, recentMessagesBeforeCheck] = await Promise.all([
        getMealRecipesBySession(sessionId),
        getRecentMessages(sessionId, 40)
    ]);

    if (!skipCompletionCheck) {
        const latestMessage = recentMessagesBeforeCheck.length > 0
            ? recentMessagesBeforeCheck[recentMessagesBeforeCheck.length - 1]
            : await getLatestMessageBySession(sessionId);

        const minutesSinceLastMessage = getMinutesSince(latestMessage?.createdAt);
        const reminderPayload = getMealV2CompletionReminderPayload({
            session,
            mealItems: mealItemsBeforeCheck,
            minutesSinceLastMessage,
            pendingUserMessage: normalizedUserMessage,
            recentMessages: recentMessagesBeforeCheck
        });

        if (reminderPayload) {
            return reminderPayload;
        }
    }

    await addChatMessage({
        chatSessionId: sessionId,
        role: 'user',
        content: normalizedUserMessage,
        meta: {
            flow: 'meal_v2'
        }
    });

    const mealItems = mealItemsBeforeCheck;
    const recipeIds = mealItems.map(item => item.recipeId);

    if (recipeIds.length === 0 && session.activeRecipeId) {
        recipeIds.push(session.activeRecipeId);
    }

    const [recipeContexts, pantryRows, activeDietNotes, recentMessages] = await Promise.all([
        getRecipeContexts(recipeIds),
        getPantryRowsByUser(parsedUserId),
        userDietModel.getActiveDietNotes(parsedUserId),
        getRecentMessages(sessionId, 40)
    ]);

    const activeRecipeId = session?.activeRecipeId ? Number(session.activeRecipeId) : null;
    const focusedRecipeContext = activeRecipeId
        ? (recipeContexts.find(item => Number(item.recipeId) === activeRecipeId) || null)
        : null;

    const contextMessage = {
        role: 'system',
        content: buildMealPrompt({
            mealItems,
            recipeContexts,
            pantryRows,
            activeDietNotes,
            activeRecipeId,
            focusedRecipeContext
        })
    };

    const llmMessages = [
        contextMessage,
        ...recentMessages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({ role: msg.role, content: msg.content }))
    ];

    try {
        const aiResult = await callAiApi({
            model,
            messages: llmMessages,
            stream: Boolean(stream)
        });

        const assistantMessage = aiResult.assistantMessage || 'Em chưa nhận được phản hồi hợp lệ từ AI, anh thử lại giúp em nhé.';

        await addChatMessage({
            chatSessionId: sessionId,
            role: 'assistant',
            content: assistantMessage,
            meta: {
                flow: 'meal_v2',
                model,
                raw: aiResult.raw,
                mealRecipeIds: recipeIds
            }
        });

        const updatedSession = await getChatSessionById(sessionId, parsedUserId);
        const updatedMealItems = await getMealRecipesBySession(sessionId);

        return {
            success: true,
            data: {
                session: updatedSession,
                meal: {
                    totalRecipes: updatedMealItems.length,
                    items: updatedMealItems
                },
                assistantMessage
            },
            message: 'Chat with AI v2 successfully'
        };
    } catch (error) {
        const updatedSession = await getChatSessionById(sessionId, parsedUserId);
        const updatedMealItems = await getMealRecipesBySession(sessionId);

        return {
            success: false,
            code: 'AI_SERVER_BUSY',
            data: {
                session: updatedSession,
                meal: {
                    totalRecipes: updatedMealItems.length,
                    items: updatedMealItems
                },
                retryable: true,
                retryAfterMs: Number(process.env.AI_CHAT_RETRY_AFTER_MS || 5000),
                failedUserMessage: {
                    content: normalizedUserMessage
                },
                error: {
                    message: 'Máy chủ AI đang bận hoặc tạm thời không khả dụng, anh vui lòng thử lại sau ít phút.',
                    status: error.status || null
                }
            },
            message: 'AI server is busy'
        };
    }
};
