import { useState, useEffect, useMemo } from 'react';
import { QUIZ } from '../utils/quizData';

const HOLIDAYS = [
  { name: 'Chinese New Year 2026',         start: '2026-01-28', end: '2026-02-04' },
  { name: 'Qingming Festival 2026',        start: '2026-04-04', end: '2026-04-06' },
  { name: 'May Day Golden Week 2026',      start: '2026-05-01', end: '2026-05-05' },
  { name: 'Dragon Boat Festival 2026',     start: '2026-05-28', end: '2026-05-30' },
  { name: 'National Day Golden Week 2026', start: '2026-10-01', end: '2026-10-07' },
  { name: 'Chinese New Year 2027',         start: '2027-02-15', end: '2027-02-22' },
  { name: 'May Day Golden Week 2027',      start: '2027-05-01', end: '2027-05-05' },
  { name: 'National Day Golden Week 2027', start: '2027-10-01', end: '2027-10-07' },
];

const today = new Date().toISOString().split('T')[0];

const AGE_GROUPS = [
  { icon: '👶', label: '0–3',  value: '0-3'  },
  { icon: '🧒', label: '4–7',  value: '4-7'  },
  { icon: '👦', label: '8–12', value: '8-12' },
  { icon: '🧑', label: '13+',  value: '13+'  },
];

const LAST_STEP = QUIZ.length - 1;
const ACC       = '#E8472A';

// ── Calendar helpers ─────────────────────────────────────────────
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function formatDateDisplay(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${M[m - 1]} ${y}`;
}

function MonthGrid({ year, month, today, dep, ret, onDayClick }) {
  const firstDow    = new Date(year, month, 1).getDay();
  const startPad    = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const ACC_TINT = 'rgba(232,71,42,0.18)';

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{ textAlign: 'center', fontWeight: 700, color: 'white', marginBottom: 10, fontSize: 14, letterSpacing: '0.01em' }}>
        {MONTH_NAMES[month]} {year}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.3)', paddingBottom: 6, fontWeight: 600 }}>
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`p${idx}`} style={{ height: 36 }} />;
          const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const isPast     = dateStr < today;
          const isDep      = dateStr === dep;
          const isRet      = dateStr === ret;
          const inRange    = dep && ret && dateStr > dep && dateStr < ret;
          const isSelected = isDep || isRet;
          return (
            <div
              key={day}
              onClick={() => !isPast && onDayClick(dateStr)}
              style={{ height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: isPast ? 'default' : 'pointer' }}
            >
              {isDep && ret  && <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', right: 0, background: ACC_TINT, zIndex: 0 }} />}
              {isRet && dep  && <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: '50%', background: ACC_TINT, zIndex: 0 }} />}
              {inRange       && <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: 0, background: ACC_TINT, zIndex: 0 }} />}
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: isSelected ? ACC : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isPast ? 'rgba(255,255,255,0.2)' : isSelected ? 'white' : 'rgba(255,255,255,0.85)' }}>
                  {day}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineCalendar({ dep, ret, today, onDayTap }) {
  const yr0 = Number(today.slice(0, 4));
  const mo0 = Number(today.slice(5, 7)) - 1;
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = mo0 + i;
    return { year: yr0 + Math.floor(m / 12), month: m % 12 };
  });
  return (
    <div>
      {months.map(({ year, month }) => (
        <MonthGrid key={`${year}-${month}`} year={year} month={month} today={today} dep={dep} ret={ret} onDayClick={onDayTap} />
      ))}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────

function parseTimePeriod(timeStr) {
  if (!timeStr) return null;
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (isNaN(hour)) return null;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

function FlightTimeInput({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 56, padding: '0 16px', borderRadius: 12, marginBottom: 16,
      background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)',
      boxSizing: 'border-box', cursor: 'pointer',
    }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.7)', flexShrink: 0, marginRight: 12 }}>
        {label}
      </span>
      <input
        type="time"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: value ? 'white' : 'rgba(255,255,255,0.35)',
          fontSize: 16, fontWeight: 700, textAlign: 'right',
          colorScheme: 'dark', minWidth: 80,
          WebkitAppearance: 'none',
        }}
      />
    </label>
  );
}

export default function QuizFlow({ onComplete }) {
  const [step,            setStep]           = useState(0);
  const [answers,         setAnswers]         = useState({ country: 'china' });
  const [othersText,      setOthersText]      = useState('');
  const [comingSoonTapped,setComingSoonTapped]= useState(null);
  const [citySearch,      setCitySearch]      = useState('');
  // Date screen tabs + calendar sheet
  const [dateTab,         setDateTab]         = useState('dates');
  const [calendarOpen,    setCalendarOpen]    = useState(false);

  const q           = QUIZ[step];
  const isLastStep  = step === LAST_STEP;
  const isDietary   = q.id === 'dietary';
  const isCity      = q.id === 'city';
  const isDateRange = q.type === 'daterange';
  const isGroupQ    = q.id === 'group';
  const isFamilyKids= answers.group === 'family-kids';
  const selected    = answers[q.id] || (q.multi ? [] : null);

  // Auto-select "No restrictions" on dietary step
  useEffect(() => {
    if (QUIZ[step]?.id !== 'dietary') return;
    if ((answers.dietary || []).length === 0) setAnswers(a => ({ ...a, dietary: ['none'] }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Date range derived state
  const datesAnswer = answers.dates || {};
  const dep         = datesAnswer.departure || '';
  const ret         = datesAnswer.return    || '';
  const totalDays   = dep && ret ? Math.round((new Date(ret) - new Date(dep)) / 86400000) + 1 : 0;
  const dateError   = dep && ret && dep >= ret;
  const overlappingHolidays = useMemo(() => {
    if (!dep || !ret || dateError) return [];
    return HOLIDAYS.filter(h => dep <= h.end && ret >= h.start);
  }, [dep, ret, dateError]);

  const canContinue = isDateRange
    ? Boolean(dep && ret && !dateError && totalDays >= 1)
    : q.multi ? selected.length > 0 : selected !== null;

  const visibleOptions    = isCity && citySearch.trim()
    ? q.options.filter(opt => opt.name.toLowerCase().includes(citySearch.toLowerCase()))
    : q.options;
  const selectedCityCount = (answers.city || []).length;

  function updateDate(field, value) {
    setAnswers(prev => ({ ...prev, dates: { ...(prev.dates || {}), [field]: value } }));
  }

  function handleDayTap(dateStr) {
    if (dateStr < today) return;
    if (!dep) {
      setAnswers(prev => ({ ...prev, dates: { departure: dateStr, return: '' } }));
    } else if (!ret) {
      if (dateStr === dep) {
        setAnswers(prev => ({ ...prev, dates: { departure: '', return: '' } }));
      } else if (dateStr < dep) {
        setAnswers(prev => ({ ...prev, dates: { departure: dateStr, return: '' } }));
      } else {
        updateDate('return', dateStr);
        setCalendarOpen(false); // auto-close when both dates picked
      }
    } else {
      setAnswers(prev => ({ ...prev, dates: { departure: dateStr, return: '' } }));
    }
  }

  function toggleKidsAge(value) {
    const cur = answers.kids_ages || [];
    setAnswers(prev => ({
      ...prev,
      kids_ages: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value],
    }));
  }

  function toggle(value, comingSoon) {
    if (comingSoon) { setComingSoonTapped(value); return; }
    setComingSoonTapped(null);
    if (q.multi) {
      const cur = answers[q.id] || [];
      const opt = q.options.find(o => o.value === value);
      if (cur.includes(value)) {
        setAnswers({ ...answers, [q.id]: cur.filter(v => v !== value) });
      } else if (opt?.exclusive) {
        setAnswers({ ...answers, [q.id]: [value] });
      } else {
        const exclusiveVals = q.options.filter(o => o.exclusive).map(o => o.value);
        setAnswers({ ...answers, [q.id]: [...cur.filter(v => !exclusiveVals.includes(v)), value] });
      }
    } else {
      const extra = (q.id === 'group' && value !== 'family-kids') ? { grandparents: false, kids_ages: [] } : {};
      setAnswers({ ...answers, [q.id]: value, ...extra });
    }
  }

  function handleContinue() {
    if (step < LAST_STEP) {
      setCitySearch('');
      setStep(step + 1);
    } else {
      const flat = {};
      QUIZ.forEach(q => {
        if (q.type === 'daterange') {
          flat.departure_date  = dep;
          flat.return_date     = ret;
          flat.duration        = totalDays;
          flat.arrival_time    = parseTimePeriod(answers.arrival_time)   || 'afternoon';
          flat.departure_time  = parseTimePeriod(answers.departure_time) || 'morning';
        } else {
          flat[q.id] = q.multi ? (answers[q.id] || []) : answers[q.id];
        }
      });
      if (othersText.trim()) flat.dietaryOthers = othersText.trim();
      flat.grandparents = flat.group === 'family-kids' ? (answers.grandparents || false) : false;
      flat.kids_ages    = flat.group === 'family-kids' ? (answers.kids_ages   || [])    : [];
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
            <div key={i} className="h-1 flex-1 rounded-full transition-all duration-300"
              style={{ background: i <= step ? 'var(--accent)' : 'rgba(255,255,255,0.2)' }} />
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
        {q.note && <p className="text-sm mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{q.note}</p>}
      </div>

      {/* City search bar */}
      {isCity && (
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <input
              type="text" value={citySearch} onChange={e => setCitySearch(e.target.value)}
              placeholder="Search cities…" className="w-full px-4 py-3 rounded-2xl text-sm outline-none"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1.5px solid rgba(255,255,255,0.2)', color: 'white' }}
            />
            {citySearch && (
              <button onClick={() => setCitySearch('')}
                style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.45)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
              >×</button>
            )}
          </div>
          <p className="text-xs mt-2 px-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
            {selectedCityCount === 0 ? 'No cities selected' : `${selectedCityCount} ${selectedCityCount === 1 ? 'city' : 'cities'} selected`}
          </p>
        </div>
      )}

      {/* ── Date range screen ─────────────────────────────────── */}
      {isDateRange && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0 16px 8px' }}>

          {/* Tab pills — strict 50/50 width */}
          <div style={{
            display: 'flex', flexShrink: 0,
            background: 'rgba(255,255,255,0.07)', borderRadius: 22, padding: 4, marginBottom: 20,
          }}>
            <button
              onClick={() => setDateTab('dates')}
              style={{
                width: '50%', padding: '9px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
                background: dateTab === 'dates' ? ACC : 'transparent',
                color: dateTab === 'dates' ? 'white' : 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 13,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              📅 Dates
            </button>
            <button
              onClick={() => setDateTab('times')}
              style={{
                width: '50%', padding: '9px 0', borderRadius: 18, border: 'none', cursor: 'pointer',
                position: 'relative',
                background: dateTab === 'times' ? ACC : 'transparent',
                color: dateTab === 'times' ? 'white' : 'rgba(255,255,255,0.5)',
                fontWeight: 700, fontSize: 13,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              ✈️ Flight Times
              {/* Superscript badge — absolutely positioned so it doesn't affect tab width */}
              <span style={{
                position: 'absolute', top: 4, right: 8,
                fontSize: 8, padding: '1px 4px', borderRadius: 4, fontWeight: 700,
                background: 'rgba(255,255,255,0.2)',
                color: 'rgba(255,255,255,0.65)',
              }}>
                opt
              </span>
            </button>
          </div>

          {/* TAB 1 — Dates (no scroll needed; content is compact) */}
          {dateTab === 'dates' && (
            <div>
              {/* Day counter badge */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                {totalDays >= 1 ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(232,71,42,0.15)', border: '1.5px solid rgba(232,71,42,0.35)',
                    borderRadius: 24, padding: '7px 20px',
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: 'white', lineHeight: 1 }}>{totalDays}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>days in China 🇨🇳</span>
                  </div>
                ) : (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
                    borderRadius: 24, padding: '7px 20px',
                  }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Select your dates</span>
                  </div>
                )}
              </div>

              {/* Tappable date fields — neutral styling, no red */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <button
                  onClick={() => setCalendarOpen(true)}
                  style={{
                    flex: 1, padding: '14px 14px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: dep ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.07)',
                    outline: '1.5px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.07em', margin: '0 0 6px' }}>📅 DEPARTURE</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: dep ? 'white' : 'rgba(255,255,255,0.3)', margin: 0 }}>
                    {dep ? formatDateDisplay(dep) : 'Tap to select'}
                  </p>
                </button>
                <button
                  onClick={() => setCalendarOpen(true)}
                  style={{
                    flex: 1, padding: '14px 14px', borderRadius: 16, border: 'none', cursor: 'pointer', textAlign: 'left',
                    background: ret ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.07)',
                    outline: '1.5px solid rgba(255,255,255,0.15)',
                  }}
                >
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, letterSpacing: '0.07em', margin: '0 0 6px' }}>📅 RETURN</p>
                  <p style={{ fontSize: 14, fontWeight: 700, color: ret ? 'white' : 'rgba(255,255,255,0.3)', margin: 0 }}>
                    {ret ? formatDateDisplay(ret) : dep ? 'Tap to select' : '—'}
                  </p>
                </button>
              </div>

              {/* Holiday warnings — sit tight below the cards */}
              {overlappingHolidays.length > 0 && (
                <div>
                  {overlappingHolidays.map(h => (
                    <div key={h.name} style={{
                      background: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.35)',
                      borderRadius: 14, padding: '12px 16px', marginBottom: 10,
                    }}>
                      <p style={{ fontSize: 13, color: '#fde68a', lineHeight: 1.5, margin: 0 }}>
                        ⚠️ Your dates overlap with <strong>{h.name}</strong> — popular attractions will be very crowded. Consider adjusting dates or booking well in advance.
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2 — Flight Times */}
          {dateTab === 'times' && (
            <div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, margin: '0 0 20px' }}>
                Optional — helps us plan your first and last day more accurately. Leave blank and we'll use sensible defaults.
              </p>
              <FlightTimeInput
                label="🛬 What time do you land?"
                value={answers.arrival_time}
                onChange={v => setAnswers(a => ({ ...a, arrival_time: v }))}
              />
              <FlightTimeInput
                label="🛫 What time is your flight home?"
                value={answers.departure_time}
                onChange={v => setAnswers(a => ({ ...a, departure_time: v }))}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Options (non-date screens) ────────────────────────── */}
      {!isDateRange && (
        <div
          className="flex-1 px-4 pb-2 overflow-y-auto flex flex-col gap-3"
          style={{ WebkitOverflowScrolling: 'touch', scrollBehavior: 'smooth', willChange: 'scroll-position' }}
        >
          {visibleOptions.map(opt => {
            const sel        = isSelected(opt.value);
            const isTappedSoon = comingSoonTapped === opt.value;
            return (
              <div key={opt.value}>
                <button
                  onClick={() => toggle(opt.value, opt.comingSoon)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all duration-200"
                  style={{
                    background: opt.comingSoon ? 'rgba(255,255,255,0.03)' : sel ? 'var(--accent-tint)' : 'rgba(255,255,255,0.07)',
                    border:     opt.comingSoon ? '2px solid rgba(255,255,255,0.06)' : sel ? '2px solid var(--accent)' : '2px solid rgba(255,255,255,0.12)',
                    opacity: opt.comingSoon ? 0.5 : 1,
                    cursor:  opt.comingSoon ? 'default' : 'pointer',
                  }}
                >
                  <span className="text-2xl w-8 flex-shrink-0 text-center" style={{ filter: opt.comingSoon ? 'grayscale(1)' : 'none' }}>{opt.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white text-sm">{opt.name}</span>
                      {opt.comingSoon && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.45)', fontSize: 10 }}>
                          Coming Soon
                        </span>
                      )}
                    </div>
                    <div className="text-xs truncate" style={{ color: 'rgba(255,255,255,0.4)' }}>{opt.desc}</div>
                  </div>
                  {!opt.comingSoon && (
                    <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center border-2 transition-all"
                      style={{ borderColor: sel ? 'var(--accent)' : 'rgba(255,255,255,0.3)', background: sel ? 'var(--accent)' : 'transparent' }}>
                      {sel && (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                  )}
                </button>

                {/* Family-kids extras */}
                {isGroupQ && opt.value === 'family-kids' && (
                  <div style={{ maxHeight: isFamilyKids ? 200 : 0, overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                    <div style={{ padding: '12px 4px 4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: 600 }}>Grandparents joining too? 👴👵</p>
                        <button
                          onClick={e => { e.stopPropagation(); setAnswers(prev => ({ ...prev, grandparents: !prev.grandparents })); }}
                          style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', flexShrink: 0, background: answers.grandparents ? 'var(--accent)' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.2s' }}
                        >
                          <div style={{ position: 'absolute', top: 3, left: answers.grandparents ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                        </button>
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, marginBottom: 8, letterSpacing: '0.04em' }}>
                        KIDS AGES (SELECT ALL THAT APPLY)
                      </p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {AGE_GROUPS.map(ag => {
                          const agSel = (answers.kids_ages || []).includes(ag.value);
                          return (
                            <button key={ag.value} onClick={e => { e.stopPropagation(); toggleKidsAge(ag.value); }}
                              style={{ flex: 1, padding: '7px 0', borderRadius: 20, border: 'none', cursor: 'pointer', background: agSel ? 'var(--accent-tint)' : 'rgba(255,255,255,0.08)', outline: agSel ? '1.5px solid var(--accent)' : '1.5px solid rgba(255,255,255,0.15)', color: 'white', fontSize: 12, fontWeight: 600, transition: 'background 0.15s, outline 0.15s' }}>
                              {ag.icon} {ag.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {isTappedSoon && (
                  <div className="mt-1 mx-1 px-3 py-2 rounded-xl text-xs"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
                    We're working on it — China is ready now!
                  </div>
                )}

                {opt.value === 'others' && sel && (
                  <div className="mt-2 px-1">
                    <input type="text" value={othersText} onChange={e => setOthersText(e.target.value)}
                      placeholder="e.g. nut allergy, no shellfish…" className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.12)', border: '1.5px solid rgba(255,255,255,0.25)', color: 'white' }} autoFocus />
                  </div>
                )}
              </div>
            );
          })}

          {isDietary && (
            <p className="text-xs px-1 pb-2 leading-relaxed" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Recommendations are based on our research. Always verify with the restaurant directly as dietary information may change.
            </p>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="px-6 pt-2 pb-8 flex gap-3">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)}
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.1)' }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <button
          onClick={handleContinue} disabled={!canContinue}
          className="flex-1 h-12 rounded-2xl font-bold text-white transition-all duration-200"
          style={{ background: canContinue ? 'var(--accent)' : 'rgba(255,255,255,0.15)', opacity: canContinue ? 1 : 0.6 }}
        >
          {isLastStep ? 'Build My Itinerary →' : 'Continue →'}
        </button>
      </div>

      {/* ── Calendar bottom sheet ─────────────────────────────── */}
      {isDateRange && calendarOpen && (
        <>
          <style>{`
            @keyframes sheetSlideUp {
              from { transform: translateY(100%); opacity: 0.6; }
              to   { transform: translateY(0);    opacity: 1;   }
            }
          `}</style>

          {/* Backdrop */}
          <div
            onClick={() => setCalendarOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50 }}
          />

          {/* Sheet */}
          <div style={{
            position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 51,
            background: '#1a1232',
            borderRadius: '24px 24px 0 0',
            maxHeight: '84vh',
            display: 'flex', flexDirection: 'column',
            animation: 'sheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
          }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
            </div>

            {/* Sheet header */}
            <div style={{ padding: '14px 20px 14px', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: 'white', margin: 0 }}>Select your dates</p>
                <button
                  onClick={() => setCalendarOpen(false)}
                  style={{ padding: '7px 20px', borderRadius: 20, border: 'none', cursor: 'pointer', background: ACC, color: 'white', fontWeight: 700, fontSize: 13 }}
                >
                  Done ✓
                </button>
              </div>

              {/* Mini dep / ret display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 12, background: dep ? 'rgba(232,71,42,0.12)' : 'rgba(255,255,255,0.06)', outline: dep ? '1.5px solid rgba(232,71,42,0.4)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.07em', margin: '0 0 3px' }}>DEPARTURE</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: dep ? 'white' : 'rgba(255,255,255,0.3)', margin: 0 }}>
                    {dep ? formatDateDisplay(dep) : 'Tap a date'}
                  </p>
                </div>
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 16, flexShrink: 0 }}>→</span>
                <div style={{ flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 12, background: ret ? 'rgba(232,71,42,0.12)' : 'rgba(255,255,255,0.06)', outline: ret ? '1.5px solid rgba(232,71,42,0.4)' : '1.5px solid rgba(255,255,255,0.1)' }}>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: '0.07em', margin: '0 0 3px' }}>RETURN</p>
                  <p style={{ fontSize: 12, fontWeight: 700, color: ret ? 'white' : 'rgba(255,255,255,0.3)', margin: 0 }}>
                    {ret ? formatDateDisplay(ret) : dep ? 'Tap return date' : '—'}
                  </p>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

            {/* Scrollable calendar */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 48px', WebkitOverflowScrolling: 'touch' }}>
              <InlineCalendar dep={dep} ret={ret} today={today} onDayTap={handleDayTap} />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
