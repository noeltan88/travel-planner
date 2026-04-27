/**
 * fetch-country-travel-times.js
 *
 * Fetches real drive times between every cluster pair within each city
 * for Japan, South Korea, Thailand, and Vietnam using Google Routes API v2.
 *
 * Centroids are computed by averaging lat/lng of staging attractions.
 * DRIVE-only (no transit calls). Haversine × 3 min/km fallback if API fails.
 *
 * Output (4 files, nested { cityKey: { "clusterA→clusterB": {...} } }):
 *   src/data/travel-times-japan.json
 *   src/data/travel-times-korea.json
 *   src/data/travel-times-thailand.json
 *   src/data/travel-times-vietnam.json
 *
 * Resume-safe: cities already fully present in the output file are skipped.
 * Run:  node scripts/fetch-country-travel-times.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = resolve(__dirname, '../src/data');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 300;
const ROUTES   = 'https://routes.googleapis.com/directions/v2:computeRoutes';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

// ── Country definitions ────────────────────────────────────────────────────────
const COUNTRIES = [
  {
    key:          'japan',
    name:         'Japan',
    fileKey:      'japan',
    attrFile:     'staging-japan-attractions.json',
    outFile:      'travel-times-japan.json',
    cityKeys: [
      'tokyo','osaka','kyoto','hiroshima','nara','hakone','nikko',
      'sapporo','fukuoka','nagasaki','kanazawa','yokohama','kamakura',
      'okinawa','kawaguchiko',
    ],
  },
  {
    key:          'south_korea',
    name:         'South Korea',
    fileKey:      'korea',
    attrFile:     'staging-korea-attractions.json',
    outFile:      'travel-times-korea.json',
    cityKeys: ['seoul','busan','jeju','gyeongju','jeonju','suwon','sokcho','andong','tongyeong','incheon'],
  },
  {
    key:          'thailand',
    name:         'Thailand',
    fileKey:      'thailand',
    attrFile:     'staging-thailand-attractions.json',
    outFile:      'travel-times-thailand.json',
    cityKeys: [
      'bangkok','chiang_mai','phuket','krabi','koh_samui','ayutthaya',
      'chiang_rai','pattaya','hua_hin','kanchanaburi','sukhothai','pai',
    ],
  },
  {
    key:          'vietnam',
    name:         'Vietnam',
    fileKey:      'vietnam',
    attrFile:     'staging-vietnam-attractions.json',
    outFile:      'travel-times-vietnam.json',
    cityKeys: [
      'hanoi','ho_chi_minh_city','da_nang','hoi_an','ha_long_bay',
      'hue','nha_trang','sapa','da_lat','phu_quoc',
    ],
  },
];

// ── City display names ─────────────────────────────────────────────────────────
const CITY_NAMES = {
  tokyo: 'Tokyo', osaka: 'Osaka', kyoto: 'Kyoto', hiroshima: 'Hiroshima',
  nara: 'Nara', hakone: 'Hakone', nikko: 'Nikko', sapporo: 'Sapporo',
  fukuoka: 'Fukuoka', nagasaki: 'Nagasaki', kanazawa: 'Kanazawa',
  yokohama: 'Yokohama', kamakura: 'Kamakura', okinawa: 'Okinawa',
  kawaguchiko: 'Kawaguchiko',
  seoul: 'Seoul', busan: 'Busan', jeju: 'Jeju', gyeongju: 'Gyeongju',
  jeonju: 'Jeonju', suwon: 'Suwon', sokcho: 'Sokcho', andong: 'Andong',
  tongyeong: 'Tongyeong', incheon: 'Incheon',
  bangkok: 'Bangkok', chiang_mai: 'Chiang Mai', phuket: 'Phuket', krabi: 'Krabi',
  koh_samui: 'Koh Samui', ayutthaya: 'Ayutthaya', chiang_rai: 'Chiang Rai',
  pattaya: 'Pattaya', hua_hin: 'Hua Hin', kanchanaburi: 'Kanchanaburi',
  sukhothai: 'Sukhothai', pai: 'Pai',
  hanoi: 'Hanoi', ho_chi_minh_city: 'Ho Chi Minh City', da_nang: 'Da Nang',
  hoi_an: 'Hoi An', ha_long_bay: 'Ha Long Bay', hue: 'Hue',
  nha_trang: 'Nha Trang', sapa: 'Sapa', da_lat: 'Da Lat', phu_quoc: 'Phu Quoc',
};

// ── City-specific transport notes ──────────────────────────────────────────────
// Used to generate the `note` field with locally relevant travel advice.
const CITY_TRANSPORT = {
  // Japan — excellent metro networks
  tokyo:       { fast: 'Tokyo Metro/JR — faster than taxi at peak hours', slow: 'Consider Shinkansen or bus for distant clusters' },
  osaka:       { fast: 'Osaka Metro — faster than taxi in central areas', slow: 'Osaka Metro or taxi — comparable off-peak' },
  kyoto:       { fast: 'Bus or taxi — comparable journey times', slow: 'Taxi recommended — buses can be slow in traffic' },
  sapporo:     { fast: 'Sapporo Subway available for central clusters', slow: 'Taxi recommended for outlying areas' },
  fukuoka:     { fast: 'Fukuoka City Subway — quicker than taxi downtown', slow: 'Taxi or bus for suburban clusters' },
  yokohama:    { fast: 'Yokohama Municipal Subway/JR available', slow: 'Taxi for waterfront-to-inland routes' },
  // South Korea — excellent metro
  seoul:       { fast: 'Seoul Metro — T-money card recommended, faster than taxi', slow: 'Metro or taxi — allow extra time at rush hour' },
  busan:       { fast: 'Busan Metro available — faster than taxi for most routes', slow: 'Taxi for coastal-to-hilltop routes' },
  incheon:     { fast: 'Incheon Airport Railroad/Metro available', slow: 'Taxi recommended for island clusters' },
  // Thailand — Grab dominant
  bangkok:     { fast: 'BTS Skytrain/MRT available — faster than taxi in traffic', slow: 'Grab or taxi — allow 2× for peak-hour traffic' },
  // Vietnam — Grab dominant
  hanoi:       { fast: 'Grab recommended — faster and cheaper than metered taxi', slow: 'Grab or taxi — allow extra time in Old Quarter traffic' },
  ho_chi_minh_city: { fast: 'Grab recommended — avoid metered taxis', slow: 'Grab or taxi — peak-hour traffic significant' },
};

/** Get a human-readable note for a cross-cluster pair */
function buildNote(cityKey, driveMins, isFallback, distKm) {
  if (isFallback) {
    return `estimated — no route data (${distKm.toFixed(1)} km apart)`;
  }
  const transport = CITY_TRANSPORT[cityKey];
  if (transport) {
    return driveMins <= 20 ? transport.fast : transport.slow;
  }
  // Generic fallback by country pattern
  return driveMins <= 15
    ? 'Short ride — taxi or local transport'
    : 'Taxi or rideshare recommended';
}

/** Determine recommended_mode — drive-only data, so taxi for all cross-cluster */
function recommendedMode(cityKey, driveMins) {
  // Cities with strong metro where transit is clearly worth it
  const metroFirst = ['tokyo','osaka','sapporo','fukuoka','yokohama','seoul','busan','incheon','bangkok'];
  if (metroFirst.includes(cityKey) && driveMins >= 15) return 'transit';
  return 'taxi';
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms)         { return new Promise(r => setTimeout(r, ms)); }
function saveJSON(p, data) { writeFileSync(p, JSON.stringify(data, null, 2)); }

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function parseDurationMins(durStr) {
  if (!durStr) return null;
  const secs = parseInt(String(durStr).replace('s', ''), 10);
  return isNaN(secs) ? null : Math.round(secs / 60);
}

/** Average lat/lng from an array of attraction objects */
function centroid(attractions) {
  const valid = attractions.filter(a => a.lat != null && a.lng != null);
  if (valid.length === 0) return null;
  return {
    lat: valid.reduce((s, a) => s + a.lat, 0) / valid.length,
    lng: valid.reduce((s, a) => s + a.lng, 0) / valid.length,
  };
}

// ── Google Routes API ──────────────────────────────────────────────────────────
let totalApiCalls = 0;

async function driveMinutes(originLat, originLng, destLat, destLng) {
  await sleep(SLEEP_MS);
  totalApiCalls++;
  try {
    const res = await fetch(ROUTES, {
      method:  'POST',
      headers: {
        'Content-Type':     'application/json',
        'X-Goog-Api-Key':   KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin:      { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination: { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
        travelMode:  'DRIVE',
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      process.stdout.write(` ⚠ HTTP ${res.status}: ${txt.slice(0, 60)}\n`);
      return null;
    }
    const data  = await res.json();
    const route = data?.routes?.[0];
    return route ? parseDurationMins(route.duration) : null;
  } catch (err) {
    process.stdout.write(` ⚠ fetch error: ${err.message}\n`);
    return null;
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const clustersRaw = JSON.parse(
    readFileSync(resolve(DATA_DIR, 'country-clusters.json'), 'utf8'),
  );
  const startMs = Date.now();

  let grandTotalPairs = 0;

  for (const country of COUNTRIES) {
    const countryApiStart = totalApiCalls;
    const countryStartMs  = Date.now();

    const attrPath = resolve(DATA_DIR, country.attrFile);
    const outPath  = resolve(DATA_DIR, country.outFile);

    if (!existsSync(attrPath)) {
      console.warn(`⚠  ${country.attrFile} not found — skipping ${country.name}`);
      continue;
    }

    const stagingAttr = JSON.parse(readFileSync(attrPath, 'utf8'));
    const out         = existsSync(outPath) ? JSON.parse(readFileSync(outPath, 'utf8')) : {};
    const countryData = clustersRaw[country.key] || {};

    let countryPairs = 0;

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🗺️  ${country.name.toUpperCase()}`);
    console.log('═'.repeat(60));

    for (const cityKey of country.cityKeys) {
      const cityInfo  = countryData[cityKey];
      const cityName  = CITY_NAMES[cityKey] || cityKey;
      const clusters  = cityInfo?.clusters || [];

      if (clusters.length === 0) {
        console.warn(`  ⚠  ${cityKey} has no clusters — skipping`);
        continue;
      }

      // ── Resume: skip city if all expected pairs are present ───────────────
      const expectedSelf  = clusters.length;
      const expectedCross = clusters.length * (clusters.length - 1) / 2;
      const expectedTotal = expectedSelf + expectedCross;
      const existing      = out[cityKey] || {};
      const existingCount = Object.keys(existing).length;

      if (existingCount >= expectedTotal) {
        console.log(`  ↷ ${cityName.padEnd(22)} already done (${existingCount} pairs) — skipping`);
        grandTotalPairs += existingCount;
        countryPairs    += existingCount;
        continue;
      }

      console.log(`\n  ── ${cityName} (${clusters.length} clusters, ${expectedCross} cross-pairs)`);

      // ── Build centroids from staging attractions ───────────────────────────
      const cityAttr   = stagingAttr[cityKey] || {};
      const centroids  = {};
      for (const cluster of clusters) {
        const attractions = cityAttr[cluster] || [];
        const cen = centroid(attractions);
        if (cen) centroids[cluster] = cen;
      }

      const cityResult = { ...existing };

      // ── Same-cluster defaults (no API call) ───────────────────────────────
      for (const cl of clusters) {
        const key = `${cl}→${cl}`;
        if (!cityResult[key]) {
          cityResult[key] = {
            drive_minutes:       5,
            recommended_minutes: 10,
            recommended_mode:    'walk',
            note:                'Walking distance within cluster',
          };
        }
      }

      // ── Cross-cluster pairs ───────────────────────────────────────────────
      for (let i = 0; i < clusters.length; i++) {
        for (let j = i + 1; j < clusters.length; j++) {
          const cA     = clusters[i];
          const cB     = clusters[j];
          const pairKey = `${cA}→${cB}`;

          if (cityResult[pairKey]) {
            process.stdout.write(`    ${pairKey} — already present, skip\n`);
            continue;
          }

          const cenA = centroids[cA];
          const cenB = centroids[cB];

          process.stdout.write(`    ${pairKey} … `);

          let driveMins  = null;
          let isFallback = false;
          let distKm     = 0;

          if (!cenA || !cenB) {
            // No coordinates — skip API, use haversine if possible
            process.stdout.write('no centroid coords — skipping\n');
            cityResult[pairKey] = {
              drive_minutes:       null,
              recommended_minutes: null,
              recommended_mode:    'taxi',
              note:                'estimated — missing centroid coordinates',
            };
            continue;
          }

          // Routes API call
          driveMins = await driveMinutes(cenA.lat, cenA.lng, cenB.lat, cenB.lng);

          // Haversine fallback
          if (driveMins == null) {
            distKm    = haversine(cenA.lat, cenA.lng, cenB.lat, cenB.lng);
            driveMins = Math.max(1, Math.round(distKm * 3));
            isFallback = true;
          }

          const mode = recommendedMode(cityKey, driveMins);
          const note = buildNote(cityKey, driveMins, isFallback, distKm);

          cityResult[pairKey] = {
            drive_minutes:       driveMins,
            recommended_minutes: driveMins,
            recommended_mode:    mode,
            note,
          };

          process.stdout.write(
            `${driveMins}min${isFallback ? ' (est)' : ''} → ${mode}\n`,
          );
        }
      }

      out[cityKey] = cityResult;
      const pairCount = Object.keys(cityResult).length;
      grandTotalPairs += pairCount;
      countryPairs    += pairCount;

      saveJSON(outPath, out);
      console.log(`  ✓ ${cityName}: ${pairCount} pairs  💾 saved`);
    }

    const countryApiCalls = totalApiCalls - countryApiStart;
    const countryElapsed  = ((Date.now() - countryStartMs) / 1000).toFixed(0);
    const estCost         = (countryApiCalls * 0.005).toFixed(2);

    console.log(`\n  ── ${country.name} Summary ${'─'.repeat(35 - country.name.length)}`);
    console.log(`     Total pairs   : ${countryPairs}`);
    console.log(`     API calls     : ${countryApiCalls}`);
    console.log(`     Est. cost     : ~$${estCost}`);
    console.log(`     Elapsed       : ${countryElapsed}s`);
    console.log(`     Output        : ${outPath}`);
  }

  const totalElapsed = ((Date.now() - startMs) / 1000).toFixed(0);
  const totalCost    = (totalApiCalls * 0.005).toFixed(2);

  console.log(`\n${'═'.repeat(60)}`);
  console.log('ALL COUNTRIES COMPLETE');
  console.log(`  Total pairs     : ${grandTotalPairs}`);
  console.log(`  Total API calls : ${totalApiCalls}`);
  console.log(`  Estimated cost  : ~$${totalCost}`);
  console.log(`  Total elapsed   : ${totalElapsed}s`);
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
