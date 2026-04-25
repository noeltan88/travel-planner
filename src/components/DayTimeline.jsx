/**
 * DayTimeline — vertical timeline layout
 *
 * Layout geometry (all px values from the outer div's left edge):
 *   outer padding-left : 16px
 *   timeline line      : left 34px  (width 2px → centre at 35px)
 *   stop badge centre  : 16 + 4 + 14 = 34px  (4px from stop-row left, 28px badge)
 *   food diamond centre: 16 + 11 + 7 = 34px  (11px from food-row left, 14px diamond)
 *   card left edge     : 16 + 44 = 60px  (STOP_PADL = 44)
 */
import { useState, useRef } from 'react';
import SwapModal from './SwapModal';
import AttractionImage from './AttractionImage';
import { getKlookLink } from '../utils/affiliateLinks';
import { getSwapAlternatives } from '../utils/algorithm';

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT     = '#E8472A';
const TINT       = '#FEF0EC';
const LINE_COL   = '#EEEBE6';
const PAGE_BG    = '#F5F4F2';
const RADIUS     = 14;

// ── Timeline geometry ─────────────────────────────────────────────────────────
const OUTER_PADL             = 16;   // outer div left padding
const LINE_LEFT              = 34;   // line left from outer div left (absolute)
const DIAMOND_LEFT_IN_ROW    = 11;   // food diamond left within food row
const STOP_PADL              = 44;   // paddingLeft on each stop / food row
// Note: no numbered badge on the line — badge lives inside the photo (bottom-left)

// ── StopCard with swipe-to-reveal delete / swap ───────────────────────────────
function StopCard({ stop, index, onDelete, onSwapRequest }) {
  const [offset,  setOffset]  = useState(0);
  const [isDrag,  setIsDrag]  = useState(false);
  const [tipOpen, setTipOpen] = useState(false);

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
            background: '#FF4444', color: '#fff',
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
        {/* Photo — 165 px tall */}
        <div style={{ height: 165, position: 'relative', overflow: 'hidden' }}>
          <AttractionImage
            src={stop.photo_url || null}
            alt={stop.name}
            category={stop.category}
            style={{ height: 165 }}
          />
          {/* Gradient */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.38) 0%, transparent 56%)',
          }} />

          {/* FIX 4: vibe tags live only in the content area below — not on the photo.
               "Iconic" badge top-left is shown only for explicitly iconic stops. */}
          {(stop.must_see || stop.iconic) && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(4px)',
              borderRadius: 20, padding: '3px 10px',
              fontSize: 10, fontWeight: 700, color: '#fff',
            }}>
              Iconic
            </div>
          )}

          {/* Top-right: time badge */}
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(4px)',
            borderRadius: 20, padding: '3px 10px',
            fontSize: 10, fontWeight: 600, color: '#fff',
          }}>
            {stop.startTime}
          </div>

          {/* Bottom-left: stop number badge */}
          <div style={{
            position: 'absolute', bottom: 10, left: 10,
            width: 26, height: 26, borderRadius: '50%',
            background: ACCENT, border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
          }}>
            {index + 1}
          </div>
        </div>

        {/* Content */}
        <div style={{ padding: '12px 14px 14px' }}>

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
              color: stop.free ? '#16a34a' : '#999',
              marginTop: 1,
            }}>
              {stop.free ? 'Free' : `¥${stop.price_rmb}`}
            </span>
          </div>

          {/* Chinese name */}
          {stop.chinese && (
            <p style={{ fontSize: 11, color: '#999', margin: '0 0 8px' }}>
              {stop.chinese}
            </p>
          )}

          {/* Tags: vibe + district (FIX 5: only render district when it exists) */}
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

          {/* Description */}
          {stop.description && (
            <p style={{ fontSize: 12, color: '#999', lineHeight: 1.55, margin: '0 0 10px' }}>
              {stop.description}
            </p>
          )}

          {/* Insider tip */}
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

          {/* Klook booking button */}
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

// ── FoodCard — coral-tinted, expandable ───────────────────────────────────────
function FoodCard({ foodItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      background: TINT,
      border: `0.5px solid rgba(232,71,42,0.18)`,
      borderRadius: RADIUS,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'none', border: 'none', cursor: 'pointer',
          padding: '10px 14px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 8, textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 13, color: '#1A1A1A', lineHeight: 1.4, flex: 1 }}>
          🍜{' '}
          <strong style={{ fontWeight: 600 }}>{foodItem.name}</strong>
          {foodItem.price_range ? ` · ${foodItem.price_range}` : ''}
          {' · ~5 min walk'}
        </span>
        <span style={{ fontSize: 10, color: '#999', flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (foodItem.chinese || foodItem.tip) && (
        <div style={{ padding: '0 14px 10px', borderTop: `0.5px solid rgba(232,71,42,0.12)` }}>
          {foodItem.chinese && (
            <p style={{ fontSize: 11, color: '#999', margin: '8px 0 4px' }}>{foodItem.chinese}</p>
          )}
          {foodItem.tip && (
            <p style={{ fontSize: 12, color: '#1A1A1A', lineHeight: 1.55, margin: 0 }}>
              {foodItem.tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── WalkingPill — subtle pill between stops ───────────────────────────────────
function WalkingPill({ stop, nextStop }) {
  const same = stop?.cluster_group &&
    nextStop?.cluster_group &&
    stop.cluster_group === nextStop.cluster_group;
  const mins = same ? 10 : 25;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
      <div style={{
        background: PAGE_BG, border: `1px solid ${LINE_COL}`,
        borderRadius: 20, padding: '4px 12px',
        fontSize: 10, color: '#999', fontWeight: 500,
      }}>
        🚶 ~{mins} min walk
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function DayTimeline({ stops, dayIdx, onDelete, onSwap, allAttractions, allUsedIds, food = [] }) {
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

          {/* ── Stop row — FIX 3: badge lives only inside photo (bottom-left),
               not duplicated on the timeline line ── */}
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

          {/* ── Between stops: food + walking pill ── */}
          {i < stops.length - 1 && (
            <>
              {food[i] && (
                <div style={{ position: 'relative', paddingLeft: STOP_PADL, paddingBottom: 8 }}>
                  {/* Coral diamond on the line */}
                  <div style={{
                    position: 'absolute',
                    left: DIAMOND_LEFT_IN_ROW,  // 11px → centre = 16+11+7 = 34px ✓
                    top: 10,
                    width: 14, height: 14,
                    background: ACCENT,
                    transform: 'rotate(45deg)',
                    borderRadius: 3,
                    border: `2px solid ${PAGE_BG}`,
                    zIndex: 2,
                  }} />
                  <FoodCard foodItem={food[i]} />
                </div>
              )}
              <WalkingPill stop={stop} nextStop={stops[i + 1]} />
            </>
          )}
        </div>
      ))}

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
