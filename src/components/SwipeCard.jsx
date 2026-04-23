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
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold text-sm leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {stop.name}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stop.chinese}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {stop.startTime}–{stop.endTime}
                </p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stop.duration_hrs}h</p>
              </div>
            </div>

            {/* Tags row */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}
              >
                {stop.vibe_tags?.[0] || stop.category}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>📍 {stop.district}</span>
              <span
                className="text-xs font-semibold ml-auto"
                style={{ color: stop.free ? 'var(--green)' : 'var(--text-secondary)' }}
              >
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
        {klookLink && (
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
