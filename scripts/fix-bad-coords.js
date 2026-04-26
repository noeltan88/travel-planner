/**
 * fix-bad-coords.js
 *
 * Three-pass fix for bad coordinate entries in china-master-db-v1.json:
 *
 * Pass 1 — Delete out-of-bounds food/hotel entries (Singapore coords, lat<15 or lng<70)
 * Pass 2 — Google Places lookup for -f* food entries (non-Guangzhou) missing coords
 * Pass 3 — Google Places lookup for attraction entries missing coords
 *
 * Guangzhou gz-f* concept entries (dish names, no real location) are left untouched.
 * Any entry that Google can't find is deleted.
 *
 * Run: node scripts/fix-bad-coords.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = resolve(__dirname, '../src/data/china-master-db-v1.json');

const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 400;

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found');
  process.exit(1);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── China bounding box ─────────────────────────────────────────────────────────
const LAT_MIN = 15, LAT_MAX = 55;
const LNG_MIN = 70, LNG_MAX = 140;

function isOutOfBounds(lat, lng) {
  if (lat == null || lng == null) return false; // handled separately
  return lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX;
}

// ── City name map for search queries ──────────────────────────────────────────
const CITY_NAMES = {
  guangzhou: 'Guangzhou', shenzhen: 'Shenzhen', shanghai: 'Shanghai',
  chongqing: 'Chongqing', chengdu: 'Chengdu', beijing: 'Beijing',
  hangzhou: 'Hangzhou', xian: 'Xi\'an', guilin: 'Guilin',
  changsha: 'Changsha', zhangjiajie: 'Zhangjiajie', yunnan: 'Yunnan',
  suzhou: 'Suzhou', jiuzhaigou: 'Jiuzhaigou', harbin: 'Harbin',
  changbaishan: 'Changbaishan', sanya: 'Sanya', xiamen: 'Xiamen',
  huangshan: 'Huangshan', nanjing: 'Nanjing', qingdao: 'Qingdao',
};

// ── Google Places Text Search ──────────────────────────────────────────────────
async function searchPlace(name, cityKey) {
  await sleep(SLEEP_MS);
  const cityName = CITY_NAMES[cityKey] ?? cityKey;
  const query    = encodeURIComponent(`${name} ${cityName} China`);
  const url      = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${KEY}`;
  try {
    const res  = await fetch(url);
    const data = await res.json();
    const loc  = data?.results?.[0]?.geometry?.location;
    if (!loc) return null;
    const { lat, lng } = loc;
    // Validate result is in China
    if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) return null;
    return { lat, lng };
  } catch (err) {
    console.warn(`    ⚠ fetch error for "${name}": ${err.message}`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  let deletedOOB    = 0;
  let foodPatched   = 0;
  let foodDeleted   = 0;
  let attrPatched   = 0;
  let attrDeleted   = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {

    // ── PASS 1: Delete out-of-bounds food entries ──────────────────────────
    const foodBefore = (cityData.food || []).length;
    cityData.food = (cityData.food || []).filter(f => {
      if (isOutOfBounds(f.lat, f.lng)) {
        console.log(`[OOB-DELETE] ${cityKey}/food ${f.id} "${f.name}" (${f.lat}, ${f.lng})`);
        deletedOOB++;
        return false;
      }
      return true;
    });

    // ── PASS 2: Fix -f* food entries missing coords (skip gz-f* Guangzhou concepts) ──
    for (const f of cityData.food) {
      // Skip Guangzhou concept entries (gz-f001…gz-f015)
      if (cityKey === 'guangzhou' && /^gz-f\d+$/.test(f.id)) continue;
      // Only process entries missing coords with -f* id pattern
      if (!(f.lat == null || f.lng == null)) continue;
      if (!/-fc?\d+$/.test(f.id)) continue;

      process.stdout.write(`[FOOD-LOOKUP] ${cityKey} ${f.id} "${f.name}" … `);
      const coords = await searchPlace(f.name, cityKey);
      if (coords) {
        f.lat = coords.lat;
        f.lng = coords.lng;
        process.stdout.write(`✓ (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})\n`);
        foodPatched++;
      } else {
        process.stdout.write(`✗ not found — will delete\n`);
        f._delete = true;
        foodDeleted++;
      }
    }
    // Remove entries flagged for deletion
    cityData.food = cityData.food.filter(f => !f._delete);

    // ── PASS 3: Fix attractions missing coords ─────────────────────────────
    for (const a of (cityData.attractions || [])) {
      if (!(a.lat == null || a.lng == null)) continue;

      process.stdout.write(`[ATTR-LOOKUP] ${cityKey} ${a.id} "${a.name}" … `);
      const coords = await searchPlace(a.name, cityKey);
      if (coords) {
        a.lat = coords.lat;
        a.lng = coords.lng;
        process.stdout.write(`✓ (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})\n`);
        attrPatched++;
      } else {
        process.stdout.write(`✗ not found — will delete\n`);
        a._delete = true;
        attrDeleted++;
      }
    }
    cityData.attractions = (cityData.attractions || []).filter(a => !a._delete);
  }

  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log(`  Out-of-bounds deleted : ${deletedOOB}`);
  console.log(`  Food patched          : ${foodPatched}`);
  console.log(`  Food deleted (not found): ${foodDeleted}`);
  console.log(`  Attractions patched   : ${attrPatched}`);
  console.log(`  Attractions deleted   : ${attrDeleted}`);
  console.log('\n  DB saved →', DB_PATH);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
