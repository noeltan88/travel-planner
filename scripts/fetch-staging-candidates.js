/**
 * fetch-staging-candidates.js
 *
 * Pulls new venue candidates (attractions, restaurants, cafes) from the
 * Google Places API for all 21 cities — venues NOT currently in the DB.
 *
 * Output: src/data/staging-candidates.json (editorial review, never imported
 *         automatically into china-master-db-v1.json).
 *
 * Run:    node scripts/fetch-staging-candidates.js
 * Resume: cities already present in staging-candidates.json are skipped.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname    = dirname(fileURLToPath(import.meta.url));
const DB_PATH      = resolve(__dirname, '../src/data/china-master-db-v1.json');
const REST_PATH    = resolve(__dirname, '../src/data/restaurants.json');
const STAGING_PATH = resolve(__dirname, '../src/data/staging-candidates.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 300;
const BASE     = 'https://places.googleapis.com/v1';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.photos',
  'places.editorialSummary',
  'places.types',
  'places.location',
].join(',');

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function textSearch(textQuery) {
  await sleep(SLEEP_MS);
  const res = await fetch(`${BASE}/places:searchText`, {
    method:  'POST',
    headers: {
      'Content-Type':     'application/json',
      'X-Goog-Api-Key':   KEY,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({ textQuery, languageCode: 'en', maxResultCount: 10 }),
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
  const url = `${BASE}/${photoName}/media?maxHeightPx=800&maxWidthPx=800&skipHttpRedirect=true&key=${KEY}`;
  const res  = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data?.photoUri || null;
}

/** Build a lowercase set of all known venue names for a city (for dedup). */
function buildKnownNames(cityData, cityRestaurants) {
  const names = new Set();

  // Attractions
  for (const a of cityData.attractions || []) {
    names.add(a.name.toLowerCase().trim());
  }

  // Hotels
  for (const h of cityData.hotels || []) {
    names.add(h.name.toLowerCase().trim());
  }

  // Existing restaurants.json entries
  for (const clusterRests of Object.values(cityRestaurants || {})) {
    for (const r of clusterRests) {
      if (r.name) names.add(r.name.toLowerCase().trim());
    }
  }

  return names;
}

/** Convert a raw Places API place object into our staging shape. */
async function toCandidate(place, cluster, cityKey, category) {
  const photoRef = place.photos?.[0]?.name || null;
  const photo_url = await fetchPhotoUri(photoRef);

  return {
    google_place_id: place.id        || null,
    name:            place.displayName?.text || null,
    address:         place.formattedAddress  || null,
    rating:          place.rating            ?? null,
    review_count:    place.userRatingCount   ?? null,
    price_level:     place.priceLevel        ?? null,
    photo_url,
    summary:         place.editorialSummary?.text || null,
    types:           place.types             || [],
    lat:             place.location?.latitude  ?? null,
    lng:             place.location?.longitude ?? null,
    cluster_group:   cluster,
    city:            cityKey,
    category,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db          = JSON.parse(readFileSync(DB_PATH, 'utf8'));
  const restaurants = existsSync(REST_PATH)
    ? JSON.parse(readFileSync(REST_PATH, 'utf8'))
    : {};

  // Load or init staging output
  const staging = existsSync(STAGING_PATH)
    ? JSON.parse(readFileSync(STAGING_PATH, 'utf8'))
    : { generated_at: new Date().toISOString(), cities: {} };

  // Totals
  let totalAttractions = 0, totalRestaurants = 0, totalCafes = 0;

  // Recount already-fetched data
  for (const cityData of Object.values(staging.cities)) {
    for (const clusterData of Object.values(cityData)) {
      totalAttractions += clusterData.attractions?.length || 0;
      totalRestaurants += clusterData.restaurants?.length || 0;
      totalCafes       += clusterData.cafes?.length       || 0;
    }
  }

  const cityKeys = Object.keys(db.cities);

  for (const cityKey of cityKeys) {
    // Resume-safe: skip cities already in staging
    if (staging.cities[cityKey]) {
      console.log(`⏭  ${cityKey} — already in staging, skipping`);
      continue;
    }

    const cityData       = db.cities[cityKey];
    const cityName       = cityData.name;
    const knownNames     = buildKnownNames(cityData, restaurants[cityKey]);
    const clusters       = [...new Set(
      cityData.attractions.map(a => a.cluster_group).filter(Boolean)
    )];

    console.log(`\n🏙  ${cityName} (${clusters.length} clusters)`);
    staging.cities[cityKey] = {};

    for (const cluster of clusters) {
      const clusterLabel = cluster.replace(/-/g, ' ');
      console.log(`  📍 ${cluster}`);

      const clusterResult = { attractions: [], restaurants: [], cafes: [] };

      // ── SEARCH 1: Attractions ────────────────────────────────────────────
      const attrQuery = `top attractions things to do ${clusterLabel} ${cityName} China`;
      const attrData  = await textSearch(attrQuery);
      const attrPlaces = (attrData?.places || []).slice(0, 5);

      for (const place of attrPlaces) {
        const name = place.displayName?.text;
        if (!name) continue;
        if (knownNames.has(name.toLowerCase().trim())) continue; // dedup
        const candidate = await toCandidate(place, cluster, cityKey, 'attraction');
        clusterResult.attractions.push(candidate);
        knownNames.add(name.toLowerCase().trim()); // prevent cross-search dupes
      }
      console.log(`    attractions: ${clusterResult.attractions.length}`);

      // ── SEARCH 2: Restaurants ────────────────────────────────────────────
      const restQuery = `best local restaurants ${clusterLabel} ${cityName} China`;
      const restData  = await textSearch(restQuery);
      const restPlaces = (restData?.places || []).slice(0, 5);

      for (const place of restPlaces) {
        const name = place.displayName?.text;
        if (!name) continue;
        if (knownNames.has(name.toLowerCase().trim())) continue;
        const candidate = await toCandidate(place, cluster, cityKey, 'restaurant');
        clusterResult.restaurants.push(candidate);
        knownNames.add(name.toLowerCase().trim());
      }
      console.log(`    restaurants: ${clusterResult.restaurants.length}`);

      // ── SEARCH 3: Cafes ──────────────────────────────────────────────────
      const cafeQuery = `best cafes coffee shops ${clusterLabel} ${cityName} China`;
      const cafeData  = await textSearch(cafeQuery);
      const cafePlaces = (cafeData?.places || []).slice(0, 5);

      for (const place of cafePlaces) {
        const name = place.displayName?.text;
        if (!name) continue;
        if (knownNames.has(name.toLowerCase().trim())) continue;
        const candidate = await toCandidate(place, cluster, cityKey, 'cafe');
        clusterResult.cafes.push(candidate);
        knownNames.add(name.toLowerCase().trim());
      }
      console.log(`    cafes:       ${clusterResult.cafes.length}`);

      totalAttractions += clusterResult.attractions.length;
      totalRestaurants += clusterResult.restaurants.length;
      totalCafes       += clusterResult.cafes.length;

      staging.cities[cityKey][cluster] = clusterResult;
    }

    // Incremental save after each city
    staging.generated_at = new Date().toISOString();
    writeFileSync(STAGING_PATH, JSON.stringify(staging, null, 2));
    console.log(`  💾 saved ${cityKey}`);
  }

  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('────────────────────────────────────────────────────');
  console.log(`  Attractions   ${totalAttractions}`);
  console.log(`  Restaurants   ${totalRestaurants}`);
  console.log(`  Cafes         ${totalCafes}`);
  console.log(`  Total         ${totalAttractions + totalRestaurants + totalCafes}`);
  console.log('════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
