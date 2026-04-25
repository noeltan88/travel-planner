/**
 * ItineraryDashboard — Variation C
 *
 * Design:
 *   • White background, coral (#E8472A) accents throughout
 *   • Day tabs sticky at the very top (no persistent map above them)
 *   • Floating coral 🗺️ FAB (bottom-right) → opens full-screen UnifiedMap overlay
 *   • Hotel card + export/share buttons are inline at the bottom of the scroll
 *   • No separate Hotels or Export tabs — everything lives in one continuous scroll
 */
import { useRef, useState, useEffect } from 'react';
import DayTimeline from './DayTimeline';
import HotelCard from './HotelCard';
import PracticalTips from './PracticalTips';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';
import UnifiedMap from './UnifiedMap';

// ── Date helper ────────────────────────────────────────────────────────────────
function formatDayDate(departureDateStr, dayIndex) {
  if (!departureDateStr) return null;
  try {
    const base = new Date(departureDateStr + 'T12:00:00Z');
    base.setUTCDate(base.getUTCDate() + dayIndex);
    const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dn[base.getUTCDay()]} ${base.getUTCDate()} ${mn[base.getUTCMonth()]}`;
  } catch {
    return null;
  }
}

const ACCENT = '#E8472A';

// ── Section divider — coral left-bar + day label ───────────────────────────────
function DaySectionHeader({ dayNum, dateStr, stopCount, cityName, cityEmoji }) {
  return (
    <div style={{ padding: '28px 16px 10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
        <div style={{
          width: 4, height: 20, borderRadius: 2,
          background: ACCENT, flexShrink: 0,
        }} />
        <p style={{
          fontSize: 15, fontWeight: 800, color: '#1a1a2e',
          margin: 0, letterSpacing: -0.2,
        }}>
          Day {dayNum}{dateStr ? ` · ${dateStr}` : ''}
        </p>
      </div>
      <p style={{
        fontSize: 11, color: '#94a3b8', margin: '0 0 0 14px',
        fontWeight: 500,
      }}>
        {stopCount} stop{stopCount !== 1 ? 's' : ''}
        {cityName ? ` · ${cityName}` : ''}
        {cityEmoji ? ` ${cityEmoji}` : ''}
      </p>
    </div>
  );
}

// ── Inline export section at the bottom of the scroll ─────────────────────────
function ExportSection({ onExport, exporting, onWhatsApp, onReset }) {
  return (
    <div style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>SAVE &amp; SHARE</span>
        <div style={{ flex: 1, height: 1, background: '#f1f5f9' }} />
      </div>

      <button
        onClick={onExport}
        disabled={exporting}
        style={{
          padding: '15px', borderRadius: 16, fontWeight: 700, fontSize: 14,
          color: '#fff', border: 'none', cursor: exporting ? 'default' : 'pointer',
          background: exporting ? '#94a3b8' : ACCENT,
          boxShadow: exporting ? 'none' : `0 4px 16px rgba(232,71,42,0.3)`,
          transition: 'all 0.2s ease',
        }}
      >
        {exporting ? 'Generating PDF…' : '📥 Download PDF'}
      </button>

      <button
        onClick={onWhatsApp}
        style={{
          padding: '15px', borderRadius: 16, fontWeight: 700, fontSize: 14,
          color: '#fff', border: 'none', cursor: 'pointer', background: '#25D366',
          boxShadow: '0 4px 16px rgba(37,211,102,0.25)',
        }}
      >
        💬 Share on WhatsApp
      </button>

      {onReset && (
        <button
          onClick={onReset}
          style={{
            padding: '14px', borderRadius: 16, fontWeight: 600, fontSize: 14,
            color: ACCENT, border: `1.5px solid ${ACCENT}`,
            cursor: 'pointer', background: 'transparent',
          }}
        >
          🔄 Plan a new trip →
        </button>
      )}
    </div>
  );
}

// ── Floating Map button ────────────────────────────────────────────────────────
function MapFAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Show on map"
      style={{
        position:       'fixed',
        bottom:         24,
        right:          20,
        zIndex:         40,
        height:         48,
        borderRadius:   28,
        background:     ACCENT,
        border:         'none',
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        gap:            8,
        padding:        '0 20px 0 16px',
        boxShadow:      `0 4px 20px rgba(232,71,42,0.45)`,
        transition:     'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'scale(1.05)';
        e.currentTarget.style.boxShadow = `0 6px 28px rgba(232,71,42,0.55)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'scale(1)';
        e.currentTarget.style.boxShadow = `0 4px 20px rgba(232,71,42,0.45)`;
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="5"  cy="3.5"  r="2"   fill="white"/>
        <circle cx="15" cy="16.5" r="2"   fill="white"/>
        <circle cx="10" cy="10"   r="1.5" fill="white"/>
        <path
          d="M5 5.5 C5 7.5 10 7.5 10 10 C10 12.5 15 12.5 15 14.5"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: 0.1 }}>
        Show on map
      </span>
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ItineraryDashboard({
  itinerary, dayStops, activeDay, setActiveDay,
  activeTab, setActiveTab,   // kept for API compat; Hotels/Export are now inline
  deleteStop, swapStop,
  itineraryRef, quizAnswers, onReset,
}) {
  const printRef       = useRef(null);
  const daySectionRefs = useRef([]);
  const stickyTabsRef  = useRef(null);
  const [exporting, setExporting]     = useState(false);
  const [mapOpen,   setMapOpen]       = useState(false);   // full-screen map overlay

  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const primaryCity    = cities?.[0] || 'guangzhou';
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();
  const depDate        = quizAnswers?.departure_date || null;

  // All stop IDs across every day (for swap deduplication)
  const allUsedIds = new Set(
    days.flatMap((_, i) => (dayStops[i] || []).map(s => s.id)),
  );

  // Food data per city for UnifiedMap explore mode
  const allFoodByCity = {};
  (cities || []).forEach(ck => {
    const cd = loadCityData(ck);
    if (cd?.food) allFoodByCity[ck] = cd.food;
  });

  // ── Block body scroll when map is open ────────────────────────────────────
  useEffect(() => {
    document.documentElement.style.overflow = mapOpen ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [mapOpen]);

  // ── Scroll tracking — update active day tab as user scrolls ──────────────
  useEffect(() => {
    if (mapOpen) return;
    function onScroll() {
      const tabsH  = stickyTabsRef.current?.offsetHeight ?? 48;
      const offset = tabsH + 16;
      let current  = 0;
      for (let i = 0; i < daySectionRefs.current.length; i++) {
        const el = daySectionRefs.current[i];
        if (!el) continue;
        if (el.getBoundingClientRect().top <= offset) current = i;
        else break;
      }
      setActiveDay(current);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [mapOpen, setActiveDay]);

  // ── Scroll to a section when a day tab is tapped ─────────────────────────
  function scrollToDay(dayIdx) {
    const el    = daySectionRefs.current[dayIdx];
    if (!el) return;
    const tabsH = stickyTabsRef.current?.offsetHeight ?? 48;
    const top   = el.getBoundingClientRect().top + window.scrollY - tabsH - 4;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // ── Export handlers ───────────────────────────────────────────────────────
  async function handleExport() {
    if (!printRef.current || exporting) return;
    setExporting(true);
    try { await exportToPDF(printRef, primaryCity, days.length); }
    finally { setExporting(false); }
  }

  function handleWhatsApp() {
    const dep      = quizAnswers?.departure_date || '';
    const ret      = quizAnswers?.return_date    || '';
    const cityLine = [...new Set(days.map(d =>
      d.cityHeader ? `${d.cityHeader.emoji} ${d.cityHeader.name}` : d.city
    ))].join(' · ');
    const dayLines = days.map((day, i) => {
      const stops  = dayStops[i] || [];
      const header = day.cityHeader
        ? `${day.label} — ${day.cityHeader.name}`
        : day.label;
      return `*${header}*\n${stops.map(s => `  • ${s.name}`).join('\n')}`;
    });
    const lines = [
      '✈️ My China Trip Itinerary', cityLine,
      dep && ret
        ? `📅 ${dep} → ${ret} (${days.length} days)`
        : `📅 ${days.length} days`,
      '', ...dayLines, '',
      hotel ? `🏨 Staying at: ${hotel.name}` : '',
      '',
      'Generated with ChinaTrip Planner 🗺️',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
    window.open(
      `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`,
      '_blank',
    );
  }

  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#fff' }}>

      {/* ══ STICKY DAY TABS ══════════════════════════════════════════════════
           Sits right at the top — no map pushing it down.                    */}
      <div
        ref={stickyTabsRef}
        style={{
          display:         mapOpen ? 'none' : 'flex',
          position:        'sticky',
          top:             0,
          zIndex:          20,
          background:      '#fff',
          borderBottom:    '1px solid #f1f5f9',
          overflowX:       'auto',
          gap:             8,
          padding:         '10px 14px',
          scrollbarWidth:  'none',
          msOverflowStyle: 'none',
          boxShadow:       '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        {days.map((day, i) => {
          const dateStr = formatDayDate(depDate, i);
          const active  = i === activeDay;
          return (
            <button
              key={i}
              onClick={() => scrollToDay(i)}
              style={{
                flexShrink:   0,
                padding:      '6px 16px',
                borderRadius: 20,
                fontSize:     12,
                fontWeight:   700,
                cursor:       'pointer',
                border:       'none',
                whiteSpace:   'nowrap',
                background:   active ? ACCENT : '#f8f9fb',
                color:        active ? '#fff' : '#64748b',
                transition:   'background 0.15s, color 0.15s',
              }}
            >
              Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
            </button>
          );
        })}
      </div>

      {/* ══ CONTINUOUS SCROLL — days → hotel → export ════════════════════════ */}
      <div style={{
        display:       mapOpen ? 'none' : 'block',
        paddingBottom: 88,   // room for the FAB
      }}>
        {days.map((day, i) => {
          const stops      = dayStops[i] || [];
          const food       = day.food    || [];
          const dateStr    = formatDayDate(depDate, i);
          const cityName   = day.cityHeader?.name || day.city || '';
          const cityEmoji  = day.cityHeader?.emoji || '';
          const cityData_i = loadCityData(day.city || primaryCity);

          return (
            <div
              key={i}
              ref={el => { daySectionRefs.current[i] = el; }}
            >
              <DaySectionHeader
                dayNum={i + 1}
                dateStr={dateStr}
                stopCount={stops.length}
                cityName={cityName}
                cityEmoji={cityEmoji}
              />

              <DayTimeline
                stops={stops}
                dayIdx={i}
                onDelete={deleteStop}
                onSwap={swapStop}
                allAttractions={
                  allAttractionsByCity?.[day.city || primaryCity] || allAttractions
                }
                allUsedIds={allUsedIds}
                food={food}
              />

              {/* Practical tips at each city boundary */}
              {(i === days.length - 1 || days[i + 1]?.city !== day.city) &&
                cityData_i?.practical && (
                <PracticalTips practical={cityData_i.practical} />
              )}
            </div>
          );
        })}

        {/* ── Hotel card inline ─────────────────────────────────────────── */}
        <div style={{ padding: '12px 0 0' }}>
          <HotelCard
            hotel={hotel}
            otherHotels={
              itinerary.hotels?.filter(h => h.id !== hotel?.id).slice(0, 3)
              ?? otherHotels
            }
          />
        </div>

        {/* ── Export / share inline ─────────────────────────────────────── */}
        <ExportSection
          onExport={handleExport}
          exporting={exporting}
          onWhatsApp={handleWhatsApp}
          onReset={onReset}
        />
      </div>

      {/* ══ FLOATING MAP FAB ═════════════════════════════════════════════════ */}
      {!mapOpen && <MapFAB onClick={() => setMapOpen(true)} />}

      {/* ══ FULL-SCREEN MAP OVERLAY ══════════════════════════════════════════
           UnifiedMap already has its own expand/collapse controls;
           we pass expanded=true so it renders in full-screen card-rail mode. */}
      {mapOpen && (
        <div style={{
          position:   'fixed',
          inset:      0,
          zIndex:     50,
          background: '#e8eaf0',
        }}>
          <UnifiedMap
            days={days}
            dayStops={dayStops}
            activeDay={activeDay}
            onDayChange={setActiveDay}
            primaryCity={primaryCity}
            isVisible={mapOpen}
            expanded={true}
            onExpand={() => {}}
            onCollapse={() => setMapOpen(false)}
            deleteStop={deleteStop}
            swapStop={swapStop}
            allAttractions={allAttractions}
            allAttractionsByCity={allAttractionsByCity}
            allFoodByCity={allFoodByCity}
            depDate={depDate}
          />
        </div>
      )}

      {/* ══ HIDDEN PRINT VIEW (for PDF export) ══════════════════════════════ */}
      <PrintView
        printRef={printRef}
        itinerary={itinerary}
        dayStops={dayStops}
        quizAnswers={quizAnswers}
      />

    </div>
  );
}
