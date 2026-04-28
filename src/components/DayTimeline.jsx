/**
 * DayTimeline — vertical timeline layout
 *
 * Layout geometry (all px values from the outer div's left edge):
 *   outer padding-left : 16px
 *   timeline line      : left 34px  (width 2px → centre at 35px)
 *   stop badge centre  : 16 + 4 + 14 = 34px  (4px from stop-row left, 28px badge)
 *   card left edge     : 16 + 44 = 60px  (STOP_PADL = 44)
 *
 * Food sections: horizontal scroll row of 3-5 cards per meal slot.
 *   Lunch shown between stop 0 and stop 1.
 *   Dinner shown after the last stop.
 *   Tapping a food card opens a full-detail bottom sheet.
 */
import { useState, useRef, useEffect, useMemo } from 'react';
import SwapModal from './SwapModal';
import AttractionImage from './AttractionImage';
import { getKlookLink } from '../utils/affiliateLinks';
import { getSwapAlternatives } from '../utils/algorithm';
import travelTimes from '../data/travel-times.json';

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT     = '#E8472A';
const TINT       = '#FEF0EC';
const LINE_COL   = '#EEEBE6';
const PAGE_BG    = '#F5F4F2';
const RADIUS     = 14;

// ── Timeline geometry ─────────────────────────────────────────────────────────
const OUTER_PADL = 16;   // outer div left padding
const LINE_LEFT  = 34;   // line left from outer div left (absolute)
const STOP_PADL  = 44;   // paddingLeft on each stop row

// ── Food selection ────────────────────────────────────────────────────────────
function pickMealFoods(stops, slotIndex, allFood, dietary, count = 5) {
  if (!allFood || !allFood.length) return [];

  const stopA    = stops[slotIndex];
  const stopB    = stops[slotIndex + 1]; // undefined for dinner (last slot)
  const clusters = new Set(
    [stopA?.cluster_group, stopB?.cluster_group].filter(Boolean),
  );

  const noRestrictions = !dietary?.length || dietary.includes('none');
  const eligible = allFood.filter(f => {
    if (!f.photo_url) return false;  // skip entries with no photo
    if (noRestrictions) return true;
    if (dietary.includes('halal')       && !f.halal && !f.dietary_tags?.includes('halal-ok')) return false;
    if (dietary.includes('vegetarian')  && !f.dietary_tags?.includes('veg-ok'))               return false;
    if (dietary.includes('pescatarian') &&
        !f.dietary_tags?.includes('seafood-ok') &&
        !f.dietary_tags?.includes('veg-ok'))                                                   return false;
    return true;
  });

  // Shuffle for variety
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);

  // Cluster matches first, then supplement from remaining
  const clusterItems = clusters.size > 0
    ? shuffled.filter(f => f.cluster_group && clusters.has(f.cluster_group))
    : [];
  const clusterIds = new Set(clusterItems.map(f => f.id));
  const others     = shuffled.filter(f => !clusterIds.has(f.id));

  return [...clusterItems, ...others].slice(0, count);
}

// ── StopCard with swipe-to-reveal delete / swap ───────────────────────────────
function StopCard({ stop, index, onDelete, onSwapRequest }) {
  const [offset,        setOffset]        = useState(0);
  const [isDrag,        setIsDrag]        = useState(false);
  const [tipOpen,       setTipOpen]       = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [hintTipOpen,   setHintTipOpen]   = useState(false);

  const startXRef   = useRef(null);
  const startOffRef = useRef(0);
  const draggingRef = useRef(false);
  const rafRef      = useRef(null);

  const MAX_REVEAL     = 120;
  const SNAP_THRESHOLD = 80;
  const klookLink      = getKlookLink(stop.id);

  function onPointerDown(e) {
    startXRef.current   = e.clientX;
    startOffRef.current = offset;
    draggingRef.current = true;
    setIsDrag(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (!draggingRef.current || startXRef.current === null) return;
    const dx     = e.clientX - startXRef.current;
    const newOff = Math.max(-MAX_REVEAL, Math.min(0, startOffRef.current + dx));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setOffset(newOff));
  }

  function onPointerUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    startXRef.current   = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setIsDrag(false);
    setOffset(prev => (prev < -SNAP_THRESHOLD ? -MAX_REVEAL : 0));
  }

  return (
    <div style={{ position: 'relative', borderRadius: RADIUS, overflow: 'hidden' }}>

      {/* ── Revealed action buttons ── */}
      <div style={{
        position: 'absolute', right: 0, top: 0, bottom: 0,
        display: 'flex', width: 120,
      }}>
        <button
          onClick={() => { setOffset(0); setIsDrag(false); onSwapRequest(stop); }}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            border: 'none', cursor: 'pointer',
            background: '#E8472A', color: '#fff',
            fontSize: 10, fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 18 }}>⇄</span>SWAP
        </button>
        <button
          onClick={() => onDelete(stop.id)}
          style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 3,
            border: 'none', cursor: 'pointer',
            background: '#1A1A1A', color: '#fff',
            fontSize: 10, fontWeight: 700,
          }}
        >
          <span style={{ fontSize: 18 }}>🗑</span>DEL
        </button>
      </div>

      {/* ── Card face ── */}
      <div
        style={{
          position: 'relative', zIndex: 1,
          transform: `translateX(${offset}px)`,
          transition: isDrag ? 'none' : 'transform 0.3s ease',
          background: '#fff',
          borderRadius: RADIUS,
          border: `0.5px solid ${LINE_COL}`,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          overflow: 'hidden',
          touchAction: 'pan-y',
          userSelect: 'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Ripple keyframe — local so it's always available regardless of global CSS */}
        <style>{`
          @keyframes ripplePulse {
            0%   { transform: scale(1); opacity: 0.8; }
            100% { transform: scale(3); opacity: 0; }
          }
        `}</style>

        {/* Photo — 165 px tall; overflow:visible so ripple rings aren't clipped */}
        <div style={{ height: 165, position: 'relative', overflow: 'visible' }}>
          {/* Inner clip — keeps photo + gradient inside the 165px frame */}
          <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
            <AttractionImage
              src={stop.photo_url || null}
              alt={stop.name}
              category={stop.category}
              style={{ height: 165 }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 56%)',
            }} />
          </div>

          {(stop.must_see || stop.iconic) && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(4px)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 10, fontWeight: 700, color: '#fff', zIndex: 5,
            }}>
              Iconic
            </div>
          )}

          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(4px)',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 600, color: '#fff', zIndex: 5,
          }}>
            {stop.startTime}
          </div>

          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            width: 26, height: 26, borderRadius: '50%',
            background: ACCENT, border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff', zIndex: 5,
          }}>
            {index + 1}
          </div>

          {/* Ripple hint dot — top-left of photo, overflows visible so rings show */}
          {!hintDismissed && (
            <div
              onClick={e => { e.stopPropagation(); setHintTipOpen(t => !t); }}
              style={{ position: 'absolute', top: 10, left: 10, width: 18, height: 18, zIndex: 10, cursor: 'pointer' }}
            >
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                animation: 'ripplePulse 1.8s ease-out infinite',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: 'rgba(255,255,255,0.9)',
                animation: 'ripplePulse 1.8s ease-out infinite 0.6s',
              }} />
              <div style={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                background: '#FFFFFF', zIndex: 1,
              }} />
            </div>
          )}
        </div>

        {/* Swipe hint tooltip overlay */}
        {!hintDismissed && hintTipOpen && (
          <div
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', inset: 0, zIndex: 10,
              background: 'rgba(0,0,0,0.55)', borderRadius: RADIUS,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '0 20px',
            }}
          >
            <div style={{
              background: '#fff', borderRadius: 14,
              padding: '16px 18px', textAlign: 'center', width: '100%',
            }}>
              <p style={{ fontSize: 13, color: '#1A1A1A', margin: '0 0 12px', lineHeight: 1.5 }}>
                👈 Swipe left to swap or remove this stop
              </p>
              <button
                onClick={() => { setHintTipOpen(false); setHintDismissed(true); }}
                style={{
                  background: ACCENT, color: '#fff', border: 'none',
                  borderRadius: 20, padding: '8px 20px',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Got it
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div style={{ padding: '12px 14px 14px', position: 'relative' }}>

          {/* Name + price */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
            <p style={{
              flex: 1, fontSize: 15, fontWeight: 700, color: '#1A1A1A',
              margin: 0, lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {stop.name}
            </p>
            <span style={{
              fontSize: 13, fontWeight: 700, flexShrink: 0,
              color: stop.free ? '#16a34a' : '#999', marginTop: 1,
            }}>
              {stop.free ? 'Free' : `¥${stop.price_rmb}`}
            </span>
          </div>

          {stop.chinese && (
            <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px' }}>{stop.chinese}</p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            {stop.vibe_tags?.[0] && (
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 20,
                background: TINT, color: ACCENT, fontWeight: 600,
              }}>
                {stop.vibe_tags[0]}
              </span>
            )}
            {stop.district && (
              <span style={{ fontSize: 11, color: '#999' }}>📍 {stop.district}</span>
            )}
          </div>

          {stop.description && (
            <p style={{ fontSize: 12, color: '#999', lineHeight: 1.55, margin: '0 0 10px' }}>
              {stop.description}
            </p>
          )}

          {stop.tip && (
            <div style={{ marginBottom: klookLink && !stop.free ? 12 : 0 }}>
              <button
                onClick={() => setTipOpen(t => !t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: ACCENT,
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                💡 Insider tip {tipOpen ? '▲' : '▼'}
              </button>
              {tipOpen && (
                <div style={{
                  marginTop: 8, background: TINT, borderRadius: 10,
                  padding: '10px 12px', fontSize: 12, color: '#1A1A1A', lineHeight: 1.55,
                }}>
                  {stop.tip}
                </div>
              )}
            </div>
          )}

          {klookLink && !stop.free && (
            <a
              href={klookLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="klook-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: stop.tip ? 0 : 12, padding: '10px 0', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none',
              }}
            >
              🎟️ Book on Klook
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ── FoodMiniCard — compact card in the horizontal scroll row ──────────────────
function FoodMiniCard({ food, onClick }) {
  const category = food.type === 'cafe' ? 'market' : 'food_street';
  return (
    <div
      onClick={onClick}
      style={{
        width: 200, minHeight: 160, flexShrink: 0, scrollSnapAlign: 'start',
        borderRadius: 14,
        background: '#FFF8F2',
        border: '1px solid #FFCFBF',
        borderLeft: `3px solid ${ACCENT}`,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Photo — 80px tall, full width */}
      <div style={{ height: 80, flexShrink: 0, overflow: 'hidden' }}>
        <AttractionImage
          src={food.photo_url || null}
          alt={food.name}
          category={category}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>

      {/* Content */}
      <div style={{ padding: 8, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <p style={{
          fontSize: 13, fontWeight: 500, color: '#1A1A1A', margin: '0 0 2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {food.name}
        </p>
        {formatFoodPrice(food) && (
          <p style={{ fontSize: 11, color: '#999', margin: '0 0 1px' }}>{formatFoodPrice(food)}</p>
        )}
        {(food.type || food.category || food.cuisine) && (
          <p style={{ fontSize: 10, color: '#bbb', margin: '0 0 1px' }}>
            {formatFoodType(food)}
          </p>
        )}
        {food.google_rating != null && (
          <p style={{ fontSize: 11, color: '#999', margin: 0 }}>
            ⭐ {food.google_rating}
            {food.google_review_count ? ` · ${food.google_review_count} reviews` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── FoodSheet — fixed bottom sheet for full food detail ───────────────────────
function FoodSheet({ food, onClose }) {
  const [visible, setVisible] = useState(false);

  // Swipe-down refs
  const sheetRef        = useRef(null);
  const dragStartY      = useRef(0);
  const dragCurrentY    = useRef(0);
  const isDraggingSheet = useRef(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // touchmove must be added via addEventListener with { passive: false }
  // so we can call e.preventDefault() and stop the page from scrolling
  // while the user is dragging the sheet down.
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const handleMove = (e) => {
      if (!isDraggingSheet.current) return;
      const dy = e.touches[0].clientY - dragStartY.current;
      if (dy > 0) {
        e.preventDefault();
        dragCurrentY.current = dy;
        sheet.style.transform = `translateY(${dy}px)`;
      }
    };
    sheet.addEventListener('touchmove', handleMove, { passive: false });
    return () => sheet.removeEventListener('touchmove', handleMove);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function close() { setVisible(false); setTimeout(onClose, 320); }

  function handleTouchStart(e) {
    dragStartY.current      = e.touches[0].clientY;
    isDraggingSheet.current = true;
    if (sheetRef.current) sheetRef.current.style.transition = 'none';
  }

  function handleTouchEnd() {
    isDraggingSheet.current = false;
    const dy = dragCurrentY.current;
    dragCurrentY.current = 0;
    if (dy > 80) {
      // Restore transition so the slide-out animates cleanly
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)';
      }
      close();
    } else {
      // Snap back to fully open
      if (sheetRef.current) {
        sheetRef.current.style.transition = 'transform 200ms ease-out';
        sheetRef.current.style.transform  = 'translateY(0)';
      }
    }
  }

  const category = food.type === 'cafe' ? 'market' : 'food_street';

  return (
    <>
      {/* Overlay — tap outside to dismiss (unchanged) */}
      <div
        onClick={close}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: `rgba(0,0,0,${visible ? 0.4 : 0})`,
          transition: 'background 0.3s ease',
        }}
      />

      {/*
        Outer wrapper — handles translateX(-50%) centering only.
        Never touched by drag logic so centering is never lost.
      */}
      <div style={{
        position:  'fixed',
        bottom:    0,
        left:      '50%',
        width:     '100%',
        maxWidth:  430,
        zIndex:    101,
        transform: 'translateX(-50%)',
      }}>
        {/*
          Inner sheet — handles translateY slide-up animation + drag.
          sheetRef lives here so drag only changes translateY.
        */}
        <div
          ref={sheetRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{
            background:    '#fff',
            borderRadius:  '24px 24px 0 0',
            transform:     `translateY(${visible ? '0%' : '100%'})`,
            transition:    'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
            maxHeight:     '85vh',
            overflowY:     'auto',
          }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px', flexShrink: 0 }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
          </div>

          <div style={{ padding: '0 20px 40px' }}>
            {/* Photo — 180px */}
            <div style={{ height: 180, borderRadius: 14, overflow: 'hidden' }}>
              <AttractionImage
                src={food.photo_url || null}
                alt={food.name}
                category={category}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>

            {/* Name */}
            <p style={{ fontSize: 18, fontWeight: 500, color: '#1A1A1A', margin: '12px 0 0' }}>
              {food.name}
            </p>

            {/* Chinese name */}
            {food.chinese && (
              <p style={{ fontSize: 13, color: '#999', margin: '2px 0 0' }}>{food.chinese}</p>
            )}

            {/* Price range */}
            {formatFoodPrice(food) && (
              <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>{formatFoodPrice(food)}</p>
            )}

            {/* Rating */}
            {food.google_rating && (
              <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
                ⭐ {food.google_rating}
                {food.google_review_count
                  ? ` · ${Number(food.google_review_count).toLocaleString()} reviews`
                  : ''}
              </p>
            )}

            {/* Tip — coral box matching stop cards */}
            {food.tip && (
              <div style={{
                marginTop: 10, background: TINT, borderRadius: 10,
                padding: '10px 12px', fontSize: 13, color: '#1A1A1A', lineHeight: 1.6,
              }}>
                {food.tip}
              </div>
            )}

            {/* Where / description (if no tip) */}
            {!food.tip && food.where && (
              <p style={{ fontSize: 13, color: '#666', lineHeight: 1.6, margin: '10px 0 0' }}>
                {food.where}
              </p>
            )}

            {/* Must order */}
            {food.must_order && (
              <p style={{ fontSize: 12, color: '#666', lineHeight: 1.6, margin: '8px 0 0' }}>
                🍽️ <strong>Must order:</strong> {food.must_order}
              </p>
            )}

            {/* Get directions */}
            {food.lat && food.lng ? (
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${food.lat},${food.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  marginTop: 16,
                  padding: '11px 0',
                  textAlign: 'center',
                  borderRadius: 10,
                  border: `1px solid ${ACCENT}`,
                  color: ACCENT,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                Get directions
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ── FoodRow — meal pill + horizontal scrollable card strip ────────────────────
function FoodRow({ foods, mealLabel }) {
  const [selectedFood, setSelectedFood] = useState(null);

  if (!foods.length) return null;

  return (
    <>
      {/* Meal pill */}
      <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 6px' }}>
        <div style={{
          background: TINT,
          border: `1px solid rgba(232,71,42,0.2)`,
          borderRadius: 20,
          padding: '3px 12px',
          fontSize: 11,
          color: ACCENT,
          fontWeight: 600,
        }}>
          🍽️ {mealLabel}
        </div>
      </div>

      {/* Horizontal scroll row */}
      <div style={{
        display: 'flex',
        overflowX: 'auto',
        scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch',
        gap: 10,
        paddingLeft: STOP_PADL,
        paddingRight: 16,
        paddingBottom: 10,
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}>
        {foods.map(food => (
          <FoodMiniCard
            key={food.id}
            food={food}
            onClick={() => setSelectedFood(food)}
          />
        ))}
      </div>

      {/* Full-detail bottom sheet */}
      {selectedFood && (
        <FoodSheet food={selectedFood} onClose={() => setSelectedFood(null)} />
      )}
    </>
  );
}

// ── FIX 3: Real cluster travel time lookup (mirrors algorithm.js logic) ────────
function getWalkMins(city, stop, nextStop) {
  const cA = stop?.cluster_group    || '_default';
  const cB = nextStop?.cluster_group || '_default';
  if (cA === cB) return 10;
  if (!city) return 25;
  const cityData = travelTimes[city];
  if (!cityData) return 25;
  const pair = cityData[`${cA}→${cB}`] || cityData[`${cB}→${cA}`];
  return pair?.recommended_minutes ?? 25;
}

// ── WalkingPill — subtle pill between stops ───────────────────────────────────
function WalkingPill({ city, stop, nextStop }) {
  const mins = getWalkMins(city, stop, nextStop);
  const sameCluster = (stop?.cluster_group && nextStop?.cluster_group &&
    stop.cluster_group === nextStop.cluster_group);
  const label = sameCluster ? `~${mins} min walk` : `~${mins} min transit`;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
      <div style={{
        background: PAGE_BG, border: `1px solid ${LINE_COL}`,
        borderRadius: 20, padding: '4px 12px',
        fontSize: 10, color: '#999', fontWeight: 500,
      }}>
        {sameCluster ? '🚶' : '🚇'} {label}
      </div>
    </div>
  );
}

// ── FIX 5: Food price + type formatting ────────────────────────────────────────
function formatFoodPrice(food) {
  const raw = food.price_range || food.price_level;
  if (!raw) return null;
  // Already a formatted display string (e.g. "¥50-100pp")
  if (typeof raw === 'string' && raw.startsWith('¥')) return raw;
  const map = {
    budget: '¥20–60pp',  '1': '¥20–60pp',
    mid:    '¥60–150pp', '2': '¥60–150pp', '3': '¥60–150pp',
    luxury: '¥150+pp',   '4': '¥150+pp',
  };
  return map[String(raw)] ?? null;
}

function formatFoodType(food) {
  if (food.cuisine) return food.cuisine;
  const raw = food.type || food.category || '';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DayTimeline({
  stops, dayIdx, onDelete, onSwap,
  allAttractions, allUsedIds,
  allFoodItems = [],   // full city food pool for meal recommendations
  dietary = [],        // dietary prefs from quiz answers
  city = null,         // FIX 3: city key for real travel-time lookups
}) {
  const [swapStop,     setSwapStop]     = useState(null);
  const [collapsingId, setCollapsingId] = useState(null);

  function handleDelete(stopId) {
    setCollapsingId(stopId);
    setTimeout(() => {
      onDelete(dayIdx, stopId);
      setCollapsingId(null);
    }, 350);
  }

  const usedIds      = allUsedIds ?? new Set(stops.map(s => s.id));
  const alternatives = swapStop
    ? getSwapAlternatives(swapStop, allAttractions || [], usedIds, 4)
    : [];

  // Compute meal food selections — memoised to avoid reshuffling on every render
  const lunchFoods = useMemo(
    () => pickMealFoods(stops, 0, allFoodItems, dietary, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops.length, allFoodItems.length, dietary.join(',')],
  );
  const dinnerFoods = useMemo(
    () => pickMealFoods(stops, stops.length - 1, allFoodItems, dietary, 5),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stops.length, allFoodItems.length, dietary.join(',')],
  );

  if (stops.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: '#999' }}>
        <p style={{ fontSize: 28, marginBottom: 8 }}>🗓️</p>
        <p style={{ fontSize: 13 }}>No stops left for this day</p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', padding: `0 ${OUTER_PADL}px`, paddingBottom: 4 }}>

      {/* ── Vertical timeline line ── */}
      <div style={{
        position: 'absolute',
        left: LINE_LEFT,
        top: 28, bottom: 28,
        width: 2,
        background: LINE_COL,
        borderRadius: 2,
      }} />

      {stops.map((stop, i) => (
        <div key={stop.id}>

          {/* ── Stop row ── */}
          <div
            className={collapsingId === stop.id ? 'card-collapsing' : ''}
            style={{ position: 'relative', paddingLeft: STOP_PADL, paddingBottom: 12 }}
          >
            <StopCard
              stop={stop}
              index={i}
              onDelete={handleDelete}
              onSwapRequest={s => setSwapStop(s)}
            />
          </div>

          {/* ── Between stops: Lunch (slot 0 only) + walking pill ── */}
          {i < stops.length - 1 && (
            <>
              {i === 0 && lunchFoods.length > 0 && (
                <FoodRow foods={lunchFoods} mealLabel="Lunch" />
              )}
              <WalkingPill city={city} stop={stop} nextStop={stops[i + 1]} />
            </>
          )}
        </div>
      ))}

      {/* ── Dinner after the last stop ── */}
      {dinnerFoods.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <FoodRow foods={dinnerFoods} mealLabel="Dinner" />
        </div>
      )}

      {/* ── Swap modal ── */}
      {swapStop && (
        <SwapModal
          stop={swapStop}
          alternatives={alternatives}
          onSwap={newStop => { onSwap(dayIdx, swapStop.id, newStop); setSwapStop(null); }}
          onClose={() => setSwapStop(null)}
        />
      )}
    </div>
  );
}
