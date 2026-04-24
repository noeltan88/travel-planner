import { useState } from 'react';
import { QUIZ } from '../utils/quizData';

const LAST_STEP = QUIZ.length - 1;

export default function QuizFlow({ onComplete }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [othersText, setOthersText] = useState('');
  const [comingSoonTapped, setComingSoonTapped] = useState(null);
  const [citySearch, setCitySearch] = useState('');

  const q = QUIZ[step];
  const isLastStep = step === LAST_STEP;
  const isDietary = q.id === 'dietary';
  const isCity = q.id === 'city';
  const selected = answers[q.id] || (q.multi ? [] : null);
  const othersSelected = isDietary && (answers.dietary || []).includes('others');
  const canContinue = q.multi ? selected.length > 0 : selected !== null;

  const visibleOptions = isCity && citySearch.trim()
    ? q.options.filter(opt => opt.name.toLowerCase().includes(citySearch.toLowerCase()))
    : q.options;
  const selectedCityCount = (answers.city || []).length;

  function toggle(value, comingSoon) {
    if (comingSoon) {
      setComingSoonTapped(value);
      return;
    }
    setComingSoonTapped(null);
    if (q.multi) {
      const cur = answers[q.id] || [];
      if (cur.includes(value)) {
        setAnswers({ ...answers, [q.id]: cur.filter(v => v !== value) });
      } else {
        setAnswers({ ...answers, [q.id]: [...cur, value] });
      }
    } else {
      setAnswers({ ...answers, [q.id]: value });
    }
  }

  function handleContinue() {
    if (step < LAST_STEP) {
      setCitySearch('');
      setStep(step + 1);
    } else {
      const flat = {};
      QUIZ.forEach(q => {
        flat[q.id] = q.multi ? (answers[q.id] || []) : answers[q.id];
      });
      if (othersText.trim()) flat.dietaryOthers = othersText.trim();
      onComplete(flat);
    }
  }

  function isSelected(value) {
    if (q.multi) return (answers[q.id] || []).includes(value);
    return answers[q.id] === value;
  }

  return (
    <div className="hero-bg flex flex-col relative overflow-hidden" style={{ height: '100dvh' }}>
      {/* Decorative Chinese character */}
      <div
        className="absolute top-8 right-6 text-[120px] font-black leading-none pointer-events-none select-none"
        style={{ color: 'var(--accent-deco)', opacity: 0.5 }}
      >
        {q.deco}
      </div>

      {/* Progress bar */}
      <div className="px-6 pt-14 pb-4">
        <div className="flex gap-2 mb-2">
          {QUIZ.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }}
            />
          ))}
        </div>
        <p className="text-xs font-semibold tracking-widest" style={{ color: 'var(--accent)' }}>
          {q.label} · {step + 1}/{QUIZ.length}
        </p>
      </div>

      {/* Question */}
      <div className="px-6 pt-2 pb-4">
        <h1 className="text-2xl font-bold text-white leading-tight mb-1">{q.title}</h1>
        <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{q.sub}</p>
      </div>

      {/* City search bar */}
      {isCity && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text"
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              placeholder="Search cities…"
              className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1.5px solid rgba(255,255,255,0.2)',
                color: 'white',
              }}
            />
            {citySearch && (
              <button
                onClick={() => setCitySearch('')}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 18, lineHeight: 1,
                }}
              >×</button>
            )}
          </div>
          <p className="text-xs mt-2 px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {selectedCityCount === 0
              ? 'No cities selected'
              : `${selectedCityCount} ${selectedCityCount === 1 ? 'city' : 'cities'} selected`}
          </p>
        </div>
      )}

      {/* Options */}
      <div className="flex-1 px-4 pb-2 overflow-y-auto flex flex-col gap-3">
        {visibleOptions.map(opt => {
          const sel = isSelected(opt.value);
          const isTappedSoon = comingSoonTapped === opt.value;
          return (
            <div key={opt.value}>
              <button
                onClick={() => toggle(opt.value, opt.comingSoon)}
                className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all duration-200"
                style={{
                  background: opt.comingSoon
                    ? 'rgba(255,255,255,0.03)'
                    : sel ? 'var(--accent-tint)' : 'rgba(255,255,255,0.07)',
                  border: opt.comingSoon
                    ? '2px solid rgba(255,255,255,0.06)'
                    : sel ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.12)',
                  opacity: opt.comingSoon ? 0.5 : 1,
                  cursor: opt.comingSoon ? 'default' : 'pointer',
                }}
              >
                <span className="text-2xl w-8 flex-shrink-0 text-center" style={{ filter: opt.comingSoon ? 'grayscale(1)' : 'none' }}>{opt.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white text-sm">{opt.name}</span>
                    {opt.comingSoon && (
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 10 }}
                      >
                        Coming Soon
                      </span>
                    )}
                  </div>
                  <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                </div>
                {!opt.comingSoon && (
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                    style={{
                      borderColor: sel ? 'var(--accent)' : 'rgba(255,255,255,0.3)',
                      background: sel ? 'var(--accent)' : 'transparent',
                    }}
                  >
                    {sel && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                )}
              </button>

              {/* Coming soon tap message */}
              {isTappedSoon && (
                <div
                  className="mt-1 mx-1 px-3 py-2 rounded-xl text-xs"
                  style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}
                >
                  We're working on it — China is ready now!
                </div>
              )}

              {/* Others free text input */}
              {opt.value === 'others' && sel && (
                <div className="mt-2 px-1">
                  <input
                    type="text"
                    value={othersText}
                    onChange={e => setOthersText(e.target.value)}
                    placeholder="e.g. nut allergy, no shellfish…"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{
                      background: 'rgba(255,255,255,0.12)',
                      border: '1.5px solid rgba(255,255,255,0.25)',
                      color: 'white',
                    }}
                    autoFocus
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Dietary disclaimer */}
        {isDietary && (
          <p className="text-xs px-1 pb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
            Recommendations are based on our research. Always verify with the restaurant directly as dietary information may change.
          </p>
        )}
      </div>

      {/* Navigation */}
      <div className="px-6 pt-2 pb-8 flex gap-3">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <button
          onClick={handleContinue}
          disabled={!canContinue}
          className="flex-1 h-12 rounded-2xl font-bold text-white transition-all duration-200"
          style={{
            background: canContinue ? 'var(--accent)' : 'rgba(255,255,255,0.15)',
            opacity: canContinue ? 1 : 0.6,
          }}
        >
          {isLastStep ? 'Build My Itinerary →' : 'Continue →'}
        </button>
      </div>
    </div>
  );
}
