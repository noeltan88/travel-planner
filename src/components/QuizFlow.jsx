/**
 * QuizFlow — redesigned UI
 * Background: #F5F4F2, white cards, coral dot progress at bottom
 * Step order: country → city → dates → group → pace → dietary → vibe (VibeCheck)
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { QUIZ, getCityOptions } from '../utils/quizData';
import VibeCheck from './VibeCheck';
import chinaConnections   from '../data/city-connections.json';
import japanConnections   from '../data/city-connections-japan.json';
import koreaConnections   from '../data/city-connections-korea.json';
import thailandConnections from '../data/city-connections-thailand.json';
import vietnamConnections  from '../data/city-connections-vietnam.json';

// City connections indexed by country key
const CITY_CONNECTIONS_BY_COUNTRY = {
  china:       chinaConnections,
  japan:       japanConnections,
  south_korea: koreaConnections,
  thailand:    thailandConnections,
  vietnam:     vietnamConnections,
};

// Base sightseeing days per city by country
const DAYS_PER_CITY = { china: 2.5, japan: 3, south_korea: 2.5, thailand: 3, vietnam: 2.5 };

function getRecommendedDays(cities, country, cityConnections) {
  if (!cities || cities.length === 0) return null;
  const cityCount = cities.length;

  // Count travel days needed between consecutive cities
  let travelDays = 0;
  for (let i = 0; i < cities.length - 1; i++) {
    const key1 = `${cities[i]}→${cities[i + 1]}`;
    const key2 = `${cities[i + 1]}→${cities[i]}`;
    const connection = cityConnections?.cities?.[key1] || cityConnections?.cities?.[key2];
    if (connection?.travel_day === true) travelDays++;
  }

  const base    = DAYS_PER_CITY[country] || 2.5;
  const minDays = Math.round(cityCount * base) + travelDays;
  const maxDays = Math.round(cityCount * (base + 1)) + travelDays;
  return { minDays, maxDays, travelDays };
}

// ── Holiday definitions by country ────────────────────────────────────────────
const HOLIDAYS_BY_COUNTRY = {
  china: [
    { name: 'Chinese New Year 2026',         start: '2026-01-28', end: '2026-02-04' },
    { name: 'Qingming Festival 2026',        start: '2026-04-04', end: '2026-04-06' },
    { name: 'May Day Golden Week 2026',      start: '2026-05-01', end: '2026-05-05' },
    { name: 'Dragon Boat Festival 2026',     chineseName: '端午节', start: '2026-06-19', end: '2026-06-21', warning: 'Dragon Boat Festival — expect crowds at scenic spots and higher prices. Book accommodation early.', severity: 'medium' },
    { name: 'National Day Golden Week 2026', start: '2026-10-01', end: '2026-10-07' },
    { name: 'Chinese New Year 2027',         start: '2027-02-15', end: '2027-02-22' },
    { name: 'May Day Golden Week 2027',      start: '2027-05-01', end: '2027-05-05' },
    { name: 'Dragon Boat Festival 2027',     chineseName: '端午节', start: '2027-06-09', end: '2027-06-11', warning: 'Dragon Boat Festival — expect crowds at scenic spots and higher prices. Book accommodation early.', severity: 'medium' },
    { name: 'National Day Golden Week 2027', start: '2027-10-01', end: '2027-10-07' },
  ],
  japan: [
    { name: 'Golden Week 2026',  start: '2026-04-29', end: '2026-05-05', warning: 'Golden Week — one of Japan\'s busiest travel periods. Trains and hotels book out fast. Reserve well in advance.' },
    { name: 'Obon 2026',         start: '2026-08-13', end: '2026-08-16', warning: 'Obon Festival — many Japanese travel home. Expect busy transport and some shop closures.' },
    { name: 'New Year 2026–27',  start: '2026-12-29', end: '2027-01-03', warning: 'New Year period — Japan is very busy. Shrines are crowded and many businesses close.' },
    { name: 'Golden Week 2027',  start: '2027-04-29', end: '2027-05-05', warning: 'Golden Week — one of Japan\'s busiest travel periods. Trains and hotels book out fast. Reserve well in advance.' },
    { name: 'Obon 2027',         start: '2027-08-13', end: '2027-08-16', warning: 'Obon Festival — many Japanese travel home. Expect busy transport and some shop closures.' },
  ],
  south_korea: [
    { name: 'Chuseok 2026',           start: '2026-09-25', end: '2026-09-27', warning: 'Chuseok (Korean Thanksgiving) — major holiday. Expect very busy transport and many shop closures.' },
    { name: "Children's Day 2026",     start: '2026-05-05', end: '2026-05-05', warning: "Children's Day — family-friendly attractions are packed. Book ahead." },
    { name: 'Chuseok 2027',           start: '2027-10-14', end: '2027-10-16', warning: 'Chuseok (Korean Thanksgiving) — major holiday. Expect very busy transport and many shop closures.' },
    { name: 'Lunar New Year 2027',    start: '2027-01-28', end: '2027-01-30', warning: 'Lunar New Year — busy travel period. Book transport and accommodation well in advance.' },
    { name: "Children's Day 2027",     start: '2027-05-05', end: '2027-05-05', warning: "Children's Day — family-friendly attractions are packed. Book ahead." },
  ],
  thailand: [
    { name: 'Songkran 2026',       start: '2026-04-13', end: '2026-04-15', warning: 'Songkran (Thai New Year) — water festival nationwide. Streets are very busy and wet. Embrace it!' },
    { name: 'Loy Krathong 2026',   start: '2026-11-01', end: '2026-11-01', warning: 'Loy Krathong — beautiful lantern festival. Chiang Mai is especially crowded. Book early.' },
    { name: 'Songkran 2027',       start: '2027-04-13', end: '2027-04-15', warning: 'Songkran (Thai New Year) — water festival nationwide. Streets are very busy and wet. Embrace it!' },
    { name: 'Loy Krathong 2027',   start: '2027-10-21', end: '2027-10-21', warning: 'Loy Krathong — beautiful lantern festival. Chiang Mai is especially crowded. Book early.' },
  ],
  vietnam: [
    { name: 'Tet 2027',              start: '2027-01-28', end: '2027-02-03', warning: 'Tet (Vietnamese New Year) — the biggest holiday of the year. Most businesses close for a week. Transport is very busy.' },
    { name: 'Reunification Day 2026', start: '2026-04-30', end: '2026-04-30', warning: 'Reunification Day — national holiday. Some closures; Ho Chi Minh City is especially busy.' },
    { name: 'National Day 2026',      start: '2026-09-02', end: '2026-09-02', warning: 'National Day — public holiday. Expect parades and crowds in major cities.' },
    { name: 'Reunification Day 2027', start: '2027-04-30', end: '2027-04-30', warning: 'Reunification Day — national holiday. Some closures; Ho Chi Minh City is especially busy.' },
    { name: 'National Day 2027',      start: '2027-09-02', end: '2027-09-02', warning: 'National Day — public holiday. Expect parades and crowds in major cities.' },
  ],
};

// Legacy default (China) for backward compat
const HOLIDAYS = HOLIDAYS_BY_COUNTRY.china;

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

// ── Animated calendar — slide transition on month change ─────────────────────
const CAL_ANIM_MS = 280;

function AnimatedCalendar({ year, month, dep, ret, onDayClick }) {
  const [current,  setCurrent]  = useState({ year, month });
  const [pending,  setPending]  = useState(null); // { year, month, direction }
  const animating  = useRef(false);
  const prevYM     = useRef({ year, month });
  const latestYM   = useRef({ year, month });

  useEffect(() => {
    latestYM.current = { year, month };
    if (year === prevYM.current.year && month === prevYM.current.month) return;
    if (animating.current) return;

    const fwd = year > prevYM.current.year ||
      (year === prevYM.current.year && month > prevYM.current.month);

    prevYM.current   = { year, month };
    animating.current = true;

    setPending({ year, month, direction: fwd ? 'next' : 'prev' });

    setTimeout(() => {
      const target = latestYM.current;
      setCurrent(target);
      setPending(null);
      animating.current  = false;
      prevYM.current     = target;
    }, CAL_ANIM_MS + 20);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <style>{`
        @keyframes cal-in-right  { from { transform: translateX(100%);  } to { transform: translateX(0); } }
        @keyframes cal-in-left   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes cal-out-left  { from { transform: translateX(0); } to { transform: translateX(-100%); } }
        @keyframes cal-out-right { from { transform: translateX(0); } to { transform: translateX(100%);  } }
      `}</style>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        {/* Invisible height holder — keeps wrapper height correct during animation */}
        <div style={{ visibility: 'hidden', pointerEvents: 'none', userSelect: 'none' }}>
          <MonthGrid year={year} month={month} dep={dep} ret={ret} onDayClick={() => {}} />
        </div>
        {/* Outgoing (or static) month */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0,
          animation: pending
            ? `cal-out-${pending.direction === 'next' ? 'left' : 'right'} ${CAL_ANIM_MS}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`
            : 'none',
        }}>
          <MonthGrid year={current.year} month={current.month} dep={dep} ret={ret} onDayClick={onDayClick} />
        </div>
        {/* Incoming month */}
        {pending && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            animation: `cal-in-${pending.direction === 'next' ? 'right' : 'left'} ${CAL_ANIM_MS}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
          }}>
            <MonthGrid year={pending.year} month={pending.month} dep={dep} ret={ret} onDayClick={onDayClick} />
          </div>
        )}
      </div>
    </>
  );
}

// ── FlightInput — compact 2-col style ────────────────────────────────────────
function FlightInput({ label, value, onChange }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#999', fontWeight: 700, margin: '0 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </p>
      <label style={{ display: 'block', background: '#fff', borderRadius: 12, border: '0.5px solid #E0E0E0', padding: 12, cursor: 'pointer' }}>
        <input
          type="time"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          style={{
            display: 'block', width: '100%',
            background: 'transparent', border: 'none', outline: 'none',
            color: value ? '#1A1A1A' : '#C0BDB9',
            fontSize: 14, fontWeight: value ? 600 : 400,
            colorScheme: 'light',
          }}
        />
      </label>
    </div>
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
  const calSwipeStartX = useRef(null);
  const calendarRef    = useRef(null);  // FIX 3: for non-passive touchmove

  // Family-kids extras scroll ref
  const familyExtrasRef = useRef(null);

  // Flight times slide-up
  const [showFlightTimes, setShowFlightTimes] = useState(false);
  const flightTimesRef = useRef(null);

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

  // FIX 2 — auto-scroll family extras into view when family-kids is selected
  useEffect(() => {
    if (!isFamilyKids) return;
    const t = setTimeout(() => {
      familyExtrasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
    return () => clearTimeout(t);
  }, [isFamilyKids]);

  // Clear city selection when country changes (prevents stale city keys crossing over)
  useEffect(() => {
    setAnswers(a => ({ ...a, city: [] }));
  }, [answers.country]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance 1s after any country is selected on country screen
  useEffect(() => {
    if (step !== 0 || !answers.country) return;
    const t = setTimeout(() => { setStep(1); }, 1000);
    return () => clearTimeout(t);
  }, [answers.country, step]);

  // Date range helpers
  const datesAnswer = answers.dates || {};
  const dep         = datesAnswer.departure || '';
  const ret         = datesAnswer.return    || '';
  const totalDays   = dep && ret ? Math.round((new Date(ret) - new Date(dep)) / 86400000) + 1 : 0;
  const dateError   = dep && ret && dep >= ret;

  // Recommended days — computed from selected cities + country connections
  const recDays = isDateRange
    ? getRecommendedDays(
        answers.city || [],
        answers.country || 'china',
        CITY_CONNECTIONS_BY_COUNTRY[answers.country || 'china'],
      )
    : null;
  if (isDateRange) console.log('recDays:', recDays, 'cities:', answers.city, 'country:', answers.country);
  const activeHolidays = HOLIDAYS_BY_COUNTRY[answers.country] || HOLIDAYS_BY_COUNTRY.china;
  const overlappingHolidays = useMemo(() => {
    if (!dep || !ret || dateError) return [];
    return activeHolidays.filter(h => dep <= h.end && ret >= h.start);
  }, [dep, ret, dateError, answers.country]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reveal + scroll flight times when both dates are picked
  useEffect(() => {
    if (dep && ret && !dateError) {
      setShowFlightTimes(true);
      setTimeout(() => {
        flightTimesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 450);
    }
  }, [dep, ret]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 3 — prevent page scroll while swiping calendar horizontally
  useEffect(() => {
    const el = calendarRef.current;
    if (!el) return;
    const handler = (e) => {
      if (calSwipeStartX.current === null) return;
      const dx = Math.abs(e.touches[0].clientX - calSwipeStartX.current);
      if (dx > 8) e.preventDefault(); // horizontal swipe → block vertical scroll
    };
    el.addEventListener('touchmove', handler, { passive: false });
    return () => el.removeEventListener('touchmove', handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = isDateRange
    ? Boolean(dep && ret && !dateError && totalDays >= 1)
    : q.multi ? (selected || []).length > 0 : selected !== null && selected !== undefined;

  // Dynamic city options based on selected country
  const activeCityOptions = isCity ? getCityOptions(answers.country || 'china') : q.options;
  const visibleCities = isCity && citySearch.trim()
    ? activeCityOptions.filter(o => o.name.toLowerCase().includes(citySearch.toLowerCase()))
    : activeCityOptions;
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

  // FIX 1 — calendar swipe gesture
  function onCalTouchStart(e) {
    calSwipeStartX.current = e.touches[0].clientX;
  }
  function onCalTouchEnd(e) {
    if (calSwipeStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - calSwipeStartX.current;
    calSwipeStartX.current = null;
    if (dx < -50) nextCal();
    else if (dx > 50) prevCal();
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
          <span style={{ fontSize: 14, fontWeight: 700, color: ACC, letterSpacing: -0.2 }}>Travel Planner</span>
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
        <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {q.options.map(opt => {
            const sel = isSel(opt.value);
            return (
              <button
                key={opt.value}
                onClick={() => toggle(opt.value)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 18px', borderRadius: 16, textAlign: 'left',
                  cursor: 'pointer', background: '#fff',
                  borderTop: `1.5px solid ${sel ? ACC : 'transparent'}`,
                  borderRight: `1.5px solid ${sel ? ACC : 'transparent'}`,
                  borderBottom: `1.5px solid ${sel ? ACC : 'transparent'}`,
                  borderLeft: `4px solid ${sel ? ACC : 'transparent'}`,
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
              >
                <span style={{ fontSize: 26, flexShrink: 0 }}>{opt.icon}</span>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 600, color: '#1A1A1A' }}>{opt.name}</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#999', marginTop: 2 }}>{opt.desc}</p>
                </div>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                  border: sel ? `6px solid ${ACC}` : '2px solid #D0D0D0',
                  background: '#fff', transition: 'border 0.15s',
                }} />
              </button>
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
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'none', padding: '0 16px 8px' }}>
          {/* Month navigation */}
          <div style={{
            background: BG,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 2px 10px', flexShrink: 0,
          }}>
            <button
              onClick={prevCal}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7L7 13" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#1A1A1A' }}>
              {MONTH_NAMES[calMonth]} {calYear}
            </p>
            <button
              onClick={nextCal}
              style={{ width: 36, height: 36, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
            >
              <svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1L7 7L1 13" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>

          {/* Animated calendar card — swipe left/right to change month */}
          <div
            ref={calendarRef}
            onTouchStart={onCalTouchStart}
            onTouchEnd={onCalTouchEnd}
            style={{ background: '#fff', borderRadius: 18, padding: '14px 10px', marginBottom: 10, touchAction: 'pan-y', flexShrink: 0 }}
          >
            <AnimatedCalendar year={calYear} month={calMonth} dep={dep} ret={ret} onDayClick={handleDayTap} />
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

          {/* Recommended days pill — below date summary, always visible */}
          {recDays && (
            <div style={{ textAlign: 'center', marginBottom: 10 }}>
              <div style={{
                display:       'inline-flex',
                flexDirection: 'column',
                alignItems:    'center',
                background:    '#FEF0EC',
                border:        '1px solid #FFCFBF',
                borderRadius:  20,
                padding:       '8px 16px',
              }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: '#E8472A', whiteSpace: 'nowrap' }}>
                  💡 We recommend {recDays.minDays}–{recDays.maxDays} days
                </span>
                {recDays.travelDays > 0 && (
                  <span style={{ fontSize: 11, color: '#B83520', marginTop: 2, whiteSpace: 'nowrap' }}>
                    Includes {recDays.travelDays} travel day{recDays.travelDays > 1 ? 's' : ''} between cities
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Holiday warnings */}
          {overlappingHolidays.map(h => (
            <div key={h.name} style={{ background: 'rgba(245,158,11,0.07)', border: '1.5px solid rgba(245,158,11,0.28)', borderRadius: 14, padding: '11px 16px', marginBottom: 10 }}>
              <p style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5, margin: 0 }}>
                ⚠️ {h.warning
                  ? <><strong>{h.name}{h.chineseName ? ` ${h.chineseName}` : ''}</strong> — {h.warning}</>
                  : <>Your dates overlap with <strong>{h.name}</strong> — very crowded. Book well in advance.</>
                }
              </p>
            </div>
          ))}

          {/* Flight times — slides up once both dates are selected */}
          <div
            ref={flightTimesRef}
            style={{
              maxHeight:  showFlightTimes ? '300px' : '0px',
              opacity:    showFlightTimes ? 1 : 0,
              overflow:   'hidden',
              transition: 'max-height 400ms ease-in-out, opacity 300ms ease-in-out',
              marginTop:  showFlightTimes ? '12px' : '0',
            }}
          >
            <p style={{ fontSize: 13, color: '#999', fontWeight: 600, margin: '0 0 10px' }}>
              ✈️ Add flight times
              <span style={{ fontSize: 11, fontWeight: 400, color: '#C0BDB9', marginLeft: 6 }}>optional</span>
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <FlightInput
                label="Arrival"
                value={answers.arrival_time}
                onChange={v => setAnswers(a => ({ ...a, arrival_time: v }))}
              />
              <FlightInput
                label="Departure"
                value={answers.departure_time}
                onChange={v => setAnswers(a => ({ ...a, departure_time: v }))}
              />
            </div>
            <p style={{ fontSize: 11, color: '#BBB', textAlign: 'center', margin: '8px 0 0' }}>
              Helps us plan your first and last day
            </p>
          </div>
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

          {/* Family extras — ref used for auto-scroll (FIX 2) */}
          {isFamilyKids && (
            <div ref={familyExtrasRef} style={{ marginTop: 12, background: '#fff', borderRadius: 18, padding: 16 }}>
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
        <VibeCheck key={step} selectedCities={answers.city || []} country={answers.country || 'china'} onComplete={handleVibeComplete} />
      )}

      {/* ════════════════ BOTTOM BAR ══════════════════════════════════════════ */}
      {!isVibe && (
        <div style={{ padding: '10px 20px 32px', flexShrink: 0, background: BG }}>
          <DotProgress step={step} total={QUIZ.length} />

          {/* Country: show confirmation text instead of button */}
          {isCountry ? (
            <div style={{ height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 10 }}>
              {answers.country ? (
                <p style={{ fontSize: 14, color: ACC, fontWeight: 600, margin: 0 }}>
                  ✓ Great choice! Setting up your trip…
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
