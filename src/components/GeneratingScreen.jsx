import { useState, useEffect } from 'react';
import masterDb from '../data/china-master-db-v1.json';

const MESSAGES = [
  'Filtering stops by your travel style…',
  'Optimising route to cut backtracking…',
  'Finding the best hotels for your stops…',
  'Adding local food picks & insider tips…',
  'Putting the finishing touches…',
];

export default function GeneratingScreen({ answers }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgIndex(i => (i + 1) % MESSAGES.length);
    }, 1500);
    return () => clearInterval(t);
  }, []);

  // Build city display from masterDb
  const cityIds = Array.isArray(answers?.city)
    ? answers.city
    : (answers?.city ? [answers.city] : []);
  const cityLabels = cityIds.map(id => {
    const c = masterDb.cities?.[id];
    return c ? `${c.emoji || '🏙️'} ${c.name}` : id;
  }).join(' · ');

  const duration = answers?.duration;
  const durationLabel = duration ? `${duration} day${duration === 1 ? '' : 's'}` : '';

  return (
    <div className="hero-bg min-h-screen flex flex-col items-center justify-center px-8 text-center relative overflow-hidden">
      {/* Decorative */}
      <div
        className="absolute top-6 right-4 text-[100px] font-black leading-none pointer-events-none select-none"
        style={{ color: 'rgba(232,71,42,0.06)' }}
      >游</div>

      {/* Plane */}
      <div className="animate-pulse-scale text-6xl mb-6">✈️</div>

      <h2 className="text-2xl font-bold text-white mb-2">Building your itinerary</h2>

      {cityLabels ? (
        <p className="text-base mb-1" style={{ color: 'rgba(255,255,255,0.75)' }}>
          {cityLabels}
        </p>
      ) : null}

      {durationLabel ? (
        <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {durationLabel}
        </p>
      ) : <div className="mb-8" />}

      {/* Bouncing dots */}
      <div className="flex gap-2 mb-10">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className="bounce-dot w-2 h-2 rounded-full"
            style={{ background: 'var(--accent)', animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      {/* Cycling message */}
      <div className="w-full max-w-xs min-h-[2.5rem] flex items-center justify-center">
        <p
          key={msgIndex}
          className="text-sm"
          style={{ color: 'rgba(255,255,255,0.7)' }}
        >
          {MESSAGES[msgIndex]}
        </p>
      </div>
    </div>
  );
}
