/**
 * merge-remaining-enriched.js
 *
 * Merges src/data/remaining-enriched.json into src/data/enriched-candidates.json.
 * For each entry in remaining-enriched, add it to the matching city > cluster > category
 * array in enriched-candidates. Skips entries whose name already exists (case-insensitive).
 *
 * Run: node scripts/merge-remaining-enriched.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname     = dirname(fileURLToPath(import.meta.url));
const ENRICHED_PATH = resolve(__dirname, '../src/data/enriched-candidates.json');
const REMAINING_PATH = resolve(__dirname, '../src/data/remaining-enriched.json');

const enriched  = JSON.parse(readFileSync(ENRICHED_PATH,  'utf8'));
const remaining = JSON.parse(readFileSync(REMAINING_PATH, 'utf8'));

const stats = {}; // cityKey -> { merged, skipped }

for (const [cityKey, cityData] of Object.entries(remaining.cities)) {
  stats[cityKey] = { merged: 0, skipped: 0 };

  // Ensure city exists in enriched
  if (!enriched.cities[cityKey]) enriched.cities[cityKey] = {};

  for (const [clusterKey, clusterData] of Object.entries(cityData)) {
    // Ensure cluster exists in enriched
    if (!enriched.cities[cityKey][clusterKey]) {
      enriched.cities[cityKey][clusterKey] = { attractions: [], restaurants: [], cafes: [] };
    }

    for (const cat of ['attractions', 'restaurants', 'cafes']) {
      const entries = clusterData[cat] || [];
      if (!enriched.cities[cityKey][clusterKey][cat]) {
        enriched.cities[cityKey][clusterKey][cat] = [];
      }

      // Build set of existing names in this array (case-insensitive)
      const existingNames = new Set(
        enriched.cities[cityKey][clusterKey][cat]
          .map(e => (e.name || '').toLowerCase().trim())
      );

      for (const entry of entries) {
        const nameKey = (entry.name || '').toLowerCase().trim();
        if (existingNames.has(nameKey)) {
          console.log(`  ⏭  skipped   [${cityKey}/${clusterKey}/${cat}] ${entry.name}`);
          stats[cityKey].skipped++;
        } else {
          enriched.cities[cityKey][clusterKey][cat].push(entry);
          existingNames.add(nameKey);
          console.log(`  ✓  merged    [${cityKey}/${clusterKey}/${cat}] ${entry.name}`);
          stats[cityKey].merged++;
        }
      }
    }
  }
}

enriched.enriched_at = new Date().toISOString();
writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));

console.log('\n════════════════════════════════════════════════════');
console.log('  MERGE SUMMARY');
console.log('────────────────────────────────────────────────────');
let totalMerged = 0, totalSkipped = 0;
for (const [city, s] of Object.entries(stats)) {
  console.log(`  ${city.padEnd(12)}  merged: ${s.merged}   skipped: ${s.skipped}`);
  totalMerged  += s.merged;
  totalSkipped += s.skipped;
}
console.log('────────────────────────────────────────────────────');
console.log(`  TOTAL         merged: ${totalMerged}   skipped: ${totalSkipped}`);
console.log('════════════════════════════════════════════════════\n');
