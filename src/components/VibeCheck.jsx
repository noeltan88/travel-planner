/**
 * VibeCheck — Six-fix revision
 *   FIX 1  Scroll-lock all screens (position:fixed, non-passive touchmove)
 *   FIX 2  LIKE/NAH show earlier (15px), larger (36px/700), edge glow
 *   FIX 3  Card flies off correctly via isSwipingRef + setFlyOff state
 *   FIX 4  Background cards zoom proportionally to |dragX|/120
 *   FIX 5  Results screen fits 100dvh without scroll (tight sizing)
 *   FIX 6  Progress bar above stack, remove 👆, swipe-hint on card 0
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

const VIBE_EMOJIS    = VIBE_CATEGORIES.map(c => c.emoji);
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
      if (city?.attractions) city.attractions.forEach(a => out.push({ ...a, cityName: city.name }));
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
    function quality(a) { return (a.photo_url ? 10 : 0) + (a.google_rating > 4.0 ? a.google_rating : 0); }
    function findMatches(pool) {
      return pool.filter(a => !usedIds.has(a.id) && a.vibe_tags?.some(t => cat.tags.includes(t))).sort((a, b) => quality(b) - quality(a));
    }
    let matches = findMatches(primaryPool);
    if (matches.length < 2) {
      const extra = findMatches(fallbackPool).filter(a => !matches.some(m => m.id === a.id));
      matches = [...matches, ...extra];
    }
    shuffle(matches.slice(0, 2)).forEach(a => {
      usedIds.add(a.id);
      cards.push({ ...a, vibeCategory: cat.key, vibeCategoryLabel: cat.label, vibeCategoryEmoji: cat.emoji });
    });
  });
  return cards;
}

// ── VibeCard ───────────────────────────────────────────────────────────────────
function VibeCard({ card, cardIdx, cardTotal, style = {}, dragX = 0, isActive = false }) {
  const absDx = Math.abs(dragX);

  return (
    <div style={{
      position: 'absolute', inset: 0,
      borderRadius: 20, overflow: 'hidden',
      touchAction: 'none',
      ...style,
    }}>
      {/* Full-bleed photo */}
      <div style={{ position: 'absolute', inset: 0 }}>
        <AttractionImage src={card.photo_url || null} alt={card.vibeCategoryLabel} category={card.category} />
      </div>

      {/* Dark gradient */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, transparent 100%)',
      }} />

      {/* FIX 2: single centred LIKE/NAH indicator, no rotation, 42px/800 */}
      {isActive && absDx > 15 && (
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 10, pointerEvents: 'none',
          opacity: Math.min(1, absDx / 80),
        }}>
          <span style={{
            fontSize: 42, fontWeight: 800,
            color: dragX > 0 ? ACC : '#FFFFFF',
            textShadow: '0 3px 12px rgba(0,0,0,0.4)',
          }}>
            {dragX > 0 ? 'LIKE ❤️' : 'NAH ✕'}
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
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(8px)', borderRadius: 20, padding: '3px 10px', marginBottom: 8,
        }}>
          <span style={{ fontSize: 11 }}>{card.vibeCategoryEmoji}</span>
          <span style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{card.vibeCategoryLabel}</span>
        </div>
        <p style={{ fontSize: 22, fontWeight: 500, color: '#fff', margin: '0 0 2px', lineHeight: 1.2 }}>{card.name}</p>
        {card.chinese && <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', margin: '0 0 4px' }}>{card.chinese}</p>}
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', margin: '0 0 6px' }}>
          📍 {card.cityName || ''}{card.district ? ` · ${card.district}` : ''}
        </p>
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

  const [idx,       setIdx]       = useState(0);
  const [scores,    setScores]    = useState({ scenic:0, culture:0, instagrammable:0, shopping:0, local:0, adventure:0 });
  const [phase,     setPhase]     = useState('swiping'); // 'swiping'|'loading'|'results'|'picks'
  const [finalData, setFinalData] = useState(null);

  const [classicMode,  setClassicMode]  = useState(false);
  const [classicVibes, setClassicVibes] = useState([]);
  const [showHint,     setShowHint]     = useState(true);

  // Drag state
  const [dragX,      setDragX]      = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [flyOff,     setFlyOff]     = useState(null); // null | 'right' | 'left' — triggers re-render

  // Refs
  const cardContainerRef  = useRef(null);
  const isDraggingRef     = useRef(false);  // for non-passive touchmove handler
  const isSwipingRef      = useRef(false);  // guard: ignore events while card is flying
  const flyDirectionRef   = useRef(null);   // 'right' | 'left' | null — stale-closure-safe
  const startXRef         = useRef(null);
  const startYRef         = useRef(null);   // for horizontal vs vertical detection
  const touchStartTimeRef = useRef(null);   // for velocity = totalDist / totalTime
  const prevXRef          = useRef(null);
  const prevTRef          = useRef(null);
  const rafRef            = useRef(null);
  const dragXRef          = useRef(0);      // mirrors dragX state — stale-closure-safe

  // Loading animation state
  const [waveIdx,        setWaveIdx]        = useState(-1);
  const [waveDone,       setWaveDone]       = useState(false);
  const [loadTextIdx,    setLoadTextIdx]    = useState(0);
  const [loadTextFadeIn, setLoadTextFadeIn] = useState(true);

  // ── Hint auto-dismiss ──────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setShowHint(false), 3000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── FIX 1: non-passive touchmove → prevents page scroll on horizontal drag ─
  useEffect(() => {
    const container = cardContainerRef.current;
    if (!container) return;
    const handler = (e) => {
      if (startXRef.current === null) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startXRef.current);
      const dy = Math.abs(touch.clientY - (startYRef.current || 0));
      if (dx > dy) e.preventDefault();
    };
    container.addEventListener('touchmove', handler, { passive: false });
    return () => container.removeEventListener('touchmove', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Compute results ────────────────────────────────────────────────────────
  function computeResults(newScores) {
    const sorted  = Object.entries(newScores).sort((a, b) => b[1] - a[1]);
    const topCat  = sorted[0][1] > 0 ? sorted[0][0] : null;
    const top3    = sorted.filter(([, s]) => s > 0).slice(0, 3).map(([k]) => k);
    setFinalData({ vibeArr: top3.length > 0 ? top3 : ['surprise'], topCat, top3, scores: newScores });
    setPhase('loading');
  }

  // ── advanceCard: updates score + idx (captures idx/scores at call time) ──────
  function advanceCard(direction) {
    const love      = direction === 'right';
    const card      = rawCards[idx];
    if (!card) return;
    const newScores = { ...scores, [card.vibeCategory]: (scores[card.vibeCategory] || 0) + (love ? 2 : -1) };
    setScores(newScores);
    const next = idx + 1;
    if (next >= rawCards.length) computeResults(newScores);
    else setIdx(next);
  }

  // ── Button taps: trigger fly-off immediately ───────────────────────────────
  function advance(love) {
    if (isSwipingRef.current) return;
    const dir = love ? 'right' : 'left';
    isSwipingRef.current  = true;
    flyDirectionRef.current = dir;
    setFlyOff(dir); // state update → re-render shows fly-off transform
    const capturedIdx    = idx;
    const capturedScores = scores;
    setTimeout(() => {
      // Use captured values — avoid stale closure from re-renders during timeout
      const capturedCard = rawCards[capturedIdx];
      if (capturedCard) {
        const isLove    = dir === 'right';
        const newScores = { ...capturedScores, [capturedCard.vibeCategory]: (capturedScores[capturedCard.vibeCategory] || 0) + (isLove ? 2 : -1) };
        setScores(newScores);
        const next = capturedIdx + 1;
        if (next >= rawCards.length) computeResults(newScores);
        else setIdx(next);
      }
      isSwipingRef.current    = false;
      flyDirectionRef.current = null;
      setFlyOff(null);
      setDragX(0);
      dragXRef.current = 0;
    }, 350);
  }

  // ── Touch handlers ─────────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    if (isSwipingRef.current) return;
    const t = e.touches[0];
    startXRef.current        = t.clientX;
    startYRef.current        = t.clientY;
    touchStartTimeRef.current = Date.now();
    prevXRef.current         = t.clientX;
    prevTRef.current         = Date.now();
    dragXRef.current         = 0;
  };

  const onTouchMove = (e) => {
    if (startXRef.current === null || isSwipingRef.current) return;
    const t  = e.touches[0];
    const dx = Math.abs(t.clientX - startXRef.current);
    const dy = Math.abs(t.clientY - (startYRef.current || 0));
    if (dx <= dy) return; // vertical gesture — let scroll handle it
    isDraggingRef.current = true;
    if (!isDragging) setIsDragging(true);
    const newDx = t.clientX - startXRef.current;
    dragXRef.current = newDx;
    prevXRef.current = t.clientX;
    prevTRef.current = Date.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setDragX(newDx));
  };

  const onTouchEnd = () => {
    if (startXRef.current === null) return;
    const wasDragging = isDraggingRef.current;
    startXRef.current     = null;
    startYRef.current     = null;
    isDraggingRef.current = false;
    setIsDragging(false); // triggers re-render; flyDirectionRef set below is seen by that render

    if (!wasDragging || isSwipingRef.current) {
      if (!isSwipingRef.current) { setDragX(0); dragXRef.current = 0; }
      return;
    }

    const finalDragX = dragXRef.current; // use ref — not stale state
    const elapsed    = Math.max(1, Date.now() - (touchStartTimeRef.current || Date.now()));
    const velocity   = Math.abs(finalDragX) / elapsed; // total dist / total time
    const shouldSwipe = Math.abs(finalDragX) > 100 || velocity > 0.4;

    if (shouldSwipe && !isSwipingRef.current) {
      isSwipingRef.current    = true;
      flyDirectionRef.current = finalDragX > 0 ? 'right' : 'left';
      // DO NOT reset dragX — card continues in its current direction into the fly-off
      const capturedIdx    = idx;
      const capturedScores = scores;
      setTimeout(() => {
        const capturedCard = rawCards[capturedIdx];
        if (capturedCard) {
          const isLove    = flyDirectionRef.current === 'right';
          const newScores = { ...capturedScores, [capturedCard.vibeCategory]: (capturedScores[capturedCard.vibeCategory] || 0) + (isLove ? 2 : -1) };
          setScores(newScores);
          const next = capturedIdx + 1;
          if (next >= rawCards.length) computeResults(newScores);
          else setIdx(next);
        }
        isSwipingRef.current    = false;
        flyDirectionRef.current = null;
        setFlyOff(null);
        dragXRef.current = 0;
        setDragX(0);
      }, 350);
    } else if (!isSwipingRef.current) {
      dragXRef.current = 0;
      setDragX(0); // snap back — failed swipe
    }
  };

  // ── Mouse handlers (desktop) ───────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (isSwipingRef.current) return;
    e.preventDefault();
    startXRef.current        = e.clientX;
    startYRef.current        = e.clientY;
    touchStartTimeRef.current = Date.now();
    prevXRef.current         = e.clientX;
    prevTRef.current         = Date.now();
    isDraggingRef.current    = true;
    dragXRef.current         = 0;
    setIsDragging(true);
  };
  const onMouseMove = (e) => {
    if (!isDraggingRef.current || startXRef.current === null || isSwipingRef.current) return;
    const newDx = e.clientX - startXRef.current;
    dragXRef.current = newDx;
    prevXRef.current = e.clientX;
    prevTRef.current = Date.now();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setDragX(newDx));
  };
  const onMouseUp = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    onTouchEnd();
  };

  // ── Classic mode toggle ────────────────────────────────────────────────────
  function toggleClassicVibe(key, exclusive) {
    setClassicVibes(prev => {
      if (exclusive) return prev.includes(key) ? [] : [key];
      const withoutExcl = prev.filter(k => !CLASSIC_OPTIONS.find(o => o.key === k)?.exclusive);
      return withoutExcl.includes(key) ? withoutExcl.filter(k => k !== key) : [...withoutExcl, key];
    });
  }

  // ── Reset ──────────────────────────────────────────────────────────────────
  function resetSwipe() {
    setIdx(0); setScores({ scenic:0, culture:0, instagrammable:0, shopping:0, local:0, adventure:0 });
    setPhase('swiping'); setFinalData(null);
    setDragX(0); dragXRef.current = 0;
    setFlyOff(null); flyDirectionRef.current = null;
    isSwipingRef.current = false; isDraggingRef.current = false;
  }

  // ══ CLASSIC MODE ════════════════════════════════════════════════════════════
  if (classicMode) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 0', background: BG, overflowY: 'auto' }}>
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
                  background: sel ? ACC : '#fff', color: sel ? '#fff' : '#1A1A1A',
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
            style={{ width: '100%', height: 52, borderRadius: 28, background: ACC, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
          >
            Continue →
          </button>
        </div>
      </div>
    );
  }

  // ══ PHASE: LOADING ══════════════════════════════════════════════════════════
  if (phase === 'loading') {
    const topCatIdx = finalData?.topCat ? VIBE_CATEGORIES.findIndex(c => c.key === finalData.topCat) : -1;
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
        <style>{`@keyframes vibeLoadBar { from { width: 0px; } to { width: 120px; } }`}</style>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
          {VIBE_EMOJIS.map((em, i) => {
            const isActive = waveDone ? topCatIdx === i : waveIdx === i;
            const isDimmed = waveDone && topCatIdx !== i;
            return (
              <span key={i} style={{
                fontSize: 32, display: 'inline-block',
                transform: isActive ? 'scale(1.3)' : 'scale(1)',
                transition: 'transform 0.2s ease, opacity 0.3s ease, filter 0.3s ease',
                opacity: isDimmed ? 0.4 : 1, filter: isDimmed ? 'grayscale(0.5)' : 'none',
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
          <div style={{ height: '100%', background: ACC, width: 0, animation: `vibeLoadBar ${LOAD_MS}ms ease-in-out forwards` }} />
        </div>
      </div>
    );
  }

  // ══ PHASE: RESULTS — FIX 1 (fixed) + FIX 5 (compact sizing) ══════════════
  if (phase === 'results') {
    const { vibeArr, topCat, scores: sc } = finalData;
    const pers       = topCat ? (PERSONALITY[topCat] || DEFAULT_PERSONALITY) : DEFAULT_PERSONALITY;
    const sortedCats = [...VIBE_CATEGORIES].sort((a, b) => (sc[b.key] || 0) - (sc[a.key] || 0));
    const MAX_POSS   = 4;
    const topTags    = topCat ? (VIBE_CATEGORIES.find(c => c.key === topCat)?.tags || []) : [];
    const topPhoto   = topCat
      ? Object.values(masterDb.cities || {})
          .flatMap(city => city.attractions || [])
          .filter(a => a.photo_url && a.vibe_tags?.some(t => topTags.includes(t)))
          .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0))[0]?.photo_url || null
      : null;

    return (
      /* FIX 1: position fixed, no scroll */
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
        overflow: 'hidden', overscrollBehavior: 'none', background: BG,
        display: 'flex', flexDirection: 'column',
        padding: '20px 20px 0', boxSizing: 'border-box',
      }}>
        {/* FIX 5: photo 70px */}
        {topPhoto && (
          <div style={{ width: 70, height: 70, borderRadius: '50%', border: `3px solid ${ACC}`, overflow: 'hidden', margin: '0 auto 12px', flexShrink: 0 }}>
            <img src={topPhoto} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        )}

        {/* FIX 5: 22px title */}
        <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.2 }}>
          {pers.label}
        </p>
        {/* FIX 5: 13px desc */}
        <p style={{ fontSize: 13, color: '#666', textAlign: 'center', margin: '0 0 12px', lineHeight: 1.5 }}>
          {pers.desc}
        </p>

        <p style={{ fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 8px' }}>
          Your travel vibe breakdown
        </p>

        {/* FIX 5: 8px row gap */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {sortedCats.map(cat => {
            const pct = Math.round(Math.max(0, sc[cat.key] || 0) / MAX_POSS * 100);
            return (
              <div key={cat.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: '#1A1A1A', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {cat.emoji} {cat.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#999', fontWeight: 500 }}>{pct}%</span>
                </div>
                <div style={{ height: 4, background: '#F0F0F0', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: ACC, borderRadius: 2, width: `${pct}%`, transition: 'width 0.6s ease' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* CTAs */}
        <button
          onClick={() => setPhase('picks')}
          style={{ width: '100%', height: 52, borderRadius: 28, background: ACC, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 10, flexShrink: 0 }}
        >
          See my recommendations →
        </button>
        <button
          onClick={resetSwipe}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 13, color: ACC, fontWeight: 500, textAlign: 'center',
            paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))', flexShrink: 0,
          }}
        >
          Retake vibe check
        </button>
      </div>
    );
  }

  // ══ PHASE: TOP PICKS — FIX 1 (fixed outer, scrollable inner) ═══════════════
  if (phase === 'picks') {
    const { vibeArr, topCat } = finalData;
    const catKey  = topCat || vibeArr[0] || 'scenic';
    const catTags = VIBE_CATEGORIES.find(c => c.key === catKey)?.tags || [];
    const picks   = Object.values(masterDb.cities || {})
      .flatMap(city => (city.attractions || []).map(a => ({ ...a, cityName: city.name })))
      .filter(a => a.vibe_tags?.some(t => catTags.includes(t)))
      .sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0))
      .slice(0, 3);

    return (
      /* FIX 1: fixed outer */
      <div style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
        overflow: 'hidden', overscrollBehavior: 'none', background: BG,
        display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
      }}>
        {/* Fixed header */}
        <div style={{ padding: '16px 16px 12px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <button
            onClick={() => setPhase('results')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px 4px 0', fontSize: 20, color: '#1A1A1A', lineHeight: 1 }}
          >←</button>
          <div>
            <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px' }}>Top picks for you</p>
            <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Based on your vibe</p>
          </div>
        </div>

        {/* FIX 1: scrollable list area, height = 100dvh minus header (~60px) + buttons (~80px) */}
        <div style={{ overflowY: 'auto', height: 'calc(100dvh - 140px)', padding: '0 16px' }}>
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

        {/* Fixed bottom buttons */}
        <div style={{ padding: '12px 16px', paddingBottom: 'max(16px, env(safe-area-inset-bottom, 16px))', flexShrink: 0 }}>
          <button
            onClick={() => onComplete(finalData.vibeArr)}
            style={{ width: '100%', height: 52, borderRadius: 28, background: ACC, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500, marginBottom: 10 }}
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

  // ══ PHASE: SWIPING — all fixes applied ══════════════════════════════════════
  const card0 = rawCards[idx];
  const card1 = rawCards[idx + 1];
  const card2 = rawCards[idx + 2];
  if (!card0) return null;

  // Card 2 & 3 scale proportionally to drag distance, snap to full when flying
  const progress = flyOff ? 1 : Math.min(1, Math.abs(dragX) / 120);
  const c1Scale  = 0.95 + 0.05 * progress;
  const c1TY     = 8   - 8  * progress;
  const c2Scale  = 0.90 + 0.05 * progress;
  const c2TY     = 16  - 8  * progress;

  // Active card: fly off to ±150vw when flyOff is set, otherwise follow drag
  const flyX     = flyOff === 'right' ? '150vw' : '-150vw';
  const flyRot   = flyOff === 'right' ? 30 : -30;
  const activeTx  = flyOff ? flyX : `${dragX}px`;
  const activeRot = flyOff ? flyRot : dragX * 0.05;
  const activeOp  = flyOff ? 0 : 1;

  const isLast = idx === rawCards.length - 1;

  return (
    /* FIX 1: position fixed, full viewport, no scroll */
    <div
      style={{
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100dvh',
        overflow: 'hidden', overscrollBehavior: 'none',
        background: BG, display: 'flex', flexDirection: 'column',
        padding: '12px 16px 0', boxSizing: 'border-box',
        userSelect: 'none',
      }}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8, flexShrink: 0 }}>
        <div>
          <p style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px' }}>Vibe Check ✨</p>
          <p style={{ fontSize: 13, color: '#999', margin: 0 }}>Swipe through to find your travel style</p>
        </div>
        <button
          onClick={() => setClassicMode(true)}
          style={{ fontSize: 12, color: ACC, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0', fontWeight: 500, whiteSpace: 'nowrap', marginTop: 4, flexShrink: 0 }}
        >
          Prefer classic? →
        </button>
      </div>

      {/* FIX 6: progress bar */}
      <div style={{ height: 3, background: '#F0F0F0', borderRadius: 2, margin: '0 0 10px', flexShrink: 0 }}>
        <div style={{ height: '100%', background: ACC, borderRadius: 2, width: `${(idx / total) * 100}%`, transition: 'width 300ms ease-out' }} />
      </div>

      {/* Last card banner */}
      {isLast && (
        <div style={{ textAlign: 'center', marginBottom: 6, flexShrink: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: ACC }}>Last one! 🎉 </span>
          <span style={{ fontSize: 12, color: '#999' }}>Almost there.</span>
        </div>
      )}

      {/* ── Card stack ──────────────────────────────────────────────────── */}
      <div
        ref={cardContainerRef}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'visible' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
      >
        {/* Card 3 — back */}
        {card2 && (
          <VibeCard
            card={card2} cardIdx={idx + 2} cardTotal={total}
            style={{
              transform: `scale(${c2Scale}) translateY(${c2TY}px)`,
              transition: isDragging || flyOff ? 'none' : 'transform 0.3s ease-out',
              zIndex: 1,
            }}
          />
        )}

        {/* Card 2 — middle */}
        {card1 && (
          <VibeCard
            card={card1} cardIdx={idx + 1} cardTotal={total}
            style={{
              transform: `scale(${c1Scale}) translateY(${c1TY}px)`,
              transition: isDragging ? 'none' : 'transform 0.3s ease-out',
              zIndex: 2,
            }}
          />
        )}

        {/* Card 1 — active */}
        <VibeCard
          card={card0} cardIdx={idx} cardTotal={total}
          dragX={flyOff ? 0 : dragX}
          isActive={true}
          style={{
            transform: `translateX(${activeTx}) rotate(${activeRot}deg)`,
            transition: flyOff
              ? 'transform 350ms ease-out, opacity 350ms ease-out'
              : isDragging ? 'none' : 'transform 0.2s ease-out',
            opacity: activeOp,
            zIndex: 3,
            cursor: isDragging ? 'grabbing' : 'grab',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          }}
        />

        {/* Hint overlay */}
        {showHint && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 20, borderRadius: 20,
            background: 'rgba(0,0,0,0.52)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>Swipe right to keep →</p>
            <p style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>← Swipe left to skip</p>
            <button
              onClick={e => { e.stopPropagation(); setShowHint(false); }}
              style={{ marginTop: 16, padding: '10px 32px', borderRadius: 28, background: ACC, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}
            >
              Got it
            </button>
          </div>
        )}
      </div>

      {/* ── Buttons — FIX 6: no 👆, swipe-hint on card 0 ─────────────── */}
      <div style={{
        flexShrink: 0, padding: '10px 0',
        paddingBottom: 'max(10px, env(safe-area-inset-bottom, 10px))',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
      }}>
        <div style={{ display: 'flex', gap: 40, alignItems: 'center', justifyContent: 'center' }}>
          {/* Nah */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => advance(false)}
              style={{ width: 56, height: 56, borderRadius: '50%', background: '#fff', border: '1.5px solid #E0E0E0', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', boxShadow: '0 2px 10px rgba(0,0,0,0.07)' }}
            >✕</button>
            <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>Nah</span>
          </div>

          {/* Love it */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => advance(true)}
              style={{ width: 56, height: 56, borderRadius: '50%', background: ACC, border: 'none', cursor: 'pointer', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 18px rgba(232,71,42,0.38)' }}
            >❤️</button>
            <span style={{ fontSize: 12, color: ACC, fontWeight: 500 }}>Love it</span>
          </div>
        </div>

        {/* FIX 6: first-card swipe hint */}
        {idx === 0 && !showHint && (
          <p style={{ fontSize: 12, color: ACC, textAlign: 'center', margin: '6px 0 0', fontWeight: 500 }}>
            Swipe right if you love it
          </p>
        )}
      </div>
    </div>
  );
}
