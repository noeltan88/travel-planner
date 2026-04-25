/**
 * QuizFlow — white + coral palette (Part A restyle)
 *
 * Design tokens:
 *   Background:      #FFFFFF / #FAFAFA
 *   Primary text:    #1A1A1A
 *   Secondary text:  #999999
 *   Accent:          #E8472A
 *
 * Progress bar: 3px, flush top, no rounded ends.
 * Options:      white + 1px #E0E0E0 border → selected: coral bg, white text.
 * Continue:     solid coral pill, 52px tall, no shadow.
 * Back:         ghost, #999.
 *
 * Step 5 (id:'vibe') is replaced by VibeCheck card-swipe (Part B).
 */
import { useState, useEffect, useMemo } from 'react';
import { QUIZ }    from '../utils/quizData';
import VibeCheck   from './VibeCheck';

// ── Constants ─────────────────────────────────────────────────────────────────
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

// ── Calendar helpers ──────────────────────────────────────────────────────────
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

// ── MonthGrid — light theme ───────────────────────────────────────────────────
function MonthGrid({ year, month, dep, ret, onDayClick }) {
  const firstDow    = new Date(year, month, 1).getDay();
  const startPad    = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells       = [
    ...Array(startPad).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div style={{ marginBottom: 28 }}>
      <p style={{
        textAlign: 'center', fontWeight: 700, color: '#1A1A1A',
        marginBottom: 10, fontSize: 14,
      }}>
        {MONTH_NAMES[month]} {year}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {DAY_LABELS.map(d => (
          <div key={d} style={{
            textAlign: 'center', fontSize: 11, color: '#CCC',
            paddingBottom: 6, fontWeight: 600,
          }}>
            {d}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`p${idx}`} style={{ height: 36 }} />;

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
              style={{
                height: 36, display: 'flex', alignItems: 'center',
                justifyContent: 'center', position: 'relative',
                cursor: isPast ? 'default' : 'pointer',
              }}
            >
              {/* Range fill */}
              {isDep && ret  && <div style={{ position: 'absolute', top: 2, bottom: 2, left: '50%', right: 0, background: ACC_TINT, zIndex: 0 }} />}
              {isRet && dep  && <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: '50%', background: ACC_TINT, zIndex: 0 }} />}
              {inRange       && <div style={{ position: 'absolute', top: 2, bottom: 2, left: 0, right: 0, background: ACC_TINT, zIndex: 0 }} />}

              {/* Day circle */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: isSelected ? ACC : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 1,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: isSelected ? 700 : 400,
                  color: isPast ? '#D0D0D0' : isSelected ? '#fff' : '#1A1A1A',
                }}>
                  {day}
                </span>
              </div>

              {/* Today dot */}
              {isToday && !isSelected && (
                <div style={{
                  position: 'absolute', bottom: 2,
                  left: '50%', transform: 'translateX(-50%)',
                  width: 4, height: 4, borderRadius: '50%',
                  background: ACC, zIndex: 2,
                }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function InlineCalendar({ dep, ret, onDayTap }) {
  const yr0 = Number(today.slice(0, 4));
  const mo0 = Number(today.slice(5, 7)) - 1;
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = mo0 + i;
    return { year: yr0 + Math.floor(m / 12), month: m % 12 };
  });
  return (
    <div>
      {months.map(({ year, month }) => (
        <MonthGrid
          key={`${year}-${month}`}
          year={year} month={month}
          dep={dep} ret={ret}
          onDayClick={onDayTap}
        />
      ))}
    </div>
  );
}

// ── FlightTimeInput — light theme ─────────────────────────────────────────────
function FlightTimeInput({ label, value, onChange }) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      minHeight: 52, padding: '0 16px', borderRadius: 12, marginBottom: 12,
      background: '#F8F8F8', border: '1.5px solid #E8E8E8',
      boxSizing: 'border-box', cursor: 'pointer',
    }}>
      <span style={{ fontSize: 14, fontWeight: 500, color: '#666', flexShrink: 0, marginRight: 12 }}>
        {label}
      </span>
      <input
        type="time"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'transparent', border: 'none', outline: 'none',
          color: value ? '#1A1A1A' : '#CCC',
          fontSize: 15, fontWeight: 700, textAlign: 'right',
          colorScheme: 'light', minWidth: 80,
        }}
      />
    </label>
  );
}

// ── parseTimePeriod ───────────────────────────────────────────────────────────
function parseTimePeriod(timeStr) {
  if (!timeStr) return null;
  const hour = parseInt(timeStr.split(':')[0], 10);
  if (isNaN(hour)) return null;
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

// ── Option card ───────────────────────────────────────────────────────────────
function OptionCard({ opt, sel, multi, isGroupQ, isFamilyKids, answers, onToggle, onToggleKidsAge, onToggleGrandparents, onOthersChange, othersText, comingSoonTapped }) {
  const [hovered, setHovered] = useState(false);

  const isTappedSoon = comingSoonTapped === opt.value;

  const cardBg        = opt.comingSoon ? '#FAFAFA'
                      : sel            ? ACC
                      :                  (hovered ? ACC_TINT : '#fff');
  const cardBorder    = opt.comingSoon ? '1px solid #F0F0F0'
                      : sel            ? `1px solid ${ACC}`
                      :                  '1px solid #E0E0E0';
  const cardBorderLeft = !sel && !opt.comingSoon ? '3px solid #F0C4BA' : cardBorder;
  const nameColor  = sel && !opt.comingSoon ? '#fff' : '#1A1A1A';
  const descColor  = sel && !opt.comingSoon ? 'rgba(255,255,255,0.75)' : '#999';

  return (
    <div>
      <button
        onClick={() => onToggle(opt.value, opt.comingSoon)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: '100%',
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderRadius: 16,
          textAlign: 'left', cursor: opt.comingSoon ? 'default' : 'pointer',
          background: cardBg, border: cardBorder, borderLeft: cardBorderLeft,
          opacity: opt.comingSoon ? 0.55 : 1,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        {/* Emoji icon */}
        <span style={{
          fontSize: 24, width: 32, textAlign: 'center', flexShrink: 0,
          filter: opt.comingSoon ? 'grayscale(1)' : 'none',
        }}>
          {opt.icon}
        </span>

        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 1 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: nameColor }}>{opt.name}</span>
            {opt.comingSoon && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '1px 6px',
                borderRadius: 20, background: '#F0F0F0', color: '#999',
              }}>
                Coming Soon
              </span>
            )}
          </div>
          <span style={{ fontSize: 12, color: descColor, display: 'block' }}>{opt.desc}</span>
        </div>

        {/* Checkbox / radio indicator */}
        {!opt.comingSoon && (
          <div style={{
            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: sel
              ? '1.5px solid rgba(255,255,255,0.5)'
              : '1.5px solid #D0D0D0',
            background: sel ? 'rgba(255,255,255,0.22)' : 'transparent',
            transition: 'all 0.15s ease',
          }}>
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
        <div style={{
          maxHeight: isFamilyKids ? 220 : 0,
          overflow: 'hidden',
          transition: 'max-height 0.3s ease',
        }}>
          <div style={{ padding: '14px 4px 4px' }}>
            {/* Grandparents toggle */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 14,
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A', margin: 0 }}>
                Grandparents joining too? 👴👵
              </p>
              <button
                onClick={e => { e.stopPropagation(); onToggleGrandparents(); }}
                style={{
                  width: 44, height: 26, borderRadius: 13, border: 'none',
                  cursor: 'pointer', flexShrink: 0,
                  background: answers.grandparents ? ACC : '#E0E0E0',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  position: 'absolute', top: 3,
                  left: answers.grandparents ? 21 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'white', transition: 'left 0.2s',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                }} />
              </button>
            </div>

            {/* Kids ages */}
            <p style={{
              fontSize: 11, fontWeight: 700, color: '#999',
              letterSpacing: '0.06em', margin: '0 0 8px',
            }}>
              KIDS AGES (SELECT ALL THAT APPLY)
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {AGE_GROUPS.map(ag => {
                const agSel = (answers.kids_ages || []).includes(ag.value);
                return (
                  <button
                    key={ag.value}
                    onClick={e => { e.stopPropagation(); onToggleKidsAge(ag.value); }}
                    style={{
                      flex: 1, padding: '7px 0', borderRadius: 20, border: 'none',
                      cursor: 'pointer',
                      background: agSel ? ACC_TINT : '#F5F5F5',
                      outline: agSel ? `1.5px solid ${ACC}` : '1.5px solid #E0E0E0',
                      color: agSel ? ACC : '#1A1A1A',
                      fontSize: 12, fontWeight: 600,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                  >
                    {ag.icon} {ag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Coming soon tapped message */}
      {isTappedSoon && (
        <div style={{
          marginTop: 6, padding: '8px 14px', borderRadius: 12,
          background: ACC_TINT, color: ACC, fontSize: 12, fontWeight: 500,
        }}>
          We're working on it — China is ready now!
        </div>
      )}

      {/* Dietary "others" free-text */}
      {opt.value === 'others' && sel && (
        <div style={{ marginTop: 8 }}>
          <input
            type="text"
            value={othersText}
            onChange={e => onOthersChange(e.target.value)}
            placeholder="e.g. nut allergy, no shellfish…"
            autoFocus
            style={{
              width: '100%', padding: '12px 16px', borderRadius: 12, fontSize: 13,
              outline: 'none', background: '#F8F8F8', border: `1.5px solid ${ACC}`,
              color: '#1A1A1A', boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function QuizFlow({ onComplete }) {
  const [step,             setStep]            = useState(0);
  const [answers,          setAnswers]          = useState({ country: 'china' });
  const [othersText,       setOthersText]       = useState('');
  const [comingSoonTapped, setComingSoonTapped] = useState(null);
  const [citySearch,       setCitySearch]       = useState('');
  const [dateTab,          setDateTab]          = useState('dates');
  const [calendarOpen,     setCalendarOpen]     = useState(false);
  const [citySearchFocused,setCitySearchFocused]= useState(false);

  const q          = QUIZ[step];
  const isLastStep = step === LAST_STEP;
  const isVibe     = q.id === 'vibe';
  const isDietary  = q.id === 'dietary';
  const isCity     = q.id === 'city';
  const isDateRange= q.type === 'daterange';
  const isGroupQ   = q.id === 'group';
  const isFamilyKids = answers.group === 'family-kids';
  const selected     = answers[q.id] || (q.multi ? [] : null);

  // Auto-select "No restrictions" on dietary step
  useEffect(() => {
    if (QUIZ[step]?.id !== 'dietary') return;
    if ((answers.dietary || []).length === 0)
      setAnswers(a => ({ ...a, dietary: ['none'] }));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Date range derived state
  const datesAnswer = answers.dates || {};
  const dep         = datesAnswer.departure || '';
  const ret         = datesAnswer.return    || '';
  const totalDays   = dep && ret
    ? Math.round((new Date(ret) - new Date(dep)) / 86400000) + 1
    : 0;
  const dateError   = dep && ret && dep >= ret;
  const overlappingHolidays = useMemo(() => {
    if (!dep || !ret || dateError) return [];
    return HOLIDAYS.filter(h => dep <= h.end && ret >= h.start);
  }, [dep, ret, dateError]);

  const canContinue = isDateRange
    ? Boolean(dep && ret && !dateError && totalDays >= 1)
    : q.multi ? selected.length > 0 : selected !== null;

  const visibleOptions    = isCity && citySearch.trim()
    ? q.options.filter(o => o.name.toLowerCase().includes(citySearch.toLowerCase()))
    : q.options;
  const selectedCityCount = (answers.city || []).length;

  // ── Date handlers ──────────────────────────────────────────────────────────
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
        setCalendarOpen(false);
      }
    } else {
      setAnswers(prev => ({ ...prev, dates: { departure: dateStr, return: '' } }));
    }
  }

  // ── Option toggle ──────────────────────────────────────────────────────────
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
      const extra = (q.id === 'group' && value !== 'family-kids')
        ? { grandparents: false, kids_ages: [] }
        : {};
      setAnswers({ ...answers, [q.id]: value, ...extra });
    }
  }

  function toggleKidsAge(value) {
    const cur = answers.kids_ages || [];
    setAnswers(prev => ({
      ...prev,
      kids_ages: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value],
    }));
  }

  // ── VibeCheck completion ───────────────────────────────────────────────────
  function handleVibeComplete(vibeArray) {
    setAnswers(a => ({ ...a, vibe: vibeArray }));
    setCitySearch('');
    setStep(s => s + 1);
  }

  // ── Continue / submit ──────────────────────────────────────────────────────
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      background:     '#fff',
      height:         '100dvh',
      display:        'flex',
      flexDirection:  'column',
      position:       'relative',
      overflow:       'hidden',
    }}>

      {/* ── 4px progress bar — flush to top edge, no rounding ────────────── */}
      <div style={{
        position:   'absolute', top: 0, left: 0, right: 0,
        height:     4,
        background: '#F0F0F0',
        zIndex:     10,
        flexShrink: 0,
      }}>
        <div style={{
          height:     '100%',
          width:      `${((step + 1) / QUIZ.length) * 100}%`,
          background: ACC,
          transition: 'width 0.35s ease',
        }} />
      </div>

      {/* ── Decorative Chinese character — very subtle watermark ─────────── */}
      <div style={{
        position:       'absolute',
        top:            36,
        right:          18,
        fontSize:       120,
        fontWeight:     900,
        lineHeight:     1,
        color:          ACC,
        opacity:        0.05,
        pointerEvents:  'none',
        userSelect:     'none',
        zIndex:         0,
      }}>
        {q.deco}
      </div>

      {/* ── Step label ───────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 20px 0', flexShrink: 0, zIndex: 1 }}>
        <p style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
          color: ACC, margin: 0,
        }}>
          {q.label} · {step + 1}/{QUIZ.length}
        </p>
      </div>

      {/* ── Question title + subtitle ─────────────────────────────────────── */}
      <div style={{ padding: '6px 20px 14px', flexShrink: 0, zIndex: 1 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 500, color: '#1A1A1A',
          margin: '0 0 4px', lineHeight: 1.3,
        }}>
          {isVibe ? "What catches your eye?" : q.title}
        </h1>
        <p style={{ fontSize: 14, color: '#999', margin: 0 }}>
          {isVibe
            ? "Swipe through — we'll build around what you love"
            : q.sub}
        </p>
        {q.note && !isVibe && (
          <p style={{ fontSize: 13, color: '#CCC', margin: '2px 0 0' }}>{q.note}</p>
        )}
      </div>

      {/* ── City search bar ───────────────────────────────────────────────── */}
      {isCity && (
        <div style={{ padding: '0 16px 10px', flexShrink: 0, zIndex: 1 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              onFocus={() => setCitySearchFocused(true)}
              onBlur={() => setCitySearchFocused(false)}
              placeholder="Search cities…"
              style={{
                width: '100%', padding: '12px 40px 12px 16px', borderRadius: 16,
                fontSize: 14, outline: 'none', boxSizing: 'border-box',
                background: '#F8F8F8', color: '#1A1A1A',
                border: `1.5px solid ${citySearchFocused ? ACC : '#E8E8E8'}`,
                transition: 'border-color 0.15s ease',
              }}
            />
            {citySearch && (
              <button
                onClick={() => setCitySearch('')}
                style={{
                  position: 'absolute', right: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#999', background: 'none', border: 'none',
                  cursor: 'pointer', fontSize: 18, lineHeight: 1,
                }}
              >
                ×
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, marginTop: 6, paddingLeft: 2, color: '#CCC' }}>
            {selectedCityCount === 0
              ? 'No cities selected'
              : `${selectedCityCount} ${selectedCityCount === 1 ? 'city' : 'cities'} selected`}
          </p>
        </div>
      )}

      {/* ── Date range screen ─────────────────────────────────────────────── */}
      {isDateRange && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          overflow: 'hidden', padding: '0 16px 8px', zIndex: 1,
        }}>
          {/* Tab pills */}
          <div style={{
            display: 'flex', flexShrink: 0,
            background: '#F5F5F5', borderRadius: 22, padding: 4, marginBottom: 18,
          }}>
            {[
              { id: 'dates', label: '📅 Dates' },
              { id: 'times', label: '✈️ Flight Times', badge: 'opt' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateTab(tab.id)}
                style={{
                  width: '50%', padding: '9px 0', borderRadius: 18,
                  border: 'none', cursor: 'pointer', position: 'relative',
                  background: dateTab === tab.id ? ACC : 'transparent',
                  color:      dateTab === tab.id ? '#fff' : '#999',
                  fontWeight: 700, fontSize: 13,
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                {tab.label}
                {tab.badge && (
                  <span style={{
                    position: 'absolute', top: 4, right: 8,
                    fontSize: 9, padding: '1px 4px', borderRadius: 4,
                    background: 'rgba(0,0,0,0.08)', color: '#999', fontWeight: 700,
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* TAB 1 — Dates */}
          {dateTab === 'dates' && (
            <div>
              {/* Day counter badge */}
              <div style={{ textAlign: 'center', marginBottom: 14 }}>
                {totalDays >= 1 ? (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    background: 'rgba(232,71,42,0.07)',
                    border: `1.5px solid rgba(232,71,42,0.22)`,
                    borderRadius: 24, padding: '7px 20px',
                  }}>
                    <span style={{ fontSize: 22, fontWeight: 900, color: ACC, lineHeight: 1 }}>{totalDays}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A' }}>days in China 🇨🇳</span>
                  </div>
                ) : (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center',
                    background: '#F5F5F5', border: '1.5px solid #E8E8E8',
                    borderRadius: 24, padding: '7px 20px',
                  }}>
                    <span style={{ fontSize: 13, color: '#CCC', fontWeight: 500 }}>Select your dates</span>
                  </div>
                )}
              </div>

              {/* Departure / Return fields */}
              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                {[
                  { field: 'departure', label: '📅 DEPARTURE', value: dep },
                  { field: 'return',    label: '📅 RETURN',    value: ret },
                ].map(({ field, label, value: val }) => (
                  <button
                    key={field}
                    onClick={() => setCalendarOpen(true)}
                    style={{
                      flex: 1, padding: '14px', borderRadius: 16,
                      border: `1.5px solid ${val ? 'rgba(232,71,42,0.3)' : '#E8E8E8'}`,
                      cursor: 'pointer', textAlign: 'left',
                      background: val ? 'rgba(232,71,42,0.04)' : '#F8F8F8',
                    }}
                  >
                    <p style={{
                      fontSize: 10, color: '#CCC', fontWeight: 700,
                      letterSpacing: '0.07em', margin: '0 0 6px',
                    }}>
                      {label}
                    </p>
                    <p style={{
                      fontSize: 14, fontWeight: 700, margin: 0,
                      color: val ? '#1A1A1A' : '#CCC',
                    }}>
                      {val
                        ? formatDateDisplay(val)
                        : field === 'return' && !dep ? '—' : 'Tap to select'}
                    </p>
                  </button>
                ))}
              </div>

              {/* Holiday warnings */}
              {overlappingHolidays.map(h => (
                <div
                  key={h.name}
                  style={{
                    background: 'rgba(245,158,11,0.07)',
                    border: '1.5px solid rgba(245,158,11,0.28)',
                    borderRadius: 14, padding: '12px 16px', marginBottom: 10,
                  }}
                >
                  <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                    ⚠️ Your dates overlap with <strong>{h.name}</strong> — popular attractions will be very crowded.
                    Consider adjusting dates or booking well in advance.
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* TAB 2 — Flight Times */}
          {dateTab === 'times' && (
            <div>
              <p style={{ fontSize: 13, color: '#999', lineHeight: 1.6, margin: '0 0 18px' }}>
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

      {/* ── VibeCheck (replaces normal options for step id='vibe') ────────── */}
      {isVibe && (
        <VibeCheck
          key={step}
          selectedCities={answers.city || []}
          onComplete={handleVibeComplete}
        />
      )}

      {/* ── Normal options (non-date, non-vibe) ──────────────────────────── */}
      {!isDateRange && !isVibe && (
        <div style={{
          flex: 1, padding: '0 16px 4px',
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
          WebkitOverflowScrolling: 'touch', zIndex: 1,
        }}>
          {visibleOptions.map(opt => (
            <OptionCard
              key={opt.value}
              opt={opt}
              sel={isSelected(opt.value)}
              multi={q.multi}
              isGroupQ={isGroupQ}
              isFamilyKids={isFamilyKids}
              answers={answers}
              onToggle={toggle}
              onToggleKidsAge={toggleKidsAge}
              onToggleGrandparents={() => setAnswers(prev => ({ ...prev, grandparents: !prev.grandparents }))}
              onOthersChange={setOthersText}
              othersText={othersText}
              comingSoonTapped={comingSoonTapped}
            />
          ))}

          {isDietary && (
            <p style={{ fontSize: 12, color: '#CCC', lineHeight: 1.6, paddingBottom: 8 }}>
              Recommendations are based on our research. Always verify with the restaurant directly as dietary information may change.
            </p>
          )}
        </div>
      )}

      {/* ── Navigation — Back (ghost) + Continue (coral pill) ────────────── */}
      <div style={{
        padding:    '10px 20px 28px',
        flexShrink: 0,
        display:    'flex',
        gap:        12,
        alignItems: 'center',
        zIndex:     1,
        background: '#fff',
        boxShadow:  '0 -1px 0 #F5F5F5',
      }}>
        {step > 0 && (
          <button
            onClick={() => { setStep(step - 1); setCitySearch(''); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: ACC, fontSize: 14, fontWeight: 500,
              padding: '0 4px', flexShrink: 0,
            }}
          >
            ← Back
          </button>
        )}

        {/* Continue button — hidden during VibeCheck (it self-advances) */}
        {!isVibe && (
          <button
            onClick={handleContinue}
            disabled={!canContinue}
            style={{
              flex:         1,
              height:       52,
              borderRadius: 28,
              border:       'none',
              cursor:       canContinue ? 'pointer' : 'default',
              background:   canContinue ? ACC : '#F0F0F0',
              color:        canContinue ? '#fff' : '#CCC',
              fontSize:     14,
              fontWeight:   500,
              transition:   'background 0.15s, color 0.15s',
            }}
          >
            {isLastStep ? 'Build My Itinerary →' : 'Continue →'}
          </button>
        )}
      </div>

      {/* ══ Calendar bottom sheet (date range step only) ════════════════════ */}
      {isDateRange && calendarOpen && (
        <>
          <style>{`
            @keyframes sheetSlideUp {
              from { transform: translateY(100%); opacity: 0.7; }
              to   { transform: translateY(0);    opacity: 1;   }
            }
          `}</style>

          {/* Backdrop */}
          <div
            onClick={() => setCalendarOpen(false)}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.35)', zIndex: 50,
            }}
          />

          {/* Sheet — light */}
          <div style={{
            position:     'absolute', left: 0, right: 0, bottom: 0,
            zIndex:       51,
            background:   '#fff',
            borderRadius: '24px 24px 0 0',
            maxHeight:    '84vh',
            display:      'flex', flexDirection: 'column',
            animation:    'sheetSlideUp 0.28s cubic-bezier(0.32,0.72,0,1)',
            boxShadow:    '0 -4px 32px rgba(0,0,0,0.12)',
          }}>

            {/* Drag handle */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, flexShrink: 0 }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E0E0E0' }} />
            </div>

            {/* Sheet header */}
            <div style={{ padding: '14px 20px 14px', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 14,
              }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
                  Select your dates
                </p>
                <button
                  onClick={() => setCalendarOpen(false)}
                  style={{
                    padding: '7px 20px', borderRadius: 20,
                    border: 'none', cursor: 'pointer',
                    background: ACC, color: '#fff', fontWeight: 700, fontSize: 13,
                  }}
                >
                  Done ✓
                </button>
              </div>

              {/* Mini dep/ret display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {[
                  { label: 'DEPARTURE', value: dep, hint: 'Tap a date' },
                  { label: 'RETURN',    value: ret, hint: dep ? 'Tap return date' : '—' },
                ].map(({ label, value: val, hint }) => (
                  <div
                    key={label}
                    style={{
                      flex: 1, textAlign: 'center', padding: '9px 10px', borderRadius: 12,
                      background: val ? 'rgba(232,71,42,0.05)' : '#F8F8F8',
                      outline: val ? `1.5px solid rgba(232,71,42,0.3)` : '1.5px solid #E8E8E8',
                    }}
                  >
                    <p style={{
                      fontSize: 9, color: '#CCC', fontWeight: 700,
                      letterSpacing: '0.07em', margin: '0 0 3px',
                    }}>
                      {label}
                    </p>
                    <p style={{
                      fontSize: 12, fontWeight: 700,
                      color: val ? '#1A1A1A' : '#CCC', margin: 0,
                    }}>
                      {val ? formatDateDisplay(val) : hint}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: 1, background: '#F0F0F0', flexShrink: 0 }} />

            {/* Scrollable calendar */}
            <div style={{
              flex: 1, overflowY: 'auto',
              padding: '16px 16px 48px',
              WebkitOverflowScrolling: 'touch',
            }}>
              <InlineCalendar dep={dep} ret={ret} onDayTap={handleDayTap} />
            </div>
          </div>
        </>
      )}

    </div>
  );
}
