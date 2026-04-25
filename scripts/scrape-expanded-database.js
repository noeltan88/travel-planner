/**
 * scrape-expanded-database.js
 *
 * Comprehensively scrapes hotels and food/restaurants around every
 * attraction cluster_group for all 21 cities in china-master-db-v1.json.
 *
 * Output (staging only — does NOT modify the master DB):
 *   src/data/staging-hotels-expanded.json   { [cityKey]: [hotelObj, ...] }
 *   src/data/staging-food-expanded.json     { [cityKey]: { [cluster]: [foodObj, ...] } }
 *
 * Run:    node scripts/scrape-expanded-database.js
 * Resume: safe — if a city already exists in BOTH staging files it is skipped.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url));
const DB_PATH    = resolve(__dirname, '../src/data/china-master-db-v1.json');
const HTL_PATH   = resolve(__dirname, '../src/data/staging-hotels-expanded.json');
const FOOD_PATH  = resolve(__dirname, '../src/data/staging-food-expanded.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 250;
const BASE     = 'https://places.googleapis.com/v1';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

// ── City ID prefixes (matches existing DB convention) ──────────────────────────
const PREFIX = {
  guangzhou:    'gz',  shenzhen:  'sz',  shanghai:   'sh',  chongqing: 'cq',
  chengdu:      'cd',  beijing:   'bj',  hangzhou:   'hz',  xian:      'xa',
  guilin:       'gl',  changsha:  'cs',  zhangjiajie:'zjj', yunnan:    'yn',
  suzhou:       'su',  jiuzhaigou:'jzg', harbin:     'hrb', changbaishan:'cbs',
  sanya:        'sy',  xiamen:    'xm',  huangshan:  'hs',  nanjing:   'nj',
  qingdao:      'qd',
};

// ── Chain skip lists ──────────────────────────────────────────────────────────
const HOTEL_CHAIN_SKIP = ['ibis budget', 'motel 168'];
const FOOD_CHAIN_SKIP  = [
  'starbucks', 'luckin', 'costa coffee', "mcdonald's", 'kfc', 'pizza hut',
  'burger king', 'subway', "domino's", 'mcdonalds',
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function norm(s) { return (s || '').toLowerCase().trim(); }

/** Readable cluster name for use in search queries */
function clusterLabel(cluster, cityName) {
  if (!cluster || cluster === 'standalone') return cityName;
  return cluster.replace(/-/g, ' ');
}

/** Extract a rough district from a formattedAddress string */
function extractDistrict(addr) {
  if (!addr) return '';
  // Chinese addresses typically: "No. X, Street, District, City, Province, China"
  const parts = addr.split(',').map(s => s.trim());
  // Take the part that contains 'District' or the 3rd-to-last meaningful part
  const districtPart = parts.find(p => /district|区|县|市/i.test(p));
  if (districtPart) return districtPart;
  // Fallback: second-to-last non-country part
  const filtered = parts.filter(p => !/^china$/i.test(p));
  return filtered.length >= 2 ? filtered[filtered.length - 2] : (filtered[filtered.length - 1] || '');
}

/** Determine budget_tier from priceLevel or search query */
function hotelTier(priceLevel, searchQuery) {
  if (priceLevel === 1 || priceLevel === 2) return 'budget';
  if (priceLevel === 3) return 'mid';
  if (priceLevel === 4) return 'luxury';
  if (/luxury/i.test(searchQuery))  return 'luxury';
  if (/budget|hostel/i.test(searchQuery)) return 'budget';
  return 'mid';
}

/** Determine stars from priceLevel */
function hotelStars(priceLevel) {
  if (priceLevel === 1) return 2;
  if (priceLevel === 2) return 3;
  if (priceLevel === 3) return 4;
  if (priceLevel === 4) return 5;
  return 3;
}

/** Estimate per-night price range from tier */
function hotelPrice(tier) {
  if (tier === 'budget')  return '¥200-400/night';
  if (tier === 'mid')     return '¥400-800/night';
  return '¥800+/night';
}

/** Determine food price_range from priceLevel */
function foodPriceRange(priceLevel) {
  if (priceLevel === 1) return '¥20-50pp';
  if (priceLevel === 2) return '¥50-100pp';
  if (priceLevel === 3) return '¥100-200pp';
  if (priceLevel === 4) return '¥200+pp';
  return '¥50-100pp';
}

/** Determine type from Places types array */
function foodType(types = []) {
  const t = types.map(s => s.toLowerCase());
  if (t.some(s => s.includes('cafe') || s.includes('coffee'))) return 'cafe';
  if (t.some(s => s.includes('bar'))) return 'bar';
  return 'restaurant';
}

/** Infer dietary tags from name + summary text */
function foodDietaryTags(name = '', summary = '') {
  const text = `${name} ${summary}`.toLowerCase();
  const tags = [];
  if (/vegetarian|vegan/.test(text))        tags.push('veg-ok');
  if (/halal|muslim/.test(text))            tags.push('halal');
  if (/seafood/.test(text))                 tags.push('seafood-ok');
  return tags;
}

function foodIcon(type) {
  if (type === 'cafe') return '☕';
  if (type === 'bar')  return '🍺';
  return '🍜';
}

/** Check if name matches any skip-chain entry */
function isChain(name, list) {
  const n = norm(name);
  return list.some(c => n.includes(norm(c))) || /motel/i.test(name);
}

// ── Google Places API calls ───────────────────────────────────────────────────
let apiCallCount = 0;

async function textSearch(query, fieldMask, maxResultCount = 10) {
  await sleep(SLEEP_MS);
  apiCallCount++;
  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': fieldMask,
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

async function fetchPhotoUri(photoName, maxPx = 800) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  apiCallCount++;
  try {
    const url = `${BASE}/${photoName}/media?maxHeightPx=${maxPx}&maxWidthPx=${maxPx}&skipHttpRedirect=true&key=${KEY}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.photoUri || null;
  } catch { return null; }
}

// ── PART 1 — Hotels ───────────────────────────────────────────────────────────
const HOTEL_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.photos', 'places.location', 'places.editorialSummary',
].join(',');

async function scrapeHotelsForCity(cityKey, cityData, existingNames) {
  const prefix   = PREFIX[cityKey] || cityKey;
  const clusters = [...new Set(
    cityData.attractions.map(a => a.cluster_group).filter(Boolean),
  )];
  const QUERIES  = (cLabel) => [
    `luxury hotels ${cLabel} ${cityData.name} China`,
    `boutique hotels ${cLabel} ${cityData.name} China`,
    `mid range hotels ${cLabel} ${cityData.name} China`,
    `budget hotels hostels ${cLabel} ${cityData.name} China`,
  ];

  const seenIds  = new Set();
  const results  = [];
  let   idxCount = 1;

  for (const cluster of clusters) {
    const cLabel   = clusterLabel(cluster, cityData.name);
    const queries  = QUERIES(cLabel);
    let   clusterN = 0;

    for (const query of queries) {
      const data = await textSearch(query, HOTEL_FIELD_MASK, 10);
      const places = data?.places || [];

      for (const p of places) {
        const placeId = p.id;
        if (!placeId || seenIds.has(placeId)) continue;

        const name = p.displayName?.text || '';
        if (!name) continue;
        if (p.rating && p.rating < 3.8) continue;
        if (isChain(name, HOTEL_CHAIN_SKIP)) continue;
        if (existingNames.has(norm(name))) continue;

        seenIds.add(placeId);

        const tier      = hotelTier(p.priceLevel, query);
        const photoRef  = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUri(photoRef, 1200) : null;

        results.push({
          id:             `${prefix}-hs-${idxCount++}`,
          google_place_id: placeId,
          name,
          chinese:        '',
          area:           extractDistrict(p.formattedAddress),
          lat:            p.location?.latitude  ?? null,
          lng:            p.location?.longitude ?? null,
          rating:         p.rating              ?? null,
          reviews:        p.userRatingCount     ?? null,
          price:          hotelPrice(tier),
          photo_url,
          budget_tier:    tier,
          stars:          hotelStars(p.priceLevel),
          cluster_group:  cluster,
          agodaId:        null,
          show_in_explore: true,
        });
        clusterN++;
      }
    }
    process.stdout.write(`    cluster ${cluster}: +${clusterN} hotels\n`);
  }
  return results;
}

// ── PART 2 — Food ─────────────────────────────────────────────────────────────
const FOOD_FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.photos', 'places.editorialSummary', 'places.types', 'places.location',
].join(',');

async function scrapeFoodForCity(cityKey, cityData, existingNames) {
  const prefix   = PREFIX[cityKey] || cityKey;
  const clusters = [...new Set(
    cityData.attractions.map(a => a.cluster_group).filter(Boolean),
  )];
  const QUERIES  = (cLabel) => [
    `best local restaurants ${cLabel} ${cityData.name} China`,
    `popular cafes coffee ${cLabel} ${cityData.name} China`,
    `street food night market ${cLabel} ${cityData.name} China`,
    `authentic local food ${cLabel} ${cityData.name} China`,
    `best dim sum hotpot noodles ${cLabel} ${cityData.name} China`,
  ];

  const seenIds    = new Set();
  const byCluster  = {};
  let   idxCount   = 1;

  for (const cluster of clusters) {
    const cLabel  = clusterLabel(cluster, cityData.name);
    const queries = QUERIES(cLabel);
    byCluster[cluster] = [];

    for (const query of queries) {
      const data   = await textSearch(query, FOOD_FIELD_MASK, 10);
      const places = data?.places || [];

      for (const p of places) {
        const placeId = p.id;
        if (!placeId || seenIds.has(placeId)) continue;

        const name = p.displayName?.text || '';
        if (!name) continue;
        if (p.rating && p.rating < 3.5) continue;
        if (isChain(name, FOOD_CHAIN_SKIP)) continue;
        if (existingNames.has(norm(name))) continue;

        seenIds.add(placeId);

        const summary     = p.editorialSummary?.text || '';
        const type        = foodType(p.types || []);
        const dietaryTags = foodDietaryTags(name, summary);
        const photoRef    = p.photos?.[0]?.name || null;
        const photo_url   = photoRef ? await fetchPhotoUri(photoRef, 800) : null;

        byCluster[cluster].push({
          id:                 `${prefix}-fs-${idxCount++}`,
          google_place_id:    placeId,
          name,
          chinese:            '',
          category:           type,
          type,
          cluster_group:      cluster,
          city:               cityKey,
          price_range:        foodPriceRange(p.priceLevel),
          where:              p.formattedAddress || '',
          dietary_tags:       dietaryTags,
          halal:              dietaryTags.includes('halal'),
          tip:                summary,
          icon:               foodIcon(type),
          photo_url,
          photo_source:       'google',
          google_rating:      p.rating              ?? null,
          google_review_count: p.userRatingCount    ?? null,
          lat:                p.location?.latitude  ?? null,
          lng:                p.location?.longitude ?? null,
          show_in_explore:    true,
        });
      }
    }
    process.stdout.write(`    cluster ${cluster}: +${byCluster[cluster].length} food\n`);
  }
  return byCluster;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  // Load existing staging files (resume support)
  const stagingHotels = existsSync(HTL_PATH)  ? JSON.parse(readFileSync(HTL_PATH,  'utf8')) : {};
  const stagingFood   = existsSync(FOOD_PATH) ? JSON.parse(readFileSync(FOOD_PATH, 'utf8')) : {};

  let totalHotels = 0;
  let totalFood   = 0;
  const startMs   = Date.now();

  const CITIES = [
    'guangzhou','shenzhen','shanghai','chongqing','chengdu','beijing','hangzhou',
    'xian','guilin','changsha','zhangjiajie','yunnan','suzhou','jiuzhaigou',
    'harbin','changbaishan','sanya','xiamen','huangshan','nanjing','qingdao',
  ];

  for (const cityKey of CITIES) {
    const cityData = db.cities[cityKey];
    if (!cityData) { console.warn(`⚠  City not found in DB: ${cityKey}`); continue; }

    // Resume: skip if city already scraped in both staging files
    if (stagingHotels[cityKey] && stagingFood[cityKey]) {
      const hN = stagingHotels[cityKey].length;
      const fN = Object.values(stagingFood[cityKey]).flat().length;
      console.log(`  ↷ ${cityData.name} — already scraped (${hN} hotels, ${fN} food) — skipping`);
      totalHotels += hN;
      totalFood   += fN;
      continue;
    }

    console.log(`\n── ${cityData.name} ──────────────────────────────────`);

    // Build existing-name sets (case-insensitive) to avoid duplicates with master DB
    const existingHotelNames = new Set(
      (cityData.hotels || []).map(h => norm(h.name)),
    );
    const existingFoodNames = new Set(
      (cityData.food   || []).map(f => norm(f.name)),
    );

    // Hotels
    console.log('  [Hotels]');
    const hotels = await scrapeHotelsForCity(cityKey, cityData, existingHotelNames);
    stagingHotels[cityKey] = hotels;
    console.log(`  → ${hotels.length} new hotels`);
    totalHotels += hotels.length;

    // Food
    console.log('  [Food]');
    const foodByCluster = await scrapeFoodForCity(cityKey, cityData, existingFoodNames);
    stagingFood[cityKey] = foodByCluster;
    const foodTotal = Object.values(foodByCluster).flat().length;
    console.log(`  → ${foodTotal} new food entries`);
    totalFood += foodTotal;

    // Save incrementally after each city
    saveJSON(HTL_PATH,  stagingHotels);
    saveJSON(FOOD_PATH, stagingFood);
    console.log(`  💾 saved`);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(0);
  const estCost    = (
    // Text search: ~$0.032 each, photo: ~$0.007 each
    // Rough split: ~half calls are text search, half photo
    (apiCallCount * 0.5 * 0.032) + (apiCallCount * 0.5 * 0.007)
  ).toFixed(2);

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log(`  New hotels scraped  : ${totalHotels}`);
  console.log(`  New food scraped    : ${totalFood}`);
  console.log(`  Total API calls     : ${apiCallCount}`);
  console.log(`  Estimated cost      : ~$${estCost}`);
  console.log(`  Elapsed             : ${elapsedSec}s`);
  console.log(`\n  staging-hotels-expanded.json → ${HTL_PATH}`);
  console.log(`  staging-food-expanded.json   → ${FOOD_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
