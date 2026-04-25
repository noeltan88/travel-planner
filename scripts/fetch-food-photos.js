/**
 * fetch-food-photos.js
 *
 * Fetches real Google Places photos for food entries in china-master-db-v1.json
 * that are missing a photo_url.
 *
 * Strategy per entry:
 *   1. POST to Places Text Search API — "{food.name} {cityName} China"
 *   2. Take first result's first photo reference
 *   3. Resolve photo reference → photoUri via Places photo media API
 *   4. Save photoUri to food.photo_url
 *
 * Run:    node scripts/fetch-food-photos.js
 * Resume: fully safe — skips any entry that already has a non-null photo_url
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = resolve(__dirname, '../src/data/china-master-db-v1.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 200;
const BASE     = 'https://places.googleapis.com/v1';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

/**
 * POST to Places Text Search API.
 * Returns the raw JSON body or null on failure.
 */
async function textSearch(textQuery) {
  await sleep(SLEEP_MS);
  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': 'places.id,places.photos',
      },
      body: JSON.stringify({ textQuery, languageCode: 'en' }),
    });
    if (!res.ok) {
      const txt = await res.text();
      console.warn(`      ⚠  textSearch HTTP ${res.status}: ${txt.slice(0, 120)}`);
      return null;
    }
    return res.json();
  } catch (err) {
    console.warn(`      ⚠  textSearch fetch error: ${err.message}`);
    return null;
  }
}

/**
 * Resolve a Places photo reference name → a permanent photoUri.
 * Returns a URL string or null.
 */
async function fetchPhotoUri(photoName) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  try {
    const url = `${BASE}/${photoName}/media?maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true&key=${KEY}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.photoUri || null;
  } catch (err) {
    console.warn(`      ⚠  fetchPhotoUri error: ${err.message}`);
    return null;
  }
}

/**
 * Look up a photo for a food entry.
 * Returns a photoUri string, or null if nothing found.
 */
async function resolvePhoto(foodName, cityName) {
  const query  = `${foodName} ${cityName} China`;
  const data   = await textSearch(query);
  const photo0 = data?.places?.[0]?.photos?.[0];
  if (!photo0?.name) return null;
  return fetchPhotoUri(photo0.name);
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  let totalFilled  = 0;
  let totalSkipped = 0;
  let totalFailed  = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    const food = cityData.food;
    if (!Array.isArray(food) || food.length === 0) continue;

    const toFetch = food.filter(f => !f.photo_url);
    console.log(
      `\n── ${cityData.name} (${food.length} entries, ${toFetch.length} missing photos) ──`,
    );

    let cityFilled  = 0;
    let citySkipped = 0;
    let cityFailed  = 0;

    for (const entry of food) {
      // Resume-safe: skip anything that already has a photo
      if (entry.photo_url) {
        process.stdout.write(`  → ${entry.name}\n`);
        citySkipped++;
        continue;
      }

      try {
        const uri = await resolvePhoto(entry.name, cityData.name);
        if (uri) {
          entry.photo_url = uri;
          console.log(`  ✓ ${entry.name}`);
          cityFilled++;
        } else {
          console.log(`  ✗ ${entry.name} (no result)`);
          cityFailed++;
        }
      } catch (err) {
        console.log(`  ✗ ${entry.name} (error: ${err.message})`);
        cityFailed++;
      }
    }

    // Persist after every city so a crash doesn't lose progress
    saveDB(db);
    console.log(
      `  ↳ city: +${cityFilled} filled, ${citySkipped} skipped, ${cityFailed} failed`,
    );

    totalFilled  += cityFilled;
    totalSkipped += citySkipped;
    totalFailed  += cityFailed;
  }

  console.log('\n══════════════════════════════════════');
  console.log(`DONE`);
  console.log(`  ✓ filled  : ${totalFilled}`);
  console.log(`  → skipped : ${totalSkipped}`);
  console.log(`  ✗ failed  : ${totalFailed}`);
  console.log(`  total     : ${totalFilled + totalSkipped + totalFailed}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
