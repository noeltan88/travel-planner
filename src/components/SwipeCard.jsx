import { useState, useRef } from 'react';
import { getKlookLink } from '../utils/affiliateLinks';

export default function SwipeCard({ stop, index, onDelete, onSwapRequest, collapsing }) {
  const [offset, setOffset]   = useState(0);
  const [dragging, setDragging] = useState(false); // drives CSS transition only
  const [tipOpen, setTipOpen] = useState(false);

  const startXRef      = useRef(null);
  const startOffsetRef = useRef(0);
  const isDraggingRef  = useRef(false); // ref copy avoids stale closures in handlers
  const rafRef         = useRef(null);

  const MAX_REVEAL     = 120;
  const SNAP_THRESHOLD = 80;
  const klookLink      = getKlookLink(stop.id);

  // ── Pointer handlers ───────────────────────────────────────────

  function onPointerDown(e) {
    startXRef.current      = e.clientX;
    startOffsetRef.current = offset;
    isDraggingRef.current  = true;
    setDragging(true);
    // Capture so we keep events even if the pointer leaves the element
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
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
    // Batch both state updates → single render that applies transition + final position
    setDragging(false);
    setOffset(prev => (prev < -SNAP_THRESHOLD ? -MAX_REVEAL : 0));
  }

  return (
    <div className={`swipe-card-container ${collapsing ? 'card-collapsing' : ''}`}>

      {/* Action buttons behind card */}
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

      {/* Card face */}
      <div
        className="swipe-card-face bg-white rounded-2xl p-4"
        style={{
          transform:               `translateX(${offset}px)`,
          transition:              dragging ? 'none' : 'transform 0.3s ease',
          willChange:              'transform',
          touchAction:             'pan-y',
          WebkitOverflowScrolling: 'touch',
          userSelect:              'none',
          boxShadow:               'var(--shadow-card)',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* Swipe hint */}
        {offset === 0 && (
          <div className="absolute right-3 top-3 text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
            <span>← swipe</span>
          </div>
        )}

        {/* Main row */}
        <div className="flex items-start gap-3">
          {/* Number + icon */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-base"
              style={{ background: 'var(--accent-tint)' }}
            >
              {getCategoryIcon(stop.category)}
            </div>
            <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{index + 1}</span>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Row 1: name + time */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontWeight: 700, fontSize: 13, lineHeight: '1.3',
                  color: 'var(--text-primary)', margin: '0 0 2px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {stop.name}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{stop.chinese}</p>
              </div>
              {/* Time column */}
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 2px', whiteSpace: 'nowrap' }}>
                  {stop.startTime}–{stop.endTime}
                </p>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>{stop.duration_hrs}h</p>
              </div>
            </div>

            {/* Row 2: category tag + district */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20, fontWeight: 600, flexShrink: 0,
                background: 'var(--accent-tint)', color: 'var(--accent)',
              }}>
                {stop.vibe_tags?.[0] || stop.category}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                📍 {stop.district}
              </span>
            </div>

            {/* Row 3: price */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <span style={{
                fontSize: 12, fontWeight: 600,
                color: stop.free ? 'var(--green)' : 'var(--text-secondary)',
              }}>
                {stop.free ? 'Free' : `¥${stop.price_rmb}`}
              </span>
            </div>
          </div>
        </div>

        {/* Insider tip */}
        <div className="mt-3">
          <button
            onClick={() => setTipOpen(!tipOpen)}
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            💡 Insider tip {tipOpen ? '▲' : '▼'}
          </button>
          {tipOpen && (
            <div
              className="mt-2 text-xs leading-relaxed pl-3"
              style={{ color: 'var(--text-secondary)', borderLeft: '3px solid var(--accent)' }}
            >
              {stop.tip}
            </div>
          )}
        </div>

        {/* Klook button */}
        {klookLink && !stop.free && (
          <a
            href={klookLink}
            target="_blank"
            rel="noopener noreferrer"
            className="klook-btn mt-3 w-full py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            🎟️ Book on Klook
          </a>
        )}
      </div>
    </div>
  );
}

function getCategoryIcon(category) {
  const map = {
    attraction: '🏛️', nature: '🌿', shopping: '🛍️', experience: '✨',
    food: '🍜', nightlife: '🌃',
  };
  return map[category] || '📍';
}
