/**
 * enrich-staged-data.js
 *
 * Enriches all three staging files using the Claude API:
 *   Part 1 — Attractions  (claude-sonnet-4-5,        max_tokens: 600)
 *   Part 2 — Food         (claude-haiku-4-5-20251001, max_tokens: 300)
 *   Part 3 — Hotels       (claude-haiku-4-5-20251001, max_tokens: 250)
 *
 * Resume-safe: skips any entry whose target field is already populated.
 * Saves each file incrementally after every 50 entries processed.
 *
 * Run:  node scripts/enrich-staged-data.js
 */

import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// ── Paths ──────────────────────────────────────────────────────────────────────
const __dirname      = dirname(fileURLToPath(import.meta.url));
const ATTRACTIONS_PATH = resolve(__dirname, '../src/data/staging-attractions-expanded.json');
const FOOD_PATH        = resolve(__dirname, '../src/data/staging-food-expanded.json');
const HOTELS_PATH      = resolve(__dirname, '../src/data/staging-hotels-expanded.json');

// ── Anthropic client ───────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Cost constants (per million tokens) ───────────────────────────────────────
// claude-sonnet-4-5:        $3 input / $15 output
// claude-haiku-4-5-20251001: $0.80 input / $4 output
const COSTS = {
  'claude-sonnet-4-5':        { input: 3 / 1_000_000,   output: 15 / 1_000_000  },
  'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4  / 1_000_000  },
};

// ── Globals ────────────────────────────────────────────────────────────────────
let totalInputTokens  = 0;
let totalOutputTokens = 0;
let totalCostUsd      = 0;

const SLEEP_MS = 400;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function trackTokens(model, usage) {
  const rates = COSTS[model];
  if (!rates || !usage) return;
  const input  = usage.input_tokens  ?? 0;
  const output = usage.output_tokens ?? 0;
  totalInputTokens  += input;
  totalOutputTokens += output;
  totalCostUsd      += input * rates.input + output * rates.output;
}

function printCostSoFar() {
  console.log(`    💰 Running cost: $${totalCostUsd.toFixed(4)} (${totalInputTokens}in / ${totalOutputTokens}out tokens)`);
}

/**
 * Call the Claude API and return parsed JSON.
 * Returns null on API error or JSON parse failure.
 */
async function callClaude(model, maxTokens, prompt, entryName) {
  await sleep(SLEEP_MS);
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    trackTokens(model, msg.usage);
    const raw = msg.content?.[0]?.text ?? '';
    try {
      // Strip any accidental markdown fences
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      return JSON.parse(cleaned);
    } catch (parseErr) {
      console.log(`  ✗ JSON parse failed for "${entryName}": ${parseErr.message}`);
      console.log(`    Raw response: ${raw.slice(0, 200)}`);
      return null;
    }
  } catch (apiErr) {
    console.log(`  ✗ API error for "${entryName}": ${apiErr.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 1 — ATTRACTIONS
// ══════════════════════════════════════════════════════════════════════════════
async function enrichAttractions() {
  console.log('\n═══════════════════════════════════════');
  console.log('PART 1 — ATTRACTIONS (claude-sonnet-4-5)');
  console.log('═══════════════════════════════════════\n');

  const db = JSON.parse(readFileSync(ATTRACTIONS_PATH, 'utf8'));

  let enriched = 0;
  let skipped  = 0;
  let failed   = 0;
  let processed = 0;

  const MODEL     = 'claude-sonnet-4-5';
  const MAX_TOKENS = 600;

  for (const [cityKey, clusters] of Object.entries(db)) {
    console.log(`\n── ${cityKey}`);

    for (const [clusterKey, entries] of Object.entries(clusters)) {
      for (const entry of entries) {
        const name = entry.name ?? entry.google_place_id;

        // Resume-safe: skip if already enriched
        if (entry.description && entry.description.trim().length > 0) {
          process.stdout.write(`  → ${name} — skipped\n`);
          skipped++;
          processed++;
          continue;
        }

        const prompt = `You are a travel writer for a Southeast Asian audience. Write editorial fields for this China attraction. Return ONLY valid JSON, no markdown, no backticks.

Name: ${entry.name}
City: ${entry.city}
Category: ${entry.category}
Cluster: ${entry.cluster_group}
Google summary: ${entry.summary || 'none'}
Google rating: ${entry.rating}
Google types: ${JSON.stringify(entry.types ?? [])}

Return exactly this JSON:
{
  "chinese": "Chinese characters for the name — if name is already Chinese characters use as-is, if English translate accurately",
  "description": "Exactly 2 sentences. Sentence 1: specific vivid detail about what makes this place unique. Sentence 2: the single best reason to visit. Max 55 words total. Never use: stunning, breathtaking, must-see, world-class, iconic.",
  "tip": "One specific insider tip. Practical, local knowledge, not obvious. Max 35 words.",
  "vibe_tags": ["array of 1-3 from: scenic, nature, instagrammable, local, hidden-gem, culture, history, shopping, food, nightlife, adventure, fun, trending"],
  "companion_tags": ["array from: solo, couple, family-kids, friends, elderly-friendly, all"],
  "practical_tags": ["array from: morning-only, morning-best, evening-best, book-ahead, full-day, free-entry — only include if genuinely applicable"],
  "energy_level": "low or medium or high",
  "duration_hrs": 1.5,
  "price_rmb": 0,
  "free": false,
  "kids_age_range": "all or 4+ or 8+ or 13+",
  "seasonal": false,
  "best_months": []
}`;

        const result = await callClaude(MODEL, MAX_TOKENS, prompt, name);

        if (result) {
          // Merge enriched fields into entry, preserving existing data
          Object.assign(entry, result, {
            icon:      false,
            klookId:   null,
            bookable:  false,
            standalone: false,
          });
          process.stdout.write(`  ✓ ${name} — enriched\n`);
          enriched++;
        } else {
          process.stdout.write(`  ✗ ${name} — failed\n`);
          failed++;
        }

        processed++;

        // Incremental save every 50 entries
        if (processed % 50 === 0) {
          saveJSON(ATTRACTIONS_PATH, db);
          console.log(`  💾 Saved (${processed} processed)`);
          printCostSoFar();
        }
      }
    }

    printCostSoFar();
  }

  // Final save
  saveJSON(ATTRACTIONS_PATH, db);
  console.log('\n  💾 Attractions — final save');
  console.log(`  Enriched: ${enriched}  Skipped: ${skipped}  Failed: ${failed}`);

  return { enriched, skipped, failed };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 2 — FOOD
// ══════════════════════════════════════════════════════════════════════════════
async function enrichFood() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('PART 2 — FOOD (claude-haiku-4-5-20251001)');
  console.log('═══════════════════════════════════════════════\n');

  const db = JSON.parse(readFileSync(FOOD_PATH, 'utf8'));

  let enriched  = 0;
  let skipped   = 0;
  let failed    = 0;
  let processed = 0;

  const MODEL      = 'claude-haiku-4-5-20251001';
  const MAX_TOKENS = 300;

  for (const [cityKey, clusters] of Object.entries(db)) {
    console.log(`\n── ${cityKey}`);

    for (const [clusterKey, entries] of Object.entries(clusters)) {
      for (const entry of entries) {
        const name = entry.name ?? entry.id;

        // Resume-safe: skip if tip already populated
        if (entry.tip && entry.tip.trim().length > 0) {
          process.stdout.write(`  → ${name} — skipped\n`);
          skipped++;
          processed++;
          continue;
        }

        const prompt = `Write editorial fields for this China restaurant or cafe. Return ONLY valid JSON, no markdown, no backticks.

Name: ${entry.name}
City: ${entry.city}
Type: ${entry.type}
Cluster: ${entry.cluster_group}
Google summary: ${entry.summary || 'none'}
Price range: ${entry.price_range || 'unknown'}

Return exactly this JSON:
{
  "chinese": "Chinese characters for the name",
  "tip": "One specific insider tip. What to order, best time to visit, or local secret. Max 30 words.",
  "dietary_tags": ["array from: veg-ok, halal, contains-pork, contains-pork-optional, seafood-ok, spicy"],
  "halal": false,
  "price_range": "estimate like ¥30-60pp based on price_level: 1=¥20-50pp, 2=¥50-100pp, 3=¥100-200pp, 4=¥200+pp, null=¥50-100pp",
  "icon": "single most relevant emoji — 🍜 🍲 🥟 🦆 🐟 🥩 ☕ 🍵 🧋 🍰 🍺"
}`;

        const result = await callClaude(MODEL, MAX_TOKENS, prompt, name);

        if (result) {
          Object.assign(entry, result);
          process.stdout.write(`  ✓ ${name} — enriched\n`);
          enriched++;
        } else {
          process.stdout.write(`  ✗ ${name} — failed\n`);
          failed++;
        }

        processed++;

        if (processed % 50 === 0) {
          saveJSON(FOOD_PATH, db);
          console.log(`  💾 Saved (${processed} processed)`);
          printCostSoFar();
        }
      }
    }

    printCostSoFar();
  }

  saveJSON(FOOD_PATH, db);
  console.log('\n  💾 Food — final save');
  console.log(`  Enriched: ${enriched}  Skipped: ${skipped}  Failed: ${failed}`);

  return { enriched, skipped, failed };
}

// ══════════════════════════════════════════════════════════════════════════════
// PART 3 — HOTELS
// ══════════════════════════════════════════════════════════════════════════════
async function enrichHotels() {
  console.log('\n═══════════════════════════════════════════════');
  console.log('PART 3 — HOTELS (claude-haiku-4-5-20251001)');
  console.log('═══════════════════════════════════════════════\n');

  const db = JSON.parse(readFileSync(HOTELS_PATH, 'utf8'));

  let enriched  = 0;
  let skipped   = 0;
  let failed    = 0;
  let processed = 0;

  const MODEL      = 'claude-haiku-4-5-20251001';
  const MAX_TOKENS = 250;

  for (const [cityKey, entries] of Object.entries(db)) {
    console.log(`\n── ${cityKey}`);

    for (const entry of entries) {
      const name = entry.name ?? entry.id;

      // Resume-safe: skip if description already populated
      if (entry.description && entry.description.trim().length > 0) {
        process.stdout.write(`  → ${name} — skipped\n`);
        skipped++;
        processed++;
        continue;
      }

      const prompt = `Write editorial fields for this China hotel. Return ONLY valid JSON, no markdown, no backticks.

Name: ${entry.name}
City: ${cityKey}
Area: ${entry.area || 'unknown'}
Budget tier: ${entry.budget_tier}
Stars: ${entry.stars}
Google rating: ${entry.rating}
Google summary: ${entry.summary || 'none'}

Return exactly this JSON:
{
  "chinese": "Chinese characters for the hotel name",
  "description": "One sentence. What kind of traveller this suits and its single standout quality. Max 25 words.",
  "area": "confirm or correct the district/area name"
}`;

      const result = await callClaude(MODEL, MAX_TOKENS, prompt, name);

      if (result) {
        Object.assign(entry, result);
        process.stdout.write(`  ✓ ${name} — enriched\n`);
        enriched++;
      } else {
        process.stdout.write(`  ✗ ${name} — failed\n`);
        failed++;
      }

      processed++;

      if (processed % 50 === 0) {
        saveJSON(HOTELS_PATH, db);
        console.log(`  💾 Saved (${processed} processed)`);
        printCostSoFar();
      }
    }

    printCostSoFar();
  }

  saveJSON(HOTELS_PATH, db);
  console.log('\n  💾 Hotels — final save');
  console.log(`  Enriched: ${enriched}  Skipped: ${skipped}  Failed: ${failed}`);

  return { enriched, skipped, failed };
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════════════════
async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌  ANTHROPIC_API_KEY not found in .env.local');
    process.exit(1);
  }

  const startMs = Date.now();

  const attrStats   = await enrichAttractions();
  const foodStats   = await enrichFood();
  const hotelStats  = await enrichHotels();

  const elapsedSec = ((Date.now() - startMs) / 1000).toFixed(0);

  console.log('\n══════════════════════════════════════════════');
  console.log('DONE');
  console.log(`  Attractions  enriched: ${attrStats.enriched}  skipped: ${attrStats.skipped}  failed: ${attrStats.failed}`);
  console.log(`  Food         enriched: ${foodStats.enriched}  skipped: ${foodStats.skipped}  failed: ${foodStats.failed}`);
  console.log(`  Hotels       enriched: ${hotelStats.enriched}  skipped: ${hotelStats.skipped}  failed: ${hotelStats.failed}`);
  console.log(`  Total tokens : ${totalInputTokens} in / ${totalOutputTokens} out`);
  console.log(`  Estimated cost: $${totalCostUsd.toFixed(4)}`);
  console.log(`  Elapsed      : ${elapsedSec}s`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
