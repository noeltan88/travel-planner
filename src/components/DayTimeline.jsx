import { useState } from 'react';
import SwipeCard from './SwipeCard';
import SwapModal from './SwapModal';
import { getSwapAlternatives } from '../utils/algorithm';

// ── Food row between stops ─────────────────────────────────────────────────────
function FoodBetweenStops({ foodItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{
      margin: '2px 16px 2px',
      padding: '9px 14px',
      background: '#fffbf5',
      borderRadius: 12,
      border: '1px solid rgba(232,71,42,0.1)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0, gap: 8,
        }}
      >
        <span style={{ fontSize: 12, color: '#475569', textAlign: 'left', flex: 1, lineHeight: 1.4 }}>
          🍜{' '}
          <strong style={{ color: '#1a1a2e', fontWeight: 600 }}>{foodItem.name}</strong>
          {foodItem.price_range ? ` · ${foodItem.price_range}` : ''}
          {' · ~5 min walk'}
        </span>
        <span style={{ fontSize: 10, color: '#94a3b8', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {open && (
        <div style={{
          marginTop: 8, paddingTop: 8,
          borderTop: '1px solid rgba(0,0,0,0.05)',
        }}>
          {foodItem.chinese && (
            <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px' }}>
              {foodItem.chinese}
            </p>
          )}
          {foodItem.tip && (
            <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.55, margin: 0 }}>
              {foodItem.tip}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Walking time indicator ─────────────────────────────────────────────────────
function WalkingIndicator({ stop, nextStop }) {
  const sameCluster = stop?.cluster_group &&
    nextStop?.cluster_group &&
    stop.cluster_group === nextStop.cluster_group;
  const mins = sameCluster ? 10 : 25;
  return (
    <div style={{
      textAlign: 'center',
      padding: '3px 0',
      fontSize: 11,
      color: '#94a3b8',
      letterSpacing: 0.2,
    }}>
      🚶 ~{mins} min to next stop
    </div>
  );
}

// ── Main timeline ──────────────────────────────────────────────────────────────
export default function DayTimeline({ stops, dayIdx, onDelete, onSwap, allAttractions, allUsedIds, food = [] }) {
  const [swapStop, setSwapStop]       = useState(null);
  const [collapsingId, setCollapsingId] = useState(null);

  function handleDelete(stopId) {
    setCollapsingId(stopId);
    setTimeout(() => {
      onDelete(dayIdx, stopId);
      setCollapsingId(null);
    }, 350);
  }

  // Use the full cross-day usedIds set if provided; fall back to this day only
  const usedIds      = allUsedIds ?? new Set(stops.map(s => s.id));
  const alternatives = swapStop
    ? getSwapAlternatives(swapStop, allAttractions || [], usedIds, 4)
    : [];

  if (stops.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
        <p style={{ fontSize: 28, marginBottom: 8 }}>🗓️</p>
        <p style={{ fontSize: 13 }}>No stops left for this day</p>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 4 }}>
      {stops.map((stop, i) => (
        <div key={stop.id}>
          {/* Stop card */}
          <div style={{ padding: '0 16px' }}>
            <SwipeCard
              stop={stop}
              index={i}
              onDelete={handleDelete}
              onSwapRequest={stop => setSwapStop(stop)}
              collapsing={collapsingId === stop.id}
            />
          </div>

          {/* Between this stop and the next */}
          {i < stops.length - 1 && (
            <>
              {food[i] && <FoodBetweenStops foodItem={food[i]} />}
              <WalkingIndicator stop={stop} nextStop={stops[i + 1]} />
            </>
          )}
        </div>
      ))}

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
