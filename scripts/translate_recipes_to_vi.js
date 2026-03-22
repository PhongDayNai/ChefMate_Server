const fs = require('fs');
const path = require('path');
const { pool } = require('../config/dbConfig');

const CACHE_PATH = path.resolve(__dirname, '.translate_cache_vi.json');
const REQUEST_DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS || 120);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function normalizeSpaces(str = '') {
    return String(str).replace(/\s+/g, ' ').trim();
}

function normalizeVietnameseText(str = '') {
    return String(str)
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .replace(/\(\s+/g, '(')
        .replace(/\s+\)/g, ')')
        .trim();
}

function loadCache() {
    if (!fs.existsSync(CACHE_PATH)) return {};
    try {
        return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
    } catch (_) {
        return {};
    }
}

function saveCache(cache) {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

async function googleTranslate(text) {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'en');
    url.searchParams.set('tl', 'vi');
    url.searchParams.set('dt', 't');
    url.searchParams.set('q', text);

    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
        throw new Error(`Translate HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || !Array.isArray(data[0])) {
        throw new Error('Unexpected translate payload');
    }

    return data[0].map(part => part[0]).join('');
}

function splitLongText(text, maxLen = 900) {
    const normalized = String(text || '');
    if (normalized.length <= maxLen) return [normalized];

    const lines = normalized.split(/\r?\n/);
    const chunks = [];
    let current = '';

    for (const line of lines) {
        const piece = line + '\n';
        if ((current + piece).length > maxLen && current.length > 0) {
            chunks.push(current);
            current = piece;
        } else {
            current += piece;
        }
    }

    if (current) chunks.push(current);

    return chunks;
}

const INGREDIENT_MAP = {
    'soy sauce': 'Nước tương',
    'fish sauce': 'Nước mắm',
    'oyster sauce': 'Dầu hào',
    'rice vinegar': 'Giấm gạo',
    'sesame seed oil': 'Dầu mè',
    'spring onions': 'Hành lá',
    'scallions': 'Hành lá',
    'garlic clove': 'Tỏi',
    'garlic': 'Tỏi',
    'ginger': 'Gừng',
    'lime': 'Chanh xanh',
    'lemon': 'Chanh vàng',
    'brown sugar': 'Đường nâu',
    'caster sugar': 'Đường cát',
    'jasmine rice': 'Gạo jasmine',
    'rice noodles': 'Bún gạo',
    'prawns': 'Tôm',
    'shrimp': 'Tôm',
    'chicken stock': 'Nước dùng gà',
    'beef stock': 'Nước dùng bò',
    'vegetable oil': 'Dầu thực vật',
    'olive oil': 'Dầu ô liu'
};

const CATEGORY_MAP = {
    chicken: 'Gà',
    beef: 'Bò',
    pork: 'Heo',
    seafood: 'Hải sản',
    vegetarian: 'Chay',
    vegan: 'Thuần chay',
    side: 'Món phụ',
    miscellaneous: 'Tổng hợp'
};

const AREA_MAP = {
    vietnamese: 'Việt Nam',
    chinese: 'Trung Quốc',
    thai: 'Thái Lan',
    japanese: 'Nhật Bản'
};

async function translateWithCache(rawText, cache) {
    const text = String(rawText || '');
    if (!text.trim()) return text;

    if (cache[text]) return cache[text];

    const chunks = splitLongText(text);
    const translatedParts = [];

    for (const chunk of chunks) {
        let attempt = 0;
        let translated = null;

        while (attempt < 4 && !translated) {
            try {
                translated = await googleTranslate(chunk);
            } catch (error) {
                attempt += 1;
                if (attempt >= 4) throw error;
                await sleep(400 * attempt);
            }
        }

        translatedParts.push(translated || chunk);
        await sleep(REQUEST_DELAY_MS);
    }

    const finalText = normalizeVietnameseText(translatedParts.join(''));
    cache[text] = finalText;
    return finalText;
}

async function mergeDuplicateIngredients(conn) {
    const [rows] = await conn.query('SELECT ingredientId, ingredientName FROM Ingredients ORDER BY ingredientId ASC');

    const byName = new Map();
    for (const row of rows) {
        const key = normalizeSpaces(row.ingredientName).toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(Number(row.ingredientId));
    }

    for (const [, ids] of byName.entries()) {
        if (ids.length <= 1) continue;

        const keeper = ids[0];
        const dupes = ids.slice(1);

        for (const dupId of dupes) {
            await conn.query('UPDATE RecipesIngredients SET ingredientId = ? WHERE ingredientId = ?', [keeper, dupId]);

            const [pantryRows] = await conn.query(
                'SELECT pantryItemId, userId, quantity, unit, expiresAt FROM PantryItems WHERE ingredientId = ?',
                [dupId]
            );

            for (const p of pantryRows) {
                await conn.query(
                    `INSERT INTO PantryItems (userId, ingredientId, quantity, unit, expiresAt)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                    [p.userId, keeper, p.quantity, p.unit, p.expiresAt]
                );
                await conn.query('DELETE FROM PantryItems WHERE pantryItemId = ?', [p.pantryItemId]);
            }

            await conn.query('DELETE FROM Ingredients WHERE ingredientId = ?', [dupId]);
        }
    }
}

async function mergeDuplicateTags(conn) {
    const [rows] = await conn.query('SELECT tagId, tagName FROM Tags ORDER BY tagId ASC');

    const byName = new Map();
    for (const row of rows) {
        const key = normalizeSpaces(row.tagName).toLowerCase();
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(Number(row.tagId));
    }

    for (const [, ids] of byName.entries()) {
        if (ids.length <= 1) continue;

        const keeper = ids[0];
        const dupes = ids.slice(1);

        for (const dupId of dupes) {
            await conn.query(
                `INSERT IGNORE INTO RecipesTags (recipeId, tagId)
                 SELECT recipeId, ? FROM RecipesTags WHERE tagId = ?`,
                [keeper, dupId]
            );
            await conn.query('DELETE FROM RecipesTags WHERE tagId = ?', [dupId]);
            await conn.query('DELETE FROM Tags WHERE tagId = ?', [dupId]);
        }
    }
}

async function run() {
    const cache = loadCache();
    const conn = await pool.getConnection();

    try {
        const [recipes] = await conn.query('SELECT recipeId, recipeName, category, area, instructions FROM Recipes');
        const [ingredients] = await conn.query('SELECT ingredientId, ingredientName FROM Ingredients');
        const [tags] = await conn.query('SELECT tagId, tagName FROM Tags');
        const [steps] = await conn.query('SELECT csId, content FROM CookingSteps');

        console.log(`Translating recipes=${recipes.length}, ingredients=${ingredients.length}, tags=${tags.length}, steps=${steps.length}`);

        await conn.beginTransaction();

        for (const r of recipes) {
            const recipeName = await translateWithCache(r.recipeName, cache);
            const category = CATEGORY_MAP[normalizeSpaces(r.category).toLowerCase()] || await translateWithCache(r.category, cache);
            const area = AREA_MAP[normalizeSpaces(r.area).toLowerCase()] || await translateWithCache(r.area, cache);
            const instructions = await translateWithCache(r.instructions, cache);

            await conn.query(
                'UPDATE Recipes SET recipeName = ?, category = ?, area = ?, instructions = ? WHERE recipeId = ?',
                [recipeName, category, area, instructions, r.recipeId]
            );
        }

        for (const ing of ingredients) {
            const key = normalizeSpaces(ing.ingredientName).toLowerCase();
            const translated = INGREDIENT_MAP[key] || await translateWithCache(ing.ingredientName, cache);
            await conn.query('UPDATE Ingredients SET ingredientName = ? WHERE ingredientId = ?', [translated, ing.ingredientId]);
        }

        for (const tag of tags) {
            const key = normalizeSpaces(tag.tagName).toLowerCase();
            const translated = CATEGORY_MAP[key] || AREA_MAP[key] || await translateWithCache(tag.tagName, cache);
            await conn.query('UPDATE Tags SET tagName = ? WHERE tagId = ?', [translated, tag.tagId]);
        }

        for (const step of steps) {
            const translated = await translateWithCache(step.content, cache);
            await conn.query('UPDATE CookingSteps SET content = ? WHERE csId = ?', [translated, step.csId]);
        }

        await mergeDuplicateIngredients(conn);
        await mergeDuplicateTags(conn);

        await conn.commit();
        saveCache(cache);

        console.log(JSON.stringify({ success: true, translatedCacheSize: Object.keys(cache).length }, null, 2));
    } catch (error) {
        await conn.rollback();
        saveCache(cache);
        throw error;
    } finally {
        conn.release();
        await pool.end();
    }
}

run().catch(err => {
    console.error('Translate failed:', err);
    process.exit(1);
});
