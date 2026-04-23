import { useState } from 'react';
import SwipeCard from './SwipeCard';
import SwapModal from './SwapModal';
import { getSwapAlternatives } from '../utils/algorithm';

export default function DayTimeline({ stops, dayIdx, onDelete, onSwap, allAttractions }) {
  const [swapStop, setSwapStop] = useState(null);
  const [collapsingId, setCollapsingId] = useState(null);

  function handleDelete(stopId) {
    setCollapsingId(stopId);
    setTimeout(() => {
      onDelete(dayIdx, stopId);
      setCollapsingId(null);
    }, 350);
  }

  function handleSwapRequest(stop) {
    setSwapStop(stop);
  }

  function handleSwapConfirm(newStop) {
    onSwap(dayIdx, swapStop.id, newStop);
    setSwapStop(null);
  }

  const usedIds = new Set(stops.map(s => s.id));
  const alternatives = swapStop
    ? getSwapAlternatives(swapStop, allAttractions || [], usedIds)
    : [];

  return (
    <div className="px-4 pb-2">
      {stops.length === 0 ? (
        <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
          <p className="text-3xl mb-2">🗓️</p>
          <p className="text-sm">No stops left for this day</p>
        </div>
      ) : (
        stops.map((stop, i) => (
          <SwipeCard
            key={stop.id}
            stop={stop}
            index={i}
            onDelete={handleDelete}
            onSwapRequest={handleSwapRequest}
            collapsing={collapsingId === stop.id}
          />
        ))
      )}

      {swapStop && (
        <SwapModal
          stop={swapStop}
          alternatives={alternatives}
          onSwap={handleSwapConfirm}
          onClose={() => setSwapStop(null)}
        />
      )}
    </div>
  );
}
