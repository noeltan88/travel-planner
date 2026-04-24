/**
 * fetch-attraction-photos.js
 *
 * One-time script: enriches china-master-db-v1.json with real photos from
 * Wikipedia / Wikimedia Commons.
 *
 * Strategy per attraction (tries in order):
 *   1. English Wikipedia page-images API  — cleaned name
 *   2. English Wikipedia page-images API  — cleaned name + city
 *   3. Chinese Wikipedia page-images API  — attraction.chinese field
 *   4. Wikimedia Commons image-search     — last resort
 *
 * Run:  node scripts/fetch-attraction-photos.js
 * Safe: re-running skips attractions that already have a real URL.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH   = resolve(__dirname, '../src/data/china-master-db-v1.json');
const BKP_PATH  = resolve(__dirname, '../src/data/china-master-db-v1.backup.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const SLEEP_MS   = 150;   // polite delay between API calls
const UA         = 'ChinaTravelPlanner/1.0 (contact: noeltan88@gmail.com)';
const STALE      = (u) => !u || u.includes('source.unsplash.com') || u.includes('picsum.photos');

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

/** Strip parenthetical qualifiers, e.g. "West Lake (Xihu)" → "West Lake" */
function cleanName(name) {
  return name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

/**
 * Call Wikipedia's action=query pageimages API.
 * Returns { url, title } or null.
 */
async function wpPageImage(title, lang = 'en') {
  const base   = `https://${lang}.wikipedia.org/w/api.php`;
  const params = new URLSearchParams({
    action:      'query',
    titles:      title,
    prop:        'pageimages',
    pithumbsize: '800',
    format:      'json',
    origin:      '*',
  });
  const url = `${base}?${params}`;
  try {
    const res  = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = Object.values(data?.query?.pages || {});
    for (const page of pages) {
      if (page.thumbnail?.source) {
        // Upsize thumb: replace /320px- with /800px-
        const src = page.thumbnail.source.replace(/\/\d+px-/, '/800px-');
        return { url: src, title: page.title };
      }
    }
  } catch { /* network hiccup */ }
  return null;
}

/**
 * Search Wikimedia Commons for an image.
 * Returns { url, title } or null.
 */
async function commonsSearch(query) {
  const base   = 'https://commons.wikimedia.org/w/api.php';
  const params = new URLSearchParams({
    action:    'query',
    list:      'search',
    srsearch:  `${query} filetype:bitmap`,
    srnamespace: '6',  // File: namespace
    srlimit:   '3',
    format:    'json',
    origin:    '*',
  });
  try {
    const res  = await fetch(`${base}?${params}`, { headers: { 'User-Agent': UA } });
    if (!res.ok) return null;
    const data = await res.json();
    const hits = data?.query?.search || [];
    for (const hit of hits) {
      // hit.title is like "File:Foo.jpg" — fetch imageinfo for the URL
      const infoParams = new URLSearchParams({
        action:  'query',
        titles:  hit.title,
        prop:    'imageinfo',
        iiprop:  'url',
        iiurlwidth: '800',
        format:  'json',
        origin:  '*',
      });
      await sleep(SLEEP_MS);
      const r2   = await fetch(`${base}?${infoParams}`, { headers: { 'User-Agent': UA } });
      if (!r2.ok) continue;
      const d2   = await r2.json();
      const pages = Object.values(d2?.query?.pages || {});
      for (const page of pages) {
        const thumbUrl = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
        if (thumbUrl) return { url: thumbUrl, title: hit.title };
      }
    }
  } catch { /* network hiccup */ }
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db = JSON.parse(readFileSync(DB_PATH, 'utf8'));

  // Backup on first run only
  if (!existsSync(BKP_PATH)) {
    writeFileSync(BKP_PATH, JSON.stringify(db, null, 2));
    console.log('📦 Backup saved →', BKP_PATH);
  }

  let checked = 0, filled = 0, skipped = 0, failed = 0;

  for (const [cityKey, cityData] of Object.entries(db.cities)) {
    console.log(`\n🏙  ${cityKey} (${cityData.attractions.length} attractions)`);

    for (const attr of cityData.attractions) {
      // Skip if already has a real photo URL
      if (!STALE(attr.photo_url)) {
        skipped++;
        continue;
      }

      checked++;
      const cleaned  = cleanName(attr.name);
      const cityName = cityData.name || cityKey;

      let result = null;

      // 1. English Wikipedia — clean name only
      await sleep(SLEEP_MS);
      result = await wpPageImage(cleaned, 'en');
      if (result) {
        attr.photo_url         = result.url;
        attr.photo_attribution = result.title;
        attr.photo_source      = 'wikipedia-en';
        filled++;
        console.log(`  ✓ wikipedia-en  ${attr.name}`);
        continue;
      }

      // 2. English Wikipedia — name + city
      await sleep(SLEEP_MS);
      result = await wpPageImage(`${cleaned}, ${cityName}`, 'en');
      if (result) {
        attr.photo_url         = result.url;
        attr.photo_attribution = result.title;
        attr.photo_source      = 'wikipedia-en';
        filled++;
        console.log(`  ✓ wikipedia-en+ ${attr.name}`);
        continue;
      }

      // 3. Chinese Wikipedia — chinese field
      if (attr.chinese) {
        await sleep(SLEEP_MS);
        result = await wpPageImage(attr.chinese, 'zh');
        if (result) {
          attr.photo_url         = result.url;
          attr.photo_attribution = result.title;
          attr.photo_source      = 'wikipedia-zh';
          filled++;
          console.log(`  ✓ wikipedia-zh  ${attr.name}`);
          continue;
        }
      }

      // 4. Wikimedia Commons search — last resort
      await sleep(SLEEP_MS);
      result = await commonsSearch(`${cleaned} ${cityName} China`);
      if (result) {
        attr.photo_url         = result.url;
        attr.photo_attribution = result.title;
        attr.photo_source      = 'commons';
        filled++;
        console.log(`  ✓ commons       ${attr.name}`);
        continue;
      }

      // No match found
      attr.photo_url         = null;
      attr.photo_attribution = null;
      attr.photo_source      = null;
      failed++;
      console.log(`  ✗ no match      ${attr.name}`);
    }

    // Save incrementally after each city so partial runs aren't lost
    writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    console.log(`  💾 saved after ${cityKey}`);
  }

  console.log('\n════════════════════════════════════════');
  console.log(`  checked  ${checked}`);
  console.log(`  filled   ${filled}`);
  console.log(`  skipped  ${skipped}  (already had real URL)`);
  console.log(`  failed   ${failed}  (no match on any source)`);
  console.log('════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
