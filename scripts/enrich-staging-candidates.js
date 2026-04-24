/**
 * enrich-staging-candidates.js
 *
 * Reads src/data/staging-candidates.json and enriches every entry with
 * AI-generated editorial fields via the Anthropic API (claude-sonnet-4-5).
 *
 * Output: src/data/enriched-candidates.json
 *
 * Run:    node scripts/enrich-staging-candidates.js
 * Resume: entries whose name already appears in enriched-candidates.json are skipped.
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname      = dirname(fileURLToPath(import.meta.url));
const STAGING_PATH   = resolve(__dirname, '../src/data/staging-candidates.json');
const ENRICHED_PATH  = resolve(__dirname, '../src/data/enriched-candidates.json');

// ── Config ─────────────────────────────────────────────────────────────────────
const MODEL     = 'claude-sonnet-4-5';
const MAX_TOKENS = 800;
const SLEEP_MS  = 500;

// Cost tracking (claude-sonnet-4-5 pricing: $3/M input, $15/M output)
const COST_PER_INPUT_TOKEN  = 3 / 1_000_000;
const COST_PER_OUTPUT_TOKEN = 15 / 1_000_000;
let totalInputTokens = 0, totalOutputTokens = 0;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('❌  ANTHROPIC_API_KEY not found in .env.local');
  process.exit(1);
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveEnriched(enriched) {
  writeFileSync(ENRICHED_PATH, JSON.stringify(enriched, null, 2));
}

/** Build the prompt for attractions. */
function attractionPrompt(entry) {
  return `You are a travel content writer for a China travel planner app targeting Southeast Asian travellers. Write editorial fields for this attraction in JSON format only — no markdown, no explanation, just the JSON object.

Entry details:
Name: ${entry.name}
City: ${entry.city}
Category: ${entry.category}
Google summary: ${entry.summary || 'none'}
Google types: ${(entry.types || []).join(', ')}
Rating: ${entry.rating ?? 'unknown'}
Cluster: ${entry.cluster_group}

Return ONLY this JSON (no backticks):
{
  "name_en": "English name if original is Chinese, otherwise keep as-is",
  "chinese": "Chinese characters if not already Chinese, otherwise keep as-is",
  "description": "Exactly 2 evocative sentences. First sentence sets the scene. Second gives the key reason to visit. Max 60 words total. No marketing language.",
  "tip": "One specific insider tip a local would give. Practical, specific, not obvious. Max 40 words.",
  "vibe_tags": ["choose from: scenic, nature, instagrammable, local, hidden-gem, culture, history, shopping, food, nightlife, adventure, fun, trending"],
  "companion_tags": ["choose relevant from: solo, couple, family-kids, friends, elderly-friendly, all"],
  "practical_tags": ["choose relevant from: morning-only, morning-best, evening-best, book-ahead, full-day, free-entry"],
  "energy_level": "low or medium or high",
  "duration_hrs": 1.5,
  "price_rmb": 0,
  "free": false,
  "kids_age_range": "all or 4+ or 8+ or 13+",
  "seasonal": false,
  "best_months": [],
  "standalone": false,
  "bookable": false
}`;
}

/** Build the prompt for restaurants and cafes. */
function foodPrompt(entry) {
  return `You are a travel content writer for a China travel planner app. Write editorial fields for this ${entry.category} entry. Return ONLY JSON (no backticks, no markdown):

Name: ${entry.name}
City: ${entry.city}
Category: ${entry.category}
Google summary: ${entry.summary || 'none'}
Rating: ${entry.rating ?? 'unknown'}
Price level: ${entry.price_level ?? 'unknown'}
Cluster: ${entry.cluster_group}

{
  "name_en": "English name if original is Chinese, otherwise keep as-is",
  "chinese": "Chinese characters if not already Chinese, otherwise keep as-is",
  "tip": "One specific insider tip. What to order, when to go, or what to avoid. Max 35 words.",
  "dietary_tags": ["choose from: veg-ok, halal, contains-pork, contains-pork-optional, seafood-ok, spicy"],
  "halal": false,
  "price_range": "¥XX-XXXpp estimate based on rating and price_level context",
  "icon": "one relevant emoji"
}`;
}

/** Call Claude and return the parsed JSON response, or null on failure. */
async function callClaude(prompt) {
  await sleep(SLEEP_MS);
  try {
    const msg = await client.messages.create({
      model:      MODEL,
      max_tokens: MAX_TOKENS,
      messages:   [{ role: 'user', content: prompt }],
    });

    totalInputTokens  += msg.usage?.input_tokens  || 0;
    totalOutputTokens += msg.usage?.output_tokens || 0;

    const text = msg.content[0]?.text?.trim() || '';

    // Strip accidental backtick fences if Claude includes them
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(cleaned);
  } catch (err) {
    // JSON parse errors or network errors
    return null;
  }
}

/** Merge enriched fields with the original entry. */
function mergeEntry(original, enriched, isFood) {
  if (isFood) {
    return {
      // Keep all original Google fields
      google_place_id: original.google_place_id,
      name:            original.name,
      address:         original.address,
      rating:          original.rating,
      review_count:    original.review_count,
      price_level:     original.price_level,
      photo_url:       original.photo_url,
      summary:         original.summary,
      types:           original.types,
      lat:             original.lat,
      lng:             original.lng,
      cluster_group:   original.cluster_group,
      city:            original.city,
      category:        original.category,
      // Enriched food fields
      name_en:         enriched.name_en     ?? original.name,
      chinese:         enriched.chinese     ?? null,
      tip:             enriched.tip         ?? null,
      dietary_tags:    enriched.dietary_tags ?? [],
      halal:           enriched.halal       ?? false,
      price_range:     enriched.price_range ?? null,
      icon:            enriched.icon        ?? null,
    };
  }

  return {
    // Keep all original Google fields
    google_place_id: original.google_place_id,
    name:            original.name,
    address:         original.address,
    rating:          original.rating,
    review_count:    original.review_count,
    price_level:     original.price_level,
    photo_url:       original.photo_url,
    summary:         original.summary,
    types:           original.types,
    lat:             original.lat,
    lng:             original.lng,
    cluster_group:   original.cluster_group,
    city:            original.city,
    category:        original.category,
    // Enriched attraction fields
    name_en:         enriched.name_en        ?? original.name,
    chinese:         enriched.chinese        ?? null,
    description:     enriched.description    ?? null,
    tip:             enriched.tip            ?? null,
    vibe_tags:       enriched.vibe_tags      ?? [],
    companion_tags:  enriched.companion_tags ?? [],
    practical_tags:  enriched.practical_tags ?? [],
    energy_level:    enriched.energy_level   ?? 'medium',
    duration_hrs:    enriched.duration_hrs   ?? 2,
    price_rmb:       enriched.price_rmb      ?? 0,
    free:            enriched.free           ?? false,
    kids_age_range:  enriched.kids_age_range ?? 'all',
    seasonal:        enriched.seasonal       ?? false,
    best_months:     enriched.best_months    ?? [],
    standalone:      enriched.standalone     ?? false,
    bookable:        enriched.bookable       ?? false,
    icon:            false,
    klookId:         null,
  };
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  const staging = JSON.parse(readFileSync(STAGING_PATH, 'utf8'));

  // Load or init enriched output
  const enriched = existsSync(ENRICHED_PATH)
    ? JSON.parse(readFileSync(ENRICHED_PATH, 'utf8'))
    : { enriched_at: new Date().toISOString(), cities: {} };

  // Build a flat set of already-enriched names for resume safety
  const doneNames = new Set();
  for (const cityData of Object.values(enriched.cities)) {
    for (const clusterData of Object.values(cityData)) {
      for (const cat of ['attractions', 'restaurants', 'cafes']) {
        for (const entry of clusterData[cat] || []) {
          if (entry.name) doneNames.add(entry.name.toLowerCase().trim());
        }
      }
    }
  }

  let totalEnriched = 0, totalSkipped = 0, totalFailed = 0;

  for (const [cityKey, cityData] of Object.entries(staging.cities)) {
    console.log(`\n🏙  ${cityKey}`);

    if (!enriched.cities[cityKey]) enriched.cities[cityKey] = {};

    for (const [cluster, clusterData] of Object.entries(cityData)) {
      console.log(`  📍 ${cluster}`);

      if (!enriched.cities[cityKey][cluster]) {
        enriched.cities[cityKey][cluster] = { attractions: [], restaurants: [], cafes: [] };
      }

      for (const cat of ['attractions', 'restaurants', 'cafes']) {
        const entries = clusterData[cat] || [];

        for (const entry of entries) {
          const nameKey = (entry.name || '').toLowerCase().trim();

          // Resume: skip if already done
          if (doneNames.has(nameKey)) {
            process.stdout.write(`    → skipped   ${entry.name}\n`);
            totalSkipped++;
            continue;
          }

          const isFood   = cat === 'restaurants' || cat === 'cafes';
          const prompt   = isFood ? foodPrompt(entry) : attractionPrompt(entry);
          const aiResult = await callClaude(prompt);

          if (!aiResult) {
            process.stdout.write(`    ✗ failed    ${entry.name}\n`);
            totalFailed++;
            continue;
          }

          const merged = mergeEntry(entry, aiResult, isFood);
          enriched.cities[cityKey][cluster][cat].push(merged);
          doneNames.add(nameKey);
          totalEnriched++;
          process.stdout.write(`    ✓ enriched  ${entry.name}\n`);
        }
      }

      // Save after each cluster so partial runs aren't lost
      enriched.enriched_at = new Date().toISOString();
      saveEnriched(enriched);
    }
  }

  const estimatedCost = (
    totalInputTokens  * COST_PER_INPUT_TOKEN +
    totalOutputTokens * COST_PER_OUTPUT_TOKEN
  ).toFixed(4);

  console.log('\n════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('────────────────────────────────────────────────────');
  console.log(`  Enriched      ${totalEnriched}`);
  console.log(`  Skipped       ${totalSkipped}`);
  console.log(`  Failed        ${totalFailed}`);
  console.log(`  Input tokens  ${totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Est. cost     $${estimatedCost}`);
  console.log('════════════════════════════════════════════════════\n');
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
