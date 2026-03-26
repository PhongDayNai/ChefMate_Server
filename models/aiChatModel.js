const { pool } = require('../config/dbConfig');
const userDietModel = require('./userDietModel');

const DEFAULT_RECOMMENDATION_LIMIT = 10;
const DEFAULT_SESSION_TITLE = 'Phiên chat nấu ăn';
const DEFAULT_AUTO_TITLE_MODEL = process.env.AI_CHAT_TITLE_MODEL || process.env.AI_CHAT_MODEL || 'gemma3:4b';
const DEFAULT_AGENT_NAME = 'Bepes';
const DEFAULT_SESSION_INTRO_MESSAGE = `Xin chào anh, em là ${DEFAULT_AGENT_NAME} – trợ lý nấu ăn của ChefMate. Em có thể gợi ý món theo nguyên liệu hiện có, hướng dẫn từng bước nấu và điều chỉnh theo dị ứng/hạn chế ăn uống của anh.`;

const PREVIOUS_RECIPE_REMINDER_MINUTES = Number(process.env.AI_CHAT_PREVIOUS_RECIPE_REMINDER_MINUTES || 30);
const PREVIOUS_RECIPE_STRONG_REMINDER_MINUTES = Number(process.env.AI_CHAT_PREVIOUS_RECIPE_STRONG_REMINDER_MINUTES || 180);

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

function stripVietnameseDiacritics(text = '') {
    return String(text)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
}

const INGREDIENT_PHRASE_NORMALIZERS = [
    // thịt heo + bộ phận
    [/\b(thit\s+lon|thit\s+heo|pork|pig\s*meat|swine)\b/g, 'thit heo'],
    [/\b(ba\s*chi|ba\s*roi|ba\s*r\s*i|belly|pork\s*belly)\b/g, 'ba chi'],
    [/\b(suon\s*non|suon\s*s\s*n|suon\s*heo|pork\s*rib|spare\s*ribs?)\b/g, 'suon heo'],
    [/\b(chan\s*gio|gio\s*heo|gio\s*lon|mong\s*gio|heo\s*trotter|pork\s*hock)\b/g, 'chan gio heo'],
    [/\b(thit\s*nac|nac\s*dam|nac\s*vai|ham)\b/g, 'nac heo'],

    // thịt bò/gà/vịt/dê/cừu/trâu
    [/\b(beef|veal|thit\s*bo)\b/g, 'thit bo'],
    [/\b(chicken|hen|thit\s*ga)\b/g, 'thit ga'],
    [/\b(duck|thit\s*vit)\b/g, 'thit vit'],
    [/\b(goat|mutton|thit\s*de)\b/g, 'thit de'],
    [/\b(lamb|thit\s*cuu)\b/g, 'thit cuu'],
    [/\b(buffalo|thit\s*trau)\b/g, 'thit trau'],

    // cá/hải sản
    [/\b(fish\s*sauce)\b/g, 'nuoc mam'],
    [/\b(shrimp|prawn|tom\s*su|tom\s*the|tom\s*dat)\b/g, 'tom'],
    [/\b(crab|cua\s*bien|cua\s*dong)\b/g, 'cua'],
    [/\b(squid|calamari|muc\s*ong|muc\s*la)\b/g, 'muc'],
    [/\b(octopus|bach\s*tuoc)\b/g, 'bach tuoc'],
    [/\b(clam|ngheu|ngao)\b/g, 'ngheu'],
    [/\b(oyster|hau)\b/g, 'hau'],
    [/\b(salmon)\b/g, 'ca hoi'],
    [/\b(tuna)\b/g, 'ca ngu'],
    [/\b(mackerel)\b/g, 'ca thu'],

    // rau củ quả / gia vị
    [/\b(scallion|green\s*onion|spring\s*onion|hanh\s*la)\b/g, 'hanh la'],
    [/\b(shallot|hanh\s*tim|hanh\s*cu)\b/g, 'hanh tim'],
    [/\b(onion|hanh\s*tay)\b/g, 'hanh tay'],
    [/\b(garlic|toi)\b/g, 'toi'],
    [/\b(ginger|gung)\b/g, 'gung'],
    [/\b(chili|chilli|ot\s*hiem|ot\s*chi\s*thien)\b/g, 'ot'],
    [/\b(pepper|tieu)\b/g, 'tieu'],
    [/\b(coriander|cilantro|ngo\s*ri|rau\s*mui)\b/g, 'ngo ri'],
    [/\b(lemongrass|sa\s*re)\b/g, 'sa re'],
    [/\b(kafir\s*lime\s*leaf|la\s*chanh)\b/g, 'la chanh'],
    [/\b(turmeric|nghe)\b/g, 'nghe'],
    [/\b(galangal|rieng)\b/g, 'rieng'],

    [/\b(potato|khoai\s*tay)\b/g, 'khoai tay'],
    [/\b(sweet\s*potato|khoai\s*lang)\b/g, 'khoai lang'],
    [/\b(taro|khoai\s*mon|khoai\s*so)\b/g, 'khoai mon'],
    [/\b(cassava|s\s*n|khoai\s*mi)\b/g, 'san'],
    [/\b(tomato|ca\s*chua)\b/g, 'ca chua'],
    [/\b(cucumber|dua\s*leo|dua\s*chuot)\b/g, 'dua leo'],
    [/\b(eggplant|aubergine|ca\s*tim)\b/g, 'ca tim'],
    [/\b(pumpkin|bi\s*do)\b/g, 'bi do'],
    [/\b(gourd|bi\s*xanh|bi\s*dao)\b/g, 'bi xanh'],
    [/\b(chayote|su\s*su)\b/g, 'su su'],
    [/\b(carrot|ca\s*rot)\b/g, 'ca rot'],
    [/\b(cabbage|bap\s*cai)\b/g, 'bap cai'],
    [/\b(cauliflower|sup\s*lo\s*trang|bong\s*cai\s*trang)\b/g, 'sup lo trang'],
    [/\b(broccoli|sup\s*lo\s*xanh|bong\s*cai\s*xanh)\b/g, 'sup lo xanh'],
    [/\b(water\s*spinach|rau\s*muong)\b/g, 'rau muong'],
    [/\b(spinach|rau\s*bo\s*xo?i?)\b/g, 'rau bo xoi'],
    [/\b(kale)\b/g, 'cai kale'],
    [/\b(mushroom|nam)\b/g, 'nam'],

    // đậu, hạt, tinh bột
    [/\b(egg|trung\s*ga|trung\s*vit)\b/g, 'trung'],
    [/\b(tofu|bean\s*curd|dau\s*hu)\b/g, 'dau hu'],
    [/\b(soy\s*bean|dau\s*nanh)\b/g, 'dau nanh'],
    [/\b(green\s*bean|mung\s*bean|dau\s*xanh)\b/g, 'dau xanh'],
    [/\b(red\s*bean|adzuki|dau\s*do)\b/g, 'dau do'],
    [/\b(peanut|groundnut|lac|dau\s*phong)\b/g, 'dau phong'],
    [/\b(sesame|me\s*trang|vung)\b/g, 'me'],

    // chất lỏng / sốt / gia vị cơ bản
    [/\b(soy\s*sauce|x\s*i\s*dau|xidau|nuoc\s*tuong)\b/g, 'nuoc tuong'],
    [/\b(oyster\s*sauce|dau\s*hao)\b/g, 'dau hao'],
    [/\b(cooking\s*oil|vegetable\s*oil|dau\s*an)\b/g, 'dau an'],
    [/\b(olive\s*oil|dau\s*oliu)\b/g, 'dau oliu'],
    [/\b(vinegar|giam)\b/g, 'giam'],
    [/\b(sugar|duong)\b/g, 'duong'],
    [/\b(salt|muoi)\b/g, 'muoi'],
    [/\b(msg|bot\s*ngot)\b/g, 'bot ngot'],
    [/\b(seasoning\s*powder|hat\s*nem)\b/g, 'hat nem'],
    [/\b(broth|stock|nuoc\s*dung)\b/g, 'nuoc dung']
];

const INGREDIENT_TOKEN_SYNONYMS = new Map([
    ['lon', 'heo'], ['pig', 'heo'], ['pork', 'heo'], ['swine', 'heo'],
    ['beef', 'bo'], ['veal', 'bo'],
    ['chicken', 'ga'], ['hen', 'ga'],
    ['duck', 'vit'],
    ['goat', 'de'], ['mutton', 'de'],
    ['lamb', 'cuu'],
    ['buffalo', 'trau'],
    ['shrimp', 'tom'], ['prawn', 'tom'], ['tep', 'tom'],
    ['crab', 'cua'],
    ['squid', 'muc'], ['calamari', 'muc'],
    ['octopus', 'bachtuoc'],
    ['fish', 'ca'],

    ['scallion', 'hanhla'], ['spring', 'hanhla'],
    ['shallot', 'hanhtim'],
    ['onion', 'hanhtay'],
    ['garlic', 'toi'],
    ['ginger', 'gung'],
    ['chili', 'ot'], ['chilli', 'ot'],
    ['pepper', 'tieu'],
    ['coriander', 'ngori'], ['cilantro', 'ngori'],
    ['lemongrass', 'sare'],

    ['potato', 'khoaitay'], ['tomato', 'cachua'], ['cucumber', 'dualeo'],
    ['eggplant', 'catim'], ['aubergine', 'catim'],
    ['pumpkin', 'bido'], ['carrot', 'carot'],
    ['cabbage', 'bapcai'], ['broccoli', 'suploxanh'], ['cauliflower', 'suplotrang'],
    ['spinach', 'rauboxoi'], ['kale', 'ka'], ['mushroom', 'nam'],

    ['tofu', 'dauhu'], ['bean', 'dau'], ['soy', 'dau'],
    ['egg', 'trung'],

    ['sauce', 'sauce'],
    ['stock', 'nuocdung'], ['broth', 'nuocdung']
]);

const INGREDIENT_STOPWORDS = new Set([
    'tuoi', 'song', 'dong', 'lanh', 'nguyen', 'con', 'mieng', 'thai', 'lat', 'xay', 'bam',
    'rut', 'xuong', 'bo', 'da', 'co', 'xu', 'ly'
]);

const INGREDIENT_CANONICAL_RULES = [
    // heo và bộ phận
    { all: ['chan', 'gio', 'heo'], canonical: 'chan gio heo' },
    { all: ['mong', 'gio', 'heo'], canonical: 'chan gio heo' },
    { all: ['gio', 'heo'], canonical: 'chan gio heo' },
    { all: ['ba', 'chi'], canonical: 'ba chi heo' },
    { all: ['suon', 'heo'], canonical: 'suon heo' },
    { all: ['nac', 'heo'], canonical: 'nac heo' },
    { all: ['thit', 'heo'], canonical: 'thit heo' },

    // thịt khác
    { all: ['thit', 'bo'], canonical: 'thit bo' },
    { all: ['thit', 'ga'], canonical: 'thit ga' },
    { all: ['thit', 'vit'], canonical: 'thit vit' },
    { all: ['thit', 'de'], canonical: 'thit de' },
    { all: ['thit', 'cuu'], canonical: 'thit cuu' },
    { all: ['thit', 'trau'], canonical: 'thit trau' },

    // cá/hải sản
    { all: ['ca', 'hoi'], canonical: 'ca hoi' },
    { all: ['ca', 'thu'], canonical: 'ca thu' },
    { all: ['ca', 'ngu'], canonical: 'ca ngu' },
    { all: ['tom'], canonical: 'tom' },
    { all: ['cua'], canonical: 'cua' },
    { all: ['muc'], canonical: 'muc' },
    { all: ['bach', 'tuoc'], canonical: 'bach tuoc' },
    { all: ['ngheu'], canonical: 'ngheu' },
    { all: ['hau'], canonical: 'hau' },

    // rau củ
    { all: ['hanh', 'la'], canonical: 'hanh la' },
    { all: ['hanh', 'tim'], canonical: 'hanh tim' },
    { all: ['hanh', 'tay'], canonical: 'hanh tay' },
    { all: ['toi'], canonical: 'toi' },
    { all: ['gung'], canonical: 'gung' },
    { all: ['ot'], canonical: 'ot' },
    { all: ['ngo', 'ri'], canonical: 'ngo ri' },
    { all: ['sa', 're'], canonical: 'sa re' },
    { all: ['khoai', 'tay'], canonical: 'khoai tay' },
    { all: ['khoai', 'lang'], canonical: 'khoai lang' },
    { all: ['khoai', 'mon'], canonical: 'khoai mon' },
    { all: ['ca', 'chua'], canonical: 'ca chua' },
    { all: ['dua', 'leo'], canonical: 'dua leo' },
    { all: ['ca', 'tim'], canonical: 'ca tim' },
    { all: ['bi', 'do'], canonical: 'bi do' },
    { all: ['bap', 'cai'], canonical: 'bap cai' },
    { all: ['sup', 'lo', 'xanh'], canonical: 'sup lo xanh' },
    { all: ['sup', 'lo', 'trang'], canonical: 'sup lo trang' },
    { all: ['rau', 'muong'], canonical: 'rau muong' },
    { all: ['rau', 'bo', 'xoi'], canonical: 'rau bo xoi' },

    // đạm thực vật
    { all: ['trung'], canonical: 'trung' },
    { all: ['dau', 'hu'], canonical: 'dau hu' },
    { all: ['dau', 'nanh'], canonical: 'dau nanh' },
    { all: ['dau', 'xanh'], canonical: 'dau xanh' },
    { all: ['dau', 'do'], canonical: 'dau do' },
    { all: ['dau', 'phong'], canonical: 'dau phong' },
    { all: ['me'], canonical: 'me' },

    // gia vị / chất lỏng
    { all: ['nuoc', 'mam'], canonical: 'nuoc mam' },
    { all: ['nuoc', 'tuong'], canonical: 'nuoc tuong' },
    { all: ['dau', 'hao'], canonical: 'dau hao' },
    { all: ['dau', 'an'], canonical: 'dau an' },
    { all: ['dau', 'oliu'], canonical: 'dau oliu' },
    { all: ['duong'], canonical: 'duong' },
    { all: ['muoi'], canonical: 'muoi' },
    { all: ['hat', 'nem'], canonical: 'hat nem' },
    { all: ['bot', 'ngot'], canonical: 'bot ngot' },
    { all: ['giam'], canonical: 'giam' },
    { all: ['nuoc', 'dung'], canonical: 'nuoc dung' }
];

function canonicalizeIngredientName(name = '') {
    let base = stripVietnameseDiacritics(normalizeIngredientName(name))
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!base) return '';

    for (const [regex, replacement] of INGREDIENT_PHRASE_NORMALIZERS) {
        base = base.replace(regex, replacement);
    }

    let tokens = base.split(' ').filter(Boolean);

    tokens = tokens
        .map(token => INGREDIENT_TOKEN_SYNONYMS.get(token) || token)
        .filter(token => !INGREDIENT_STOPWORDS.has(token));

    // gom cụm từ đa token thành cụm chuẩn
    const joined = ` ${tokens.join(' ')} `;

    if (joined.includes(' hanh la ')) {
        tokens = tokens.filter(t => !['hanh', 'la'].includes(t));
        tokens.push('hanh', 'la');
    }
    if (joined.includes(' hanh tim ')) {
        tokens = tokens.filter(t => !['hanh', 'tim'].includes(t));
        tokens.push('hanh', 'tim');
    }
    if (joined.includes(' hanh tay ')) {
        tokens = tokens.filter(t => !['hanh', 'tay'].includes(t));
        tokens.push('hanh', 'tay');
    }
    if (joined.includes(' sa re ')) {
        tokens = tokens.filter(t => !['sa', 're'].includes(t));
        tokens.push('sa', 're');
    }
    if (joined.includes(' khoai tay ')) {
        tokens = tokens.filter(t => !['khoai', 'tay'].includes(t));
        tokens.push('khoai', 'tay');
    }
    if (joined.includes(' ca chua ')) {
        tokens = tokens.filter(t => !['ca', 'chua'].includes(t));
        tokens.push('ca', 'chua');
    }
    if (joined.includes(' dua leo ') || joined.includes(' dua chuot ')) {
        tokens = tokens.filter(t => !['dua', 'leo', 'chuot'].includes(t));
        tokens.push('dua', 'leo');
    }

    // loại trùng token để ổn định key so khớp
    tokens = Array.from(new Set(tokens));

    for (const rule of INGREDIENT_CANONICAL_RULES) {
        const matched = rule.all.every(token => tokens.includes(token));
        if (matched) return rule.canonical;
    }

    return tokens.join(' ');
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

async function getLatestMessageBySession(chatSessionId) {
    const [rows] = await pool.query(
        `SELECT chatMessageId, role, content, metaJson, createdAt
         FROM ChatMessages
         WHERE chatSessionId = ?
         ORDER BY chatMessageId DESC
         LIMIT 1`,
        [chatSessionId]
    );

    if (rows.length === 0) return null;

    return {
        chatMessageId: Number(rows[0].chatMessageId),
        role: rows[0].role,
        content: rows[0].content,
        meta: safeParseJson(rows[0].metaJson),
        createdAt: rows[0].createdAt
    };
}

async function getUserMessageCountBySession(chatSessionId) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM ChatMessages
         WHERE chatSessionId = ? AND role = 'user'`,
        [chatSessionId]
    );

    return Number(rows?.[0]?.total || 0);
}

function getMinutesSince(dateInput) {
    if (!dateInput) return null;
    const ts = new Date(dateInput).getTime();
    if (!Number.isFinite(ts)) return null;
    const diffMs = Date.now() - ts;
    return Math.floor(diffMs / (1000 * 60));
}

function getCompletionReminderPayload({ session, recipeContext, minutesSinceLastMessage, pendingUserMessage = '' }) {
    const minMinutes = PREVIOUS_RECIPE_REMINDER_MINUTES;
    if (!Number.isFinite(minMinutes) || minutesSinceLastMessage === null || minutesSinceLastMessage < minMinutes) {
        return null;
    }

    const isStrongReminder = Number.isFinite(PREVIOUS_RECIPE_STRONG_REMINDER_MINUTES)
        ? minutesSinceLastMessage >= PREVIOUS_RECIPE_STRONG_REMINDER_MINUTES
        : false;

    const recipeName = recipeContext?.recipeName || `món #${session.activeRecipeId}`;

    const reminderMessage = isStrongReminder
        ? `Anh vẫn chưa chốt món trước (${recipeName}) từ khoảng ${minutesSinceLastMessage} phút trước. Để tránh lệch kho nguyên liệu, anh vui lòng chọn một trong hai: "Hoàn thành & trừ nguyên liệu" hoặc "Bỏ qua (không trừ)".`
        : `Anh đang có món trước (${recipeName}) chưa được chốt. Anh chọn giúp em: "Hoàn thành & trừ nguyên liệu" hoặc "Bỏ qua (không trừ)" để em mở phiên chat mới cho gọn nhé.`;

    return {
        success: true,
        code: 'PENDING_PREVIOUS_RECIPE_COMPLETION',
        data: {
            previousSessionId: session.chatSessionId,
            recipeId: session.activeRecipeId,
            recipeName,
            minutesSinceLastMessage,
            isStrongReminder,
            reminderMessage,
            pendingUserMessage: String(pendingUserMessage || ''),
            actions: [
                { id: 'complete_and_deduct', label: 'Hoàn thành & trừ nguyên liệu' },
                { id: 'skip_deduction', label: 'Bỏ qua (không trừ)' },
                { id: 'continue_current_session', label: 'Chưa kết thúc phiên, tiếp tục chat' }
            ]
        },
        message: isStrongReminder
            ? 'Previous recipe requires strong confirmation before continuing'
            : 'Previous recipe requires confirmation before continuing'
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
        const canonicalName = canonicalizeIngredientName(row.ingredientName);
        const normalizedUnit = String(row.unit || '').trim().toLowerCase();
        const qty = Number(row.quantity || 0);

        const keys = new Set([
            `${normalizedName}|${normalizedUnit}`,
            canonicalName ? `${canonicalName}|${normalizedUnit}` : null
        ].filter(Boolean));

        for (const key of keys) {
            exactMap.set(key, (exactMap.get(key) || 0) + qty);
        }

        nameMap.set(normalizedName, (nameMap.get(normalizedName) || 0) + qty);
        if (canonicalName) {
            nameMap.set(canonicalName, (nameMap.get(canonicalName) || 0) + qty);
        }
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

async function getSessionMessagesPaginated({ chatSessionId, beforeMessageId = null, limit = 30 }) {
    const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const parsedBeforeId = beforeMessageId ? Number(beforeMessageId) : null;

    let query = `SELECT chatMessageId, role, content, metaJson, createdAt
                 FROM ChatMessages
                 WHERE chatSessionId = ?`;
    const params = [chatSessionId];

    if (parsedBeforeId && parsedBeforeId > 0) {
        query += ' AND chatMessageId < ?';
        params.push(parsedBeforeId);
    }

    query += ' ORDER BY chatMessageId DESC LIMIT ?';
    params.push(parsedLimit + 1);

    const [rows] = await pool.query(query, params);

    const hasMore = rows.length > parsedLimit;
    const trimmed = hasMore ? rows.slice(0, parsedLimit) : rows;
    const ascending = trimmed.slice().reverse();

    const items = ascending.map(row => ({
        chatMessageId: Number(row.chatMessageId),
        role: row.role,
        content: row.content,
        meta: safeParseJson(row.metaJson),
        createdAt: row.createdAt
    }));

    const nextBeforeMessageId = hasMore && trimmed.length > 0
        ? Number(trimmed[trimmed.length - 1].chatMessageId)
        : null;

    return {
        items,
        paging: {
            limit: parsedLimit,
            hasMore,
            nextBeforeMessageId
        }
    };
}

async function getUserMessagesPaginated({ userId, beforeMessageId = null, limit = 30 }) {
    const parsedUserId = Number(userId);
    const parsedLimit = Math.min(Math.max(Number(limit) || 30, 1), 100);
    const parsedBeforeId = beforeMessageId ? Number(beforeMessageId) : null;

    let query = `SELECT m.chatMessageId, m.chatSessionId, m.role, m.content, m.metaJson, m.createdAt,
                        s.title AS sessionTitle, s.activeRecipeId, s.createdAt AS sessionCreatedAt, s.updatedAt AS sessionUpdatedAt
                 FROM ChatMessages m
                 JOIN ChatSessions s ON s.chatSessionId = m.chatSessionId
                 WHERE s.userId = ?`;
    const params = [parsedUserId];

    if (parsedBeforeId && parsedBeforeId > 0) {
        query += ' AND m.chatMessageId < ?';
        params.push(parsedBeforeId);
    }

    query += ' ORDER BY m.chatMessageId DESC LIMIT ?';
    params.push(parsedLimit + 1);

    const [rows] = await pool.query(query, params);

    const hasMore = rows.length > parsedLimit;
    const trimmed = hasMore ? rows.slice(0, parsedLimit) : rows;
    const ascending = trimmed.slice().reverse();

    const items = ascending.map((row, index, arr) => {
        const currentSessionId = Number(row.chatSessionId);
        const prevSessionId = index > 0 ? Number(arr[index - 1].chatSessionId) : null;

        return {
            chatMessageId: Number(row.chatMessageId),
            chatSessionId: currentSessionId,
            sessionTitle: row.sessionTitle,
            activeRecipeId: row.activeRecipeId ? Number(row.activeRecipeId) : null,
            sessionCreatedAt: row.sessionCreatedAt,
            sessionUpdatedAt: row.sessionUpdatedAt,
            isSessionStart: index === 0 ? true : currentSessionId !== prevSessionId,
            role: row.role,
            content: row.content,
            meta: safeParseJson(row.metaJson),
            createdAt: row.createdAt
        };
    });

    const nextBeforeMessageId = hasMore && trimmed.length > 0
        ? Number(trimmed[trimmed.length - 1].chatMessageId)
        : null;

    return {
        items,
        paging: {
            limit: parsedLimit,
            hasMore,
            nextBeforeMessageId
        }
    };
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

async function getOrCreateDefaultChatSession(userId, { createIfMissing = true } = {}) {
    const latestSession = await getLatestChatSessionByUser(userId);
    if (latestSession) return latestSession;

    if (!createIfMissing) return null;

    const chatSessionId = await createChatSession({
        userId,
        title: 'Trò chuyện với Bepes'
    });

    await addChatMessage({
        chatSessionId,
        role: 'assistant',
        content: DEFAULT_SESSION_INTRO_MESSAGE,
        meta: {
            agentName: DEFAULT_AGENT_NAME,
            intro: true
        }
    });

    return getChatSessionById(chatSessionId, userId);
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
            const canonicalName = canonicalizeIngredientName(ing.ingredientName);

            const candidateKeys = [
                `${normalizedName}|${unit}`,
                canonicalName ? `${canonicalName}|${unit}` : null
            ].filter(Boolean);

            const candidateNames = [normalizedName, canonicalName].filter(Boolean);

            const currentExact = candidateKeys.reduce((max, key) => {
                return Math.max(max, pantryExactMap.get(key) || 0);
            }, 0);

            const currentByName = candidateNames.reduce((max, name) => {
                return Math.max(max, pantryNameMap.get(name) || 0);
            }, 0);

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

async function callAiFallbackOpenAI({ apiUrl, apiKey, model, messages, stream, timeoutMs }) {
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
                stream,
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

        try {
            const fallbackResult = await callAiFallbackOpenAI({
                apiUrl: fallbackApiUrl,
                apiKey: fallbackApiKey,
                model: fallbackModel,
                messages,
                stream: false,
                timeoutMs
            });

            return fallbackResult;
        } catch (fallbackError) {
            fallbackError.primary = {
                message: primaryError.message,
                status: primaryError.status || null,
                payload: primaryError.payload || null
            };
            throw fallbackError;
        }
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

exports.getUnifiedTimeline = async ({ userId, beforeMessageId = null, limit = 30, createIfMissing = true }) => {
    const parsedUserId = Number(userId);
    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    const latestSession = await getOrCreateDefaultChatSession(parsedUserId, { createIfMissing });

    if (!latestSession) {
        return {
            success: true,
            data: {
                session: null,
                latestSession: null,
                items: [],
                paging: {
                    limit: Math.min(Math.max(Number(limit) || 30, 1), 100),
                    hasMore: false,
                    nextBeforeMessageId: null
                }
            },
            message: 'Get unified chat timeline successfully'
        };
    }

    const paginated = await getUserMessagesPaginated({
        userId: parsedUserId,
        beforeMessageId,
        limit
    });

    return {
        success: true,
        data: {
            // giữ field `session` để tương thích client cũ
            session: latestSession,
            latestSession,
            items: paginated.items,
            paging: paginated.paging
        },
        message: 'Get unified chat timeline successfully'
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

exports.resolvePreviousSession = async ({ userId, previousSessionId, action, pendingUserMessage = '', model = process.env.AI_CHAT_MODEL || 'gemma3:4b' }) => {
    const parsedUserId = Number(userId);
    const parsedSessionId = Number(previousSessionId);

    if (!parsedUserId || parsedUserId <= 0) {
        throw new Error('userId must be a positive number');
    }

    if (!parsedSessionId || parsedSessionId <= 0) {
        throw new Error('previousSessionId must be a positive number');
    }

    const validActions = new Set(['complete_and_deduct', 'skip_deduction', 'continue_current_session']);
    if (!validActions.has(action)) {
        throw new Error('action must be one of: complete_and_deduct, skip_deduction, continue_current_session');
    }

    const session = await getChatSessionById(parsedSessionId, parsedUserId);
    if (!session) {
        return {
            success: false,
            data: null,
            message: 'Chat session not found'
        };
    }

    const recipeContext = session.activeRecipeId ? await getRecipeContext(session.activeRecipeId) : null;

    const finalPendingUserMessage = String(pendingUserMessage || '').trim();

    if (action === 'continue_current_session') {
        await addChatMessage({
            chatSessionId: parsedSessionId,
            role: 'assistant',
            content: 'Đã giữ nguyên phiên hiện tại theo lựa chọn của anh. Mình tiếp tục hội thoại trên phiên này nhé.',
            meta: {
                sessionResolution: true,
                resolutionAction: action,
                previousRecipeId: session.activeRecipeId,
                previousRecipeName: recipeContext?.recipeName || null
            }
        });

        let continuation = null;

        if (finalPendingUserMessage) {
            continuation = await exports.sendMessage({
                userId: parsedUserId,
                chatSessionId: parsedSessionId,
                message: finalPendingUserMessage,
                model,
                useUnifiedSession: false
            });
        }

        const currentSession = await getChatSessionById(parsedSessionId, parsedUserId);

        return {
            success: true,
            data: {
                resolvedSessionId: parsedSessionId,
                resolution: action,
                carriedRecipe: {
                    recipeId: session.activeRecipeId,
                    recipeName: recipeContext?.recipeName || null
                },
                carriedPendingUserMessage: finalPendingUserMessage || null,
                continuedSession: currentSession,
                continuation
            },
            message: 'Continue current session successfully'
        };
    }

    await setActiveRecipe({ chatSessionId: parsedSessionId, userId: parsedUserId, recipeId: null });

    await addChatMessage({
        chatSessionId: parsedSessionId,
        role: 'assistant',
        content: action === 'complete_and_deduct'
            ? 'Đã ghi nhận món trước là hoàn thành. Hiện luồng tự trừ nguyên liệu chưa bật, anh cập nhật kho thủ công giúp em nhé.'
            : 'Đã bỏ qua trừ nguyên liệu cho món trước theo lựa chọn của anh.',
        meta: {
            sessionResolution: true,
            resolutionAction: action,
            previousRecipeId: session.activeRecipeId,
            previousRecipeName: recipeContext?.recipeName || null
        }
    });

    const newSessionId = await createChatSession({
        userId: parsedUserId,
        title: 'Trò chuyện mới',
        activeRecipeId: session.activeRecipeId
    });

    await addChatMessage({
        chatSessionId: newSessionId,
        role: 'assistant',
        content: DEFAULT_SESSION_INTRO_MESSAGE,
        meta: {
            agentName: DEFAULT_AGENT_NAME,
            intro: true,
            createdAfterResolution: true,
            resolvedPreviousSessionId: parsedSessionId,
            carriedActiveRecipeId: session.activeRecipeId,
            carriedActiveRecipeName: recipeContext?.recipeName || null
        }
    });

    if (finalPendingUserMessage) {
        await addChatMessage({
            chatSessionId: newSessionId,
            role: 'user',
            content: finalPendingUserMessage,
            meta: {
                migratedFromPreviousSession: parsedSessionId,
                migratedByResolveFlow: true
            }
        });
    }

    const newSession = await getChatSessionById(newSessionId, parsedUserId);

    return {
        success: true,
        data: {
            resolvedSessionId: parsedSessionId,
            resolution: action,
            carriedRecipe: {
                recipeId: session.activeRecipeId,
                recipeName: recipeContext?.recipeName || null
            },
            carriedPendingUserMessage: finalPendingUserMessage || null,
            newSession
        },
        message: 'Resolve previous session successfully'
    };
};

exports.sendMessage = async ({
    userId,
    chatSessionId = null,
    message,
    model = process.env.AI_CHAT_MODEL || 'gemma3:4b',
    stream = false,
    activeRecipeId = null,
    useUnifiedSession = false
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

    if (!sessionId && useUnifiedSession) {
        session = await getOrCreateDefaultChatSession(parsedUserId);
        sessionId = session?.chatSessionId || null;
    }

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

    session = session || await getChatSessionById(sessionId, parsedUserId);
    if (!session) {
        throw new Error('Chat session not found');
    }

    if (activeRecipeId !== null && activeRecipeId !== undefined) {
        await setActiveRecipe({ chatSessionId: sessionId, userId: parsedUserId, recipeId: activeRecipeId });
        session = await getChatSessionById(sessionId, parsedUserId);
    }

    if (!chatSessionId && useUnifiedSession && session.activeRecipeId) {
        const userMessageCount = await getUserMessageCountBySession(session.chatSessionId);

        // Nếu phiên mới chỉ có greeting hoặc chưa có user message thì bỏ qua nhắc nhở,
        // cho phép user dùng lại phiên hiện tại bình thường.
        if (userMessageCount > 0) {
            const latestMessage = await getLatestMessageBySession(session.chatSessionId);
            const minutesSinceLastMessage = getMinutesSince(latestMessage?.createdAt);
            const recipeContextBeforeContinue = await getRecipeContext(session.activeRecipeId);
            const reminderPayload = getCompletionReminderPayload({
                session,
                recipeContext: recipeContextBeforeContinue,
                minutesSinceLastMessage,
                pendingUserMessage: message.trim()
            });

            if (reminderPayload) {
                return reminderPayload;
            }
        }
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
