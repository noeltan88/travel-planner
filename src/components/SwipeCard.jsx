import { useState, useRef } from 'react';
import { getKlookLink } from '../utils/affiliateLinks';

export default function SwipeCard({ stop, index, onDelete, onSwapRequest, collapsing }) {
  const [offset, setOffset] = useState(0);
  const [tipOpen, setTipOpen] = useState(false);
  const startX = useRef(null);
  const isDragging = useRef(false);
  const MAX_REVEAL = 120;
  const SNAP_THRESHOLD = 50;
  const klookLink = getKlookLink(stop.id);

  function onTouchStart(e) {
    startX.current = e.touches[0].clientX;
    isDragging.current = true;
  }

  function onTouchMove(e) {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const newOffset = Math.max(-MAX_REVEAL, Math.min(0, dx + (offset === -MAX_REVEAL ? -MAX_REVEAL : 0)));
    setOffset(newOffset);
  }

  function onTouchEnd() {
    isDragging.current = false;
    if (offset < -SNAP_THRESHOLD) {
      setOffset(-MAX_REVEAL);
    } else {
      setOffset(0);
    }
  }

  // Mouse drag support for desktop
  function onMouseDown(e) {
    startX.current = e.clientX;
    isDragging.current = true;
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUpGlobal);
  }

  function onMouseMove(e) {
    if (!isDragging.current) return;
    const dx = e.clientX - startX.current;
    const newOffset = Math.max(-MAX_REVEAL, Math.min(0, dx + (offset === -MAX_REVEAL ? -MAX_REVEAL : 0)));
    setOffset(newOffset);
  }

  function onMouseUpGlobal() {
    isDragging.current = false;
    setOffset(prev => prev < -SNAP_THRESHOLD ? -MAX_REVEAL : 0);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUpGlobal);
  }

  const revealed = offset <= -MAX_REVEAL;

  return (
    <div className={`swipe-card-container ${collapsing ? 'card-collapsing' : ''}`}>
      {/* Action buttons behind card */}
      <div className="swipe-card-actions">
        <button
          onClick={() => { setOffset(0); onSwapRequest(stop); }}
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
        style={{ transform: `translateX(${offset}px)`, boxShadow: 'var(--shadow-card)' }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
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
            {/* Row 1: name + time (strictly separated columns) */}
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
              {/* Time column — flexShrink:0 + whitespace-nowrap prevents any overlap */}
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

            {/* Row 3: price — bottom right, isolated from time column */}
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
              style={{
                color: 'var(--text-secondary)',
                borderLeft: '3px solid var(--accent)',
              }}
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
