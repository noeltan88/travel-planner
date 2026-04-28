/**
 * fix-cluster-assignments-countries.js
 *
 * Corrects cluster_group on every entry in the Japan, South Korea, Thailand,
 * and Vietnam staging files (attractions, food, hotels) using the same
 * nearest-neighbour haversine approach as fix-cluster-assignments.js.
 *
 * Since there is no external master DB for these countries, cluster anchors
 * are derived from the centroid (mean lat/lng) of all existing entries in
 * each cluster.  An entry is reassigned to whichever cluster centroid is
 * closest by haversine distance.
 *
 * Thresholds (same as China script):
 *   > 50 km from nearest centroid → OUTLIER  (warn, keep)
 *   > 80 km from nearest centroid → REMOVED  (likely wrong city)
 *
 * Overwrites each staging file in place.
 *
 * Run: node scripts/fix-cluster-assignments-countries.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR   = resolve(__dirname, '../src/data');

// ── Countries + file types to process ─────────────────────────────────────────
const COUNTRIES = ['japan', 'korea', 'thailand', 'vietnam'];
const TYPES     = ['attractions', 'food', 'hotels'];

// ── Haversine ──────────────────────────────────────────────────────────────────
function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    = Math.sin(dLat / 2) ** 2
             + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
             * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Compute cluster centroid from entries with valid coords ────────────────────
function centroid(entries) {
  const valid = entries.filter(e => e.lat != null && e.lng != null);
  if (valid.length === 0) return null;
  const lat = valid.reduce((s, e) => s + e.lat, 0) / valid.length;
  const lng = valid.reduce((s, e) => s + e.lng, 0) / valid.length;
  return { lat, lng };
}

// ── Process one staging file ───────────────────────────────────────────────────
function processFile(filePath, label) {
  const staging = JSON.parse(readFileSync(filePath, 'utf8'));

  let grandTotal      = 0;
  let grandReassigned = 0;
  let grandFlagged    = 0;
  let grandRemoved    = 0;

  for (const cityKey of Object.keys(staging)) {
    const byCluster = staging[cityKey]; // { [clusterName]: [entry, ...] }

    // ── Build cluster centroids ──────────────────────────────────────────────
    const centroids = {}; // clusterName → { lat, lng }
    for (const [clusterName, entries] of Object.entries(byCluster)) {
      const c = centroid(entries);
      if (c) centroids[clusterName] = { ...c, cluster: clusterName };
    }

    const anchorList = Object.values(centroids);

    if (anchorList.length === 0) {
      console.warn(`  ⚠  ${cityKey} has no cluster centroids — skipping`);
      continue;
    }

    let cityTotal      = 0;
    let cityReassigned = 0;
    let cityFlagged    = 0;
    let cityRemoved    = 0;

    const corrected = {}; // rebuilt cluster map

    for (const [cluster, entries] of Object.entries(byCluster)) {
      for (const entry of entries) {
        cityTotal++;

        // Keep entries missing coordinates as-is
        if (entry.lat == null || entry.lng == null) {
          if (!corrected[cluster]) corrected[cluster] = [];
          corrected[cluster].push(entry);
          continue;
        }

        // Find nearest cluster centroid
        let minDist = Infinity;
        let nearest = null;
        for (const anchor of anchorList) {
          const d = haversine(entry.lat, entry.lng, anchor.lat, anchor.lng);
          if (d < minDist) { minDist = d; nearest = anchor; }
        }

        const distKm = minDist.toFixed(1);

        // Remove if > 80 km from every centroid
        if (minDist > 80) {
          console.log(`    🗑  REMOVED  : ${entry.name} (${distKm}km — likely wrong city)`);
          cityRemoved++;
          continue;
        }

        // Flag outlier
        if (minDist > 50) {
          console.log(`    ⚠  OUTLIER  : ${entry.name} (${distKm}km) — manual review needed`);
          cityFlagged++;
        }

        // Reassign if cluster differs
        if (nearest.cluster !== entry.cluster_group) {
          console.log(`    ↺  REASSIGN : ${entry.name}`
            + `\n                 ${entry.cluster_group} → ${nearest.cluster} (${distKm}km)`);
          entry.cluster_group = nearest.cluster;
          cityReassigned++;
        }

        const dest = entry.cluster_group;
        if (!corrected[dest]) corrected[dest] = [];
        corrected[dest].push(entry);
      }
    }

    staging[cityKey] = corrected;

    console.log(`  ── ${cityKey.padEnd(16)}`
      + `checked: ${String(cityTotal).padStart(4)}`
      + `  reassigned: ${String(cityReassigned).padStart(3)}`
      + `  flagged: ${String(cityFlagged).padStart(3)}`
      + `  removed: ${String(cityRemoved).padStart(3)}`);

    grandTotal      += cityTotal;
    grandReassigned += cityReassigned;
    grandFlagged    += cityFlagged;
    grandRemoved    += cityRemoved;
  }

  writeFileSync(filePath, JSON.stringify(staging, null, 2));

  return { grandTotal, grandReassigned, grandFlagged, grandRemoved };
}

// ── Main ───────────────────────────────────────────────────────────────────────
let totalChecked    = 0;
let totalReassigned = 0;
let totalFlagged    = 0;
let totalRemoved    = 0;

for (const country of COUNTRIES) {
  console.log(`\n${'═'.repeat(62)}`);
  console.log(`🌏  ${country.toUpperCase()}`);
  console.log('═'.repeat(62));

  for (const type of TYPES) {
    const filePath = resolve(DATA_DIR, `staging-${country}-${type}.json`);
    console.log(`\n  [${type}]`);

    const stats = processFile(filePath, `${country}/${type}`);

    console.log(`\n  ✓ ${type}: checked ${stats.grandTotal}`
      + `  reassigned ${stats.grandReassigned}`
      + `  flagged ${stats.grandFlagged}`
      + `  removed ${stats.grandRemoved}`);

    totalChecked    += stats.grandTotal;
    totalReassigned += stats.grandReassigned;
    totalFlagged    += stats.grandFlagged;
    totalRemoved    += stats.grandRemoved;
  }
}

console.log('\n' + '═'.repeat(62));
console.log('ALL DONE');
console.log(`  Total checked    : ${totalChecked}`);
console.log(`  Reassigned       : ${totalReassigned}`);
console.log(`  Flagged (>50km)  : ${totalFlagged}`);
console.log(`  Removed (>80km)  : ${totalRemoved}`);
console.log(`  Kept             : ${totalChecked - totalRemoved}`);
console.log('═'.repeat(62));
