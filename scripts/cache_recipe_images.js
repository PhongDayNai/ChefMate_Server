const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool } = require('../config/dbConfig');

const OUTPUT_DIR = path.resolve(__dirname, '../assets/images/recipes');
const CONCURRENCY = Number(process.env.IMAGE_CACHE_CONCURRENCY || 8);

function sanitizeName(input = '') {
  return String(input)
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase()
    .slice(0, 80);
}

function extFromContentType(contentType = '') {
  const ct = String(contentType).toLowerCase();
  if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return '.jpg';
  if (ct.includes('image/png')) return '.png';
  if (ct.includes('image/webp')) return '.webp';
  if (ct.includes('image/gif')) return '.gif';
  return null;
}

function extFromUrl(url = '') {
  const lower = String(url).toLowerCase();
  if (lower.includes('.jpg') || lower.includes('.jpeg')) return '.jpg';
  if (lower.includes('.png')) return '.png';
  if (lower.includes('.webp')) return '.webp';
  if (lower.includes('.gif')) return '.gif';
  return '.jpg';
}

async function downloadImage(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'ChefMate-Image-Cacher/1.0'
      }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const ct = res.headers.get('content-type') || '';

    return { buffer: buf, contentType: ct };
  } finally {
    clearTimeout(timeout);
  }
}

async function processOne(row) {
  const recipeId = Number(row.recipeId);
  const recipeName = row.recipeName || `recipe-${recipeId}`;
  const imageUrl = row.image;

  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    return { recipeId, skipped: true, reason: 'not-http-url' };
  }

  const downloaded = await downloadImage(imageUrl);
  const hash = crypto.createHash('md5').update(String(imageUrl)).digest('hex').slice(0, 10);
  const ext = extFromContentType(downloaded.contentType) || extFromUrl(imageUrl);
  const filename = `${recipeId}-${sanitizeName(recipeName)}-${hash}${ext}`;
  const absPath = path.join(OUTPUT_DIR, filename);
  const dbPath = `/images/recipes/${filename}`;

  fs.writeFileSync(absPath, downloaded.buffer);

  await pool.query(
    'UPDATE Recipes SET image = ? WHERE recipeId = ?',
    [dbPath, recipeId]
  );

  return { recipeId, updated: true, dbPath };
}

async function worker(rows, shared) {
  while (true) {
    const idx = shared.index++;
    if (idx >= rows.length) return;

    const row = rows[idx];
    try {
      const result = await processOne(row);
      shared.results.push(result);
    } catch (error) {
      shared.errors.push({
        recipeId: Number(row.recipeId),
        image: row.image,
        error: error.message
      });
    }
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const [rows] = await pool.query(
    `SELECT recipeId, recipeName, image
     FROM Recipes
     WHERE image IS NOT NULL AND image <> ''`
  );

  const shared = {
    index: 0,
    results: [],
    errors: []
  };

  const workers = Array.from({ length: Math.max(1, CONCURRENCY) }, () => worker(rows, shared));
  await Promise.all(workers);

  const updated = shared.results.filter(r => r.updated).length;
  const skipped = shared.results.filter(r => r.skipped).length;

  const summary = {
    total: rows.length,
    updated,
    skipped,
    failed: shared.errors.length
  };

  const reportPath = path.resolve(__dirname, 'cache_recipe_images.report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ summary, errors: shared.errors.slice(0, 200) }, null, 2));

  console.log(JSON.stringify({ summary, reportPath }, null, 2));

  await pool.end();
}

main().catch(async (err) => {
  console.error('cache_recipe_images failed:', err);
  try { await pool.end(); } catch (_) {}
  process.exit(1);
});
