/**
 * QuizFlow — redesigned UI
 * Background: #F5F4F2, white cards, coral dot progress at bottom
 * Step order: country → city → dates → group → pace → dietary → vibe (VibeCheck)
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { QUIZ }  from '../utils/quizData';
import VibeCheck from './VibeCheck';

// ── Constants ──────────────────────────────────────────────────────────────────
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
const ACC_TINT  = '#FEF0EC';
const BG        = '#F5F4F2';

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const DAY_LABELS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

function formatDateShort(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${M[m - 1]}`;
}

function parseTimePeriod(timeStr) {
  if (!timeStr) return null;
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (isNaN(hour)) return null;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// ── Dot progress ───────────────────────────────────────────────────────────────
function DotProgress({ step, total }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 5, paddingBottom: 6 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={{
          width:        i === step ? 20 : 6,
          height:       6,
          borderRadius: 3,
          background:   i === step ? ACC : i < step ? '#E8C4BC' : '#D9D5D1',
          transition:   'all 0.25s ease',
        }} />
      ))}
    </div>
  );
}

// ── Month calendar grid ────────────────────────────────────────────────────────
function MonthGrid({ year, month, dep, ret, onDayClick }) {
  const firstDow    = new Date(year, month, 1).getDay();
  const startPad    = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
      {DAY_LABELS.map(d => (
        <div key={d} style={{ textAlign: 'center', fontSize: 11, color: '#C0BDB9', paddingBottom: 8, fontWeight: 600 }}>
          {d}
        </div>
      ))}
      {cells.map((day, idx) => {
        if (day === null) return <div key={`p${idx}`} style={{ height: 38 }} />;
        const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isPast     = dateStr < today;
        const isToday    = dateStr === today;
        const isDep      = dateStr === dep;
        const isRet      = dateStr === ret;
        const inRange    = dep && ret && dateStr > dep && dateStr < ret;
        const isSelected = isDep || isRet;
        return (
          <div
            key={day}
            onClick={() => !isPast && onDayClick(dateStr)}
            style={{ height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: isPast ? 'default' : 'pointer' }}
          >
            {isDep && ret  && <div style={{ position: 'absolute', top: 3, bottom: 3, left: '50%', right: 0, background: ACC_TINT, zIndex: 0 }} />}
            {isRet && dep  && <div style={{ position: 'absolute', top: 3, bottom: 3, left: 0, right: '50%', background: ACC_TINT, zIndex: 0 }} />}
            {inRange       && <div style={{ position: 'absolute', top: 3, bottom: 3, left: 0, right: 0, background: ACC_TINT, zIndex: 0 }} />}
            <div style={{
              width: 34, height: 34, borderRadius: '50%',
              background: isSelected ? ACC : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', zIndex: 1,
            }}>
              <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 400, color: isPast ? '#D0D0D0' : isSelected ? '#fff' : '#1A1A1A' }}>
                {day}
              </span>
            </div>
            {isToday && !isSelected && (
              <div style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: ACC, zIndex: 2 }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FlightTimeInput ────────────────────────────────────────────────────────────
function FlightTimeInput({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 52, padding: '0 16px', borderRadius: 12, marginBottom: 10,
      background: '#fff', border: '1.5px solid #E8E8E8', boxSizing: 'border-box', cursor: 'pointer',
    }}>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#666', flexShrink: 0, marginRight: 12 }}>{label}</span>
      <input
        type="time" value={value || ''} onChange={e => onChange(e.target.value)}
        style={{ background: 'transparent', border: 'none', outline: 'none', color: value ? '#1A1A1A' : '#CCC', fontSize: 15, fontWeight: 700, textAlign: 'right', colorScheme: 'light', minWidth: 80 }}
      />
    </label>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuizFlow({ onComplete }) {
  const [step,              setStep]             = useState(0);
  const [answers,           setAnswers]          = useState({});
  const [othersText,        setOthersText]       = useState('');
  const [comingSoonTapped,  setComingSoonTapped] = useState(null);
  const [citySearch,        setCitySearch]       = useState('');
  const [citySearchFocused, setCitySearchFocused]= useState(false);

  // Single-month calendar navigation
  const todayD = new Date();
  const [calYear,  setCalYear]  = useState(todayD.getFullYear());
  const [calMonth, setCalMonth] = useState(todayD.getMonth());

  const q           = QUIZ[step];
  const isVibe      = q.id === 'vibe';
  const isDietary   = q.id === 'dietary';
  const isCity      = q.id === 'city';
  const isCountry   = q.id === 'country';
  const isDateRange = q.type === 'daterange';
  const isGroupQ    = q.id === 'group';
  const isPaceQ     = q.id === 'pace';

  const isFamilyKids = answers.group === 'family-kids';
  const selected     = answers[q.id] ?? (q.multi ? [] : null);

  // Auto-select defaults when entering certain steps
  useEffect(() => {
    if (q.id === 'dietary' && (answers.dietary || []).length === 0)
      setAnswers(a => ({ ...a, dietary: ['none'] }));
    if (q.id === 'pace' && !answers.pace)
      setAnswers(a => ({ ...a, pace: 'balance' }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance 1s after China is selected on country screen
  useEffect(() => {
    if (step !== 0 || answers.country !== 'china') return;
    const t = setTimeout(() => { setStep(1); }, 1000);
    return () => clearTimeout(t);
  }, [answers.country, step]);

  // Date range helpers
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
    : q.multi ? (selected || []).length > 0 : selected !== null && selected !== undefined;

  const visibleCities = isCity && citySearch.trim()
    ? q.options.filter(o => o.name.toLowerCase().includes(citySearch.toLowerCase()))
    : q.options;
  const selectedCityCount = (answers.city || []).length;

  // ── Date tap logic ─────────────────────────────────────────────────────────
  function handleDayTap(dateStr) {
    if (dateStr < today) return;
    if (!dep) {
      setAnswers(p => ({ ...p, dates: { departure: dateStr, return: '' } }));
    } else if (!ret) {
      if (dateStr === dep) {
        setAnswers(p => ({ ...p, dates: { departure: '', return: '' } }));
      } else if (dateStr < dep) {
        setAnswers(p => ({ ...p, dates: { departure: dateStr, return: '' } }));
      } else {
        setAnswers(p => ({ ...p, dates: { ...(p.dates || {}), return: dateStr } }));
      }
    } else {
      setAnswers(p => ({ ...p, dates: { departure: dateStr, return: '' } }));
    }
  }

  // ── Calendar nav ───────────────────────────────────────────────────────────
  function prevCal() {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  }
  function nextCal() {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  }

  // ── Toggle option ──────────────────────────────────────────────────────────
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
        const excl = q.options.filter(o => o.exclusive).map(o => o.value);
        setAnswers({ ...answers, [q.id]: [...cur.filter(v => !excl.includes(v)), value] });
      }
    } else {
      const extra = (q.id === 'group' && value !== 'family-kids') ? { grandparents: false, kids_ages: [] } : {};
      setAnswers({ ...answers, [q.id]: value, ...extra });
    }
  }

  function toggleKidsAge(value) {
    const cur = answers.kids_ages || [];
    setAnswers(p => ({ ...p, kids_ages: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] }));
  }

  // ── Build flat answers & submit ────────────────────────────────────────────
  function submitAnswers(ans) {
    const d  = ans.dates || {};
    const dp = d.departure || '';
    const rt = d.return    || '';
    const td = dp && rt ? Math.round((new Date(rt) - new Date(dp)) / 86400000) + 1 : 0;
    const flat = {};
    QUIZ.forEach(qz => {
      if (qz.type === 'daterange') {
        flat.departure_date  = dp;
        flat.return_date     = rt;
        flat.duration        = td;
        flat.arrival_time    = parseTimePeriod(ans.arrival_time)   || 'afternoon';
        flat.departure_time  = parseTimePeriod(ans.departure_time) || 'morning';
      } else {
        flat[qz.id] = qz.multi ? (ans[qz.id] || []) : ans[qz.id];
      }
    });
    if (othersText.trim()) flat.dietaryOthers = othersText.trim();
    flat.grandparents = flat.group === 'family-kids' ? (ans.grandparents || false) : false;
    flat.kids_ages    = flat.group === 'family-kids' ? (ans.kids_ages    || [])    : [];
    onComplete(flat);
  }

  // ── VibeCheck done ─────────────────────────────────────────────────────────
  function handleVibeComplete(vibeArray) {
    const newAns = { ...answers, vibe: vibeArray };
    setAnswers(newAns);
    setCitySearch('');
    if (step === LAST_STEP) {
      submitAnswers(newAns);
    } else {
      setStep(s => s + 1);
    }
  }

  // ── Continue ───────────────────────────────────────────────────────────────
  function handleContinue() {
    if (step < LAST_STEP) { setCitySearch(''); setStep(step + 1); }
    else submitAnswers(answers);
  }

  function isSel(value) {
    return q.multi ? (answers[q.id] || []).includes(value) : answers[q.id] === value;
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: BG, height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '18px 20px 0', flexShrink: 0, display: 'flex', alignItems: 'center', minHeight: 48 }}>
        {step > 0 ? (
          <button
            onClick={() => { setStep(step - 1); setCitySearch(''); }}
            style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
        ) : (
          <span style={{ fontSize: 14, fontWeight: 700, color: ACC, letterSpacing: -0.2 }}>China Travel Planner</span>
        )}
      </div>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      {!isVibe && (
        <div style={{ padding: '12px 20px 10px', flexShrink: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1A1A1A', margin: '0 0 5px', lineHeight: 1.25 }}>
            {isCountry ? "Let's build your perfect trip" : q.title}
          </h1>
          <p style={{ fontSize: 14, color: '#888', margin: 0, lineHeight: 1.4 }}>
            {isCountry ? 'Where are you heading?' : q.sub}
          </p>
        </div>
      )}

      {/* ── City search ──────────────────────────────────────────────────── */}
      {isCity && (
        <div style={{ padding: '0 16px 10px', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text" value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              onFocus={() => setCitySearchFocused(true)}
              onBlur={() => setCitySearchFocused(false)}
              placeholder="🔍  Search cities…"
              style={{
                width: '100%', padding: '11px 40px 11px 16px', borderRadius: 14,
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
                background: '#fff', color: '#1A1A1A',
                border: `1.5px solid ${citySearchFocused ? ACC : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}
            />
            {citySearch && (
              <button onClick={() => setCitySearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#999', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
            )}
          </div>
          {selectedCityCount > 0 && (
            <p style={{ fontSize: 12, marginTop: 5, paddingLeft: 2, color: ACC, fontWeight: 600 }}>
              {selectedCityCount} {selectedCityCount === 1 ? 'city' : 'cities'} selected
            </p>
          )}
        </div>
      )}

      {/* ════════════════ CONTENT ════════════════════════════════════════════ */}

      {/* ── COUNTRY ──────────────────────────────────────────────────────── */}
      {isCountry && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map(opt => {
            const sel = isSel(opt.value);
            return (
              <div key={opt.value}>
                <button
                  onClick={() => toggle(opt.value, opt.comingSoon)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 16, textAlign: 'left',
                    cursor: opt.comingSoon ? 'default' : 'pointer',
                    background: '#fff',
                    borderTop: `1.5px solid ${sel ? ACC : 'transparent'}`,
                    borderRight: `1.5px solid ${sel ? ACC : 'transparent'}`,
                    borderBottom: `1.5px solid ${sel ? ACC : 'transparent'}`,
                    borderLeft: `4px solid ${sel ? ACC : 'transparent'}`,
                    opacity: opt.comingSoon ? 0.5 : 1,
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.icon}</span>
                  <span style={{ flex: 1, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{opt.name}</span>
                  {opt.comingSoon && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: '#F0F0F0', color: '#999', flexShrink: 0 }}>
                      Coming Soon
                    </span>
                  )}
                  {!opt.comingSoon && (
                    <div style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      border: sel ? `6px solid ${ACC}` : '2px solid #D0D0D0',
                      background: '#fff', transition: 'border 0.15s',
                    }} />
                  )}
                </button>
                {comingSoonTapped === opt.value && (
                  <div style={{ marginTop: 6, padding: '8px 14px', borderRadius: 12, background: ACC_TINT, color: ACC, fontSize: 12, fontWeight: 500 }}>
                    We're working on it — China is ready now!
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── CITY ─────────────────────────────────────────────────────────── */}
      {isCity && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {visibleCities.map(opt => {
            const sel = isSel(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '10px 14px', borderRadius: 16, textAlign: 'left',
                  cursor: 'pointer', background: '#fff',
                  border: `1.5px solid ${sel ? ACC : 'transparent'}`,
                  transition: 'border-color 0.15s',
                }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: sel ? ACC : ACC_TINT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 22, transition: 'background 0.15s',
                }}>
                  {opt.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>{opt.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.desc}</p>
                </div>
                <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: sel ? `6px solid ${ACC}` : '2px solid #D0D0D0', background: '#fff', transition: 'border 0.15s' }} />
              </button>
            );
          })}
        </div>
      )}

      {/* ── DATES ────────────────────────────────────────────────────────── */}
      {isDateRange && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
          {/* Month navigation */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
            <button onClick={prevCal} style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>{MONTH_NAMES[calMonth]} {calYear}</p>
            <button onClick={nextCal} style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', fontSize: 18, color: '#1A1A1A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
          </div>

          {/* Calendar card */}
          <div style={{ background: '#fff', borderRadius: 18, padding: '14px 10px', marginBottom: 14 }}>
            <MonthGrid year={calYear} month={calMonth} dep={dep} ret={ret} onDayClick={handleDayTap} />
          </div>

          {/* Range summary pill */}
          <div style={{ textAlign: 'center', marginBottom: 14 }}>
            {dep && ret && !dateError ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: ACC_TINT, borderRadius: 24, padding: '8px 20px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: ACC }}>
                  {formatDateShort(dep)} → {formatDateShort(ret)}
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: ACC, borderRadius: 12, padding: '2px 10px' }}>
                  {totalDays}d
                </span>
              </div>
            ) : (
              <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fff', borderRadius: 24, padding: '8px 20px' }}>
                <span style={{ fontSize: 13, color: '#CCC', fontWeight: 500 }}>
                  {dep ? 'Now select your return date' : 'Tap a date to start'}
                </span>
              </div>
            )}
          </div>

          {/* Holiday warnings */}
          {overlappingHolidays.map(h => (
            <div key={h.name} style={{ background: 'rgba(245,158,11,0.07)', border: '1.5px solid rgba(245,158,11,0.28)', borderRadius: 14, padding: '11px 16px', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                ⚠️ Your dates overlap with <strong>{h.name}</strong> — very crowded. Book well in advance.
              </p>
            </div>
          ))}

          {/* Flight times collapsible */}
          <details style={{ marginTop: 4 }}>
            <summary style={{ fontSize: 13, color: '#999', cursor: 'pointer', fontWeight: 600, padding: '8px 0', listStyle: 'none' }}>
              ✈️ Add flight times (optional)
            </summary>
            <div style={{ paddingTop: 10 }}>
              <p style={{ fontSize: 12, color: '#CCC', margin: '0 0 10px', lineHeight: 1.5 }}>
                Helps plan your first and last day more accurately.
              </p>
              <FlightTimeInput
                label="🛬 Land time"
                value={answers.arrival_time}
                onChange={v => setAnswers(a => ({ ...a, arrival_time: v }))}
              />
              <FlightTimeInput
                label="🛫 Departure time"
                value={answers.departure_time}
                onChange={v => setAnswers(a => ({ ...a, departure_time: v }))}
              />
            </div>
          </details>
        </div>
      )}

      {/* ── GROUP — 2-col grid ────────────────────────────────────────────── */}
      {isGroupQ && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {q.options.map(opt => {
              const sel = isSel(opt.value);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggle(opt.value)}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: 8, padding: '20px 10px', borderRadius: 18, cursor: 'pointer', minHeight: 96,
                    background: sel ? ACC_TINT : '#fff',
                    border: `2px solid ${sel ? ACC : 'transparent'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 28 }}>{opt.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: sel ? ACC : '#1A1A1A', textAlign: 'center', lineHeight: 1.3 }}>{opt.name}</span>
                </button>
              );
            })}
          </div>

          {/* Family extras */}
          {isFamilyKids && (
            <div style={{ marginTop: 12, background: '#fff', borderRadius: 18, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Grandparents joining? 👴👵</p>
                <button
                  onClick={() => setAnswers(p => ({ ...p, grandparents: !p.grandparents }))}
                  style={{ width: 44, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: answers.grandparents ? ACC : '#E0E0E0', position: 'relative', transition: 'background 0.2s' }}
                >
                  <div style={{ position: 'absolute', top: 3, left: answers.grandparents ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                </button>
              </div>
              <p style={{ fontSize: 11, fontWeight: 700, color: '#999', letterSpacing: '0.06em', margin: '0 0 8px' }}>KIDS AGES</p>
              <div style={{ display: 'flex', gap: 8 }}>
                {AGE_GROUPS.map(ag => {
                  const agSel = (answers.kids_ages || []).includes(ag.value);
                  return (
                    <button key={ag.value} onClick={() => toggleKidsAge(ag.value)} style={{ flex: 1, padding: '7px 0', borderRadius: 20, border: 'none', cursor: 'pointer', background: agSel ? ACC_TINT : '#F5F5F5', outline: agSel ? `1.5px solid ${ACC}` : '1.5px solid #E0E0E0', color: agSel ? ACC : '#1A1A1A', fontSize: 12, fontWeight: 600, transition: 'background 0.15s' }}>
                      {ag.icon} {ag.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PACE — 3 tall cards ───────────────────────────────────────────── */}
      {isPaceQ && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map(opt => {
            const sel = isSel(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  flex: 1, minHeight: 86, position: 'relative',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center',
                  gap: 4, padding: '22px 20px', borderRadius: 20, textAlign: 'left', cursor: 'pointer',
                  background: sel ? ACC_TINT : '#fff',
                  border: `2px solid ${sel ? ACC : 'transparent'}`,
                  transition: 'background 0.15s, border-color 0.15s',
                }}
              >
                {sel && (
                  <div style={{ position: 'absolute', top: 14, right: 14, width: 24, height: 24, borderRadius: '50%', background: ACC, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="12" height="10" viewBox="0 0 12 10" fill="none">
                      <path d="M1.5 5L4.5 8L10.5 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <span style={{ fontSize: 26, marginBottom: 2 }}>{opt.icon}</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: sel ? ACC : '#1A1A1A' }}>{opt.name}</span>
                <span style={{ fontSize: 12, color: '#888', lineHeight: 1.4 }}>{opt.desc}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── DIETARY — row list ────────────────────────────────────────────── */}
      {isDietary && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map(opt => {
            const sel = isSel(opt.value);
            return (
              <div key={opt.value}>
                <button
                  onClick={() => toggle(opt.value)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 16px', borderRadius: 16, textAlign: 'left', cursor: 'pointer',
                    background: sel ? ACC_TINT : '#fff',
                    border: `1.5px solid ${sel ? ACC : 'transparent'}`,
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0, width: 32, textAlign: 'center' }}>{opt.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: sel ? ACC : '#1A1A1A' }}>{opt.name}</p>
                    <p style={{ margin: 0, fontSize: 12, color: '#888' }}>{opt.desc}</p>
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, border: sel ? `6px solid ${ACC}` : '2px solid #D0D0D0', background: '#fff', transition: 'border 0.15s' }} />
                </button>
                {opt.value === 'others' && sel && (
                  <div style={{ marginTop: 8 }}>
                    <input
                      type="text" value={othersText} onChange={e => setOthersText(e.target.value)}
                      placeholder="e.g. nut allergy, no shellfish…" autoFocus
                      style={{ width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 13, outline: 'none', background: '#fff', border: `1.5px solid ${ACC}`, color: '#1A1A1A', boxSizing: 'border-box' }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <p style={{ fontSize: 12, color: '#C0BDB9', lineHeight: 1.6, paddingBottom: 4 }}>
            Always verify dietary info directly with the restaurant.
          </p>
        </div>
      )}

      {/* ── VIBECHECK ────────────────────────────────────────────────────── */}
      {isVibe && (
        <VibeCheck key={step} selectedCities={answers.city || []} onComplete={handleVibeComplete} />
      )}

      {/* ════════════════ BOTTOM BAR ══════════════════════════════════════════ */}
      {!isVibe && (
        <div style={{ padding: '10px 20px 32px', flexShrink: 0, background: BG }}>
          <DotProgress step={step} total={QUIZ.length} />

          {/* Country: show confirmation text instead of button */}
          {isCountry ? (
            <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
              {answers.country === 'china' ? (
                <p style={{ fontSize: 14, color: ACC, fontWeight: 600, margin: 0 }}>
                  ✓ Great choice! Setting up China…
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#C0BDB9', margin: 0 }}>
                  Select a destination above
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={handleContinue}
              disabled={!canContinue}
              style={{
                width: '100%', height: 54, borderRadius: 28, border: 'none', marginTop: 10,
                cursor: canContinue ? 'pointer' : 'default',
                background: canContinue ? ACC : '#E0DDD9',
                color: canContinue ? '#fff' : '#B0ABA6',
                fontSize: 15, fontWeight: 700,
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              {isDietary ? "Let's go! →" : 'Continue →'}
            </button>
          )}
        </div>
      )}

    </div>
  );
}
