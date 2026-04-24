/**
 * merge-into-master-db.js
 *
 * Reads src/data/enriched-candidates.json and merges every entry into
 * src/data/china-master-db-v1.json, following the existing ID conventions.
 *
 * - attraction → db.cities[city].attractions   (ID: {prefix}-NNN)
 * - restaurant/cafe → db.cities[city].food      (ID: {prefix}-fcNNN)
 *
 * Skips duplicates (case-insensitive name match against existing name + chinese).
 *
 * Run: node scripts/merge-into-master-db.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname      = dirname(fileURLToPath(import.meta.url));
const DB_PATH        = resolve(__dirname, '../src/data/china-master-db-v1.json');
const ENRICHED_PATH  = resolve(__dirname, '../src/data/enriched-candidates.json');

const db       = JSON.parse(readFileSync(DB_PATH,       'utf8'));
const enriched = JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'));

// ── ID Helpers ─────────────────────────────────────────────────────────────────

/** Extract { prefix, last } from the last attraction ID in a city. */
function attrIdInfo(cityKey) {
  const attrs = db.cities[cityKey]?.attractions || [];
  for (let i = attrs.length - 1; i >= 0; i--) {
    const m = (attrs[i].id || '').match(/^(.+)-(\d+)$/);
    if (m) return { prefix: m[1], last: parseInt(m[2], 10) };
  }
  return null;
}

/** Extract { prefix, last } from the last fc food ID in a city. */
function fcIdInfo(cityKey) {
  const food = db.cities[cityKey]?.food || [];
  for (let i = food.length - 1; i >= 0; i--) {
    const m = (food[i].id || '').match(/^(.+)-fc(\d+)$/);
    if (m) return { prefix: m[1], last: parseInt(m[2], 10) };
  }
  return null;
}

function pad(n) { return String(n).padStart(3, '0'); }

// ── Name-set builder ──────────────────────────────────────────────────────────

/** Lowercase set of all name + chinese values in an array. */
function nameSet(arr) {
  const s = new Set();
  for (const e of arr) {
    if (e.name)    s.add(e.name.toLowerCase().trim());
    if (e.chinese) s.add(e.chinese.toLowerCase().trim());
  }
  return s;
}

/** Candidate names to test (name, name_en, chinese). */
function candidateKeys(entry) {
  const keys = [];
  if (entry.name)    keys.push(entry.name.toLowerCase().trim());
  if (entry.name_en) keys.push(entry.name_en.toLowerCase().trim());
  if (entry.chinese) keys.push(entry.chinese.toLowerCase().trim());
  return keys;
}

// ── Entry builders ─────────────────────────────────────────────────────────────

function buildAttraction(entry, id) {
  // Use name_en as display name; fall back to raw name
  const displayName = (entry.name_en && entry.name_en.trim()) ? entry.name_en : entry.name;
  // Chinese: use chinese field; if name is already Chinese-heavy and chinese is missing, use name
  const chinese = entry.chinese || entry.name || null;

  return {
    id,
    name:            displayName,
    chinese,
    category:        'attraction',
    vibe_tags:       entry.vibe_tags       || [],
    companion_tags:  entry.companion_tags  || [],
    practical_tags:  entry.practical_tags  || [],
    duration_hrs:    entry.duration_hrs    ?? 2,
    price_rmb:       entry.price_rmb       ?? 0,
    free:            entry.free            ?? false,
    lat:             entry.lat             ?? null,
    lng:             entry.lng             ?? null,
    tip:             entry.tip             || null,
    cluster_group:   entry.cluster_group   || null,
    standalone:      entry.standalone      ?? false,
    energy_level:    entry.energy_level    || 'medium',
    seasonal:        entry.seasonal        ?? false,
    best_months:     entry.best_months     || [],
    kids_age_range:  entry.kids_age_range  || 'all',
    description:     entry.description     || null,
    photo_url:       entry.photo_url       || null,
    photo_source:    entry.photo_url ? 'google' : null,
    icon:            false,
    google_rating:       entry.rating        ?? null,
    google_review_count: entry.review_count  ?? null,
    bookable:        entry.bookable        ?? false,
    klookId:         entry.klookId         ?? null,
  };
}

function buildFoodEntry(entry, id) {
  const displayName = (entry.name_en && entry.name_en.trim()) ? entry.name_en : entry.name;
  const chinese     = entry.chinese || entry.name || null;

  return {
    id,
    name:          displayName,
    chinese,
    type:          entry.category, // 'restaurant' or 'cafe'
    cluster_group: entry.cluster_group || null,
    price_range:   entry.price_range   || null,
    tip:           entry.tip           || null,
    lat:           entry.lat           ?? null,
    lng:           entry.lng           ?? null,
    photo_url:     entry.photo_url     || null,
    dietary_tags:  entry.dietary_tags  || [],
    halal:         entry.halal         ?? false,
    icon:          entry.icon          || null,
    google_rating:       entry.rating       ?? null,
    google_review_count: entry.review_count ?? null,
  };
}

// ── Main merge ─────────────────────────────────────────────────────────────────

const stats = {}; // cityKey -> { attrsAdded, foodAdded, skipped }

// Track running ID counters per city (attr and fc) so we don't need to re-scan
const attrCounters = {};
const fcCounters   = {};

for (const cityKey of Object.keys(enriched.cities)) {
  if (!db.cities[cityKey]) {
    console.warn(`⚠  City "${cityKey}" not found in DB — skipping`);
    continue;
  }

  stats[cityKey] = { attrsAdded: 0, foodAdded: 0, skipped: 0 };

  // Initialise counters once per city from the current DB state
  if (!attrCounters[cityKey]) {
    const info = attrIdInfo(cityKey);
    attrCounters[cityKey] = info ? { prefix: info.prefix, next: info.last + 1 } : null;
  }
  if (!fcCounters[cityKey]) {
    const info = fcIdInfo(cityKey);
    // If no fc entries yet, derive prefix from attraction IDs
    if (info) {
      fcCounters[cityKey] = { prefix: info.prefix, next: info.last + 1 };
    } else {
      const aInfo = attrIdInfo(cityKey);
      fcCounters[cityKey] = aInfo ? { prefix: aInfo.prefix, next: 1 } : null;
    }
  }

  // Build name sets from the CURRENT db arrays (updated as we add)
  const cityDb    = db.cities[cityKey];
  const attrNames = nameSet(cityDb.attractions || []);
  if (!cityDb.food) cityDb.food = [];
  const foodNames = nameSet(cityDb.food);

  const cityEnriched = enriched.cities[cityKey];

  for (const clusterData of Object.values(cityEnriched)) {
    // ── Attractions ──────────────────────────────────────────────────────────
    for (const entry of (clusterData.attractions || [])) {
      const keys = candidateKeys(entry);
      if (keys.some(k => attrNames.has(k))) {
        console.log(`  ⏭  skip attr  [${cityKey}] ${entry.name_en || entry.name}`);
        stats[cityKey].skipped++;
        continue;
      }

      if (!attrCounters[cityKey]) {
        console.warn(`  ⚠  no attr ID prefix for ${cityKey} — skipping ${entry.name}`);
        continue;
      }
      const { prefix, next } = attrCounters[cityKey];
      const id = `${prefix}-${pad(next)}`;
      attrCounters[cityKey].next++;

      const dbEntry = buildAttraction(entry, id);
      cityDb.attractions.push(dbEntry);
      for (const k of keys) attrNames.add(k);

      console.log(`  ✓  attr      [${cityKey}] ${id} ${dbEntry.name}`);
      stats[cityKey].attrsAdded++;
    }

    // ── Restaurants + Cafes → food array ────────────────────────────────────
    for (const cat of ['restaurants', 'cafes']) {
      for (const entry of (clusterData[cat] || [])) {
        const keys = candidateKeys(entry);
        if (keys.some(k => foodNames.has(k))) {
          console.log(`  ⏭  skip food [${cityKey}] ${entry.name_en || entry.name}`);
          stats[cityKey].skipped++;
          continue;
        }

        if (!fcCounters[cityKey]) {
          console.warn(`  ⚠  no fc ID prefix for ${cityKey} — skipping ${entry.name}`);
          continue;
        }
        const { prefix, next } = fcCounters[cityKey];
        const id = `${prefix}-fc${pad(next)}`;
        fcCounters[cityKey].next++;

        const dbEntry = buildFoodEntry(entry, id);
        cityDb.food.push(dbEntry);
        for (const k of keys) foodNames.add(k);

        console.log(`  ✓  food      [${cityKey}] ${id} ${dbEntry.name}`);
        stats[cityKey].foodAdded++;
      }
    }
  }
}

// Update metadata
db.last_updated = new Date().toISOString().slice(0, 10);

writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
console.log('\n  ✅  china-master-db-v1.json saved\n');

// ── Summary ────────────────────────────────────────────────────────────────────
console.log('════════════════════════════════════════════════════════════');
console.log('  MERGE SUMMARY');
console.log('────────────────────────────────────────────────────────────');
console.log('  City           Attractions  Food  Skipped');
console.log('  ─────────────────────────────────────────');
let totalAttr = 0, totalFood = 0, totalSkip = 0;
for (const [city, s] of Object.entries(stats)) {
  console.log(`  ${city.padEnd(14)} ${String(s.attrsAdded).padStart(5)}        ${String(s.foodAdded).padStart(3)}    ${String(s.skipped).padStart(4)}`);
  totalAttr += s.attrsAdded;
  totalFood += s.foodAdded;
  totalSkip += s.skipped;
}
console.log('  ─────────────────────────────────────────');
console.log(`  ${'TOTAL'.padEnd(14)} ${String(totalAttr).padStart(5)}        ${String(totalFood).padStart(3)}    ${String(totalSkip).padStart(4)}`);
console.log('════════════════════════════════════════════════════════════\n');
