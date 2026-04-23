import { useState, useEffect } from 'react';

const STEPS = [
  'Filtering stops by your travel style',
  'Optimising route to cut backtracking',
  'Finding best-located hotel for your stops',
  'Adding local food picks & insider tips',
];

const CITY_LABELS = {
  guangzhou: 'Guangzhou 广州',
  shenzhen: 'Shenzhen 深圳',
  shanghai: 'Shanghai 上海',
  'gz-sz': 'Guangzhou + Shenzhen',
  all: 'All 3 Cities',
};

export default function GeneratingScreen({ answers }) {
  const [activeStep, setActiveStep] = useState(0);
  const [doneSteps, setDoneSteps] = useState([]);

  useEffect(() => {
    STEPS.forEach((_, i) => {
      setTimeout(() => {
        setActiveStep(i);
        if (i > 0) setDoneSteps(prev => [...prev, i - 1]);
      }, i * 750);
    });
    setTimeout(() => {
      setDoneSteps([0, 1, 2, 3]);
    }, STEPS.length * 750 + 200);
  }, []);

  const cityLabel = CITY_LABELS[answers?.city] || 'Your Destination';
  const durationMap = { 2: '2–3 days', 4: '4–5 days', 6: '6–7 days', 8: '8–10 days', 12: '10–14 days' };
  const durationLabel = durationMap[answers?.duration] || `${answers?.duration} days`;

  return (
    <div className="hero-bg min-h-screen flex flex-col items-center justify-center px-8 text-center relative overflow-hidden">
      {/* Decorative */}
      <div
        className="absolute top-6 right-4 text-[100px] font-black leading-none pointer-events-none select-none"
        style={{ color: 'rgba(232,71,42,0.06)' }}
      >游</div>

      {/* Plane */}
      <div className="animate-pulse-scale text-6xl mb-6">✈️</div>

      <h2 className="text-2xl font-bold text-white mb-1">Building your itinerary</h2>
      <p className="text-base mb-2" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {cityLabel}
      </p>
      <p className="text-sm mb-8" style={{ color: 'rgba(255,255,255,0.5)' }}>
        {durationLabel}
      </p>

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

      {/* Steps */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const done = doneSteps.includes(i);
          const active = activeStep === i && !done;
          return (
            <div
              key={i}
              className="flex items-center gap-3 transition-all duration-500"
              style={{ opacity: i <= activeStep ? 1 : 0.3 }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300"
                style={{
                  background: done ? 'var(--accent)' : active ? 'rgba(232,71,42,0.3)' : 'rgba(255,255,255,0.1)',
                  border: active ? '2px solid var(--accent)' : 'none',
                }}
              >
                {done ? (
                  <svg className="step-done" width="12" height="10" viewBox="0 0 12 10" fill="none">
                    <path d="M1 5L4.5 8.5L11 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                ) : active ? (
                  <div className="w-2 h-2 rounded-full bg-white" />
                ) : null}
              </div>
              <span className="text-sm text-left" style={{ color: done || active ? 'white' : 'rgba(255,255,255,0.4)' }}>
                {step}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
