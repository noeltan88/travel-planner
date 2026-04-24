import { useRef, useState, useEffect } from 'react';
import DayTimeline from './DayTimeline';
import HotelCard from './HotelCard';
import PracticalTips from './PracticalTips';
import BottomNav from './BottomNav';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';
// Full-screen map tab — always mounted so the Mapbox canvas is never destroyed
import MapView, { MapErrorBoundary } from './MapView';
// Lean 300 px map embedded at the top of the itinerary tab
import ItineraryMap from './ItineraryMap';

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

const MAP_HEIGHT = 300; // px — must match ItineraryMap's explicit height

export default function ItineraryDashboard({
  itinerary, dayStops, activeDay, setActiveDay,
  activeTab, setActiveTab, deleteStop, swapStop,
  itineraryRef, quizAnswers, onReset,
}) {
  const printRef       = useRef(null);
  const daySectionRefs = useRef([]);   // one ref per day section for scroll tracking
  const stickyTabsRef  = useRef(null); // sticky day-tabs bar
  const [exporting, setExporting] = useState(false);

  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const primaryCity    = cities?.[0] || 'guangzhou';
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();
  const depDate        = quizAnswers?.departure_date || null;

  // ── Scroll tracking — update active day tab as user scrolls ───────────────
  useEffect(() => {
    if (activeTab !== 'itinerary') return;

    function onScroll() {
      const tabsH  = stickyTabsRef.current?.offsetHeight ?? 44;
      const offset = MAP_HEIGHT + tabsH + 24; // map + tabs + small lookahead
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
  }, [activeTab, setActiveDay]);

  // ── Scroll to a section when a day tab is tapped ──────────────────────────
  function scrollToDay(dayIdx) {
    const el    = daySectionRefs.current[dayIdx];
    if (!el) return;
    const tabsH = stickyTabsRef.current?.offsetHeight ?? 44;
    const top   = el.getBoundingClientRect().top + window.scrollY - MAP_HEIGHT - tabsH - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // ── Export handlers ────────────────────────────────────────────────────────
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
      const header = day.cityHeader ? `${day.label} — ${day.cityHeader.name}` : day.label;
      return `*${header}*\n${stops.map(s => `  • ${s.name}`).join('\n')}`;
    });
    const lines = [
      '✈️ My China Trip Itinerary', cityLine,
      dep && ret ? `📅 ${dep} → ${ret} (${days.length} days)` : `📅 ${days.length} days`,
      '', ...dayLines, '',
      hotel ? `🏨 Staying at: ${hotel.name}` : '', '',
      'Generated with ChinaTrip Planner 🗺️',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Single return — every tab always in the DOM.
  // CSS display:none/block keeps both Mapbox canvases alive.
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ══ MAP TAB — full-screen, always mounted ════════════════════════════ */}
      <div style={{
        display: activeTab === 'map' ? 'flex' : 'none',
        flexDirection: 'column', flex: '1 1 auto', paddingBottom: 64,
      }}>
        <MapErrorBoundary>
          <MapView
            days={days}
            dayStops={dayStops}
            activeDay={activeDay}
            onDayChange={setActiveDay}
            primaryCity={primaryCity}
            isVisible={activeTab === 'map'}
          />
        </MapErrorBoundary>
      </div>

      {/* ══ HOTELS TAB ═══════════════════════════════════════════════════════ */}
      <div style={{ display: activeTab === 'hotels' ? 'block' : 'none', paddingBottom: 80 }}>
        <div className="hero-bg px-6 pt-14 pb-6">
          <h2 className="text-xl font-bold text-white">Hotel Recommendations</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Picked for your itinerary locations
          </p>
        </div>
        <div className="pt-4">
          <HotelCard
            hotel={hotel}
            otherHotels={itinerary.hotels?.filter(h => h.id !== hotel?.id).slice(0, 3)}
          />
        </div>
      </div>

      {/* ══ EXPORT TAB ═══════════════════════════════════════════════════════ */}
      <div style={{
        display: activeTab === 'export' ? 'flex' : 'none',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '0 24px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>📋</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Export Your Itinerary
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            All days, stops, food picks &amp; hotel recommendation
          </p>
        </div>
        <button
          onClick={handleExport} disabled={exporting}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-white mb-2"
          style={{ background: exporting ? '#94a3b8' : 'var(--accent)' }}
        >
          {exporting ? 'Generating PDF…' : '📥 Download PDF'}
        </button>
        <p className="text-xs text-center mb-6" style={{ color: 'var(--text-muted)' }}>
          Saves as {primaryCity}-{days.length}-day-itinerary.pdf
        </p>
        <button
          onClick={handleWhatsApp}
          className="w-full max-w-xs py-4 rounded-2xl font-bold text-white mb-3"
          style={{ background: '#25D366' }}
        >
          💬 Share on WhatsApp
        </button>
        {onReset && (
          <button
            onClick={onReset}
            className="w-full max-w-xs py-3 rounded-2xl font-semibold"
            style={{ background: 'transparent', border: '1.5px solid var(--accent)', color: 'var(--accent)' }}
          >
            🔄 Plan a new trip →
          </button>
        )}
        <PrintView
          printRef={printRef}
          itinerary={itinerary}
          dayStops={dayStops}
          quizAnswers={quizAnswers}
        />
      </div>

      {/* ══ ITINERARY TAB — continuous scroll ════════════════════════════════
           Layout (top → bottom):
            1. ItineraryMap  — 300 px, sticky top:0
            2. Day tabs      — sticky top:300px
            3. Day sections  — continuous scroll
            4. Hotel card    — very bottom                                    */}
      <div style={{ display: activeTab === 'itinerary' ? 'block' : 'none' }}>

        {/* ── 1. Embedded map — sticky at the very top ───────────────────── */}
        <div style={{
          position: 'sticky',
          top:      0,
          zIndex:   15,
          width:    '100%',
          height:   MAP_HEIGHT,
          background: '#f1f5f9', // visible while map loads
          boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        }}>
          <ItineraryMap
            days={days}
            dayStops={dayStops}
            activeDay={activeDay}
            primaryCity={primaryCity}
            isVisible={activeTab === 'itinerary'}
          />
        </div>

        {/* ── 2. Day tabs — sticky just below the map ────────────────────── */}
        <div
          ref={stickyTabsRef}
          style={{
            position:         'sticky',
            top:              MAP_HEIGHT,
            zIndex:           10,
            background:       '#fff',
            borderBottom:     '1px solid #f1f5f9',
            display:          'flex',
            overflowX:        'auto',
            gap:              8,
            padding:          '8px 12px',
            scrollbarWidth:   'none',
            msOverflowStyle:  'none',
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
                  flexShrink:  0,
                  padding:     '6px 14px',
                  borderRadius: 20,
                  fontSize:    12,
                  fontWeight:  600,
                  cursor:      'pointer',
                  border:      'none',
                  whiteSpace:  'nowrap',
                  background:  active ? 'rgba(232,71,42,0.12)' : '#f1f5f9',
                  color:       active ? 'var(--accent)' : '#64748b',
                  outline:     active ? '1.5px solid var(--accent)' : 'none',
                }}
              >
                Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
              </button>
            );
          })}
        </div>

        {/* ── 3. Continuous day sections ──────────────────────────────────── */}
        <div style={{ paddingBottom: 80 }}>
          {days.map((day, i) => {
            const stops      = dayStops[i] || [];
            const food       = day.food    || [];
            const dateStr    = formatDayDate(depDate, i);
            const cityName   = day.cityHeader?.name || day.city || '';
            const cityData_i = loadCityData(day.city || primaryCity);

            return (
              <div
                key={i}
                ref={el => { daySectionRefs.current[i] = el; }}
              >
                {/* Section header */}
                <div style={{ padding: '20px 16px 6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
                    </p>
                    <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                    {stops.length} stop{stops.length !== 1 ? 's' : ''}
                    {cityName ? ` · ${cityName}` : ''}
                    {day.cityHeader ? ` ${day.cityHeader.emoji}` : ''}
                  </p>
                </div>

                {/* Stops with food + walking rows between them */}
                <DayTimeline
                  stops={stops}
                  dayIdx={i}
                  onDelete={deleteStop}
                  onSwap={swapStop}
                  allAttractions={allAttractions}
                  food={food}
                />

                {/* Practical tips at city boundaries */}
                {(i === days.length - 1 || days[i + 1]?.city !== day.city) &&
                  cityData_i?.practical && (
                  <PracticalTips practical={cityData_i.practical} />
                )}
              </div>
            );
          })}

          {/* ── 4. Hotel card — once at the very bottom ──────────────────── */}
          <HotelCard hotel={hotel} otherHotels={otherHotels} />
        </div>

      </div>

      {/* ══ BOTTOM NAV — always visible ══════════════════════════════════════
           Map tab stays: tapping it opens the full-screen MapView with
           interactive stop list, perfect for detailed exploration.           */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
