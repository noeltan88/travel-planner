/**
 * VibeCheck — Instagram-style attraction card swiper for the quiz Vibe step.
 *
 * Shows 12 cards (2 per category × 6 categories), sourced from the selected
 * cities' attraction pool. User taps ❤️ Love it / ✕ Nah — or swipes — on each.
 *
 * Scoring:
 *   Love it → +2 to that category
 *   Nah     → −1 to that category
 *
 * After all 12: shows a 1-second "Finding your vibe…" pulse,
 * then calls onComplete(vibeArray) where vibeArray is every category with score > 0
 * (or ['surprise'] if all scores are 0 or negative).
 */
import { useState, useRef, useMemo } from 'react';
import masterDb from '../data/china-master-db-v1.json';
import AttractionImage from './AttractionImage';

// ── Category definitions ───────────────────────────────────────────────────────
const VIBE_CATEGORIES = [
  { key: 'scenic',         label: 'Scenic & nature',     tags: ['scenic', 'nature'] },
  { key: 'culture',        label: 'History & culture',   tags: ['culture', 'history'] },
  { key: 'instagrammable', label: 'Instagrammable',      tags: ['instagrammable'] },
  { key: 'shopping',       label: 'Shopping & food',     tags: ['shopping', 'food'] },
  { key: 'local',          label: 'Local & hidden gems', tags: ['local', 'hidden-gem'] },
  { key: 'adventure',      label: 'Fun & adventure',     tags: ['fun', 'adventure'] },
];

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

  const allCityKeys    = Object.keys(masterDb.cities || {});
  const primaryKeys    = selectedCities.length > 0 ? selectedCities : allCityKeys;
  const primaryPool    = getAttractions(primaryKeys);
  const fallbackPool   = getAttractions(allCityKeys);

  const cards  = [];
  const usedIds = new Set();

  VIBE_CATEGORIES.forEach(cat => {
    // Score: prefer photo + high rating
    function quality(a) {
      return (a.photo_url ? 10 : 0) + (a.google_rating > 4.0 ? a.google_rating : 0);
    }
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

    // Take top-2, shuffle within the pair so order varies each run
    const pair = shuffle(matches.slice(0, 2));
    pair.forEach(a => {
      usedIds.add(a.id);
      cards.push({ ...a, vibeCategory: cat.key, vibeCategoryLabel: cat.label });
    });
  });

  return cards;
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function VibeCheck({ selectedCities, onComplete }) {
  // Build card deck once (stable across re-renders)
  const cards = useMemo(
    () => buildVibeCards(selectedCities),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [idx,    setIdx]    = useState(0);
  const [scores, setScores] = useState({
    scenic: 0, culture: 0, instagrammable: 0, shopping: 0, local: 0, adventure: 0,
  });
  const [fading,  setFading]  = useState(false);
  const [done,    setDone]    = useState(false);

  // Touch-swipe tracking
  const touchRef  = useRef(null);
  const [swipeX,  setSwipeX]  = useState(0);
  const [swiping, setSwiping] = useState(false);

  // ── Core action ─────────────────────────────────────────────────────────────
  function advance(love) {
    const card = cards[idx];
    if (!card || fading) return;

    const delta     = love ? 2 : -1;
    const newScores = { ...scores, [card.vibeCategory]: (scores[card.vibeCategory] || 0) + delta };
    setScores(newScores);
    setSwipeX(0);
    setSwiping(false);
    setFading(true);

    setTimeout(() => {
      const next = idx + 1;
      if (next >= cards.length) {
        setDone(true);
        // 1-second "Finding your vibe…" then fire onComplete
        setTimeout(() => {
          const vibeArr = Object.entries(newScores)
            .filter(([, s]) => s > 0)
            .map(([k]) => k);
          onComplete(vibeArr.length > 0 ? vibeArr : ['surprise']);
        }, 1200);
      } else {
        setIdx(next);
        setFading(false);
      }
    }, 150);
  }

  // ── Touch handlers ───────────────────────────────────────────────────────────
  function onTouchStart(e) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }
  function onTouchMove(e) {
    if (!touchRef.current) return;
    const dx = e.touches[0].clientX - touchRef.current.x;
    const dy = Math.abs(e.touches[0].clientY - touchRef.current.y);
    if (Math.abs(dx) > dy) {
      setSwiping(true);
      setSwipeX(dx);
    }
  }
  function onTouchEnd(e) {
    if (!touchRef.current) return;
    const dx = e.changedTouches[0].clientX - touchRef.current.x;
    touchRef.current = null;
    if (Math.abs(dx) > 80) {
      advance(dx > 0); // swipe right = Love it, swipe left = Nah
    } else {
      setSwipeX(0);
      setSwiping(false);
    }
  }

  // ── "Finding your vibe…" completion screen ──────────────────────────────────
  if (done) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
      }}>
        <style>{`
          @keyframes vibePulse {
            0%, 100% { transform: scale(1);   opacity: 0.18; }
            50%       { transform: scale(1.6); opacity: 0.08; }
          }
        `}</style>
        <div style={{ position: 'relative', width: 52, height: 52 }}>
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            background: '#E8472A',
            animation: 'vibePulse 1.1s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: 10, borderRadius: '50%',
            background: '#E8472A',
          }} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
          Finding your vibe…
        </p>
      </div>
    );
  }

  const card = cards[idx];
  if (!card) return null;

  // Derived animation values
  const rot       = swipeX * 0.03;
  const loveAlpha = Math.max(0, Math.min(1, swipeX / 80));
  const nahAlpha  = Math.max(0, Math.min(1, -swipeX / 80));

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '4px 16px 0',
      overflow: 'hidden', minHeight: 0,
    }}>

      {/* ── Card progress indicator ─────────────────────────────────────── */}
      <div style={{
        width: '100%', display: 'flex', justifyContent: 'flex-end',
        marginBottom: 8, flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
          {idx + 1} of {cards.length}
        </span>
      </div>

      {/* ── Attraction card ─────────────────────────────────────────────── */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{
          width:           '100%',
          maxWidth:        400,
          height:          420,
          borderRadius:    20,
          overflow:        'hidden',
          flexShrink:      0,
          position:        'relative',
          transform:       `translateX(${swipeX}px) rotate(${rot}deg)`,
          transition:      swiping ? 'none'
                           : fading ? 'opacity 0.15s ease'
                           : 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          opacity:         fading ? 0 : 1,
          cursor:          'grab',
          userSelect:      'none',
          touchAction:     'pan-y',
          boxShadow:       '0 8px 32px rgba(0,0,0,0.13)',
        }}
      >
        {/* Photo */}
        <div style={{ position: 'absolute', inset: 0 }}>
          <AttractionImage
            src={card.photo_url || null}
            alt={card.name}
            category={card.category}
          />
        </div>

        {/* Dark gradient overlay */}
        <div style={{
          position:   'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 48%, rgba(0,0,0,0.72) 100%)',
        }} />

        {/* Love-it swipe overlay */}
        {loveAlpha > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(232,71,42,${loveAlpha * 0.22})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 64, opacity: loveAlpha, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.3))' }}>❤️</span>
          </div>
        )}

        {/* Nah swipe overlay */}
        {nahAlpha > 0 && (
          <div style={{
            position: 'absolute', inset: 0,
            background: `rgba(0,0,0,${nahAlpha * 0.25})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ fontSize: 64, opacity: nahAlpha, color: '#fff', fontWeight: 700, textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>✕</span>
          </div>
        )}

        {/* Bottom content */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 16px 18px' }}>
          {/* Category pill */}
          <div style={{
            display: 'inline-flex',
            background: 'rgba(255,255,255,0.92)',
            borderRadius: 20, padding: '3px 10px',
            marginBottom: 8,
          }}>
            <span style={{ fontSize: 11, color: '#1A1A1A', fontWeight: 500 }}>
              {card.vibeCategoryLabel}
            </span>
          </div>
          {/* Name */}
          <p style={{
            fontSize: 20, fontWeight: 500, color: '#fff',
            margin: '0 0 3px', lineHeight: 1.25,
            textShadow: '0 1px 6px rgba(0,0,0,0.35)',
          }}>
            {card.name}
          </p>
          {/* City */}
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', margin: 0 }}>
            {card.cityName}
          </p>
        </div>
      </div>

      {/* ── Action buttons ──────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 40, alignItems: 'center',
        marginTop: 22, flexShrink: 0,
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
            background: '#E8472A', border: 'none',
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

      {/* Hint */}
      <p style={{
        fontSize: 12, color: '#CCC', marginTop: 10,
        textAlign: 'center', flexShrink: 0,
      }}>
        Swipe or tap to choose
      </p>
    </div>
  );
}
