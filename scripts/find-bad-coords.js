/**
 * find-bad-coords.js
 *
 * Scans every attraction, food, and hotel entry in china-master-db-v1.json
 * and reports any entry whose coordinates are missing, zero, or outside
 * China's bounding box (lat 15–55, lng 70–140).
 *
 * Run: node scripts/find-bad-coords.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = resolve(__dirname, '../src/data/china-master-db-v1.json');

const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

const LAT_MIN =  15, LAT_MAX =  55;
const LNG_MIN =  70, LNG_MAX = 140;

function isBad(lat, lng) {
  if (lat == null || lng == null)  return 'missing';
  if (lat === 0   || lng === 0)    return 'zero';
  if (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX) return 'out-of-bounds';
  return null;
}

let total = 0;
const bad = [];

for (const [cityKey, cityData] of Object.entries(db.cities)) {
  const types = [
    { label: 'attraction', entries: cityData.attractions || [] },
    { label: 'food',       entries: cityData.food        || [] },
    { label: 'hotel',      entries: cityData.hotels      || [] },
  ];

  for (const { label, entries } of types) {
    for (const entry of entries) {
      total++;
      const reason = isBad(entry.lat, entry.lng);
      if (reason) {
        bad.push({ city: cityKey, type: label, id: entry.id, name: entry.name, lat: entry.lat, lng: entry.lng, reason });
      }
    }
  }
}

if (bad.length === 0) {
  console.log(`✅ All ${total} entries have valid coordinates.`);
} else {
  console.log(`⚠️  Found ${bad.length} bad entries out of ${total} total:\n`);
  for (const e of bad) {
    console.log(`  [${e.reason}] ${e.city} / ${e.type} / ${e.id}`);
    console.log(`    name: "${e.name}"`);
    console.log(`    lat:  ${e.lat}`);
    console.log(`    lng:  ${e.lng}`);
    console.log();
  }
}
