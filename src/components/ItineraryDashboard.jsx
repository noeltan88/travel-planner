import { useRef, useState, useEffect, Component } from 'react';
import DayTimeline from './DayTimeline';
import HotelCard from './HotelCard';
import PracticalTips from './PracticalTips';
import BottomNav from './BottomNav';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';
import MapView, { MapErrorBoundary } from './MapView';

// ── Date helper ────────────────────────────────────────────────────────────────
function formatDayDate(departureDateStr, dayIndex) {
  if (!departureDateStr) return null;
  try {
    // Use noon UTC to dodge DST edge cases
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

// ── City decoration map ────────────────────────────────────────────────────────
const CITY_DECOS = {
  guangzhou:  { char: '穗', emoji: '🏯', name: 'Guangzhou', zh: '广州' },
  shenzhen:   { char: '深', emoji: '🌆', name: 'Shenzhen',  zh: '深圳' },
  shanghai:   { char: '沪', emoji: '🏙️', name: 'Shanghai',  zh: '上海' },
  chongqing:  { char: '渝', emoji: '🌆', name: 'Chongqing', zh: '重庆' },
  chengdu:    { char: '蓉', emoji: '🐼', name: 'Chengdu',   zh: '成都' },
  beijing:    { char: '京', emoji: '🏯', name: 'Beijing',   zh: '北京' },
  hangzhou:   { char: '杭', emoji: '🌊', name: 'Hangzhou',  zh: '杭州' },
};

export default function ItineraryDashboard({
  itinerary, dayStops, activeDay, setActiveDay,
  activeTab, setActiveTab, deleteStop, swapStop,
  itineraryRef, quizAnswers, onReset,
}) {
  const exportRef       = useRef(null);
  const printRef        = useRef(null);
  const daySectionRefs  = useRef([]);   // one ref per day section
  const stickyTabsRef   = useRef(null); // ref to sticky tabs bar (for height)
  const [exporting, setExporting] = useState(false);

  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const primaryCity    = cities?.[0] || 'guangzhou';
  const deco           = CITY_DECOS[primaryCity] || CITY_DECOS.guangzhou;
  const cityData       = loadCityData(days[0]?.city || primaryCity);
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();
  const totalStops     = dayStops.flat().length;
  const freeStops      = dayStops.flat().filter(s => s.free).length;
  const depDate        = quizAnswers?.departure_date || null;

  // ── Scroll tracking: update active day tab as user scrolls ──────────────────
  useEffect(() => {
    if (activeTab !== 'itinerary') return;

    function onScroll() {
      const stickyH = stickyTabsRef.current?.offsetHeight ?? 44;
      let current = 0;
      for (let i = 0; i < daySectionRefs.current.length; i++) {
        const el = daySectionRefs.current[i];
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        // Section has scrolled past the sticky bar → it's now "active"
        if (top <= stickyH + 24) current = i;
      }
      setActiveDay(current);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [activeTab, setActiveDay]);

  // ── Scroll to a day section when tab is tapped ──────────────────────────────
  function scrollToDay(dayIdx) {
    const el = daySectionRefs.current[dayIdx];
    if (!el) return;
    const stickyH = stickyTabsRef.current?.offsetHeight ?? 44;
    const top = el.getBoundingClientRect().top + window.scrollY - stickyH - 8;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  // ── Export handlers ──────────────────────────────────────────────────────────
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
      const stops   = dayStops[i] || [];
      const header  = day.cityHeader ? `${day.label} — ${day.cityHeader.name}` : day.label;
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

  // ────────────────────────────────────────────────────────────────────────────
  // Single return — all tabs always in DOM; CSS display:none/block keeps
  // the Mapbox canvas alive when switching away from the map tab.
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ══ MAP TAB — always mounted ══════════════════════════════════════════ */}
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

      {/* ══ HOTELS TAB ════════════════════════════════════════════════════════ */}
      <div style={{ display: activeTab === 'hotels' ? 'block' : 'none', paddingBottom: 80 }}>
        <div className="hero-bg px-6 pt-14 pb-6">
          <h2 className="text-xl font-bold text-white">Hotel Recommendations</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Picked for your itinerary locations</p>
        </div>
        <div className="pt-4">
          <HotelCard
            hotel={hotel}
            otherHotels={itinerary.hotels?.filter(h => h.id !== hotel?.id).slice(0, 3)}
          />
        </div>
      </div>

      {/* ══ EXPORT TAB ════════════════════════════════════════════════════════ */}
      <div style={{
        display: activeTab === 'export' ? 'flex' : 'none',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', padding: '0 24px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>📋</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Export Your Itinerary</h2>
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
        <PrintView printRef={printRef} itinerary={itinerary} dayStops={dayStops} quizAnswers={quizAnswers} />
      </div>

      {/* ══ ITINERARY TAB — continuous scroll ════════════════════════════════ */}
      <div style={{ display: activeTab === 'itinerary' ? 'block' : 'none' }}>
        <div ref={exportRef}>

          {/* ── Hero banner ─────────────────────────────────────────────────── */}
          <div className="hero-bg relative overflow-hidden">
            <div
              className="absolute top-4 right-4 font-black leading-none pointer-events-none select-none"
              style={{ fontSize: 80, color: 'var(--accent-deco)', opacity: 0.55 }}
            >
              {deco.char}
            </div>
            <div className="px-6 pt-14 pb-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{deco.emoji}</span>
                <h1 className="text-xl font-bold text-white">{deco.name}</h1>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{deco.zh}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {cityData?.tagline}
              </p>
              <div className="flex gap-2 flex-wrap">
                {[
                  { label: `${totalStops} stops` },
                  { label: `${freeStops} free` },
                  { label: `${days.length} days` },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ background: 'rgba(255,255,255,0.13)' }}
                  >
                    {stat.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Sticky day tabs ──────────────────────────────────────────────── */}
          <div
            ref={stickyTabsRef}
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 20,
              background: '#fff',
              borderBottom: '1px solid #f1f5f9',
              display: 'flex',
              overflowX: 'auto',
              gap: 8,
              padding: '8px 12px',
              // hide scrollbar
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
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
                    flexShrink: 0,
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: 'none',
                    whiteSpace: 'nowrap',
                    background: active ? 'rgba(232,71,42,0.12)' : '#f1f5f9',
                    color:      active ? 'var(--accent)' : '#64748b',
                    outline:    active ? '1.5px solid var(--accent)' : 'none',
                  }}
                >
                  Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
                </button>
              );
            })}
          </div>

          {/* ── Continuous day sections ──────────────────────────────────────── */}
          <div style={{ paddingBottom: 80 }}>
            {days.map((day, i) => {
              const stops   = dayStops[i] || [];
              const food    = day.food    || [];
              const dateStr = formatDayDate(depDate, i);
              const city    = day.cityHeader?.name || day.city || '';
              const cityData_i = loadCityData(day.city || primaryCity);

              return (
                <div
                  key={i}
                  ref={el => { daySectionRefs.current[i] = el; }}
                >
                  {/* Day section header */}
                  <div style={{ padding: '20px 16px 6px' }}>
                    {/* Divider with day label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                      <p style={{
                        fontSize: 12, fontWeight: 700, color: 'var(--text-primary)',
                        whiteSpace: 'nowrap',
                      }}>
                        Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
                      </p>
                      <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.07)' }} />
                    </div>
                    {/* Sub-header: stop count + city */}
                    <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
                      {stops.length} stop{stops.length !== 1 ? 's' : ''}
                      {city ? ` · ${city}` : ''}
                      {day.cityHeader ? ` ${day.cityHeader.emoji}` : ''}
                    </p>
                  </div>

                  {/* Stops + food between + walking time */}
                  <DayTimeline
                    stops={stops}
                    dayIdx={i}
                    onDelete={deleteStop}
                    onSwap={swapStop}
                    allAttractions={allAttractions}
                    food={food}
                  />

                  {/* Practical tips — once per city change or on last day */}
                  {(i === days.length - 1 || days[i + 1]?.city !== day.city) && cityData_i?.practical && (
                    <PracticalTips practical={cityData_i.practical} />
                  )}
                </div>
              );
            })}

            {/* Hotel card — once at the very end */}
            <HotelCard hotel={hotel} otherHotels={otherHotels} />
          </div>

        </div>
      </div>

      {/* ══ BOTTOM NAV — always visible ══════════════════════════════════════ */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
