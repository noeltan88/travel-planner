/**
 * VibeCheck — Instagram-style attraction card swiper (quiz step 6)
 *
 * Changes in this version:
 *   Change 2 — Swipe instruction row (← Nah / 👆 / Love it →) below card;
 *              first-time overlay on card 0 with localStorage dismissal.
 *   Change 3 — Cards show ONLY photo + category pill (bottom-left) +
 *              progress "N of 12" (top-right, inside card); no name/city.
 *              Dedup enforced via usedIds Set across all categories.
 *              Results screen: personality label, top-3 coral pills, CTA.
 *   Change 4 — Animated 1.8s loading screen: wave emojis, cycling subtext,
 *              coral progress bar; auto-advances to results.
 *
 * Phase flow: 'swiping' → 'loading' (1.8s) → 'results' → onComplete()
 */
import { useState, useRef, useMemo, useEffect } from 'react';
import masterDb from '../data/china-master-db-v1.json';
import AttractionImage from './AttractionImage';

// ── Constants ──────────────────────────────────────────────────────────────────
const ACC = '#E8472A';

const VIBE_CATEGORIES = [
  { key: 'scenic',         label: 'Scenic & nature',     tags: ['scenic', 'nature'],    emoji: '🌿' },
  { key: 'culture',        label: 'History & culture',   tags: ['culture', 'history'],  emoji: '🏯' },
  { key: 'instagrammable', label: 'Instagrammable',      tags: ['instagrammable'],      emoji: '📸' },
  { key: 'shopping',       label: 'Shopping & food',     tags: ['shopping', 'food'],    emoji: '🍜' },
  { key: 'local',          label: 'Local & hidden gems', tags: ['local', 'hidden-gem'], emoji: '🗺️' },
  { key: 'adventure',      label: 'Fun & adventure',     tags: ['fun', 'adventure'],    emoji: '⚡' },
];

const VIBE_EMOJIS    = VIBE_CATEGORIES.map(c => c.emoji);
const CATEGORY_LABEL = Object.fromEntries(VIBE_CATEGORIES.map(c => [c.key, c.label]));

const PERSONALITY = {
  scenic:         "You're a Nature Seeker 🌿",
  culture:        "You're a Culture Explorer 🏯",
  instagrammable: "You're a Visual Hunter 📸",
  shopping:       "You're a Food & Finds Lover 🍜",
  local:          "You're a Local at Heart 🗺️",
  adventure:      "You're a Thrill Chaser ⚡",
};
const DEFAULT_PERSONALITY = "You're full of Surprises 🎲";

const LOAD_TEXTS  = ['Crunching your swipes…', 'Reading between the lines…', 'Almost there…'];
const LOAD_MS     = 1800;

// ── Helpers ────────────────────────────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildVibeCards(selectedCities) {
  function getAttractions(cityKeys) {
    const out = [];
    cityKeys.forEach(ck => {
      const city = masterDb.cities?.[ck];
      if (city?.attractions) {
        city.attractions.forEach(a => out.push({ ...a, cityName: city.name }));
      }
    });
    return out;
  }

  const allCityKeys  = Object.keys(masterDb.cities || {});
  const primaryKeys  = selectedCities.length > 0 ? selectedCities : allCityKeys;
  const primaryPool  = getAttractions(primaryKeys);
  const fallbackPool = getAttractions(allCityKeys);

  const cards   = [];
  const usedIds = new Set(); // dedup across all categories

  VIBE_CATEGORIES.forEach(cat => {
    function quality(a) {
      return (a.photo_url ? 10 : 0) + (a.google_rating > 4.0 ? a.google_rating : 0);
    }
    // Always filter usedIds to enforce global dedup
    function findMatches(pool) {
      return pool
        .filter(a => !usedIds.has(a.id) && a.vibe_tags?.some(t => cat.tags.includes(t)))
        .sort((a, b) => quality(b) - quality(a));
    }

    let matches = findMatches(primaryPool);
    if (matches.length < 2) {
      const extra = findMatches(fallbackPool).filter(a => !matches.some(m => m.id === a.id));
      matches = [...matches, ...extra];
    }

    // Take top-2, shuffle within pair for variety
    const pair = shuffle(matches.slice(0, 2));
    pair.forEach(a => {
      usedIds.add(a.id); // mark used immediately
      cards.push({ ...a, vibeCategory: cat.key, vibeCategoryLabel: cat.label });
    });
  });

  return cards;
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VibeCheck({ selectedCities, onComplete }) {
  const cards = useMemo(
    () => buildVibeCards(selectedCities),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [idx,    setIdx]    = useState(0);
  const [scores, setScores] = useState({
    scenic: 0, culture: 0, instagrammable: 0, shopping: 0, local: 0, adventure: 0,
  });
  const [fading,  setFading]  = useState(false);
  const [phase,   setPhase]   = useState('swiping'); // 'swiping' | 'loading' | 'results'
  const [finalData, setFinalData] = useState(null);  // { vibeArr, topCat, top3 }

  // Swipe hint overlay — always shows on every VibeCheck load (FIX 3)
  const [showHint, setShowHint] = useState(true);

  // Touch swipe
  const touchRef  = useRef(null);
  const [swipeX,  setSwipeX]  = useState(0);
  const [swiping, setSwiping] = useState(false);

  // Loading screen animation state
  const [waveIdx,        setWaveIdx]        = useState(-1);
  const [waveDone,       setWaveDone]       = useState(false);
  const [loadTextIdx,    setLoadTextIdx]    = useState(0);
  const [loadTextFadeIn, setLoadTextFadeIn] = useState(true);

  // ── Hint auto-dismiss after 3s ─────────────────────────────────────────────
  useEffect(() => {
    if (!showHint) return;
    const t = setTimeout(dismissHint, 3000);
    return () => clearTimeout(t);
  }, [showHint]); // eslint-disable-line react-hooks/exhaustive-deps

  function dismissHint() {
    setShowHint(false);
  }

  // ── Loading screen orchestration ───────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading') return;

    // Wave: advance every 200ms through all 6 emojis
    setWaveIdx(0);
    setWaveDone(false);
    let wi = 0;
    const waveTimer = setInterval(() => {
      wi++;
      if (wi >= VIBE_EMOJIS.length) {
        clearInterval(waveTimer);
        setWaveDone(true);
      } else {
        setWaveIdx(wi);
      }
    }, 200);

    // Cycling subtext: fade out → change → fade in every 600ms
    let ti = 0;
    const textTimer = setInterval(() => {
      setLoadTextFadeIn(false);
      setTimeout(() => {
        ti = (ti + 1) % LOAD_TEXTS.length;
        setLoadTextIdx(ti);
        setLoadTextFadeIn(true);
      }, 150);
    }, 600);

    // Advance to results after LOAD_MS
    const doneTimer = setTimeout(() => {
      clearInterval(waveTimer);
      clearInterval(textTimer);
      setPhase('results');
    }, LOAD_MS);

    return () => {
      clearInterval(waveTimer);
      clearInterval(textTimer);
      clearTimeout(doneTimer);
    };
  }, [phase]);

  // ── Core swipe action ──────────────────────────────────────────────────────
  function advance(love) {
    const card = cards[idx];
    if (!card || fading) return;

    const delta     = love ? 2 : -1;
    const newScores = {
      ...scores,
      [card.vibeCategory]: (scores[card.vibeCategory] || 0) + delta,
    };
    setScores(newScores);
    setSwipeX(0);
    setSwiping(false);
    setFading(true);

    setTimeout(() => {
      const next = idx + 1;
      if (next >= cards.length) {
        // Compute final results
        const sorted = Object.entries(newScores).sort((a, b) => b[1] - a[1]);
        const topCat = sorted[0][1] > 0 ? sorted[0][0] : null;
        const top3   = sorted.filter(([, s]) => s > 0).slice(0, 3).map(([k]) => k);
        const vibeArr = top3.length > 0 ? top3 : ['surprise'];
        setFinalData({ vibeArr, topCat, top3 });
        setPhase('loading');
      } else {
        setIdx(next);
        setFading(false);
      }
    }, 150);
  }

  // ── Touch handlers ─────────────────────────────────────────────────────────
  function onTouchStart(e) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e) {
    if (!touchRef.current) return;
    const dx = e.touches[0].clientX - touchRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.y);
    if (Math.abs(dx) > dy) { setSwiping(true); setSwipeX(dx); }
  }
  function onTouchEnd(e) {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    touchRef.current = null;
    if (Math.abs(dx) > 80) advance(dx > 0);
    else { setSwipeX(0); setSwiping(false); }
  }

  // ══ PHASE: LOADING ══════════════════════════════════════════════════════════
  if (phase === 'loading') {
    const topCatIdx = finalData?.topCat
      ? VIBE_CATEGORIES.findIndex(c => c.key === finalData.topCat)
      : -1;

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fff', gap: 0,
      }}>
        <style>{`
          @keyframes vibeLoadBar { from { width: 0px; } to { width: 120px; } }
        `}</style>

        {/* 6 vibe emojis — wave then settle on top category */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {VIBE_EMOJIS.map((em, i) => {
            const isActive = waveDone ? topCatIdx === i : waveIdx === i;
            const isDimmed = waveDone && topCatIdx !== i;
            return (
              <span
                key={i}
                style={{
                  fontSize:   32,
                  display:    'inline-block',
                  transform:  isActive ? 'scale(1.3)' : 'scale(1)',
                  transition: 'transform 0.2s ease, opacity 0.3s ease, filter 0.3s ease',
                  opacity:    isDimmed ? 0.4 : 1,
                  filter:     isDimmed ? 'grayscale(0.5)' : 'none',
                }}
              >
                {em}
              </span>
            );
          })}
        </div>

        {/* "Finding your vibe..." */}
        <p style={{
          fontSize: 16, fontWeight: 500, color: '#1A1A1A',
          margin: '0 0 8px',
        }}>
          Finding your vibe…
        </p>

        {/* Cycling subtext with fade */}
        <p style={{
          fontSize: 12, color: '#999',
          margin: '0 0 20px',
          opacity:    loadTextFadeIn ? 1 : 0,
          transition: 'opacity 0.15s ease',
          minHeight: 18, textAlign: 'center',
        }}>
          {LOAD_TEXTS[loadTextIdx]}
        </p>

        {/* Coral progress bar — 0→120px over LOAD_MS */}
        <div style={{
          width: 120, height: 3, background: '#F0F0F0', overflow: 'hidden',
        }}>
          <div style={{
            height:     '100%',
            background: ACC,
            width:      0,
            animation:  `vibeLoadBar ${LOAD_MS}ms ease-in-out forwards`,
          }} />
        </div>
      </div>
    );
  }

  // ══ PHASE: RESULTS ══════════════════════════════════════════════════════════
  if (phase === 'results') {
    const { vibeArr, topCat, top3 } = finalData;
    const label    = topCat ? (PERSONALITY[topCat] || DEFAULT_PERSONALITY) : DEFAULT_PERSONALITY;
    const topEmoji = topCat ? (VIBE_CATEGORIES.find(c => c.key === topCat)?.emoji ?? '🎲') : '🎲';

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '0 24px 16px', background: '#fff',
      }}>
        {/* Big emoji */}
        <div style={{ fontSize: 64, lineHeight: 1, marginBottom: 18 }}>
          {topEmoji}
        </div>

        {/* Personality label */}
        <p style={{
          fontSize: 22, fontWeight: 500, color: '#1A1A1A',
          margin: '0 0 8px', textAlign: 'center', lineHeight: 1.3,
        }}>
          {label}
        </p>

        {/* Subtext */}
        <p style={{
          fontSize: 14, color: '#999',
          margin: '0 0 24px', textAlign: 'center',
        }}>
          We'll build your itinerary around this
        </p>

        {/* Top-3 coral category pills */}
        {top3.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 8,
            justifyContent: 'center', marginBottom: 32,
          }}>
            {top3.map(cat => (
              <span
                key={cat}
                style={{
                  padding: '7px 18px', borderRadius: 20,
                  background: ACC, color: '#fff',
                  fontSize: 13, fontWeight: 500,
                }}
              >
                {CATEGORY_LABEL[cat] || cat}
              </span>
            ))}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => onComplete(vibeArr)}
          style={{
            width: '100%', height: 52, borderRadius: 28,
            background: ACC, color: '#fff',
            border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500,
          }}
        >
          Build my itinerary →
        </button>
      </div>
    );
  }

  // ══ PHASE: SWIPING ══════════════════════════════════════════════════════════
  const card      = cards[idx];
  if (!card) return null;

  const rot       = swipeX * 0.03;
  const loveAlpha = Math.max(0, Math.min(1, swipeX / 80));
  const nahAlpha  = Math.max(0, Math.min(1, -swipeX / 80));

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '4px 16px 0',
      overflow: 'hidden', minHeight: 0,
    }}>

      {/* ── Attraction card ─────────────────────────────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width:        '100%',
          maxWidth:     400,
          height:       420,
          borderRadius: 20,
          overflow:     'hidden',
          flexShrink:   0,
          position:     'relative',
          transform:    `translateX(${swipeX}px) rotate(${rot}deg)`,
          transition:   swiping ? 'none'
                        : fading  ? 'opacity 0.15s ease'
                        : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          opacity:      fading ? 0 : 1,
          cursor:       'grab',
          userSelect:   'none',
          touchAction:  'pan-y',
          boxShadow:    '0 8px 32px rgba(0,0,0,0.13)',
        }}
      >
        {/* Full-bleed photo */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <AttractionImage
            src={card.photo_url || null}
            alt={card.vibeCategoryLabel}
            category={card.category}
          />
        </div>

        {/* Subtle gradient for readability of overlaid elements */}
        <div style={{
          position:   'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.18) 0%, transparent 35%, rgba(0,0,0,0.35) 100%)',
        }} />

        {/* Love-it swipe feedback */}
        {loveAlpha > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(232,71,42,${loveAlpha * 0.22})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 64, opacity: loveAlpha, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>
              ❤️
            </span>
          </div>
        )}

        {/* Nah swipe feedback */}
        {nahAlpha > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(0,0,0,${nahAlpha * 0.28})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: 64, opacity: nahAlpha, color: '#fff',
              fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            }}>
              ✕
            </span>
          </div>
        )}

        {/* Progress indicator — top-right inside card (Change 3) */}
        <div style={{ position: 'absolute', top: 12, right: 14, zIndex: 5 }}>
          <span style={{
            fontSize: 12, color: '#fff', fontWeight: 500,
            textShadow: '0 1px 4px rgba(0,0,0,0.6)',
          }}>
            {idx + 1} of {cards.length}
          </span>
        </div>

        {/* Category pill — bottom-left only, no name/city (Change 3) */}
        <div style={{ position: 'absolute', bottom: 16, left: 16, zIndex: 5 }}>
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 20, padding: '3px 10px',
          }}>
            <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>
              {card.vibeCategoryLabel}
            </span>
          </div>
        </div>

        {/* ── First-time hint overlay (card 0 only, localStorage-gated) ─── */}
        {showHint && idx === 0 && (
          <div style={{
            position:   'absolute', inset: 0, zIndex: 20,
            background: 'rgba(0,0,0,0.5)',
            display:    'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
              Swipe right to keep →
            </p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>
              ← Swipe left to skip
            </p>
            <button
              onClick={dismissHint}
              style={{
                marginTop:    16,
                padding:      '10px 32px',
                borderRadius: 28,
                background:   ACC,
                color:        '#fff',
                border:       'none',
                cursor:       'pointer',
                fontSize:     14,
                fontWeight:   500,
              }}
            >
              Got it
            </button>
          </div>
        )}
      </div>

      {/* ── Instruction row — "← Nah / 👆 / Love it →" (Change 2) ────── */}
      <div style={{
        width:          '100%',
        maxWidth:       400,
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        padding:        '10px 6px 0',
        flexShrink:     0,
      }}>
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>← Nah</span>
        <span style={{ fontSize: 16, color: '#CCC' }}>👆</span>
        <span style={{ fontSize: 12, color: ACC, fontWeight: 500 }}>Love it →</span>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────── */}
      <div style={{
        display:    'flex',
        gap:        40,
        alignItems: 'center',
        marginTop:  14,
        flexShrink: 0,
      }}>
        {/* Nah */}
        <button
          onClick={() => advance(false)}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#fff', border: '1.5px solid #E0E0E0',
            cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#888',
            boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
          onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ✕
        </button>

        {/* Love it */}
        <button
          onClick={() => advance(true)}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: ACC, border: 'none',
            cursor: 'pointer', fontSize: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 18px rgba(232,71,42,0.38)',
            transition: 'transform 0.1s ease',
          }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.9)'; }}
          onMouseUp={e   => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
        >
          ❤️
        </button>
      </div>

    </div>
  );
}
