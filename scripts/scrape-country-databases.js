/**
 * scrape-country-databases.js
 *
 * Scrapes attractions, food, and hotels for Japan, South Korea,
 * Thailand, and Vietnam using Google Places API (New).
 *
 * Reads cluster structure from src/data/country-clusters.json.
 * Outputs 12 staging files — one per country × category — each
 * nested as { [cityKey]: { [cluster]: [...entries] } }.
 *
 * Resume-safe: if all 3 staging files already contain a city, it
 * is skipped entirely. Saves after every city.
 *
 * Run:  node scripts/scrape-country-databases.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname      = dirname(fileURLToPath(import.meta.url));
const CLUSTERS_PATH  = resolve(__dirname, '../src/data/country-clusters.json');
const DATA_DIR       = resolve(__dirname, '../src/data');

// ── API config ─────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 250;
const BASE     = 'https://places.googleapis.com/v1';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

const FIELD_MASK = [
  'places.id', 'places.displayName', 'places.formattedAddress',
  'places.rating', 'places.userRatingCount', 'places.priceLevel',
  'places.photos', 'places.editorialSummary', 'places.types', 'places.location',
].join(',');

// ── Country definitions ────────────────────────────────────────────────────────
const COUNTRIES = [
  {
    key:      'japan',
    name:     'Japan',
    fileKey:  'japan',
    bbox:     { minLat: 24, maxLat: 46, minLng: 122, maxLng: 146 },
    cityKeys: [
      'tokyo','osaka','kyoto','hiroshima','nara','hakone','nikko',
      'sapporo','fukuoka','nagasaki','kanazawa','yokohama','kamakura',
      'okinawa','kawaguchiko',
    ],
    hotelPrice: { budget: '¥5,000–15,000/night', mid: '¥15,000–40,000/night', luxury: '¥40,000+/night' },
  },
  {
    key:      'south_korea',
    name:     'South Korea',
    fileKey:  'korea',
    bbox:     { minLat: 33, maxLat: 39, minLng: 124, maxLng: 132 },
    cityKeys: ['seoul','busan','jeju','gyeongju','jeonju','suwon','sokcho','andong','tongyeong','incheon'],
    hotelPrice: { budget: '₩50,000–100,000/night', mid: '₩100,000–250,000/night', luxury: '₩250,000+/night' },
  },
  {
    key:      'thailand',
    name:     'Thailand',
    fileKey:  'thailand',
    bbox:     { minLat: 5, maxLat: 21, minLng: 97, maxLng: 106 },
    cityKeys: [
      'bangkok','chiang_mai','phuket','krabi','koh_samui','ayutthaya',
      'chiang_rai','pattaya','hua_hin','kanchanaburi','sukhothai','pai',
    ],
    hotelPrice: { budget: '฿800–2,500/night', mid: '฿2,500–6,000/night', luxury: '฿6,000+/night' },
  },
  {
    key:      'vietnam',
    name:     'Vietnam',
    fileKey:  'vietnam',
    bbox:     { minLat: 8, maxLat: 24, minLng: 102, maxLng: 110 },
    cityKeys: [
      'hanoi','ho_chi_minh_city','da_nang','hoi_an','ha_long_bay',
      'hue','nha_trang','sapa','da_lat','phu_quoc',
    ],
    hotelPrice: {
      budget:  '₫300,000–800,000/night',
      mid:     '₫800,000–2,000,000/night',
      luxury:  '₫2,000,000+/night',
    },
  },
];

// ── City display names (cluster keys have no name field) ───────────────────────
const CITY_NAMES = {
  // Japan
  tokyo: 'Tokyo', osaka: 'Osaka', kyoto: 'Kyoto', hiroshima: 'Hiroshima',
  nara: 'Nara', hakone: 'Hakone', nikko: 'Nikko', sapporo: 'Sapporo',
  fukuoka: 'Fukuoka', nagasaki: 'Nagasaki', kanazawa: 'Kanazawa',
  yokohama: 'Yokohama', kamakura: 'Kamakura', okinawa: 'Okinawa',
  kawaguchiko: 'Kawaguchiko',
  // South Korea
  seoul: 'Seoul', busan: 'Busan', jeju: 'Jeju', gyeongju: 'Gyeongju',
  jeonju: 'Jeonju', suwon: 'Suwon', sokcho: 'Sokcho', andong: 'Andong',
  tongyeong: 'Tongyeong', incheon: 'Incheon',
  // Thailand
  bangkok: 'Bangkok', chiang_mai: 'Chiang Mai', phuket: 'Phuket', krabi: 'Krabi',
  koh_samui: 'Koh Samui', ayutthaya: 'Ayutthaya', chiang_rai: 'Chiang Rai',
  pattaya: 'Pattaya', hua_hin: 'Hua Hin', kanchanaburi: 'Kanchanaburi',
  sukhothai: 'Sukhothai', pai: 'Pai',
  // Vietnam
  hanoi: 'Hanoi', ho_chi_minh_city: 'Ho Chi Minh City', da_nang: 'Da Nang',
  hoi_an: 'Hoi An', ha_long_bay: 'Ha Long Bay', hue: 'Hue',
  nha_trang: 'Nha Trang', sapa: 'Sapa', da_lat: 'Da Lat', phu_quoc: 'Phu Quoc',
};

// ── ID prefixes per city ───────────────────────────────────────────────────────
const CITY_PREFIX = {
  // Japan
  tokyo: 'tk', osaka: 'os', kyoto: 'ky', hiroshima: 'hi', nara: 'nr',
  hakone: 'hk', nikko: 'nk', sapporo: 'sp', fukuoka: 'fk', nagasaki: 'ng',
  kanazawa: 'kz', yokohama: 'yk', kamakura: 'km', okinawa: 'ok', kawaguchiko: 'kw',
  // South Korea
  seoul: 'sl', busan: 'bs', jeju: 'jj', gyeongju: 'gj', jeonju: 'jo',
  suwon: 'sw', sokcho: 'sc', andong: 'ad', tongyeong: 'ty', incheon: 'ic',
  // Thailand
  bangkok: 'bk', chiang_mai: 'cm', phuket: 'ph', krabi: 'kb', koh_samui: 'ks',
  ayutthaya: 'ay', chiang_rai: 'cr', pattaya: 'pt', hua_hin: 'hh',
  kanchanaburi: 'kn', sukhothai: 'st', pai: 'pi',
  // Vietnam
  hanoi: 'hn', ho_chi_minh_city: 'hc', da_nang: 'dn', hoi_an: 'ha',
  ha_long_bay: 'hl', hue: 'hu', nha_trang: 'nt', sapa: 'sa', da_lat: 'dl', phu_quoc: 'pq',
};

// ── Chain skip lists ───────────────────────────────────────────────────────────
const HOTEL_CHAIN_SKIP = ['ibis budget', 'motel 168'];
const FOOD_CHAIN_SKIP  = [
  'starbucks', "mcdonald's", 'mcdonalds', 'kfc', 'pizza hut',
  'burger king', 'subway', "domino's", 'costa',
];

// ── Food price ranges per country ──────────────────────────────────────────────
const FOOD_PRICE = {
  japan:       ['¥500–1,500pp',          '¥1,500–5,000pp',         '¥5,000–15,000pp',       '¥15,000+pp'],
  south_korea: ['₩5,000–15,000pp',       '₩15,000–40,000pp',       '₩40,000–100,000pp',     '₩100,000+pp'],
  thailand:    ['฿50–200pp',             '฿200–600pp',              '฿600–2,000pp',           '฿2,000+pp'],
  vietnam:     ['₫30,000–100,000pp',     '₫100,000–300,000pp',     '₫300,000–800,000pp',    '₫800,000+pp'],
};

// ── API call counter ───────────────────────────────────────────────────────────
let totalApiCalls = 0;

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms)          { return new Promise(r => setTimeout(r, ms)); }
function saveJSON(p, data)  { writeFileSync(p, JSON.stringify(data, null, 2)); }
function norm(s)            { return (s || '').toLowerCase().trim(); }
function clusterLabel(cl)   { return cl.replace(/-/g, ' '); }

function inBbox(lat, lng, bbox) {
  if (lat == null || lng == null) return false;
  return lat >= bbox.minLat && lat <= bbox.maxLat &&
         lng >= bbox.minLng && lng <= bbox.maxLng;
}

function isChain(name, list) {
  const n = norm(name);
  return list.some(c => n.includes(norm(c)));
}

/** Normalize priceLevel (string enum or integer) → integer 1-4 | null */
function normPriceLevel(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const MAP = {
    PRICE_LEVEL_INEXPENSIVE:    1,
    PRICE_LEVEL_MODERATE:       2,
    PRICE_LEVEL_EXPENSIVE:      3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };
  return MAP[raw] ?? null;
}

function hotelTier(priceLevel, query) {
  const lvl = normPriceLevel(priceLevel);
  if (lvl === 1 || lvl === 2) return 'budget';
  if (lvl === 3)              return 'mid';
  if (lvl === 4)              return 'luxury';
  // null fallback: infer from query keyword
  if (/luxury/i.test(query))        return 'luxury';
  if (/budget|hostel/i.test(query)) return 'budget';
  return 'mid'; // spec default for null
}

function foodPriceRange(priceLevel, countryKey) {
  const lvl    = normPriceLevel(priceLevel);
  const ranges = FOOD_PRICE[countryKey] || ['$5–15pp', '$15–40pp', '$40–80pp', '$80+pp'];
  if (lvl === 1) return ranges[0];
  if (lvl === 2) return ranges[1];
  if (lvl === 3) return ranges[2];
  if (lvl === 4) return ranges[3];
  return ranges[1]; // null → mid
}

function foodType(types = []) {
  const t = types.map(s => s.toLowerCase());
  if (t.some(s => /cafe|coffee_shop/.test(s))) return 'cafe';
  if (t.some(s => /bar|pub/.test(s)))           return 'bar';
  return 'restaurant';
}

function foodIcon(type) {
  if (type === 'cafe') return '☕';
  if (type === 'bar')  return '🍺';
  return '🍽️';
}

function vibeTags(types = [], name = '', summary = '') {
  const t    = types.map(s => s.toLowerCase());
  const text = `${name} ${summary}`.toLowerCase();
  const tags = new Set();

  if (t.some(s => /park|garden|nature_reserve|national_park|natural_feature|beach|mountain|lake|river|forest/.test(s)))
    { tags.add('scenic'); tags.add('nature'); }
  if (t.some(s => /museum|gallery|cultural|heritage/.test(s)))
    { tags.add('culture'); tags.add('history'); }
  if (t.some(s => /temple|shrine|church|mosque|place_of_worship|hindu|buddhist|shinto/.test(s)))
    { tags.add('culture'); tags.add('history'); }
  if (t.some(s => /amusement_park|theme_park|zoo|aquarium|water_park/.test(s)))
    { tags.add('fun'); tags.add('adventure'); }
  if (t.some(s => /shopping|market|mall/.test(s)))
    { tags.add('shopping'); }
  if (t.some(s => /tourist_attraction|landmark|point_of_interest/.test(s)))
    { tags.add('instagrammable'); }
  if (/hidden|local gem|secret|off the beaten|neighbourhood|neighborhood/.test(text))
    { tags.add('local'); tags.add('hidden-gem'); }
  if (/historic|ancient|palace|ruins|dynasty|traditional/.test(text))
    { tags.add('culture'); tags.add('history'); }
  if (/scenic|viewpoint|panoram|sunset|sunrise|vista/.test(text))
    { tags.add('scenic'); tags.add('instagrammable'); }

  if (tags.size === 0) tags.add('instagrammable'); // default fallback
  return [...tags];
}

function extractArea(addr) {
  if (!addr) return '';
  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 2] : parts[0] || '';
}

// ── Google Places API wrappers ─────────────────────────────────────────────────
async function textSearch(query, maxResultCount = 10) {
  await sleep(SLEEP_MS);
  totalApiCalls++;
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
      process.stdout.write(`      ⚠  HTTP ${res.status}: ${txt.slice(0, 100)}\n`);
      return null;
    }
    return res.json();
  } catch (err) {
    process.stdout.write(`      ⚠  fetch error: ${err.message}\n`);
    return null;
  }
}

async function fetchPhotoUrl(photoName) {
  if (!photoName) return null;
  await sleep(SLEEP_MS);
  totalApiCalls++;
  try {
    const url = `${BASE}/${photoName}/media?maxHeightPx=1200&maxWidthPx=1200&skipHttpRedirect=true&key=${KEY}`;
    const res  = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.photoUri || null;
  } catch { return null; }
}

// ── Query builders ─────────────────────────────────────────────────────────────
function attractionQueries(cluster, cityName, countryName) {
  const cl = clusterLabel(cluster);
  return [
    `top attractions things to do ${cl} ${cityName} ${countryName}`,
    `hidden gems local spots ${cl} ${cityName} ${countryName}`,
    `historical sites temples cultural ${cl} ${cityName} ${countryName}`,
    `parks nature scenic viewpoints ${cl} ${cityName} ${countryName}`,
  ];
}

function foodQueries(cluster, cityName, countryName) {
  const cl = clusterLabel(cluster);
  return [
    `best local restaurants ${cl} ${cityName} ${countryName}`,
    `popular cafes coffee ${cl} ${cityName} ${countryName}`,
    `street food night market ${cl} ${cityName} ${countryName}`,
    `authentic local food ${cl} ${cityName} ${countryName}`,
    `best traditional cuisine ${cl} ${cityName} ${countryName}`,
  ];
}

function hotelQueries(cluster, cityName, countryName) {
  const cl = clusterLabel(cluster);
  return [
    `luxury hotels ${cl} ${cityName} ${countryName}`,
    `boutique hotels ${cl} ${cityName} ${countryName}`,
    `mid range hotels ${cl} ${cityName} ${countryName}`,
    `budget hotels hostels ${cl} ${cityName} ${countryName}`,
  ];
}

// ── Scrape a single city ────────────────────────────────────────────────────────
async function scrapeCity(cityKey, clusterList, country) {
  const pfx        = CITY_PREFIX[cityKey] || cityKey.slice(0, 4);
  const cityName   = CITY_NAMES[cityKey]  || cityKey.replace(/_/g, ' ');
  const bbox       = country.bbox;
  const countryKey = country.key;
  const cName      = country.name;

  const attrByCluster  = {};
  const foodByCluster  = {};
  const hotelByCluster = {};

  // Per-type dedup: same place_id can't appear twice within attractions,
  // food, or hotels, but can legitimately appear across types.
  const attrSeen  = new Set();
  const foodSeen  = new Set();
  const hotelSeen = new Set();

  let attrIdx  = 1;
  let foodIdx  = 1;
  let hotelIdx = 1;

  for (const cluster of clusterList) {
    process.stdout.write(`    [${cluster}]\n`);

    attrByCluster[cluster]  = [];
    foodByCluster[cluster]  = [];
    hotelByCluster[cluster] = [];

    // ── Attractions ────────────────────────────────────────────────────────────
    for (const query of attractionQueries(cluster, cityName, cName)) {
      const data   = await textSearch(query, 10);
      const places = data?.places || [];
      for (const p of places) {
        if (!p.id || attrSeen.has(p.id)) continue;
        const lat = p.location?.latitude  ?? null;
        const lng = p.location?.longitude ?? null;
        if (!inBbox(lat, lng, bbox)) continue;
        const name = p.displayName?.text || '';
        if (!name) continue;
        if (p.rating != null && p.rating < 3.8) continue;

        attrSeen.add(p.id);
        const summary   = p.editorialSummary?.text || '';
        const photoRef  = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUrl(photoRef) : null;

        attrByCluster[cluster].push({
          id:                  `${pfx}-a${String(attrIdx++).padStart(3, '0')}`,
          google_place_id:     p.id,
          name,
          description:         summary,
          category:            'attraction',
          cluster_group:       cluster,
          lat,
          lng,
          google_rating:       p.rating          ?? null,
          google_review_count: p.userRatingCount  ?? null,
          photo_url,
          photo_source:        'google',
          vibe_tags:           vibeTags(p.types || [], name, summary),
          show_in_explore:     true,
        });
      }
    }

    // ── Food ───────────────────────────────────────────────────────────────────
    for (const query of foodQueries(cluster, cityName, cName)) {
      const data   = await textSearch(query, 10);
      const places = data?.places || [];
      for (const p of places) {
        if (!p.id || foodSeen.has(p.id)) continue;
        const lat = p.location?.latitude  ?? null;
        const lng = p.location?.longitude ?? null;
        if (!inBbox(lat, lng, bbox)) continue;
        const name = p.displayName?.text || '';
        if (!name) continue;
        if (p.rating != null && p.rating < 3.5) continue;
        if (isChain(name, FOOD_CHAIN_SKIP)) continue;

        foodSeen.add(p.id);
        const summary   = p.editorialSummary?.text || '';
        const type      = foodType(p.types || []);
        const photoRef  = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUrl(photoRef) : null;

        foodByCluster[cluster].push({
          id:                  `${pfx}-f${String(foodIdx++).padStart(3, '0')}`,
          google_place_id:     p.id,
          name,
          category:            type,
          type,
          cluster_group:       cluster,
          city:                cityKey,
          price_range:         foodPriceRange(p.priceLevel, countryKey),
          where:               p.formattedAddress || '',
          tip:                 summary,
          icon:                foodIcon(type),
          photo_url,
          photo_source:        'google',
          google_rating:       p.rating          ?? null,
          google_review_count: p.userRatingCount  ?? null,
          lat,
          lng,
          show_in_explore:     true,
        });
      }
    }

    // ── Hotels ─────────────────────────────────────────────────────────────────
    for (const query of hotelQueries(cluster, cityName, cName)) {
      const data   = await textSearch(query, 10);
      const places = data?.places || [];
      for (const p of places) {
        if (!p.id || hotelSeen.has(p.id)) continue;
        const lat = p.location?.latitude  ?? null;
        const lng = p.location?.longitude ?? null;
        if (!inBbox(lat, lng, bbox)) continue;
        const name = p.displayName?.text || '';
        if (!name) continue;
        if (p.rating != null && p.rating < 3.8) continue;
        if (isChain(name, HOTEL_CHAIN_SKIP)) continue;

        hotelSeen.add(p.id);
        const tier      = hotelTier(p.priceLevel, query);
        const photoRef  = p.photos?.[0]?.name || null;
        const photo_url = photoRef ? await fetchPhotoUrl(photoRef) : null;

        hotelByCluster[cluster].push({
          id:              `${pfx}-h${String(hotelIdx++).padStart(3, '0')}`,
          google_place_id: p.id,
          name,
          area:            extractArea(p.formattedAddress),
          lat,
          lng,
          rating:          p.rating         ?? null,
          reviews:         p.userRatingCount ?? null,
          price:           country.hotelPrice[tier],
          photo_url,
          budget_tier:     tier,
          cluster_group:   cluster,
          show_in_explore: true,
        });
      }
    }

    const an = attrByCluster[cluster].length;
    const fn = foodByCluster[cluster].length;
    const hn = hotelByCluster[cluster].length;
    process.stdout.write(`      → attractions:${an}  food:${fn}  hotels:${hn}\n`);
  }

  return { attrByCluster, foodByCluster, hotelByCluster };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const clusters = JSON.parse(readFileSync(CLUSTERS_PATH, 'utf8'));
  const startMs  = Date.now();

  for (const country of COUNTRIES) {
    const countryApiStart = totalApiCalls;
    const countryStartMs  = Date.now();
    const fKey            = country.fileKey;

    const attrPath = resolve(DATA_DIR, `staging-${fKey}-attractions.json`);
    const foodPath = resolve(DATA_DIR, `staging-${fKey}-food.json`);
    const htlPath  = resolve(DATA_DIR, `staging-${fKey}-hotels.json`);

    // Load existing staging data (resume support)
    const stagingAttr  = existsSync(attrPath) ? JSON.parse(readFileSync(attrPath, 'utf8')) : {};
    const stagingFood  = existsSync(foodPath) ? JSON.parse(readFileSync(foodPath, 'utf8')) : {};
    const stagingHtl   = existsSync(htlPath)  ? JSON.parse(readFileSync(htlPath,  'utf8')) : {};

    let countryAttr = 0;
    let countryFood = 0;
    let countryHtl  = 0;

    console.log(`\n${'═'.repeat(62)}`);
    console.log(`🌏  ${country.name.toUpperCase()}`);
    console.log('═'.repeat(62));

    const countryData = clusters[country.key] || {};

    for (const cityKey of country.cityKeys) {
      const cityInfo = countryData[cityKey];
      if (!cityInfo) {
        console.warn(`  ⚠  ${cityKey} not found in country-clusters.json — skipping`);
        continue;
      }

      const cityName    = CITY_NAMES[cityKey] || cityKey.replace(/_/g, ' ');
      const clusterList = cityInfo.clusters || [];

      // Resume: skip city if all 3 staging files already have it
      if (stagingAttr[cityKey] && stagingFood[cityKey] && stagingHtl[cityKey]) {
        const an = Object.values(stagingAttr[cityKey]).flat().length;
        const fn = Object.values(stagingFood[cityKey]).flat().length;
        const hn = Object.values(stagingHtl[cityKey]).flat().length;
        console.log(
          `  ↷ ${cityName.padEnd(22)} already scraped ` +
          `(${an} attr, ${fn} food, ${hn} hotels) — skipping`,
        );
        countryAttr += an;
        countryFood += fn;
        countryHtl  += hn;
        continue;
      }

      console.log(`\n  ── ${cityName} (${cityKey}) — ${clusterList.length} clusters`);

      const { attrByCluster, foodByCluster, hotelByCluster } = await scrapeCity(
        cityKey, clusterList, country,
      );

      stagingAttr[cityKey] = attrByCluster;
      stagingFood[cityKey] = foodByCluster;
      stagingHtl[cityKey]  = hotelByCluster;

      const an = Object.values(attrByCluster).flat().length;
      const fn = Object.values(foodByCluster).flat().length;
      const hn = Object.values(hotelByCluster).flat().length;
      countryAttr += an;
      countryFood += fn;
      countryHtl  += hn;

      // Save all 3 files after each city
      saveJSON(attrPath, stagingAttr);
      saveJSON(foodPath, stagingFood);
      saveJSON(htlPath,  stagingHtl);

      console.log(`  ✓ ${cityName}: ${an} attractions, ${fn} food, ${hn} hotels  💾 saved`);
      console.log(`    Running total: ${countryAttr} attr | ${countryFood} food | ${countryHtl} hotels`);
    }

    // ── Country summary ──────────────────────────────────────────────────────
    const countryApiCalls = totalApiCalls - countryApiStart;
    const countryElapsed  = ((Date.now() - countryStartMs) / 1000).toFixed(0);
    // Text Search ~$0.032, Photo media ~$0.007
    const estCost = (
      (countryApiCalls * 0.5 * 0.032) + (countryApiCalls * 0.5 * 0.007)
    ).toFixed(2);

    console.log(`\n  ── ${country.name} Summary ${'─'.repeat(35 - country.name.length)}`);
    console.log(`     Total attractions : ${countryAttr}`);
    console.log(`     Total food        : ${countryFood}`);
    console.log(`     Total hotels      : ${countryHtl}`);
    console.log(`     API calls         : ${countryApiCalls}`);
    console.log(`     Estimated cost    : ~$${estCost}`);
    console.log(`     Elapsed           : ${countryElapsed}s`);
    console.log(`     Staging files:`);
    console.log(`       ${attrPath}`);
    console.log(`       ${foodPath}`);
    console.log(`       ${htlPath}`);
  }

  // ── Grand summary ──────────────────────────────────────────────────────────
  const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(0);
  const totalCost    = (
    (totalApiCalls * 0.5 * 0.032) + (totalApiCalls * 0.5 * 0.007)
  ).toFixed(2);

  console.log(`\n${'═'.repeat(62)}`);
  console.log('ALL COUNTRIES COMPLETE');
  console.log(`  Total API calls   : ${totalApiCalls}`);
  console.log(`  Estimated cost    : ~$${totalCost}`);
  console.log(`  Total elapsed     : ${totalElapsed}s`);
  console.log('═'.repeat(62));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
