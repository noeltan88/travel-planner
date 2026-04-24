import { useRef, lazy, Suspense, useState, Component } from 'react';
import DayTimeline from './DayTimeline';
import HotelCard from './HotelCard';
import FoodSection from './FoodSection';
import PracticalTips from './PracticalTips';
import BottomNav from './BottomNav';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';

const MapView = lazy(() => import('./MapView'));

class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 8 }}>
          <p style={{ fontSize: 32 }}>🗺️</p>
          <p style={{ fontSize: 14 }}>Map failed to load</p>
          <button onClick={() => this.setState({ error: false })} style={{ marginTop: 8, fontSize: 12, color: '#E8472A', background: 'none', border: 'none', cursor: 'pointer' }}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const printRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const currentDay = days[activeDay];
  const currentStops = dayStops[activeDay] || [];
  const primaryCity = cities?.[0] || 'guangzhou';
  const deco = CITY_DECOS[primaryCity] || CITY_DECOS.guangzhou;

  // Get city data for practical tips
  const cityData = loadCityData(currentDay?.city || primaryCity);
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();

  // Stats
  const totalStops = dayStops.flat().length;
  const freeStops = dayStops.flat().filter(s => s.free).length;

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
    const ret = quizAnswers?.return_date || '';
    const cityLine = [...new Set(days.map(d =>
      d.cityHeader ? `${d.cityHeader.emoji} ${d.cityHeader.name}` : d.city
    ))].join(' · ');

    const dayLines = days.map((day, i) => {
      const stops = dayStops[i] || [];
      const header = day.cityHeader ? `${day.label} — ${day.cityHeader.name}` : day.label;
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

    const msg = lines.join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Show map tab
  if (activeTab === 'map') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
        <div className="flex-1 relative" style={{ paddingBottom: 64 }}>
          <MapErrorBoundary>
            <Suspense fallback={<div className="flex items-center justify-center h-64"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading map...</p></div>}>
              <MapView
                days={days}
                dayStops={dayStops}
                activeDay={activeDay}
                onDayChange={setActiveDay}
                primaryCity={primaryCity}
              />
            </Suspense>
          </MapErrorBoundary>
        </div>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  // Show hotels tab
  if (activeTab === 'hotels') {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="hero-bg px-6 pt-14 pb-6">
          <h2 className="text-xl font-bold text-white">Hotel Recommendations</h2>
          <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>Picked for your itinerary locations</p>
        </div>
        <div className="pt-4">
          <HotelCard hotel={hotel} otherHotels={itinerary.hotels?.filter(h => h.id !== hotel?.id).slice(0, 3)} />
        </div>
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  // Show export tab
  if (activeTab === 'export') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="text-center mb-8">
          <p className="text-4xl mb-4">📋</p>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Export Your Itinerary</h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Full itinerary — all days, stops, food picks & hotel recommendation
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
            style={{
              background: 'transparent',
              border: '1.5px solid var(--accent)',
              color: 'var(--accent)',
            }}
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
        <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    );
  }

  // Main itinerary view
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg)' }}>
      <div ref={exportRef}>
        {/* Hero banner */}
        <div className="hero-bg relative overflow-hidden">
          {/* Decorative city character */}
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

            {/* Stats pills */}
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
              const stops = dayStops[i] || [];
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
          {/* Day header */}
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

      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
}
