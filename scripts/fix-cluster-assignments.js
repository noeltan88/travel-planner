/**
 * fix-cluster-assignments.js
 *
 * Corrects cluster_group on every entry in staging-attractions-expanded.json
 * using a nearest-neighbour approach against china-master-db-v1.json.
 *
 * Logic per staging entry:
 *   - Calculate haversine distance to every master DB attraction in the same city
 *   - Nearest master attraction's cluster_group → correct cluster
 *   - If nearest > 50km: flag as outlier (log warning, keep entry)
 *   - If nearest > 80km: remove entry (likely wrong city)
 *
 * Output: overwrites src/data/staging-attractions-expanded.json in place.
 *
 * Run: node scripts/fix-cluster-assignments.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH      = resolve(__dirname, '../src/data/china-master-db-v1.json');
const STAGING_PATH = resolve(__dirname, '../src/data/staging-attractions-expanded.json');

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

// ── Main ───────────────────────────────────────────────────────────────────────
const db      = JSON.parse(readFileSync(DB_PATH,      'utf8'));
const staging = JSON.parse(readFileSync(STAGING_PATH, 'utf8'));

let grandTotal      = 0;
let grandReassigned = 0;
let grandFlagged    = 0;
let grandRemoved    = 0;

for (const cityKey of Object.keys(staging)) {
  const cityData = db.cities[cityKey];
  if (!cityData) {
    console.warn(`⚠  ${cityKey} not found in master DB — skipping`);
    continue;
  }

  // Build master-DB anchor array (only entries with valid lat/lng)
  const anchors = cityData.attractions
    .filter(a => a.lat != null && a.lng != null)
    .map(a => ({ lat: a.lat, lng: a.lng, cluster: a.cluster_group }));

  if (anchors.length === 0) {
    console.warn(`⚠  ${cityKey} has no anchors with coordinates — skipping`);
    continue;
  }

  let cityTotal      = 0;
  let cityReassigned = 0;
  let cityFlagged    = 0;
  let cityRemoved    = 0;

  const byCluster = staging[cityKey]; // { [cluster]: [attractionObj, ...] }
  const corrected  = {};              // rebuilt cluster map after fixes

  for (const [cluster, entries] of Object.entries(byCluster)) {
    const kept = [];

    for (const entry of entries) {
      cityTotal++;

      // Skip entries missing coordinates
      if (entry.lat == null || entry.lng == null) {
        console.log(`  ⚠  ${entry.name} — no coordinates, keeping as-is`);
        kept.push(entry);
        continue;
      }

      // Find nearest master DB anchor
      let minDist   = Infinity;
      let nearest   = null;
      for (const anchor of anchors) {
        const d = haversine(entry.lat, entry.lng, anchor.lat, anchor.lng);
        if (d < minDist) { minDist = d; nearest = anchor; }
      }

      const distKm = minDist.toFixed(1);

      // Remove if too far from any anchor (wrong city)
      if (minDist > 80) {
        console.log(`  🗑  REMOVED  : ${entry.name} (${distKm}km from nearest anchor — wrong city)`);
        cityRemoved++;
        continue;
      }

      // Flag outlier (keep but warn)
      if (minDist > 50) {
        console.log(`  ⚠  OUTLIER  : ${entry.name} (${distKm}km) — too far from any cluster, manual review needed`);
        cityFlagged++;
      }

      // Reassign if cluster differs
      if (nearest.cluster !== entry.cluster_group) {
        console.log(`  ↺  REASSIGN : ${entry.name}`
          + `\n               ${entry.cluster_group} → ${nearest.cluster} (${distKm}km away)`);
        entry.cluster_group = nearest.cluster;
        cityReassigned++;
      }

      // Place into corrected cluster map
      const dest = entry.cluster_group;
      if (!corrected[dest]) corrected[dest] = [];
      corrected[dest].push(entry);

      kept.push(entry); // for count tracking (entry object is the same ref)
    }

    // Entries that were kept without reassignment stay in original cluster
    // (already handled above via corrected map)
    void kept; // suppress unused-var lint
  }

  // Replace city entry in staging with corrected cluster map
  staging[cityKey] = corrected;

  console.log(`\n── ${cityData.name}`
    + `  checked: ${cityTotal}  reassigned: ${cityReassigned}`
    + `  flagged: ${cityFlagged}  removed: ${cityRemoved}`);

  grandTotal      += cityTotal;
  grandReassigned += cityReassigned;
  grandFlagged    += cityFlagged;
  grandRemoved    += cityRemoved;
}

// ── Save ───────────────────────────────────────────────────────────────────────
writeFileSync(STAGING_PATH, JSON.stringify(staging, null, 2));

console.log('\n══════════════════════════════════════════════');
console.log('DONE');
console.log(`  Total checked    : ${grandTotal}`);
console.log(`  Reassigned       : ${grandReassigned}`);
console.log(`  Flagged (>50km)  : ${grandFlagged}`);
console.log(`  Removed (>80km)  : ${grandRemoved}`);
console.log(`  Kept             : ${grandTotal - grandRemoved}`);
console.log(`\n  Output → ${STAGING_PATH}`);
