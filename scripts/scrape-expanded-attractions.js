/**
 * scrape-expanded-attractions.js
 *
 * Scrapes additional attractions for all 21 cities using Google Places API (New).
 * For each city, runs 4 searches per cluster_group and collects attractions
 * not already present in china-master-db-v1.json.
 *
 * Output (staging only — does NOT modify the master DB):
 *   src/data/staging-attractions-expanded.json
 *   { [cityKey]: { [cluster]: [attractionObj, ...] } }
 *
 * Run:    node scripts/scrape-expanded-attractions.js
 * Resume: safe — if a city already exists in the staging file it is skipped.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url));
const DB_PATH    = resolve(__dirname, '../src/data/china-master-db-v1.json');
const OUT_PATH   = resolve(__dirname, '../src/data/staging-attractions-expanded.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 250;
const BASE     = 'https://places.googleapis.com/v1';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

// ── Field mask ─────────────────────────────────────────────────────────────────
const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.photos', 'places.editorialSummary', 'places.types', 'places.location',
].join(',');

// ── Types that indicate a non-attraction place (skip these) ───────────────────
const SKIP_TYPES = new Set([
  'lodging', 'hotel', 'restaurant', 'cafe', 'coffee_shop', 'bar', 'food',
  'store', 'supermarket', 'grocery_or_supermarket', 'convenience_store',
  'shopping_mall', 'department_store', 'clothing_store', 'pharmacy',
  'gas_station', 'parking', 'bank', 'atm', 'hospital', 'doctor',
]);

// ── Name-based skip patterns ───────────────────────────────────────────────────
const SKIP_NAME_RE = /shopping mall|supermarket|convenience store|hotel|hostel|motel|inn\b/i;

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function saveJSON(path, data) { writeFileSync(path, JSON.stringify(data, null, 2)); }
function norm(s) { return (s || '').toLowerCase().trim(); }

/** Human-readable cluster label for search queries */
function clusterLabel(cluster, cityName) {
  if (!cluster || cluster === 'standalone') return cityName;
  return cluster.replace(/-/g, ' ');
}

/** Map Places types array → a single category string */
function detectCategory(types = []) {
  const t = types.map(s => s.toLowerCase());
  if (t.some(s => s.includes('museum') || s.includes('art_gallery')))  return 'museum';
  if (t.some(s => s.includes('park') || s.includes('natural_feature'))) return 'park';
  if (t.some(s => s.includes('temple') || s.includes('church') || s.includes('mosque') || s.includes('place_of_worship'))) return 'temple';
  if (t.some(s => s.includes('amusement_park')))                        return 'theme_park';
  if (t.some(s => s.includes('zoo') || s.includes('aquarium')))         return 'nature';
  if (t.some(s => s.includes('tourist_attraction') || s.includes('point_of_interest'))) return 'landmark';
  return 'landmark';
}

/** Return true if the place should be skipped based on its types array */
function hasSkipType(types = []) {
  return types.some(t => SKIP_TYPES.has(t.toLowerCase()));
}

// ── Google Places API ─────────────────────────────────────────────────────────
let apiCallCount = 0;

async function textSearch(query, maxResultCount = 10) {
  await sleep(SLEEP_MS);
  apiCallCount++;
  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'en', maxResultCount }),
    });
    if (!res.ok) {
      const txt = await res.text();
      process.stdout.write(`      ⚠  HTTP ${res.status}: ${txt.slice(0, 80)}\n`);
      return null;
    }
    return res.json();
  } catch (err) {
    process.stdout.write(`      ⚠  fetch error: ${err.message}\n`);
    return null;
  }
}

async function fetchPhotoUri(photoName) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  apiCallCount++;
  try {
    const url = `${BASE}/${photoName}/media?maxHeightPx=1200&maxWidthPx=1200&skipHttpRedirect=true&key=${KEY}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.photoUri || null;
  } catch { return null; }
}

// ── Per-city scrape ────────────────────────────────────────────────────────────
async function scrapeCityAttractions(cityKey, cityData) {
  const clusters = [...new Set(
    cityData.attractions.map(a => a.cluster_group).filter(Boolean),
  )];

  // Existing names set for fast dedup against master DB
  const existingNames = new Set(
    cityData.attractions.map(a => norm(a.name)),
  );

  // place_ids seen across the entire city run (cross-cluster dedup)
  const seenIds = new Set();

  const byCluster = {};

  for (const cluster of clusters) {
    const cLabel = clusterLabel(cluster, cityData.name);
    byCluster[cluster] = [];

    const queries = [
      `top attractions things to do ${cLabel} ${cityData.name} China`,
      `hidden gems local spots ${cLabel} ${cityData.name} China`,
      `historical sites cultural attractions ${cLabel} ${cityData.name} China`,
      `parks nature scenic spots ${cLabel} ${cityData.name} China`,
    ];

    for (const query of queries) {
      const data   = await textSearch(query, 10);
      const places = data?.places || [];

      for (const p of places) {
        const placeId = p.id;
        if (!placeId || seenIds.has(placeId)) continue;

        const name = p.displayName?.text || '';
        if (!name) continue;

        // Quality floor
        if (p.rating && p.rating < 3.8) continue;

        // Skip non-attraction types
        if (hasSkipType(p.types || [])) continue;

        // Skip generic commercial venues by name
        if (SKIP_NAME_RE.test(name)) continue;

        // Skip if already in master DB for this city
        if (existingNames.has(norm(name))) continue;

        seenIds.add(placeId);

        const photoRef  = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUri(photoRef) : null;

        byCluster[cluster].push({
          google_place_id: placeId,
          name,
          chinese:         '',
          category:        detectCategory(p.types || []),
          cluster_group:   cluster,
          city:            cityKey,
          address:         p.formattedAddress || '',
          lat:             p.location?.latitude  ?? null,
          lng:             p.location?.longitude ?? null,
          rating:          p.rating              ?? null,
          review_count:    p.userRatingCount     ?? null,
          price_level:     p.priceLevel          ?? null,
          photo_url,
          photo_source:    'google',
          summary:         p.editorialSummary?.text || '',
          types:           p.types || [],
          icon:            false,
          show_in_explore: true,
        });
      }
    }

    process.stdout.write(`    ${cluster}: +${byCluster[cluster].length} attractions\n`);
  }

  return byCluster;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db      = JSON.parse(readFileSync(DB_PATH, 'utf8'));
  const staging = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : {};

  const CITIES = [
    'guangzhou','shenzhen','shanghai','chongqing','chengdu','beijing','hangzhou',
    'xian','guilin','changsha','zhangjiajie','yunnan','suzhou','jiuzhaigou',
    'harbin','changbaishan','sanya','xiamen','huangshan','nanjing','qingdao',
  ];

  let grandTotal = 0;
  const startMs  = Date.now();

  for (const cityKey of CITIES) {
    const cityData = db.cities[cityKey];
    if (!cityData) { console.warn(`⚠  City not in DB: ${cityKey}`); continue; }

    // Resume: skip if already scraped
    if (staging[cityKey]) {
      const n = Object.values(staging[cityKey]).flat().length;
      console.log(`  ↷ ${cityData.name} — already scraped (${n} attractions) — skipping`);
      grandTotal += n;
      continue;
    }

    console.log(`\n── ${cityData.name} ──────────────────────────────────`);

    const byCluster = await scrapeCityAttractions(cityKey, cityData);
    staging[cityKey] = byCluster;

    const cityTotal = Object.values(byCluster).flat().length;
    grandTotal += cityTotal;
    console.log(`  → ${cityTotal} new attractions`);

    // Incremental save
    saveJSON(OUT_PATH, staging);
    console.log(`  💾 saved`);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(0);

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log('\nPer-city totals:');
  for (const ck of CITIES) {
    if (!staging[ck]) continue;
    const n = Object.values(staging[ck]).flat().length;
    console.log(`  ${ck.padEnd(16)}: ${n}`);
  }
  console.log(`\n  Grand total attractions : ${grandTotal}`);
  console.log(`  Total API calls         : ${apiCallCount}`);
  console.log(`  Elapsed                 : ${elapsedSec}s`);
  console.log(`\n  Output → ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
