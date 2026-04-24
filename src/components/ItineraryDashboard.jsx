import { useRef, useState, Component } from 'react';
import DayTimeline from './DayTimeline';
import HotelCard from './HotelCard';
import FoodSection from './FoodSection';
import PracticalTips from './PracticalTips';
import BottomNav from './BottomNav';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';
// Direct import — no lazy() so the component is never torn down
import MapView, { MapErrorBoundary } from './MapView';

const CITY_DECOS = {
  guangzhou: { char: '穗', emoji: '🏯', name: 'Guangzhou', zh: '广州' },
  shenzhen: { char: '深', emoji: '🌆', name: 'Shenzhen', zh: '深圳' },
  shanghai: { char: '沪', emoji: '🏙️', name: 'Shanghai', zh: '上海' },
  chongqing: { char: '渝', emoji: '🌆', name: 'Chongqing', zh: '重庆' },
  chengdu: { char: '蓉', emoji: '🐼', name: 'Chengdu', zh: '成都' },
  beijing: { char: '京', emoji: '🏯', name: 'Beijing', zh: '北京' },
  hangzhou: { char: '杭', emoji: '🌊', name: 'Hangzhou', zh: '杭州' },
};

export default function ItineraryDashboard({
  itinerary, dayStops, activeDay, setActiveDay,
  activeTab, setActiveTab, deleteStop, swapStop,
  itineraryRef, quizAnswers, onReset,
}) {
  const exportRef = useRef(null);
  const printRef  = useRef(null);
  const [exporting, setExporting] = useState(false);
  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const currentDay    = days[activeDay];
  const currentStops  = dayStops[activeDay] || [];
  const primaryCity   = cities?.[0] || 'guangzhou';
  const deco          = CITY_DECOS[primaryCity] || CITY_DECOS.guangzhou;
  const cityData      = loadCityData(currentDay?.city || primaryCity);
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();
  const totalStops    = dayStops.flat().length;
  const freeStops     = dayStops.flat().filter(s => s.free).length;

  async function handleExport() {
    if (!printRef.current || exporting) return;
    setExporting(true);
    try {
      await exportToPDF(printRef, primaryCity, days.length);
    } finally {
      setExporting(false);
    }
  }

  function handleWhatsApp() {
    const dep = quizAnswers?.departure_date || '';
    const ret = quizAnswers?.return_date    || '';
    const cityLine = [...new Set(days.map(d =>
      d.cityHeader ? `${d.cityHeader.emoji} ${d.cityHeader.name}` : d.city
    ))].join(' · ');

    const dayLines = days.map((day, i) => {
      const stops   = dayStops[i] || [];
      const header  = day.cityHeader ? `${day.label} — ${day.cityHeader.name}` : day.label;
      const stopList = stops.map(s => `  • ${s.name}`).join('\n');
      return `*${header}*\n${stopList}`;
    });

    const lines = [
      '✈️ My China Trip Itinerary',
      cityLine,
      dep && ret ? `📅 ${dep} → ${ret} (${days.length} days)` : `📅 ${days.length} days`,
      '',
      ...dayLines,
      '',
      hotel ? `🏨 Staying at: ${hotel.name}` : '',
      '',
      'Generated with ChinaTrip Planner 🗺️',
    ].filter((l, i, arr) => !(l === '' && arr[i - 1] === ''));

    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Single return — all tabs always in the DOM.
  // The map tab uses CSS display instead of conditional JSX so the Mapbox
  // canvas is never destroyed.  Every other tab is cheap HTML so keeping
  // them mounted has negligible cost.
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── MAP TAB — always mounted, shown/hidden via CSS ─────────────── */}
      <div style={{
        display:       activeTab === 'map' ? 'flex' : 'none',
        flexDirection: 'column',
        flex:          '1 1 auto',
        paddingBottom: 64,
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

      {/* ── HOTELS TAB ────────────────────────────────────────────────────── */}
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

      {/* ── EXPORT TAB ────────────────────────────────────────────────────── */}
      <div style={{
        display:        activeTab === 'export' ? 'flex' : 'none',
        flexDirection:  'column',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '100vh',
        padding:        '0 24px 80px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 40, marginBottom: 16 }}>📋</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Export Your Itinerary</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Full itinerary — all days, stops, food picks &amp; hotel recommendation
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
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

      {/* ── ITINERARY TAB (default) ───────────────────────────────────────── */}
      <div style={{ display: activeTab === 'itinerary' ? 'block' : 'none' }}>
        <div ref={exportRef}>
          {/* Hero banner */}
          <div className="hero-bg relative overflow-hidden">
            <div
              className="absolute top-4 right-4 text-[80px] font-black leading-none pointer-events-none select-none"
              style={{ color: 'var(--accent-deco)', opacity: 0.6 }}
            >
              {deco.char}
            </div>

            <div className="px-6 pt-14 pb-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{deco.emoji}</span>
                <h1 className="text-xl font-bold text-white">{deco.name}</h1>
                <span className="text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>{deco.zh}</span>
              </div>
              <p className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {cityData?.tagline}
              </p>
              <div className="flex gap-2">
                {[
                  { label: `${totalStops} stops` },
                  { label: `${freeStops} free` },
                  { label: `${days.length} days` },
                ].map(stat => (
                  <div
                    key={stat.label}
                    className="px-3 py-1 rounded-full text-xs font-semibold text-white"
                    style={{ background: 'rgba(255,255,255,0.12)' }}
                  >
                    {stat.label}
                  </div>
                ))}
              </div>
            </div>

            {/* Day tabs */}
            <div className="flex gap-2 px-4 pb-4 overflow-x-auto">
              {days.map((day, i) => {
                const isActive = i === activeDay;
                const stops    = dayStops[i] || [];
                const totalHrs = stops.reduce((s, st) => s + st.duration_hrs, 0);
                return (
                  <button
                    key={i}
                    onClick={() => setActiveDay(i)}
                    className="flex-shrink-0 px-3 py-2 rounded-2xl text-left transition-all duration-200"
                    style={{
                      background: isActive ? 'var(--accent-tint)' : 'rgba(255,255,255,0.08)',
                      border: isActive ? '1.5px solid var(--accent)' : '1.5px solid transparent',
                      minWidth: 90,
                    }}
                  >
                    <p className="text-xs font-bold text-white">{day.label}</p>
                    {day.cityHeader && (
                      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {day.cityHeader.emoji} {day.cityHeader.name}
                      </p>
                    )}
                    <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                      {totalHrs.toFixed(0)}h · {stops.length} stops
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Day content */}
          <div style={{ paddingBottom: 80 }}>
            <div className="px-4 pt-5 pb-3 flex items-center gap-2">
              {currentDay?.cityHeader && (
                <span className="text-lg">{currentDay.cityHeader.emoji}</span>
              )}
              <div>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                  {currentDay?.label}
                  {currentDay?.cityHeader && (
                    <span className="ml-2 text-sm font-normal" style={{ color: 'var(--text-muted)' }}>
                      — {currentDay.cityHeader.name}
                    </span>
                  )}
                </h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {currentStops.length} stops · {currentStops.reduce((s, st) => s + st.duration_hrs, 0).toFixed(0)}h touring
                </p>
              </div>
            </div>

            <DayTimeline
              stops={currentStops}
              dayIdx={activeDay}
              onDelete={deleteStop}
              onSwap={swapStop}
              allAttractions={allAttractions}
            />

            <FoodSection food={currentDay?.food} />
            <HotelCard hotel={hotel} otherHotels={otherHotels} />
            <PracticalTips practical={cityData?.practical} />
          </div>
        </div>
      </div>

      {/* ── BOTTOM NAV — always visible ───────────────────────────────────── */}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
