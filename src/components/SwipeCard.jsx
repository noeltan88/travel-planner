import { useState, useRef } from 'react';
import { getKlookLink } from '../utils/affiliateLinks';

export default function SwipeCard({ stop, index, onDelete, onSwapRequest, collapsing }) {
  const [offset, setOffset]    = useState(0);
  const [dragging, setDragging] = useState(false);
  const [tipOpen, setTipOpen]  = useState(false);
  const [imgError, setImgError] = useState(false);

  const startXRef      = useRef(null);
  const startOffsetRef = useRef(0);
  const isDraggingRef  = useRef(false);
  const rafRef         = useRef(null);

  const MAX_REVEAL     = 120;
  const SNAP_THRESHOLD = 80;
  const klookLink      = getKlookLink(stop.id);

  // ── Pointer handlers ────────────────────────────────────────────────────────
  function onPointerDown(e) {
    startXRef.current      = e.clientX;
    startOffsetRef.current = offset;
    isDraggingRef.current  = true;
    setDragging(true);
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (!isDraggingRef.current || startXRef.current === null) return;
    const dx        = e.clientX - startXRef.current;
    const newOffset = Math.max(-MAX_REVEAL, Math.min(0, startOffsetRef.current + dx));
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setOffset(newOffset));
  }

  function onPointerUp() {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    startXRef.current     = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setDragging(false);
    setOffset(prev => (prev < -SNAP_THRESHOLD ? -MAX_REVEAL : 0));
  }

  return (
    <div className={`swipe-card-container ${collapsing ? 'card-collapsing' : ''}`}>

      {/* Action buttons revealed on swipe */}
      <div className="swipe-card-actions">
        <button
          onClick={() => { setOffset(0); setDragging(false); onSwapRequest(stop); }}
          className="flex-1 flex flex-col items-center justify-center gap-1 font-bold text-white text-xs"
          style={{ background: 'var(--swap-bg)' }}
        >
          <span className="text-lg">⇄</span>
          SWAP
        </button>
        <button
          onClick={() => onDelete(stop.id)}
          className="flex-1 flex flex-col items-center justify-center gap-1 font-bold text-white text-xs"
          style={{ background: 'var(--delete-bg)' }}
        >
          <span className="text-lg">🗑</span>
          DELETE
        </button>
      </div>

      {/* Card face — slides left to reveal buttons */}
      <div
        className="swipe-card-face"
        style={{
          transform:   `translateX(${offset}px)`,
          transition:  dragging ? 'none' : 'transform 0.3s ease',
          willChange:  'transform',
          touchAction: 'pan-y',
          userSelect:  'none',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* ── Photo (160px) ───────────────────────────────────────────────── */}
        <div style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
          {stop.photo_url && !imgError ? (
            <img
              src={stop.photo_url}
              alt={stop.name}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 55%, #0f3460 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 44,
            }}>
              {getCategoryIcon(stop.category)}
            </div>
          )}
          {/* Subtle gradient so text above photo reads well */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.28) 0%, transparent 55%)',
          }} />
          {/* Stop number — bottom-left of photo */}
          <div style={{
            position: 'absolute', bottom: 10, left: 12,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--accent)', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 800, color: '#fff',
          }}>
            {index + 1}
          </div>
        </div>

        {/* ── Card content ────────────────────────────────────────────────── */}
        <div style={{ padding: '12px 14px 14px' }}>

          {/* Row 1: name + time */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
            <p style={{
              flex: 1, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
              margin: 0, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis',
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            }}>
              {stop.name}
            </p>
            <p style={{
              fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
              flexShrink: 0, whiteSpace: 'nowrap', marginTop: 1,
            }}>
              {stop.startTime}–{stop.endTime}
            </p>
          </div>

          {/* Row 2: Chinese name */}
          {stop.chinese && (
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 8px' }}>
              {stop.chinese}
            </p>
          )}

          {/* Row 3: vibe tag + district + price */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 600,
              background: 'var(--accent-tint)', color: 'var(--accent)', flexShrink: 0,
            }}>
              {stop.vibe_tags?.[0] || stop.category}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
              📍 {stop.district}
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: 12, fontWeight: 700, flexShrink: 0,
              color: stop.free ? 'var(--green)' : 'var(--text-secondary)',
            }}>
              {stop.free ? 'Free' : `¥${stop.price_rmb}`}
            </span>
          </div>

          {/* Description — always visible */}
          {stop.description && (
            <p style={{
              fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.55,
              margin: '0 0 10px',
            }}>
              {stop.description}
            </p>
          )}

          {/* Collapsible insider tip */}
          {stop.tip && (
            <div>
              <button
                onClick={() => setTipOpen(t => !t)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                💡 Insider tip {tipOpen ? '▲' : '▼'}
              </button>
              {tipOpen && (
                <div style={{
                  marginTop: 8, paddingLeft: 12, fontSize: 12, lineHeight: 1.55,
                  color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent)',
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
              className="klook-btn"
              onClick={e => e.stopPropagation()}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                marginTop: 12, padding: '9px 0', borderRadius: 12,
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

function getCategoryIcon(category) {
  const map = {
    attraction: '🏛️', nature: '🌿', shopping: '🛍️',
    experience: '✨', food: '🍜', nightlife: '🌃',
  };
  return map[category] || '📍';
}
