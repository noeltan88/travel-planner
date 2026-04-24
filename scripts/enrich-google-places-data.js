/**
 * enrich-google-places-data.js
 *
 * PART 1 — Add google_rating + google_review_count to every attraction.
 * PART 2 — Add photo_url + numeric rating/reviews to every hotel.
 *
 * Run:    node scripts/enrich-google-places-data.js
 * Resume: fully safe — skips anything that already has the target fields.
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

let apiCalls = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveDB(db) {
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}

async function textSearch(textQuery, fieldMask) {
  await sleep(SLEEP_MS);
  apiCalls++;
  const res = await fetch(`${BASE}/places:searchText`, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Goog-Api-Key':   KEY,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({ textQuery, languageCode: 'en' }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.warn(`    ⚠  HTTP ${res.status}: ${txt.slice(0, 120)}`);
    return null;
  }
  return res.json();
}

async function fetchPhotoUri(photoName) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  apiCalls++;
  const url = `${BASE}/${photoName}/media?maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true&key=${KEY}`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.photoUri || null;
}

// ── PART 1 — Attraction ratings ────────────────────────────────────────────────
async function enrichAttractionRatings(db) {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 1 — Attraction ratings');
  console.log('══════════════════════════════════════════════════\n');

  let enriched = 0, skipped = 0, failed = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    console.log(`🏙  ${cityData.name}`);

    for (const attr of cityData.attractions) {
      // Resume-safe: skip if both fields already present
      if (attr.google_rating != null && attr.google_review_count != null) {
        process.stdout.write(`  → skipped   ${attr.name}\n`);
        skipped++;
        continue;
      }

      const data = await textSearch(
        `${attr.name} ${cityData.name} China`,
        'places.id,places.rating,places.userRatingCount',
      );

      const place = data?.places?.[0];
      if (!place || (place.rating == null && place.userRatingCount == null)) {
        process.stdout.write(`  ✗ no data   ${attr.name}\n`);
        failed++;
        continue;
      }

      if (place.rating != null)          attr.google_rating       = place.rating;
      if (place.userRatingCount != null) attr.google_review_count = place.userRatingCount;
      enriched++;
      process.stdout.write(`  ✓ ${place.rating ?? '—'}★ (${place.userRatingCount ?? '—'})  ${attr.name}\n`);
    }

    saveDB(db);
    console.log(`  💾 saved ${cityKey}\n`);
  }

  return { enriched, skipped, failed };
}

// ── PART 2 — Hotel photos + detail enrichment ─────────────────────────────────
async function enrichHotels(db) {
  console.log('\n══════════════════════════════════════════════════');
  console.log(' PART 2 — Hotel photos + details');
  console.log('══════════════════════════════════════════════════\n');

  let enriched = 0, skipped = 0, failed = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    if (!cityData.hotels?.length) continue;
    console.log(`🏙  ${cityData.name} (${cityData.hotels.length} hotels)`);

    for (const hotel of cityData.hotels) {
      // Resume-safe: skip if photo_url is already a non-empty real URL
      if (hotel.photo_url) {
        process.stdout.write(`  → skipped   ${hotel.name}\n`);
        skipped++;
        continue;
      }

      const data = await textSearch(
        `${hotel.name} ${cityData.name} China hotel`,
        'places.id,places.displayName,places.rating,places.userRatingCount,places.photos,places.priceLevel',
      );

      const place = data?.places?.[0];
      if (!place) {
        process.stdout.write(`  ✗ no match  ${hotel.name}\n`);
        failed++;
        continue;
      }

      // Photo
      const photoRef = place.photos?.[0]?.name;
      const photoUri = await fetchPhotoUri(photoRef);
      if (photoUri) hotel.photo_url = photoUri;

      // Numeric rating — only overwrite if current value is a string/missing
      if (place.rating != null && (typeof hotel.rating !== 'number')) {
        hotel.rating = place.rating;
      }

      // Review count — add if missing or string
      if (place.userRatingCount != null &&
          (hotel.reviews == null || typeof hotel.reviews !== 'number')) {
        hotel.reviews = place.userRatingCount;
      }

      if (place.priceLevel != null && hotel.price_level == null) {
        hotel.price_level = place.priceLevel;
      }

      enriched++;
      const photoStr = photoUri ? '📷' : '(no photo)';
      process.stdout.write(`  ✓ ${photoStr} ${place.rating ?? '—'}★  ${hotel.name}\n`);
    }

    saveDB(db);
    console.log(`  💾 saved ${cityKey}\n`);
  }

  return { enriched, skipped, failed };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  const attrStats  = await enrichAttractionRatings(db);
  const hotelStats = await enrichHotels(db);

  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('────────────────────────────────────────────────────');
  console.log(`  Attractions enriched  ${attrStats.enriched}`);
  console.log(`  Attractions skipped   ${attrStats.skipped}`);
  console.log(`  Attractions failed    ${attrStats.failed}`);
  console.log(`  Hotels enriched       ${hotelStats.enriched}`);
  console.log(`  Hotels skipped        ${hotelStats.skipped}`);
  console.log(`  Hotels failed         ${hotelStats.failed}`);
  console.log(`  Total API calls       ${apiCalls}`);
  console.log('════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
