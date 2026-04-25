/**
 * VibeCheck — Complete redesign
 * Card stack with depth, drag tilt, results breakdown, top picks
 *
 * Phase flow: 'swiping' → 'loading' (1.8s) → 'results' → 'picks' → onComplete()
 */
import { useState, useRef, useMemo, useEffect } from 'react';
import masterDb from '../data/china-master-db-v1.json';
import AttractionImage from './AttractionImage';

// ── Constants ──────────────────────────────────────────────────────────────────
const ACC = '#E8472A';
const BG  = '#F5F4F2';

const VIBE_CATEGORIES = [
  { key: 'scenic',         label: 'Scenic & nature',     tags: ['scenic', 'nature'],    emoji: '🌿' },
  { key: 'culture',        label: 'History & culture',   tags: ['culture', 'history'],  emoji: '🏯' },
  { key: 'instagrammable', label: 'Instagrammable',      tags: ['instagrammable'],      emoji: '📸' },
  { key: 'shopping',       label: 'Shopping & food',     tags: ['shopping', 'food'],    emoji: '🍜' },
  { key: 'local',          label: 'Local & hidden gems', tags: ['local', 'hidden-gem'], emoji: '🗺️' },
  { key: 'adventure',      label: 'Fun & adventure',     tags: ['fun', 'adventure'],    emoji: '⚡' },
];

const VIBE_EMOJIS = VIBE_CATEGORIES.map(c => c.emoji);
const CATEGORY_LABEL = Object.fromEntries(VIBE_CATEGORIES.map(c => [c.key, c.label]));

const CLASSIC_OPTIONS = [
  ...VIBE_CATEGORIES,
  { key: 'surprise', label: 'Surprise me', emoji: '🎲', exclusive: true },
];

const PERSONALITY = {
  scenic:         { label: "You're a Nature Seeker 🌿",     desc: 'You gravitate toward open skies, rivers, and mountain views.' },
  culture:        { label: "You're a Culture Explorer 🏯",   desc: 'History, temples, and local traditions energise you.' },
  instagrammable: { label: "You're a Visual Hunter 📸",      desc: "If it's beautiful, you'll find it — and photograph it." },
  shopping:       { label: "You're a Food & Finds Lover 🍜", desc: 'Markets, street eats, and hidden boutiques are your playground.' },
  local:          { label: "You're a Local at Heart 🗺️",     desc: 'You prefer the road less travelled and real neighbourhood life.' },
  adventure:      { label: "You're a Thrill Chaser ⚡",      desc: 'Cable cars, hot springs, and theme parks — bring it on.' },
};
const DEFAULT_PERSONALITY = {
  label: "You're full of Surprises 🎲",
  desc:  'Your eclectic taste means every trip is an adventure.',
};

const LOAD_TEXTS = ['Crunching your swipes…', 'Reading between the lines…', 'Almost there…'];
const LOAD_MS    = 1800;

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
  const usedIds = new Set();

  VIBE_CATEGORIES.forEach(cat => {
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
    const pair = shuffle(matches.slice(0, 2));
    pair.forEach(a => {
      usedIds.add(a.id);
      cards.push({ ...a, vibeCategory: cat.key, vibeCategoryLabel: cat.label, vibeCategoryEmoji: cat.emoji });
    });
  });

  return cards;
}

// ── VibeCard ───────────────────────────────────────────────────────────────────
function VibeCard({
  card, cardIdx, cardTotal,
  style = {},
  dragX = 0, isActive = false,
  onTouchStart, onTouchMove, onTouchEnd, onMouseDown,
}) {
  const loveAlpha = isActive && dragX > 0 ? Math.min(1, dragX / 80) : 0;
  const nahAlpha  = isActive && dragX < 0 ? Math.min(1, -dragX / 80) : 0;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        borderRadius: 20, overflow: 'hidden',
        touchAction: 'pan-y',
        ...style,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      {/* Full-bleed photo */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <AttractionImage
          src={card.photo_url || null}
          alt={card.vibeCategoryLabel}
          category={card.category}
        />
      </div>

      {/* Dark gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
      }} />

      {/* LIKE label — top-right */}
      {loveAlpha > 0.04 && (
        <div style={{
          position: 'absolute', top: 24, right: 20, zIndex: 10,
          transform: 'rotate(-15deg)', opacity: loveAlpha,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 28, fontWeight: 500, color: ACC, textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            LIKE ❤️
          </span>
        </div>
      )}

      {/* NAH label — top-left */}
      {nahAlpha > 0.04 && (
        <div style={{
          position: 'absolute', top: 24, left: 20, zIndex: 10,
          transform: 'rotate(15deg)', opacity: nahAlpha,
          pointerEvents: 'none',
        }}>
          <span style={{ fontSize: 28, fontWeight: 500, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            NAH ✕
          </span>
        </div>
      )}

      {/* Progress — top-right */}
      <div style={{ position: 'absolute', top: 14, right: 16, zIndex: 5, pointerEvents: 'none' }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 500, textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
          {cardIdx + 1} / {cardTotal}
        </span>
      </div>

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, zIndex: 5, pointerEvents: 'none' }}>
        {/* Category pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(8px)',
          borderRadius: 20, padding: '3px 10px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 11 }}>{card.vibeCategoryEmoji}</span>
          <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{card.vibeCategoryLabel}</span>
        </div>

        {/* Name */}
        <p style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 2px', lineHeight: 1.2 }}>
          {card.name}
        </p>

        {/* Chinese name */}
        {card.chinese && (
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>
            {card.chinese}
          </p>
        )}

        {/* Location */}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 6px' }}>
          📍 {card.cityName || ''}{card.district ? ` · ${card.district}` : ''}
        </p>

        {/* Description — 2 lines max */}
        {card.description && (
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5, margin: 0,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {card.description}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function VibeCheck({ selectedCities, onComplete }) {
  const rawCards = useMemo(() => buildVibeCards(selectedCities), []); // eslint-disable-line react-hooks/exhaustive-deps
  const total    = rawCards.length;

  const [idx,      setIdx]      = useState(0);
  const [scores,   setScores]   = useState({
    scenic: 0, culture: 0, instagrammable: 0, shopping: 0, local: 0, adventure: 0,
  });
  const [phase,     setPhase]     = useState('swiping'); // 'swiping'|'loading'|'results'|'picks'
  const [finalData, setFinalData] = useState(null);

  // Classic mode
  const [classicMode,  setClassicMode]  = useState(false);
  const [classicVibes, setClassicVibes] = useState([]);

  // Hint overlay
  const [showHint, setShowHint] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Drag state
  const [dragX,      setDragX]      = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipingOut, setSwipingOut] = useState(null); // null | 'right' | 'left'

  const startXRef  = useRef(null);
  const prevXRef   = useRef(null);
  const prevTRef   = useRef(null);
  const velRef     = useRef(0);
  const rafRef     = useRef(null);

  // Loading animation state
  const [waveIdx,        setWaveIdx]        = useState(-1);
  const [waveDone,       setWaveDone]       = useState(false);
  const [loadTextIdx,    setLoadTextIdx]    = useState(0);
  const [loadTextFadeIn, setLoadTextFadeIn] = useState(true);

  // ── Loading orchestration ──────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'loading') return;
    setWaveIdx(0); setWaveDone(false);
    let wi = 0;
    const waveTimer = setInterval(() => {
      wi++;
      if (wi >= VIBE_EMOJIS.length) { clearInterval(waveTimer); setWaveDone(true); }
      else setWaveIdx(wi);
    }, 200);
    let ti = 0;
    const textTimer = setInterval(() => {
      setLoadTextFadeIn(false);
      setTimeout(() => { ti = (ti + 1) % LOAD_TEXTS.length; setLoadTextIdx(ti); setLoadTextFadeIn(true); }, 150);
    }, 600);
    const doneTimer = setTimeout(() => {
      clearInterval(waveTimer); clearInterval(textTimer); setPhase('results');
    }, LOAD_MS);
    return () => { clearInterval(waveTimer); clearInterval(textTimer); clearTimeout(doneTimer); };
  }, [phase]);

  // ── Compute final results ──────────────────────────────────────────────────
  function computeResults(newScores) {
    const sorted  = Object.entries(newScores).sort((a, b) => b[1] - a[1]);
    const topCat  = sorted[0][1] > 0 ? sorted[0][0] : null;
    const top3    = sorted.filter(([, s]) => s > 0).slice(0, 3).map(([k]) => k);
    const vibeArr = top3.length > 0 ? top3 : ['surprise'];
    setFinalData({ vibeArr, topCat, top3, scores: newScores });
    setPhase('loading');
  }

  // ── Advance card ──────────────────────────────────────────────────────────
  function advance(love) {
    if (swipingOut) return;
    const card = rawCards[idx];
    if (!card) return;
    const newScores = { ...scores, [card.vibeCategory]: (scores[card.vibeCategory] || 0) + (love ? 2 : -1) };
    setScores(newScores);
    setSwipingOut(love ? 'right' : 'left');
    setTimeout(() => {
      setSwipingOut(null);
      setDragX(0);
      const next = idx + 1;
      if (next >= rawCards.length) computeResults(newScores);
      else setIdx(next);
    }, 310);
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function dragStart(clientX) {
    if (swipingOut || phase !== 'swiping') return;
    startXRef.current = clientX;
    prevXRef.current  = clientX;
    prevTRef.current  = Date.now();
    velRef.current    = 0;
    setIsDragging(true);
  }
  function dragMove(clientX) {
    if (startXRef.current === null) return;
    const now = Date.now();
    const dt  = Math.max(1, now - (prevTRef.current || now));
    velRef.current   = (clientX - prevXRef.current) / dt;
    prevXRef.current = clientX;
    prevTRef.current = now;
    const dx = clientX - startXRef.current;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setDragX(dx));
  }
  function dragEnd() {
    if (startXRef.current === null) return;
    startXRef.current = null;
    setIsDragging(false);
    const dx = dragX;
    if (Math.abs(dx) > 120 || Math.abs(velRef.current) > 0.5) advance(dx > 0);
    else setDragX(0);
  }

  const onTouchStart = e => dragStart(e.touches[0].clientX);
  const onTouchMove  = e => { e.stopPropagation(); dragMove(e.touches[0].clientX); };
  const onTouchEnd   = ()  => dragEnd();
  const onMouseDown  = e => { e.preventDefault(); dragStart(e.clientX); };

  // ── Classic mode toggle ────────────────────────────────────────────────────
  function toggleClassicVibe(key, exclusive) {
    setClassicVibes(prev => {
      if (exclusive) return prev.includes(key) ? [] : [key];
      const withoutExcl = prev.filter(k => !CLASSIC_OPTIONS.find(o => o.key === k)?.exclusive);
      if (withoutExcl.includes(key)) return withoutExcl.filter(k => k !== key);
      return [...withoutExcl, key];
    });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function resetSwipe() {
    setIdx(0);
    setScores({ scenic: 0, culture: 0, instagrammable: 0, shopping: 0, local: 0, adventure: 0 });
    setPhase('swiping');
    setFinalData(null);
    setDragX(0);
    setSwipingOut(null);
  }

  // ══ CLASSIC MODE ════════════════════════════════════════════════════════════
  if (classicMode) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        padding: '16px 16px 0', background: BG, overflowY: 'auto',
      }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: '0 0 8px' }}>
            What kind of experiences do you love?
          </p>
          <button
            onClick={() => setClassicMode(false)}
            style={{ fontSize: 12, color: ACC, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 500 }}
          >
            Try Vibe Check instead →
          </button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
          {CLASSIC_OPTIONS.map(opt => {
            const sel = classicVibes.includes(opt.key);
            return (
              <button
                key={opt.key}
                onClick={() => toggleClassicVibe(opt.key, opt.exclusive)}
                style={{
                  padding: '10px 16px', borderRadius: 20,
                  background: sel ? ACC : '#fff',
                  color: sel ? '#fff' : '#1A1A1A',
                  border: sel ? 'none' : '1px solid #E0E0E0',
                  fontSize: 14, fontWeight: 500, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 6,
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                <span>{opt.emoji}</span><span>{opt.label}</span>
              </button>
            );
          })}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ padding: '16px 0', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))' }}>
          <button
            onClick={() => onComplete(classicVibes.length > 0 ? classicVibes : ['surprise'])}
            style={{
              width: '100%', height: 52, borderRadius: 28,
              background: ACC, color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500,
            }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
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
        background: '#fff',
      }}>
        <style>{`@keyframes vibeLoadBar { from { width: 0px; } to { width: 120px; } }`}</style>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {VIBE_EMOJIS.map((em, i) => {
            const isActive = waveDone ? topCatIdx === i : waveIdx === i;
            const isDimmed = waveDone && topCatIdx !== i;
            return (
              <span key={i} style={{
                fontSize: 32, display: 'inline-block',
                transform:  isActive ? 'scale(1.3)' : 'scale(1)',
                transition: 'transform 0.2s ease, opacity 0.3s ease, filter 0.3s ease',
                opacity:    isDimmed ? 0.4 : 1,
                filter:     isDimmed ? 'grayscale(0.5)' : 'none',
              }}>{em}</span>
            );
          })}
        </div>
        <p style={{ fontSize: 16, fontWeight: 500, color: '#1A1A1A', margin: '0 0 8px' }}>Finding your vibe…</p>
        <p style={{
          fontSize: 12, color: '#999', margin: '0 0 20px',
          opacity: loadTextFadeIn ? 1 : 0, transition: 'opacity 0.15s ease',
          minHeight: 18, textAlign: 'center',
        }}>{LOAD_TEXTS[loadTextIdx]}</p>
        <div style={{ width: 120, height: 3, background: '#F0F0F0', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: ACC, width: 0,
            animation: `vibeLoadBar ${LOAD_MS}ms ease-in-out forwards`,
          }} />
        </div>
      </div>
    );
  }

  // ══ PHASE: RESULTS ══════════════════════════════════════════════════════════
  if (phase === 'results') {
    const { vibeArr, topCat, scores: sc } = finalData;
    const pers       = topCat ? (PERSONALITY[topCat] || DEFAULT_PERSONALITY) : DEFAULT_PERSONALITY;
    const sortedCats = [...VIBE_CATEGORIES].sort((a, b) => (sc[b.key] || 0) - (sc[a.key] || 0));
    const MAX_POSS   = 4; // 2 cards × +2

    // Best photo from top category
    const topTags   = topCat ? (VIBE_CATEGORIES.find(c => c.key === topCat)?.tags || []) : [];
    const topPhoto  = topCat
      ? Object.values(masterDb.cities || {})
          .flatMap(city => (city.attractions || []).map(a => ({ ...a })))
          .filter(a => a.photo_url && a.vibe_tags?.some(t => topTags.includes(t)))
          .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0))[0]?.photo_url || null
      : null;

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: BG, overflowY: 'auto',
        padding: '24px 20px 0',
      }}>
        {/* Circular photo */}
        {topPhoto && (
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            border: `3px solid ${ACC}`, overflow: 'hidden',
            margin: '0 auto 16px', flexShrink: 0,
          }}>
            <img src={topPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* Personality label */}
        <p style={{ fontSize: 26, fontWeight: 500, color: '#1A1A1A', textAlign: 'center', margin: '0 0 8px', lineHeight: 1.2 }}>
          {pers.label}
        </p>
        <p style={{ fontSize: 14, color: '#666', textAlign: 'center', margin: '0 0 24px', lineHeight: 1.5 }}>
          {pers.desc}
        </p>

        {/* Breakdown */}
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 12px' }}>
          Your travel vibe breakdown
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          {sortedCats.map(cat => {
            const score = sc[cat.key] || 0;
            const pct   = Math.round(Math.max(0, score) / MAX_POSS * 100);
            return (
              <div key={cat.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, color: '#1A1A1A', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: ACC, borderRadius: 2,
                    width: `${pct}%`, transition: 'width 0.6s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <button
          onClick={() => setPhase('picks')}
          style={{
            width: '100%', height: 52, borderRadius: 28,
            background: ACC, color: '#fff', border: 'none',
            cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 12,
          }}
        >
          See my recommendations →
        </button>
        <button
          onClick={resetSwipe}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: ACC, fontWeight: 500, textAlign: 'center',
            paddingBottom: 'max(20px, env(safe-area-inset-bottom, 20px))',
          }}
        >
          Retake vibe check
        </button>
      </div>
    );
  }

  // ══ PHASE: TOP PICKS ════════════════════════════════════════════════════════
  if (phase === 'picks') {
    const { vibeArr, topCat } = finalData;
    const catKey  = topCat || vibeArr[0] || 'scenic';
    const catTags = VIBE_CATEGORIES.find(c => c.key === catKey)?.tags || [];

    const picks = Object.values(masterDb.cities || {})
      .flatMap(city => (city.attractions || []).map(a => ({ ...a, cityName: city.name })))
      .filter(a => a.vibe_tags?.some(t => catTags.includes(t)))
      .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0))
      .slice(0, 3);

    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: BG, overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={() => setPhase('results')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 20, color: '#1A1A1A', lineHeight: 1 }}
          >
            ←
          </button>
          <div>
            <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px' }}>Top picks for you</p>
            <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Based on your vibe</p>
          </div>
        </div>

        {/* Picks list */}
        <div style={{ padding: '0 16px', flex: 1 }}>
          {picks.map((a, i) => {
            const catData = VIBE_CATEGORIES.find(c => a.vibe_tags?.some(t => c.tags.includes(t)));
            return (
              <div key={a.id || i}>
                <div style={{ display: 'flex', gap: 12, padding: '14px 0', alignItems: 'flex-start' }}>
                  <div style={{ width: 70, height: 70, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: '#e8e0d5' }}>
                    {a.photo_url
                      ? <img src={a.photo_url} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{catData?.emoji || '🏙️'}</div>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</p>
                    {a.chinese && <p style={{ fontSize: 12, color: '#999', margin: '0 0 2px' }}>{a.chinese}</p>}
                    <p style={{ fontSize: 11, color: '#999', margin: '0 0 6px' }}>📍 {a.cityName}{a.district ? ` · ${a.district}` : ''}</p>
                    {catData && (
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 20, background: ACC, color: '#fff', fontSize: 10, fontWeight: 500 }}>
                        {catData.label}
                      </span>
                    )}
                  </div>
                  <div style={{ flexShrink: 0, paddingTop: 2 }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                    </svg>
                  </div>
                </div>
                {i < picks.length - 1 && <div style={{ height: '0.5px', background: '#EEEBE6' }} />}
              </div>
            );
          })}
        </div>

        {/* Bottom buttons */}
        <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))', flexShrink: 0 }}>
          <button
            onClick={() => onComplete(finalData.vibeArr)}
            style={{
              width: '100%', height: 52, borderRadius: 28,
              background: ACC, color: '#fff', border: 'none',
              cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 12,
            }}
          >
            View full itinerary →
          </button>
          <button
            onClick={resetSwipe}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: ACC, fontWeight: 500, width: '100%', textAlign: 'center' }}
          >
            Start over
          </button>
        </div>
      </div>
    );
  }

  // ══ PHASE: SWIPING ══════════════════════════════════════════════════════════
  const card0 = rawCards[idx];
  const card1 = rawCards[idx + 1];
  const card2 = rawCards[idx + 2];
  if (!card0) return null;

  const progress   = Math.min(1, Math.abs(dragX) / (typeof window !== 'undefined' ? window.innerWidth * 0.4 : 200));
  const c1Scale    = 0.95 + progress * 0.05;
  const c2Scale    = 0.90 + progress * 0.05;
  const isLast     = idx === rawCards.length - 1;

  const activeTx  = swipingOut
    ? (swipingOut === 'right' ? '160vw' : '-160vw')
    : `${dragX}px`;
  const activeRot = swipingOut
    ? (swipingOut === 'right' ? 30 : -30)
    : dragX * 0.05;

  return (
    <div
      style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        background: BG, overflow: 'hidden',
        padding: '12px 16px 0',
        userSelect: 'none',
      }}
      onMouseMove={e => { if (isDragging) dragMove(e.clientX); }}
      onMouseUp={() => { if (isDragging) dragEnd(); }}
      onMouseLeave={() => { if (isDragging) dragEnd(); }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        marginBottom: 10, flexShrink: 0,
      }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px' }}>Vibe Check ✨</p>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Swipe through to find your travel style</p>
        </div>
        <button
          onClick={() => setClassicMode(true)}
          style={{
            fontSize: 12, color: ACC, background: 'none', border: 'none',
            cursor: 'pointer', padding: '4px 0', fontWeight: 500,
            whiteSpace: 'nowrap', marginTop: 4, flexShrink: 0,
          }}
        >
          Prefer classic? →
        </button>
      </div>

      {/* Last card banner */}
      {isLast && (
        <div style={{ textAlign: 'center', marginBottom: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: ACC }}>Last one! 🎉 </span>
          <span style={{ fontSize: 12, color: '#999' }}>Almost there.</span>
        </div>
      )}

      {/* ── Card stack ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative',
        flex: 1,
        minHeight: 0,
        overflow: 'visible',
      }}>
        {/* Card 3 — back */}
        {card2 && (
          <VibeCard
            card={card2}
            cardIdx={idx + 2}
            cardTotal={total}
            style={{
              transform:  `scale(${swipingOut ? 0.95 : c2Scale}) translateY(${swipingOut ? 8 : 16}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              zIndex: 1,
              boxShadow: '0 4px 24px rgba(0,0,0,0.10)',
            }}
          />
        )}

        {/* Card 2 — middle */}
        {card1 && (
          <VibeCard
            card={card1}
            cardIdx={idx + 1}
            cardTotal={total}
            style={{
              transform:  `scale(${swipingOut ? 1 : c1Scale}) translateY(${swipingOut ? 0 : 8}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              zIndex: 2,
              boxShadow: '0 6px 32px rgba(0,0,0,0.12)',
            }}
          />
        )}

        {/* Card 1 — active */}
        <VibeCard
          card={card0}
          cardIdx={idx}
          cardTotal={total}
          dragX={swipingOut ? 0 : dragX}
          isActive={true}
          style={{
            transform:  `translateX(${activeTx}) rotate(${activeRot}deg)`,
            transition: swipingOut
              ? 'transform 0.3s ease-out, opacity 0.3s ease-out'
              : isDragging ? 'none' : 'transform 0.2s ease-out',
            opacity:    swipingOut ? 0 : 1,
            zIndex: 3,
            cursor: isDragging ? 'grabbing' : 'grab',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
        />

        {/* Hint overlay */}
        {showHint && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 20, borderRadius: 20,
              background: 'rgba(0,0,0,0.52)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            onMouseDown={onMouseDown}
          >
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>Swipe right to keep →</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>← Swipe left to skip</p>
            <button
              onClick={e => { e.stopPropagation(); setShowHint(false); }}
              style={{
                marginTop: 16, padding: '10px 32px', borderRadius: 28,
                background: ACC, color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: 500,
              }}
            >
              Got it
            </button>
          </div>
        )}
      </div>

      {/* ── Buttons ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center',
        padding: '12px 0',
        paddingBottom: 'max(12px, env(safe-area-inset-bottom, 12px))',
        flexShrink: 0,
      }}>
        {/* Nah */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => advance(false)}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#fff', border: '1.5px solid #E0E0E0',
              cursor: 'pointer', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#888', boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
            }}
          >✕</button>
          <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>Nah</span>
        </div>

        <span style={{ fontSize: 20, color: '#CCC' }}>👆</span>

        {/* Love it */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => advance(true)}
            style={{
              width: 56, height: 56, borderRadius: '50%',
              background: ACC, border: 'none',
              cursor: 'pointer', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', boxShadow: '0 4px 18px rgba(232,71,42,0.38)',
            }}
          >❤️</button>
          <span style={{ fontSize: 12, color: ACC, fontWeight: 500 }}>Love it</span>
        </div>
      </div>
    </div>
  );
}
