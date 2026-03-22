const { pool } = require('../config/dbConfig');

function cleanLine(line = '') {
  return String(line)
    .replace(/\r/g, '')
    .replace(/^\s*(step\s*\d+|bước\s*\d+|\d+[\.)])\s*[:\-]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitInstructions(text = '') {
  const normalized = String(text || '').replace(/\r/g, '\n');

  let chunks = normalized
    .split(/\n\s*\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (chunks.length <= 1) {
    chunks = normalized
      .split(/(?:^|\n)\s*(?:step\s*\d+|bước\s*\d+|\d+[\.)])\s*[:\-]?\s*/gi)
      .map(s => s.trim())
      .filter(Boolean);
  }

  const lines = [];
  for (const c of chunks) {
    const line = cleanLine(c);
    if (!line) continue;
    lines.push(line);
  }

  return lines.length > 0 ? lines : [cleanLine(normalized)].filter(Boolean);
}

async function main() {
  const conn = await pool.getConnection();
  try {
    const [recipes] = await conn.query('SELECT recipeId, instructions FROM Recipes');

    await conn.beginTransaction();

    let updated = 0;

    for (const recipe of recipes) {
      const recipeId = Number(recipe.recipeId);
      const steps = splitInstructions(recipe.instructions || '');
      if (!steps.length) continue;

      await conn.query('DELETE FROM CookingSteps WHERE recipeId = ?', [recipeId]);

      let idx = 1;
      for (const s of steps) {
        await conn.query(
          'INSERT INTO CookingSteps (recipeId, indexStep, content) VALUES (?, ?, ?)',
          [recipeId, idx++, s]
        );
      }

      updated += 1;
    }

    await conn.commit();
    console.log(JSON.stringify({ success: true, updatedRecipes: updated }, null, 2));
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch(async (e) => {
  console.error('reparse_recipe_steps failed:', e);
  process.exit(1);
});
