/**
 * fetch-cluster-travel-times.js
 *
 * Fetches real transit and drive travel times between every cluster pair
 * within each city using the Google Routes API v2.
 *
 * Strategy:
 *   - Compute centroid (avg lat/lng) for each cluster from master DB attractions
 *   - For every unique cross-cluster pair in the city: call Routes API twice
 *     (TRANSIT + DRIVE)
 *   - Pick recommended_mode based on the 10-minute rule
 *   - If transit fails: drive-only, mode = "taxi"
 *   - If both fail: haversine × 3 min/km fallback, mode = "taxi", note "estimated"
 *
 * Output: src/data/travel-times.json
 * Run:    node scripts/fetch-cluster-travel-times.js
 * Resume: safe — cities already in output file are skipped
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname  = dirname(fileURLToPath(import.meta.url));
const DB_PATH    = resolve(__dirname, '../src/data/china-master-db-v1.json');
const OUT_PATH   = resolve(__dirname, '../src/data/travel-times.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const KEY      = process.env.GOOGLE_PLACES_KEY;
const SLEEP_MS = 300;
const BASE     = 'https://routes.googleapis.com/directions/v2:computeRoutes';

if (!KEY) {
  console.error('❌  GOOGLE_PLACES_KEY not found in .env.local');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function saveJSON(path, data) { writeFileSync(path, JSON.stringify(data, null, 2)); }

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Parse Google Routes duration string like "1234s" → integer minutes */
function parseDurationMins(durStr) {
  if (!durStr) return null;
  const secs = parseInt(durStr.replace('s', ''), 10);
  return isNaN(secs) ? null : Math.round(secs / 60);
}

/** Build a human-readable note based on the two travel times */
function buildNote(transitMins, driveMins, mode) {
  if (mode === 'walk')    return 'Walking distance within cluster';
  if (mode === 'taxi' && transitMins == null)
    return 'No transit available — taxi recommended';
  if (mode === 'taxi' && driveMins != null && transitMins != null)
    return `Taxi faster by ${transitMins - driveMins} min — transit limited`;
  if (mode === 'transit' && driveMins != null && transitMins != null) {
    const diff = driveMins - transitMins;
    if (diff <= 0) return 'Transit and taxi comparable — metro preferred';
    return `Metro saves ${diff} min over taxi in traffic`;
  }
  if (mode === 'taxi' && driveMins != null)
    return 'Drive time only — transit unavailable for this route';
  return 'estimated';
}

// ── Google Routes API ─────────────────────────────────────────────────────────
let apiCallCount = 0;

async function routesCall(originLat, originLng, destLat, destLng, travelMode) {
  await sleep(SLEEP_MS);
  apiCallCount++;
  try {
    const res = await fetch(BASE, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'X-Goog-Api-Key':    KEY,
        'X-Goog-FieldMask':  'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin:                   { location: { latLng: { latitude: originLat, longitude: originLng } } },
        destination:              { location: { latLng: { latitude: destLat,   longitude: destLng   } } },
        travelMode,
        computeAlternativeRoutes: false,
      }),
    });

    if (!res.ok) {
      // Non-2xx — treat as no-route (common for TRANSIT in remote cities)
      return null;
    }

    const data = await res.json();
    const route = data?.routes?.[0];
    if (!route) return null;

    return {
      durationMins: parseDurationMins(route.duration),
      distanceM:    route.distanceMeters ?? null,
    };
  } catch (err) {
    process.stdout.write(`      ⚠  ${travelMode} fetch error: ${err.message}\n`);
    return null;
  }
}

// ── Centroid ───────────────────────────────────────────────────────────────────
function centroid(attractions) {
  const valid = attractions.filter(a => a.lat != null && a.lng != null);
  if (valid.length === 0) return null;
  const lat = valid.reduce((s, a) => s + a.lat, 0) / valid.length;
  const lng = valid.reduce((s, a) => s + a.lng, 0) / valid.length;
  return { lat, lng };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const db  = JSON.parse(readFileSync(DB_PATH, 'utf8'));
  const out = existsSync(OUT_PATH) ? JSON.parse(readFileSync(OUT_PATH, 'utf8')) : {};

  let grandPairs = 0;
  const startMs  = Date.now();

  for (const [cityKey, cityData] of Object.entries(db.cities)) {

    // Resume: skip city if already done
    if (out[cityKey]) {
      const n = Object.keys(out[cityKey]).length;
      console.log(`  ↷ ${cityData.name} — already done (${n} pairs) — skipping`);
      grandPairs += n;
      continue;
    }

    // ── Build cluster centroid map ───────────────────────────────────────────
    const clusterMap = {}; // { clusterKey: [attraction, ...] }
    for (const a of cityData.attractions) {
      const c = a.cluster_group;
      if (!c) continue;
      if (!clusterMap[c]) clusterMap[c] = [];
      clusterMap[c].push(a);
    }

    const clusters = Object.keys(clusterMap);
    if (clusters.length === 0) continue;

    const centroids = {}; // { clusterKey: { lat, lng } }
    for (const c of clusters) {
      const cen = centroid(clusterMap[c]);
      if (cen) centroids[c] = cen;
    }

    console.log(`\n── ${cityData.name} (${clusters.length} clusters)`);

    const cityResult = {};

    // ── Same-cluster defaults (no API calls) ─────────────────────────────────
    for (const c of clusters) {
      const key = `${c}→${c}`;
      cityResult[key] = {
        transit_minutes:     10,
        drive_minutes:       5,
        recommended_minutes: 10,
        recommended_mode:    'walk',
        note:                'Walking distance within cluster',
      };
    }

    // ── Cross-cluster pairs ──────────────────────────────────────────────────
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const cA = clusters[i];
        const cB = clusters[j];
        const cenA = centroids[cA];
        const cenB = centroids[cB];

        const pairKey = `${cA}→${cB}`;
        process.stdout.write(`  ${pairKey} … `);

        // If either centroid is missing coords — fallback immediately
        if (!cenA || !cenB) {
          const note = 'estimated — missing centroid coordinates';
          cityResult[pairKey] = {
            transit_minutes:     null,
            drive_minutes:       null,
            recommended_minutes: null,
            recommended_mode:    'taxi',
            note,
          };
          process.stdout.write(`no coords\n`);
          continue;
        }

        // ── Transit call ──────────────────────────────────────────────────────
        const transitRes = await routesCall(cenA.lat, cenA.lng, cenB.lat, cenB.lng, 'TRANSIT');
        const transitMins = transitRes?.durationMins ?? null;

        // ── Drive call ────────────────────────────────────────────────────────
        const driveRes   = await routesCall(cenA.lat, cenA.lng, cenB.lat, cenB.lng, 'DRIVE');
        const driveMins  = driveRes?.durationMins ?? null;

        // ── Fallback if both fail ─────────────────────────────────────────────
        let finalTransit = transitMins;
        let finalDrive   = driveMins;
        let isFallback   = false;

        if (finalTransit == null && finalDrive == null) {
          const distKm      = haversine(cenA.lat, cenA.lng, cenB.lat, cenB.lng);
          const estimateMins = Math.round(distKm * 3);
          finalDrive  = estimateMins;
          isFallback  = true;
        }

        // ── Determine recommendation ──────────────────────────────────────────
        let recommended_minutes;
        let recommended_mode;

        if (finalTransit != null && finalDrive != null) {
          const transitLag = finalTransit - finalDrive;
          if (transitLag <= 10) {
            // Transit within 10 min of drive → prefer transit
            recommended_mode    = 'transit';
            recommended_minutes = finalTransit;
          } else {
            recommended_mode    = 'taxi';
            recommended_minutes = finalDrive;
          }
        } else if (finalTransit != null) {
          recommended_mode    = 'transit';
          recommended_minutes = finalTransit;
        } else {
          recommended_mode    = 'taxi';
          recommended_minutes = finalDrive;
        }

        const note = isFallback
          ? `estimated — no route data (${haversine(cenA.lat, cenA.lng, cenB.lat, cenB.lng).toFixed(1)}km apart)`
          : buildNote(finalTransit, finalDrive, recommended_mode);

        cityResult[pairKey] = {
          transit_minutes:     finalTransit,
          drive_minutes:       finalDrive,
          recommended_minutes,
          recommended_mode,
          note,
        };

        process.stdout.write(
          `transit ${finalTransit != null ? finalTransit + 'min' : 'N/A'}`
          + ` / drive ${finalDrive != null ? finalDrive + 'min' : 'N/A'}`
          + ` → ${recommended_mode} ${recommended_minutes}min\n`,
        );

        grandPairs++;
      }
    }

    out[cityKey] = cityResult;
    grandPairs += clusters.length; // count same-cluster defaults too

    // Incremental save
    saveJSON(OUT_PATH, out);
    console.log(`  💾 saved (${Object.keys(cityResult).length} pairs)`);
  }

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(0);
  const estimatedCost = (apiCallCount * 0.005).toFixed(2);

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log(`  Total pairs calculated : ${grandPairs}`);
  console.log(`  API calls made         : ${apiCallCount}`);
  console.log(`  Estimated cost         : $${estimatedCost}`);
  console.log(`  Elapsed                : ${elapsedSec}s`);
  console.log(`\n  Output → ${OUT_PATH}`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
