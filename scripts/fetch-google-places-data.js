/**
 * fetch-google-places-data.js
 *
 * PART 1 — Replace Wikipedia/Picsum attraction photos with Google Places photos.
 * PART 2 — Build src/data/restaurants.json from Google Places restaurant search
 *           (top-5 per cluster per city).
 *
 * Run:    node scripts/fetch-google-places-data.js
 * Resume: re-running is fully safe — skips attractions with photo_source "google"
 *         and merges into existing restaurants.json without losing prior data.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url));
const DB_PATH    = resolve(__dirname, '../src/data/china-master-db-v1.json');
const BKP2_PATH  = resolve(__dirname, '../src/data/china-master-db-v1.backup2.json');
const REST_PATH  = resolve(__dirname, '../src/data/restaurants.json');

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
 * Returns the raw JSON response (may include places[]).
 */
async function textSearch(textQuery, fieldMask, extra = {}) {
  await sleep(SLEEP_MS);
  const res = await fetch(`${BASE}/places:searchText`, {
    method:  'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Goog-Api-Key':  KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({ textQuery, languageCode: 'en', ...extra }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`    ⚠ textSearch HTTP ${res.status}: ${txt.slice(0, 120)}`);
    return null;
  }
  return res.json();
}

/**
 * Fetch a photo URI from a Places photo reference name.
 * Returns a URL string or null.
 */
async function fetchPhotoUri(photoName) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  const url = `${BASE}/${photoName}/media?maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true&key=${KEY}`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.photoUri || null;
}

// ── PART 1 — Attraction photos ─────────────────────────────────────────────────
async function fillAttractionPhotos(db) {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 1 — Attraction photos');
  console.log('══════════════════════════════════════════════════\n');

  let filled = 0, skipped = 0, failed = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    console.log(`🏙  ${cityData.name} (${cityData.attractions.length})`);

    for (const attr of cityData.attractions) {
      // Resume-safe: skip if already fetched from Google
      if (attr.photo_source === 'google') {
        process.stdout.write(`  → skipped   ${attr.name}\n`);
        skipped++;
        continue;
      }

      const query = `${attr.name} ${cityData.name} China`;
      const data  = await textSearch(query, 'places.id,places.displayName,places.photos');

      const photoRef = data?.places?.[0]?.photos?.[0]?.name;
      if (!photoRef) {
        process.stdout.write(`  ✗ no match  ${attr.name}\n`);
        failed++;
        continue;
      }

      const photoUri = await fetchPhotoUri(photoRef);
      if (!photoUri) {
        process.stdout.write(`  ✗ no photo  ${attr.name}\n`);
        failed++;
        continue;
      }

      attr.photo_url         = photoUri;
      attr.photo_attribution = data.places[0].displayName?.text || null;
      attr.photo_source      = 'google';
      filled++;
      process.stdout.write(`  ✓ google    ${attr.name}\n`);
    }

    // Incremental save after each city
    saveDB(db);
    console.log(`  💾 saved ${cityKey}\n`);
  }

  return { filled, skipped, failed };
}

// ── PART 2 — Restaurant data ───────────────────────────────────────────────────
async function fillRestaurants(db) {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 2 — Restaurant data');
  console.log('══════════════════════════════════════════════════\n');

  // Load existing restaurants.json to allow resume
  const restaurants = existsSync(REST_PATH)
    ? JSON.parse(readFileSync(REST_PATH, 'utf8'))
    : {};

  let totalSaved = 0;

  const FIELD_MASK = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.photos',
    'places.regularOpeningHours',
    'places.editorialSummary',
  ].join(',');

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    console.log(`🏙  ${cityData.name}`);

    if (!restaurants[cityKey]) restaurants[cityKey] = {};

    const clusters = [...new Set(
      cityData.attractions.map(a => a.cluster_group).filter(Boolean)
    )];

    for (const cluster of clusters) {
      // Resume-safe: skip clusters that already have ≥ 1 result
      if (restaurants[cityKey][cluster]?.length > 0) {
        console.log(`  → skipped cluster: ${cluster}`);
        continue;
      }

      const query = `best local restaurants near ${cluster.replace(/-/g, ' ')} ${cityData.name} China`;
      const data  = await textSearch(query, FIELD_MASK);

      const places = data?.places?.slice(0, 5) || [];
      if (places.length === 0) {
        console.log(`  ✗ no restaurants: ${cluster}`);
        restaurants[cityKey][cluster] = [];
        continue;
      }

      const results = [];
      for (const p of places) {
        const photoRef = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUri(photoRef) : null;

        results.push({
          id:              p.id || null,
          name:            p.displayName?.text || null,
          address:         p.formattedAddress || null,
          rating:          p.rating || null,
          userRatingCount: p.userRatingCount || null,
          priceLevel:      p.priceLevel || null,
          photo_url,
          openingHours:    p.regularOpeningHours?.weekdayDescriptions || null,
          summary:         p.editorialSummary?.text || null,
        });
      }

      restaurants[cityKey][cluster] = results;
      totalSaved += results.length;
      console.log(`  ✓ ${results.length} restaurants: ${cluster}`);

      // Save after each cluster so partial runs aren't lost
      writeFileSync(REST_PATH, JSON.stringify(restaurants, null, 2));
    }
  }

  return { totalSaved };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  // Backup on first run only
  if (!existsSync(BKP2_PATH)) {
    writeFileSync(BKP2_PATH, JSON.stringify(db, null, 2));
    console.log('📦 Backup saved →', BKP2_PATH);
  }

  const photoStats = await fillAttractionPhotos(db);
  const restStats  = await fillRestaurants(db);

  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('────────────────────────────────────────────────────');
  console.log(`  Photos filled   ${photoStats.filled}`);
  console.log(`  Photos skipped  ${photoStats.skipped}  (already google)`);
  console.log(`  Photos failed   ${photoStats.failed}  (no result)`);
  console.log(`  Restaurants     ${restStats.totalSaved}  entries saved`);
  console.log('════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
