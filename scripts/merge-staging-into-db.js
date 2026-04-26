/**
 * merge-staging-into-db.js
 *
 * Merges all three enriched staging files into china-master-db-v1.json.
 *
 * For each city:
 *   - Attractions: added to db.cities[city].attractions, skip if name exists
 *   - Food:        added to db.cities[city].food, skip if name exists
 *   - Hotels:      added to db.cities[city].hotels, skip if name exists
 *
 * IDs are assigned sequentially, continuing from each city's last existing ID.
 *
 * Run: node scripts/merge-staging-into-db.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const ATTR_PATH    = resolve(__dirname, '../src/data/staging-attractions-expanded.json');
const FOOD_PATH    = resolve(__dirname, '../src/data/staging-food-expanded.json');
const HOTELS_PATH  = resolve(__dirname, '../src/data/staging-hotels-expanded.json');
const DB_PATH      = resolve(__dirname, '../src/data/china-master-db-v1.json');

// ── ID helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse the last entry's id to extract prefix and current max number.
 * e.g. "gz-035"    → { prefix: "gz-",    num: 35, pad: 3 }
 *      "gz-fc017"  → { prefix: "gz-fc",  num: 17, pad: 3 }
 *      "gz-h010"   → { prefix: "gz-h",   num: 10, pad: 3 }
 *      "zjj-016"   → { prefix: "zjj-",   num: 16, pad: 3 }
 */
function parseLastId(id) {
  const m = id.match(/^(.*?)(\d+)$/);
  if (!m) return null;
  const prefix = m[1];
  const num    = parseInt(m[2], 10);
  const pad    = m[2].length;
  return { prefix, num, pad };
}

/**
 * Given an array of existing entries (with .id), return a counter function
 * that produces the next ID each time it is called.
 */
function makeIdCounter(entries) {
  if (!entries || entries.length === 0) return null; // caller must handle
  const lastId = entries[entries.length - 1]?.id;
  if (!lastId) return null;
  const parsed = parseLastId(lastId);
  if (!parsed) return null;
  let { prefix, num, pad } = parsed;
  return () => {
    num++;
    return `${prefix}${String(num).padStart(pad, '0')}`;
  };
}

// ── Dedup helpers ──────────────────────────────────────────────────────────────

function nameSet(entries) {
  return new Set((entries || []).map(e => e.name?.toLowerCase().trim()));
}

// ── Field mappers ──────────────────────────────────────────────────────────────

function mapAttraction(entry, newId) {
  return {
    id:                newId,
    name:              entry.name,
    chinese:           entry.chinese           || '',
    category:          entry.category          || 'attraction',
    cluster_group:     entry.cluster_group     || null,
    lat:               entry.lat               ?? null,
    lng:               entry.lng               ?? null,
    // Enriched editorial fields
    description:       entry.description       || '',
    tip:               entry.tip               || '',
    vibe_tags:         entry.vibe_tags         || [],
    companion_tags:    entry.companion_tags     || [],
    practical_tags:    entry.practical_tags     || [],
    energy_level:      entry.energy_level      || 'medium',
    duration_hrs:      entry.duration_hrs      ?? 1.5,
    price_rmb:         entry.price_rmb         ?? null,
    free:              entry.free              ?? false,
    kids_age_range:    entry.kids_age_range    || 'all',
    seasonal:          entry.seasonal          ?? false,
    best_months:       entry.best_months       || [],
    standalone:        entry.standalone        ?? false,
    icon:              false,
    klookId:           entry.klookId           ?? null,
    bookable:          entry.bookable          ?? false,
    // Google data
    google_place_id:   entry.google_place_id   || null,
    google_rating:     entry.rating            ?? null,
    google_review_count: entry.review_count    ?? null,
    photo_url:         entry.photo_url         || null,
    photo_source:      entry.photo_source      || 'google',
    summary:           entry.summary           || '',
    types:             entry.types             || [],
    show_in_explore:   true,
  };
}

function mapFood(entry, newId) {
  return {
    id:                newId,
    name:              entry.name,
    chinese:           entry.chinese           || '',
    category:          entry.type              || 'restaurant',
    type:              entry.type              || 'restaurant',
    cluster_group:     entry.cluster_group     || null,
    city:              entry.city              || null,
    lat:               entry.lat               ?? null,
    lng:               entry.lng               ?? null,
    price_range:       entry.price_range       || '',
    where:             entry.where             || '',
    dietary_tags:      entry.dietary_tags      || [],
    halal:             entry.halal             ?? false,
    tip:               entry.tip               || '',
    icon:              entry.icon              || '🍜',
    // Google data
    google_place_id:   entry.google_place_id   || null,
    google_rating:     entry.google_rating     ?? null,
    google_review_count: entry.google_review_count ?? null,
    photo_url:         entry.photo_url         || null,
    photo_source:      entry.photo_source      || 'google',
    show_in_explore:   true,
  };
}

function mapHotel(entry, newId) {
  return {
    id:                newId,
    name:              entry.name,
    chinese:           entry.chinese           || '',
    stars:             entry.stars             ?? null,
    cluster_group:     entry.cluster_group     || null,
    budget_tier:       entry.budget_tier       || null,
    rating:            entry.rating            ?? null,
    reviews:           entry.reviews           ?? null,
    lat:               entry.lat               ?? null,
    lng:               entry.lng               ?? null,
    area:              entry.area              || '',
    description:       entry.description       || '',
    price:             entry.price             || '',
    agodaId:           entry.agodaId           ?? null,
    // Google data
    google_place_id:   entry.google_place_id   || null,
    photo_url:         entry.photo_url         || null,
    show_in_explore:   true,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────

function main() {
  const db      = JSON.parse(readFileSync(DB_PATH,      'utf8'));
  const staging = {
    attractions: JSON.parse(readFileSync(ATTR_PATH,   'utf8')),
    food:        JSON.parse(readFileSync(FOOD_PATH,   'utf8')),
    hotels:      JSON.parse(readFileSync(HOTELS_PATH, 'utf8')),
  };

  const totals = { attr: { added: 0, skipped: 0 }, food: { added: 0, skipped: 0 }, hotels: { added: 0, skipped: 0 } };

  const cities = Object.keys(db.cities);

  for (const cityKey of cities) {
    const city = db.cities[cityKey];
    if (!city.attractions) city.attractions = [];
    if (!city.food)        city.food        = [];
    if (!city.hotels)      city.hotels      = [];

    const stats = { attrAdded: 0, attrSkipped: 0, foodAdded: 0, foodSkipped: 0, hotelsAdded: 0, hotelsSkipped: 0 };

    // ── ATTRACTIONS ──────────────────────────────────────────────────────────
    const stagingAttr = staging.attractions[cityKey];
    if (stagingAttr) {
      const existing   = nameSet(city.attractions);
      const nextId     = makeIdCounter(city.attractions);

      // Flatten cluster → entries
      const allEntries = Object.values(stagingAttr).flat();

      for (const entry of allEntries) {
        const nameLower = entry.name?.toLowerCase().trim();
        if (!nameLower || existing.has(nameLower)) {
          stats.attrSkipped++;
          totals.attr.skipped++;
          continue;
        }
        if (!nextId) {
          // No existing entries — build id from scratch using city prefix
          console.warn(`  ⚠ No existing attraction IDs for ${cityKey} — skipping ID generation`);
          stats.attrSkipped++;
          totals.attr.skipped++;
          continue;
        }
        const newId = nextId();
        city.attractions.push(mapAttraction(entry, newId));
        existing.add(nameLower);
        stats.attrAdded++;
        totals.attr.added++;
      }
    }

    // ── FOOD ────────────────────────────────────────────────────────────────
    const stagingFood = staging.food[cityKey];
    if (stagingFood) {
      const existing = nameSet(city.food);
      const nextId   = makeIdCounter(city.food);

      const allEntries = Object.values(stagingFood).flat();

      for (const entry of allEntries) {
        const nameLower = entry.name?.toLowerCase().trim();
        if (!nameLower || existing.has(nameLower)) {
          stats.foodSkipped++;
          totals.food.skipped++;
          continue;
        }
        if (!nextId) {
          console.warn(`  ⚠ No existing food IDs for ${cityKey} — skipping`);
          stats.foodSkipped++;
          totals.food.skipped++;
          continue;
        }
        const newId = nextId();
        city.food.push(mapFood(entry, newId));
        existing.add(nameLower);
        stats.foodAdded++;
        totals.food.added++;
      }
    }

    // ── HOTELS ───────────────────────────────────────────────────────────────
    const stagingHotels = staging.hotels[cityKey];
    if (stagingHotels) {
      const existing = nameSet(city.hotels);
      const nextId   = makeIdCounter(city.hotels);

      for (const entry of stagingHotels) {
        const nameLower = entry.name?.toLowerCase().trim();
        if (!nameLower || existing.has(nameLower)) {
          stats.hotelsSkipped++;
          totals.hotels.skipped++;
          continue;
        }
        if (!nextId) {
          console.warn(`  ⚠ No existing hotel IDs for ${cityKey} — skipping`);
          stats.hotelsSkipped++;
          totals.hotels.skipped++;
          continue;
        }
        const newId = nextId();
        city.hotels.push(mapHotel(entry, newId));
        existing.add(nameLower);
        stats.hotelsAdded++;
        totals.hotels.added++;
      }
    }

    console.log(`\n── ${cityKey}`);
    console.log(`   Attractions : +${stats.attrAdded}  skipped ${stats.attrSkipped}`);
    console.log(`   Food        : +${stats.foodAdded}  skipped ${stats.foodSkipped}`);
    console.log(`   Hotels      : +${stats.hotelsAdded}  skipped ${stats.hotelsSkipped}`);
  }

  // Save
  writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log(`  Attractions : +${totals.attr.added}  skipped ${totals.attr.skipped}`);
  console.log(`  Food        : +${totals.food.added}  skipped ${totals.food.skipped}`);
  console.log(`  Hotels      : +${totals.hotels.added}  skipped ${totals.hotels.skipped}`);
  console.log(`\n  Saved → ${DB_PATH}`);
}

main();
