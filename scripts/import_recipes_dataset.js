const fs = require('fs');
const path = require('path');
const { pool } = require('../config/dbConfig');

const datasetPath = process.argv[2] || path.resolve(__dirname, '../../.openclaw/media/inbound/recipes_all---aa408f7d-2249-46e4-93d0-fb1595f31a4e.json');
const importUserId = Number(process.argv[3] || 1);

function normalizeSpaces(str = '') {
    return String(str).replace(/\s+/g, ' ').trim();
}

function toTitleCase(str = '') {
    return normalizeSpaces(str)
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function detectUnitAndWeight(measureRaw = '') {
    const s = normalizeSpaces(measureRaw).toLowerCase();

    const numberMatch = s.match(/\d+(?:[\.,]\d+)?/);
    const fractionMatch = s.match(/(\d+)\s*\/\s*(\d+)/);

    let weight = 1;

    if (fractionMatch) {
        const num = Number(fractionMatch[1]);
        const den = Number(fractionMatch[2]);
        if (den !== 0) weight = num / den;
    } else if (numberMatch) {
        weight = Number(numberMatch[0].replace(',', '.'));
        if (!Number.isFinite(weight)) weight = 1;
    }

    let unit = 'portion';

    const map = [
        [/\bkg\b|kilogram/, 'kg'],
        [/\bg\b|gram/, 'g'],
        [/\bml\b/, 'ml'],
        [/\bl\b|litre|liter/, 'l'],
        [/tablespoon|tbsp|tbs/, 'tbsp'],
        [/teaspoon|tsp/, 'tsp'],
        [/cup/, 'cup'],
        [/clove/, 'clove'],
        [/slice/, 'slice'],
        [/bunch/, 'bunch'],
        [/pinch/, 'pinch'],
        [/pack|packet/, 'pack'],
        [/piece|small|large|medium|head/, 'piece']
    ];

    for (const [regex, u] of map) {
        if (regex.test(s)) {
            unit = u;
            break;
        }
    }

    if (!numberMatch && !fractionMatch) {
        if (/to serve|garnish|handful|sprig|dash/.test(s)) {
            weight = 1;
            unit = 'to taste';
        }
    }

    return { weight, unit };
}

function isMainIngredient(nameRaw = '') {
    const name = normalizeSpaces(nameRaw).toLowerCase();

    const mainKeywords = [
        'beef', 'pork', 'chicken', 'salmon', 'prawn', 'shrimp', 'fish', 'tofu', 'trout', 'lamb',
        'rice noodles', 'noodles', 'rice', 'egg', 'cabbage', 'broccoli', 'potato', 'pumpkin', 'tempeh'
    ];

    return mainKeywords.some(k => name.includes(k));
}

function isCommonIngredient(nameRaw = '') {
    const name = normalizeSpaces(nameRaw).toLowerCase();

    const commonKeywords = [
        'salt', 'sugar', 'pepper', 'soy sauce', 'fish sauce', 'oil', 'garlic', 'ginger',
        'chilli', 'chili', 'onion', 'spring onions', 'scallions', 'vinegar', 'lime', 'lemon',
        'sesame', 'honey', 'coriander', 'mint', 'basil', 'water'
    ];

    return commonKeywords.some(k => name.includes(k));
}

function estimateCookingTime(instructions = '') {
    const txt = normalizeSpaces(instructions).toLowerCase();
    const minutes = [];

    const regex = /(\d+)\s*(?:-|to)?\s*(\d+)?\s*mins?|minutes?/g;
    let m;
    while ((m = regex.exec(txt)) !== null) {
        if (m[2]) {
            minutes.push((Number(m[1]) + Number(m[2])) / 2);
        } else {
            minutes.push(Number(m[1]));
        }
    }

    const total = minutes.reduce((a, b) => a + b, 0);
    const clamped = Math.max(10, Math.min(240, Math.round(total || 30)));

    return `${clamped} mins`;
}

async function getOrCreateIngredientId(conn, ingredientName) {
    const normalized = toTitleCase(ingredientName);

    const [rows] = await conn.query(
        'SELECT ingredientId FROM Ingredients WHERE LOWER(TRIM(ingredientName)) = LOWER(TRIM(?)) LIMIT 1',
        [normalized]
    );

    if (rows.length > 0) return Number(rows[0].ingredientId);

    const [insert] = await conn.query(
        'INSERT INTO Ingredients (ingredientName) VALUES (?)',
        [normalized]
    );

    return Number(insert.insertId);
}

async function getOrCreateTagId(conn, tagName) {
    const normalized = toTitleCase(tagName);

    const [rows] = await conn.query(
        'SELECT tagId FROM Tags WHERE LOWER(TRIM(tagName)) = LOWER(TRIM(?)) LIMIT 1',
        [normalized]
    );

    if (rows.length > 0) return Number(rows[0].tagId);

    const [insert] = await conn.query(
        'INSERT INTO Tags (tagName) VALUES (?)',
        [normalized]
    );

    return Number(insert.insertId);
}

async function ensureUserExists(userId) {
    const [rows] = await pool.query('SELECT userId FROM Users WHERE userId = ? LIMIT 1', [userId]);

    if (rows.length > 0) return;

    await pool.query(
        `INSERT INTO Users (userId, fullName, phone, email, passwordHash)
         VALUES (?, 'Dataset Import Bot', ?, ?, 'dataset-import-no-login')`,
        [userId, `dataset-${userId}`, `dataset-${userId}@local`]
    );
}

async function upsertRecipe(conn, recipe) {
    const externalId = normalizeSpaces(recipe.id || '');
    const recipeName = normalizeSpaces(recipe.name || 'Unknown Recipe').slice(0, 255);
    const image = normalizeSpaces(recipe.thumbnail || '') || '/images/default_recipe.jpg';
    const sourceUrl = normalizeSpaces(recipe.source || '');
    const youtubeUrl = normalizeSpaces(recipe.youtube || '');
    const instructions = String(recipe.instructions || '');
    const category = normalizeSpaces(recipe.category || '');
    const area = normalizeSpaces(recipe.area || '');
    const cookingTime = estimateCookingTime(instructions);

    const ingredientRows = Array.isArray(recipe.ingredients)
        ? recipe.ingredients.filter(i => normalizeSpaces(i.ingredient))
        : [];

    const ration = 2;

    const [existsRows] = await conn.query(
        'SELECT recipeId FROM Recipes WHERE externalSourceId = ? LIMIT 1',
        [externalId]
    );

    let recipeId;

    if (existsRows.length > 0) {
        recipeId = Number(existsRows[0].recipeId);

        await conn.query(
            `UPDATE Recipes
             SET recipeName = ?, category = ?, area = ?, image = ?, sourceUrl = ?, youtubeUrl = ?,
                 instructions = ?, cookingTime = ?, ration = ?, userId = ?
             WHERE recipeId = ?`,
            [recipeName, category, area, image, sourceUrl, youtubeUrl, instructions, cookingTime, ration, importUserId, recipeId]
        );

        await conn.query('DELETE FROM RecipesIngredients WHERE recipeId = ?', [recipeId]);
        await conn.query('DELETE FROM CookingSteps WHERE recipeId = ?', [recipeId]);
        await conn.query('DELETE FROM RecipesTags WHERE recipeId = ?', [recipeId]);
    } else {
        const [insertRecipe] = await conn.query(
            `INSERT INTO Recipes
             (externalSourceId, recipeName, category, area, image, sourceUrl, youtubeUrl, instructions, cookingTime, ration, likeQuantity, viewCount, userId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
            [externalId, recipeName, category, area, image, sourceUrl, youtubeUrl, instructions, cookingTime, ration, importUserId]
        );

        recipeId = Number(insertRecipe.insertId);
    }

    const steps = String(instructions)
        .split(/\r?\n\r?\n|\nstep\s+\d+/i)
        .map(s => normalizeSpaces(s))
        .filter(Boolean);

    let stepIndex = 1;
    for (const stepText of steps.length ? steps : [instructions]) {
        if (!normalizeSpaces(stepText)) continue;

        await conn.query(
            'INSERT INTO CookingSteps (recipeId, indexStep, content) VALUES (?, ?, ?)',
            [recipeId, stepIndex++, stepText]
        );
    }

    for (const ing of ingredientRows) {
        const ingredientName = normalizeSpaces(ing.ingredient);
        const { weight, unit } = detectUnitAndWeight(ing.measure || '');
        const ingredientId = await getOrCreateIngredientId(conn, ingredientName);

        await conn.query(
            `INSERT INTO RecipesIngredients (recipeId, ingredientId, weight, unit, isMain, isCommon)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                recipeId,
                ingredientId,
                weight,
                unit,
                isMainIngredient(ingredientName) ? 1 : 0,
                isCommonIngredient(ingredientName) ? 1 : 0
            ]
        );
    }

    const tags = new Set();
    if (category) tags.add(category);
    if (area) tags.add(area);
    if (Array.isArray(recipe.tags)) {
        for (const t of recipe.tags) {
            if (normalizeSpaces(t)) tags.add(t);
        }
    }

    for (const tagName of tags) {
        const tagId = await getOrCreateTagId(conn, tagName);
        await conn.query(
            'INSERT IGNORE INTO RecipesTags (recipeId, tagId) VALUES (?, ?)',
            [recipeId, tagId]
        );
    }

    return recipeId;
}

async function main() {
    const raw = fs.readFileSync(datasetPath, 'utf8');
    const recipes = JSON.parse(raw);

    if (!Array.isArray(recipes) || recipes.length === 0) {
        throw new Error('Dataset is empty or invalid JSON array');
    }

    await ensureUserExists(importUserId);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        let upserted = 0;
        for (const recipe of recipes) {
            await upsertRecipe(conn, recipe);
            upserted += 1;
        }

        await conn.commit();

        const [countRows] = await pool.query('SELECT COUNT(*) AS total FROM Recipes');
        const [importedRows] = await pool.query('SELECT COUNT(*) AS total FROM Recipes WHERE userId = ?', [importUserId]);

        console.log(JSON.stringify({
            success: true,
            datasetPath,
            upserted,
            totalRecipes: Number(countRows[0]?.total || 0),
            importedByUser: Number(importedRows[0]?.total || 0),
            importUserId
        }, null, 2));
    } catch (error) {
        await conn.rollback();
        throw error;
    } finally {
        conn.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error('Import failed:', err);
    process.exit(1);
});
