const fs = require('fs');
const path = require('path');
const { pool } = require('../config/dbConfig');

const OUTPUT_DIR = path.resolve(__dirname, '../assets/images/placeholders');

function slugify(input = '') {
  return String(input)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

function hashCode(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function colorFromHash(seed) {
  const h = seed % 360;
  return `hsl(${h}, 70%, 45%)`;
}

function colorFromHash2(seed) {
  const h = (seed + 70) % 360;
  return `hsl(${h}, 75%, 35%)`;
}

function initialsFromName(name = '') {
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'CM';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0] || ''}${words[1][0] || ''}`.toUpperCase();
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function createSvg({ recipeName, seed, subtitle = 'ChefMate Placeholder' }) {
  const c1 = colorFromHash(seed);
  const c2 = colorFromHash2(seed);
  const initials = initialsFromName(recipeName);
  const title = escapeXml(recipeName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${c1}"/>
      <stop offset="100%" stop-color="${c2}"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-opacity="0.25"/>
    </filter>
  </defs>

  <rect width="1200" height="800" fill="url(#bg)"/>
  <circle cx="1000" cy="180" r="140" fill="rgba(255,255,255,0.12)"/>
  <circle cx="180" cy="650" r="180" fill="rgba(255,255,255,0.10)"/>

  <g filter="url(#shadow)">
    <rect x="120" y="150" rx="28" ry="28" width="960" height="500" fill="rgba(255,255,255,0.14)"/>
  </g>

  <text x="600" y="330" text-anchor="middle" font-size="160" font-family="Arial, Helvetica, sans-serif" fill="#fff" font-weight="700">${initials}</text>
  <text x="600" y="460" text-anchor="middle" font-size="44" font-family="Arial, Helvetica, sans-serif" fill="#fff" font-weight="600">${title}</text>
  <text x="600" y="520" text-anchor="middle" font-size="28" font-family="Arial, Helvetica, sans-serif" fill="rgba(255,255,255,0.88)">${escapeXml(subtitle)}</text>
</svg>`;
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const [rows] = await pool.query(
    `SELECT recipeId, recipeName
     FROM Recipes
     WHERE image = '/images/default_recipe.jpg' OR image IS NULL OR image = ''`
  );

  let updated = 0;

  for (const row of rows) {
    const recipeId = Number(row.recipeId);
    const recipeName = row.recipeName || `Recipe ${recipeId}`;
    const seed = hashCode(`${recipeId}-${recipeName}`);
    const fileName = `${recipeId}-${slugify(recipeName) || `recipe-${recipeId}`}.svg`;
    const abs = path.join(OUTPUT_DIR, fileName);
    const dbPath = `/images/placeholders/${fileName}`;

    const svg = createSvg({
      recipeName,
      seed,
      subtitle: 'Ảnh tạm thời – đang cập nhật ảnh món'
    });
    fs.writeFileSync(abs, svg, 'utf8');

    await pool.query('UPDATE Recipes SET image = ? WHERE recipeId = ?', [dbPath, recipeId]);
    updated += 1;
  }

  console.log(JSON.stringify({ success: true, placeholderGenerated: updated }, null, 2));
  await pool.end();
}

main().catch(async (e) => {
  console.error('generate_recipe_placeholders failed:', e);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
