/**
 * ItineraryDashboard — vertical timeline variant
 *
 * Design tokens:
 *   bg      #F5F4F2   cards  #FFFFFF   accent #E8472A
 *   text-1  #1A1A1A   text-2 #999      border 0.5px #EEEBE6
 *   shadow  0 2px 12px rgba(0,0,0,0.06)
 *
 * Structure:
 *   • Sticky header — city name + trip summary + Share pill, then scrollable day tabs
 *   • Continuous scroll — day sections (DaySectionHeader + DayTimeline)
 *   • Hotel card + export/share inline at the bottom
 *   • Floating coral map FAB (fixed, bottom-right)
 *   • Full-screen UnifiedMap overlay when FAB tapped
 */
import { useRef, useState, useEffect } from 'react';
import DayTimeline from './DayTimeline';
import PracticalTips from './PracticalTips';
import PrintView from './PrintView';
import { exportToPDF } from '../utils/pdfExport';
import { loadCityData } from '../utils/algorithm';
import UnifiedMap from './UnifiedMap';

// ── Design tokens ─────────────────────────────────────────────────────────────
const ACCENT   = '#E8472A';
const PAGE_BG  = '#F5F4F2';
const LINE_COL = '#EEEBE6';

// ── Date helpers ──────────────────────────────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function formatDayDate(departureDateStr, dayIndex) {
  if (!departureDateStr) return null;
  try {
    const base = new Date(departureDateStr + 'T12:00:00Z');
    base.setUTCDate(base.getUTCDate() + dayIndex);
    return `${DAYS[base.getUTCDay()]} ${base.getUTCDate()} ${MONTHS[base.getUTCMonth()]}`;
  } catch { return null; }
}

// FIX 2: "17–21 Jun 2026"  or  "17 Jun – 3 Jul 2026"  (en-dash, no ISO strings)
function formatTripDates(dep, ret) {
  if (!dep) return null;
  try {
    const d1 = new Date(dep + 'T12:00:00Z');
    if (!ret) return `${d1.getUTCDate()} ${MONTHS[d1.getUTCMonth()]} ${d1.getUTCFullYear()}`;
    const d2 = new Date(ret + 'T12:00:00Z');
    if (d1.getUTCMonth() === d2.getUTCMonth() && d1.getUTCFullYear() === d2.getUTCFullYear()) {
      // Same month: "17–21 Jun 2026"
      return `${d1.getUTCDate()}–${d2.getUTCDate()} ${MONTHS[d1.getUTCMonth()]} ${d1.getUTCFullYear()}`;
    }
    // Different months: "17 Jun – 3 Jul 2026"
    return `${d1.getUTCDate()} ${MONTHS[d1.getUTCMonth()]} – ${d2.getUTCDate()} ${MONTHS[d2.getUTCMonth()]} ${d2.getUTCFullYear()}`;
  } catch { return null; }
}

// ── Day section header — "DAY 01", date, stops, estimated spend ───────────────
function DaySectionHeader({ dayNum, dateStr, stopCount, cityName, cityEmoji, estimatedSpend }) {
  const label = `DAY ${String(dayNum).padStart(2, '0')}`;
  return (
    <div style={{
      padding: '20px 16px 10px',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    }}>
      <div>
        <p style={{
          fontSize: 11, fontWeight: 800, color: ACCENT,
          letterSpacing: 1.5, margin: 0, textTransform: 'uppercase',
        }}>
          {label}
        </p>
        {dateStr && (
          <p style={{ fontSize: 17, fontWeight: 700, color: '#1A1A1A', margin: '2px 0 0', lineHeight: 1.2 }}>
            {dateStr}
          </p>
        )}
        <p style={{ fontSize: 11, color: '#999', margin: '3px 0 0', fontWeight: 500 }}>
          {stopCount != null
            ? `${stopCount} stop${stopCount !== 1 ? 's' : ''}`
            : 'Travel day'}
          {cityName ? ` · ${cityName}` : ''}
        </p>
      </div>
      {estimatedSpend > 0 && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <p style={{ fontSize: 10, color: '#999', margin: 0, fontWeight: 500 }}>Est. spend</p>
          <p style={{ fontSize: 15, fontWeight: 700, color: '#1A1A1A', margin: '2px 0 0' }}>
            ¥{estimatedSpend}
          </p>
        </div>
      )}
    </div>
  );
}

// ── FIX 2: Travel day card ────────────────────────────────────────────────────
const TRAVEL_EMOJI = {
  hsr:               '🚄',
  flight:            '✈️',
  flight_then_drive: '✈️🚗',
  hsr_then_drive:    '🚄🚗',
  drive:             '🚗',
};
const TRAVEL_LABEL = {
  hsr:               'High Speed Rail',
  flight:            'Flight',
  flight_then_drive: 'Flight + Drive',
  hsr_then_drive:    'HSR + Drive',
  drive:             'Drive',
};
const TRAVEL_TIPS = {
  hsr:               'Book on 12306.cn or Trip.com at least 3 days ahead. Bring your passport — required for train boarding.',
  flight:            'Check in online 24hrs before. Allow 90 mins for airport transfer each end.',
  flight_then_drive: 'Book airport transfer in advance — taxis at remote airports are scarce. Confirm pickup before flying.',
  hsr_then_drive:    'Book on 12306.cn or Trip.com. Arrange a driver at the destination station in advance.',
  drive:             'Hire a driver through your hotel — more reliable than hailing taxis for long distances.',
};

function TravelDayCard({ day, compact = false }) {
  const { connection, fromCityName, toCityName } = day;
  if (!connection) return null;
  const mode  = connection.mode || 'drive';
  const emoji = TRAVEL_EMOJI[mode] || '🚗';
  const label = TRAVEL_LABEL[mode] || mode;
  const tip   = TRAVEL_TIPS[mode]  || TRAVEL_TIPS.drive;

  // ── Compact variant (used inside split travel days) ───────────────
  if (compact) {
    return (
      <div style={{ padding: '4px 16px 4px' }}>
        <div style={{
          background: '#FEF0EC',
          border: `1px solid rgba(232,71,42,0.2)`,
          borderRadius: 12,
          padding: '12px 16px',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 26, lineHeight: 1 }}>{emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>
              {fromCityName} → {toCityName}
            </p>
            <p style={{ fontSize: 12, color: '#666', margin: '2px 0 0' }}>
              {label} · {connection.duration_hrs}h
              {connection.station_note ? ` · ${connection.station_note}` : ''}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Full variant (used for long travel days) ──────────────────────
  return (
    <div style={{ padding: '0 16px 16px' }}>
      <div style={{
        background: '#fff', borderRadius: 14,
        boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
        padding: 20, textAlign: 'center',
      }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{emoji}</div>

        <p style={{ fontSize: 20, fontWeight: 500, color: '#1A1A1A', margin: '0 0 4px' }}>
          {fromCityName} → {toCityName}
        </p>
        <p style={{ fontSize: 13, color: '#999', margin: '0 0 2px' }}>{label}</p>
        <p style={{ fontSize: 13, color: '#999', margin: '0 0 16px' }}>
          {connection.duration_hrs} hour{connection.duration_hrs !== 1 ? 's' : ''}
        </p>

        <div style={{ height: 1, background: ACCENT, opacity: 0.25, margin: '0 0 16px' }} />

        {connection.station_note && (
          <p style={{
            fontSize: 12, color: '#666', fontStyle: 'italic',
            margin: '0 0 16px', lineHeight: 1.5,
          }}>
            {connection.station_note}
          </p>
        )}

        <div style={{
          background: '#FEF0EC',
          borderLeft: `3px solid ${ACCENT}`,
          borderRadius: 8,
          padding: '10px 12px',
          textAlign: 'left',
        }}>
          <p style={{ fontSize: 12, color: '#555', margin: 0, lineHeight: 1.6 }}>{tip}</p>
        </div>
      </div>
    </div>
  );
}

// ── Short transition pill (shown after last day of departure city) ─────────────
function ShortTransitionPill({ transition }) {
  if (!transition?.connection) return null;
  const mode  = transition.connection.mode || 'drive';
  const emoji = TRAVEL_EMOJI[mode] || '🚄';
  const label = TRAVEL_LABEL[mode] || mode;
  return (
    <div style={{ padding: '2px 16px 14px' }}>
      <div style={{
        background: '#F0F9FF',
        border: '1px solid #BAE6FD',
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>{emoji}</span>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#1A1A1A' }}>
            {transition.fromCityName} → {transition.toCityName}
          </span>
          <span style={{ fontSize: 12, color: '#0284C7', marginLeft: 8 }}>
            {transition.connection.duration_hrs}h · {label}
          </span>
          {transition.connection.station_note && (
            <p style={{ fontSize: 11, color: '#666', margin: '2px 0 0', fontStyle: 'italic' }}>
              {transition.connection.station_note}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Section sub-label for split travel days ───────────────────────────────────
function SplitSectionLabel({ cityName }) {
  return (
    <div style={{ padding: '10px 16px 2px' }}>
      <p style={{
        fontSize: 10, fontWeight: 700, color: '#999',
        margin: 0, textTransform: 'uppercase', letterSpacing: 1,
      }}>
        {cityName}
      </p>
    </div>
  );
}

// ── Inline export / share section ─────────────────────────────────────────────
function ExportSection({ onExport, exporting, onWhatsApp, onReset }) {
  return (
    <div style={{ padding: '8px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <div style={{ flex: 1, height: 1, background: LINE_COL }} />
        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600 }}>SAVE &amp; SHARE</span>
        <div style={{ flex: 1, height: 1, background: LINE_COL }} />
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

// ── Floating map FAB ──────────────────────────────────────────────────────────
function MapFAB({ onClick }) {
  return (
    <button
      onClick={onClick}
      aria-label="Show on map"
      style={{
        position: 'fixed', bottom: 24, right: 16, zIndex: 40,
        width: 52, height: 52, borderRadius: '50%',
        background: ACCENT, border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 16px rgba(232,71,42,0.4)',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform  = 'scale(1.08)';
        e.currentTarget.style.boxShadow  = '0 6px 24px rgba(232,71,42,0.55)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform  = 'scale(1)';
        e.currentTarget.style.boxShadow  = '0 4px 16px rgba(232,71,42,0.4)';
      }}
    >
      {/* Route icon: circle origin bottom-left → winding S-path → arrow top-right */}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="6" cy="19" r="3" stroke="white" strokeWidth="2" fill="none"/>
        <path
          d="M9 19 H18 Q21 19 21 16 Q21 13 18 13 H6 Q3 13 3 10 Q3 7 6 7 H18"
          stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"
        />
        <path
          d="M15 4 L18 7 L15 10"
          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
        />
      </svg>
    </button>
  );
}

// ── Hotel accordion card ──────────────────────────────────────────────────────
function HotelAccordionCard({ hotel, agodaHref }) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div style={{
      margin: '0 10px',
      background: '#fff',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      borderLeft: '3px solid #E8472A',
    }}>
      {/* Photo / gradient fallback */}
      {hotel.photo_url && !imgErr ? (
        <img
          src={hotel.photo_url}
          alt={hotel.name}
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: 130, objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div style={{
          width: '100%', height: 130,
          background: 'linear-gradient(135deg, rgba(232,71,42,0.18), rgba(26,26,26,0.12))',
        }} />
      )}

      {/* Content */}
      <div style={{ padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>
              {hotel.name}
            </p>
            {hotel.chinese && (
              <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0' }}>{hotel.chinese}</p>
            )}
            {hotel.area && (
              <p style={{ fontSize: 11, color: '#999', margin: '4px 0 0' }}>📍 {hotel.area}</p>
            )}
            {hotel.rating != null && (
              <p style={{ fontSize: 12, color: '#999', margin: '4px 0 0' }}>
                ⭐ {hotel.rating}
                {hotel.reviews != null ? ` · ${hotel.reviews} reviews` : ''}
              </p>
            )}
          </div>
          {hotel.price && (
            <p style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', flexShrink: 0, margin: 0 }}>
              {hotel.price}
            </p>
          )}
        </div>

        {/* Agoda CTA */}
        <a
          href={agodaHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', marginTop: 10,
            height: 44, lineHeight: '44px', textAlign: 'center',
            background: '#1A1A1A', color: '#fff',
            fontSize: 13, fontWeight: 500,
            borderRadius: 10, textDecoration: 'none',
          }}
        >
          Check on Agoda →
        </a>
      </div>
    </div>
  );
}

// ── Where to stay section ─────────────────────────────────────────────────────
function WhereToStay({ cities, days, quizAnswers }) {
  // Distinct sightseeing city keys, in visit order, intersected with itinerary cities list
  const visitedCities = [...new Set(
    days
      .filter(d => !d.isTravelDay && !d.isSplitTravelDay && d.city)
      .map(d => d.city),
  )].filter(ck => cities.includes(ck));

  const defaultCity = visitedCities[0] || cities[0] || '';
  const [selectedCity, setSelectedCity] = useState(defaultCity);
  const [openTier,     setOpenTier]     = useState('luxury'); // luxury expanded by default

  const cityData  = loadCityData(selectedCity);
  const allHotels = cityData?.hotels || [];
  const cityName  = cityData?.name   || selectedCity;
  const checkIn   = quizAnswers?.departure_date || '';
  const checkOut  = quizAnswers?.return_date    || '';

  const byTier = tier =>
    allHotels
      .filter(h => h.budget_tier === tier)
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, 5);

  const TIERS = [
    { key: 'luxury', emoji: '👑', label: 'Luxury',    hotels: byTier('luxury') },
    { key: 'mid',    emoji: '🏨', label: 'Mid-range', hotels: byTier('mid')    },
    { key: 'budget', emoji: '💰', label: 'Budget',    hotels: byTier('budget') },
  ];

  function agodaHref(hotel) {
    const p = new URLSearchParams({ city: cityName, adults: '2', textToSearch: hotel.name });
    if (checkIn)  p.set('checkIn',  checkIn);
    if (checkOut) p.set('checkOut', checkOut);
    return `https://www.agoda.com/search?${p}`;
  }

  function toggleTier(tier) {
    setOpenTier(prev => (prev === tier ? null : tier));
  }

  return (
    <div style={{ padding: '8px 0 24px' }}>

      {/* Section divider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px 20px' }}>
        <div style={{ flex: 1, height: 1, background: LINE_COL }} />
        <span style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>🏨 Where to stay</span>
        <div style={{ flex: 1, height: 1, background: LINE_COL }} />
      </div>

      {/* Header */}
      <div style={{ padding: '0 16px 4px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 500, color: '#1A1A1A', margin: 0, lineHeight: 1.3 }}>
          Where to stay in {cityName}?
        </h2>
        <p style={{ fontSize: 13, color: '#999', margin: '4px 0 0' }}>
          Recommended based on your stops
        </p>
      </div>

      {/* City selector pills — multi-city trips only */}
      {visitedCities.length > 1 && (
        <div style={{
          display: 'flex', gap: 8, padding: '12px 16px 4px',
          overflowX: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>
          {visitedCities.map(ck => {
            const nm  = loadCityData(ck)?.name || ck;
            const sel = ck === selectedCity;
            return (
              <button
                key={ck}
                onClick={() => setSelectedCity(ck)}
                style={{
                  flexShrink: 0, padding: '6px 16px', borderRadius: 20,
                  border: sel ? 'none' : `1px solid ${LINE_COL}`,
                  background: sel ? ACCENT : '#fff',
                  color:      sel ? '#fff' : '#1A1A1A',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                }}
              >
                {nm}
              </button>
            );
          })}
        </div>
      )}

      {/* Accordion */}
      <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TIERS.map(({ key, emoji, label, hotels }) => {
          const isOpen = openTier === key;
          return (
            <div
              key={key}
              style={{ borderRadius: 14, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
            >
              {/* Section header */}
              <button
                onClick={() => toggleTier(key)}
                style={{
                  width: '100%', background: '#fff', border: 'none',
                  borderBottom: isOpen ? `2px solid ${ACCENT}` : 'none',
                  padding: 16, display: 'flex', alignItems: 'center',
                  cursor: 'pointer', gap: 10,
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 500, color: '#1A1A1A', flex: 1, textAlign: 'left' }}>
                  {label}
                </span>
                <span style={{ fontSize: 13, color: '#999', flexShrink: 0 }}>
                  {hotels.length} hotel{hotels.length !== 1 ? 's' : ''}
                </span>
                <span style={{
                  fontSize: 18, color: '#999', flexShrink: 0, lineHeight: 1, marginLeft: 2,
                  display: 'inline-block',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}>
                  ›
                </span>
              </button>

              {/* Expanded hotel list */}
              {isOpen && (
                <div style={{
                  background: '#F5F4F2', padding: '10px 0 10px',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  {hotels.length === 0 ? (
                    <p style={{ padding: '8px 16px', fontSize: 13, color: '#999', margin: 0 }}>
                      No hotels available in this category
                    </p>
                  ) : (
                    hotels.map(hotel => (
                      <HotelAccordionCard
                        key={hotel.id}
                        hotel={hotel}
                        agodaHref={agodaHref(hotel)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ItineraryDashboard({
  itinerary, dayStops, activeDay, setActiveDay,
  activeTab, setActiveTab,   // kept for API compat
  deleteStop, swapStop, addStopToDay,
  itineraryRef, quizAnswers, onReset,
}) {
  const printRef       = useRef(null);
  const daySectionRefs = useRef([]);
  const stickyTabsRef  = useRef(null);
  const tabsScrollRef  = useRef(null);   // FIX 7: ref for tab scroll container
  const tabRefs        = useRef([]);     // FIX 7: refs for each tab button
  const [exporting,     setExporting]     = useState(false);
  const [mapOpen,       setMapOpen]       = useState(false);
  const [showTutorial,  setShowTutorial]  = useState(false);

  // ── Swipe tutorial — show once, 1 s after load, auto-dismiss after 3 s ────
  useEffect(() => {
    if (localStorage.getItem('swipe-tutorial-shown')) return;
    const t1 = setTimeout(() => setShowTutorial(true), 1000);
    const t2 = setTimeout(() => {
      setShowTutorial(false);
      localStorage.setItem('swipe-tutorial-shown', '1');
    }, 4000); // 1 s delay + 3 s display
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  if (!itinerary) return null;

  const { days, allAttractionsByCity, cities, hotel, otherHotels } = itinerary;
  const primaryCity    = cities?.[0] || 'guangzhou';
  const allAttractions = Object.values(allAttractionsByCity || {}).flat();
  const depDate        = quizAnswers?.departure_date || null;
  const retDate        = quizAnswers?.return_date    || null;

  // All used stop IDs across every day (for swap deduplication)
  const allUsedIds = new Set(
    days.flatMap((_, i) => (dayStops[i] || []).map(s => s.id)),
  );

  // Food data per city for UnifiedMap explore mode
  const allFoodByCity = {};
  (cities || []).forEach(ck => {
    const cd = loadCityData(ck);
    if (cd?.food) allFoodByCity[ck] = cd.food;
  });

  // ── Sticky header content ─────────────────────────────────────────────────
  // FIX 1: De-duplicate by city KEY, then look up display name + emoji.
  // cityHeader is only set on the first day of each city group; later days of
  // the same city have cityHeader=null but d.city=key — so we must dedup by key,
  // not by the display string (which caused "🥘 Guangzhou · guangzhou" bug).
  const seenCityKeys  = new Set();
  const cityDisplays  = [];
  days.forEach(d => {
    const key = d.city || primaryCity;
    if (seenCityKeys.has(key)) return;
    seenCityKeys.add(key);
    // Prefer cityHeader (set by algorithm with correct emoji+name)
    if (d.cityHeader?.name) {
      const e = d.cityHeader.emoji ? `${d.cityHeader.emoji} ` : '';
      cityDisplays.push(`${e}${d.cityHeader.name}`);
    } else {
      // Fall back to master DB lookup
      const cd = loadCityData(key);
      if (cd?.name) cityDisplays.push(cd.emoji ? `${cd.emoji} ${cd.name}` : cd.name);
      else          cityDisplays.push(key);
    }
  });
  const headerTitle = cityDisplays.join(' · ');

  // Human-readable date range + pace label (no raw ISO dates)
  const PACE_LABELS = { chill: 'Chill', balance: 'Balance', pack: 'Pack it in' };
  const tripDates   = formatTripDates(depDate, retDate);
  const paceLabel   = PACE_LABELS[quizAnswers?.pace] || '';

  // FIX 1: distinguish sightseeing days from full travel days in the header
  const longTravelDayCount  = days.filter(d => d.isTravelDay).length;
  const sightseeingDayCount = days.length - longTravelDayCount;
  const dayCountStr = longTravelDayCount > 0
    ? `${sightseeingDayCount} day${sightseeingDayCount !== 1 ? 's' : ''} + ${longTravelDayCount} travel day${longTravelDayCount !== 1 ? 's' : ''}`
    : `${days.length} day${days.length !== 1 ? 's' : ''}`;

  const summaryLine = [tripDates, dayCountStr, paceLabel].filter(Boolean).join(' · ');

  // ── Block body scroll when map is open ───────────────────────────────────
  useEffect(() => {
    document.documentElement.style.overflow = mapOpen ? 'hidden' : '';
    return () => { document.documentElement.style.overflow = ''; };
  }, [mapOpen]);

  // ── FIX 1: IntersectionObserver — reliable active day tab as user scrolls ──
  useEffect(() => {
    if (mapOpen) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.dataset.dayIndex);
            if (!isNaN(index)) setActiveDay(index);
          }
        });
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
    );
    daySectionRefs.current.forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [mapOpen, days.length, setActiveDay]);

  // ── FIX 2: Scroll to a section when day tab is tapped ────────────────────
  function scrollToDay(dayIndex) {
    const el = document.getElementById(`day-section-${dayIndex}`);
    if (el) {
      const stickyHeaderHeight = 100;
      const top = el.getBoundingClientRect().top + window.scrollY - stickyHeaderHeight;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  }

  // ── FIX 7: Auto-scroll itinerary tabs to keep active tab visible ──────────
  useEffect(() => {
    const activeTab = tabRefs.current[activeDay];
    const container = tabsScrollRef.current;
    if (!activeTab || !container) return;
    const scrollLeft =
      activeTab.offsetLeft - container.offsetWidth / 2 + activeTab.offsetWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [activeDay]);

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
    window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ background: PAGE_BG }}>

      {/* ══ STICKY HEADER ════════════════════════════════════════════════════ */}
      <div
        ref={stickyTabsRef}
        style={{
          display:      mapOpen ? 'none' : 'block',
          position:     'sticky',
          top:          0,
          zIndex:       20,
          background:   '#fff',
          borderBottom: `0.5px solid ${LINE_COL}`,
          boxShadow:    '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        {/* City name + trip summary + Share button */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          padding: '12px 16px 8px', gap: 12,
        }}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: 20, fontWeight: 800, color: '#1A1A1A',
              margin: 0, lineHeight: 1.15,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {headerTitle}
            </h1>
            {summaryLine && (
              <p style={{ fontSize: 11, color: '#999', margin: '2px 0 0', fontWeight: 500 }}>
                {summaryLine}
              </p>
            )}
          </div>
          <button
            onClick={handleWhatsApp}
            style={{
              flexShrink: 0, background: ACCENT, color: '#fff',
              border: 'none', cursor: 'pointer',
              borderRadius: 20, padding: '7px 14px',
              fontSize: 12, fontWeight: 700,
            }}
          >
            Share ↗
          </button>
        </div>

        {/* Scrollable day tabs — FIX 7: ref for auto-scroll */}
        <div
          ref={tabsScrollRef}
          style={{
            display: 'flex', overflowX: 'auto', gap: 8,
            padding: '0 14px 10px',
            scrollbarWidth: 'none', msOverflowStyle: 'none',
          }}
        >
          {days.map((day, i) => {
            const dateStr = formatDayDate(depDate, i);
            const active  = i === activeDay;
            return (
              <button
                key={i}
                ref={el => { tabRefs.current[i] = el; }}
                onClick={() => scrollToDay(i)}
                style={{
                  flexShrink: 0, padding: '6px 16px', borderRadius: 20,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: 'none', whiteSpace: 'nowrap',
                  background: active ? ACCENT : PAGE_BG,
                  color:      active ? '#fff' : '#94a3b8',
                  transition: 'background 0.15s, color 0.15s',
                }}
              >
                Day {i + 1}{dateStr ? ` · ${dateStr}` : ''}
              </button>
            );
          })}
        </div>
      </div>

      {/* ══ CONTINUOUS SCROLL — days → hotel → export ════════════════════════ */}
      <div style={{ display: mapOpen ? 'none' : 'block', paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}>
        {days.map((day, i) => {
          const stops            = dayStops[i] || [];
          const dateStr          = formatDayDate(depDate, i);
          const isTravelDay      = !!day.isTravelDay;
          const isSplitTravelDay = !!day.isSplitTravelDay;
          const isTransitDay     = isTravelDay || isSplitTravelDay;

          // For split travel days, partition stops by their original morning IDs
          const morningIds    = isSplitTravelDay ? (day.morningStopIds || new Set()) : null;
          const splitMorning  = isSplitTravelDay ? stops.filter(s => morningIds.has(s.id))  : null;
          const splitEvening  = isSplitTravelDay ? stops.filter(s => !morningIds.has(s.id)) : null;

          const cityName = isTransitDay
            ? `${day.fromCityName} → ${day.toCityName}`
            : (day.cityHeader?.name || day.city || '');
          const cityEmoji = isTransitDay
            ? (TRAVEL_EMOJI[day.connection?.mode] || '✈️')
            : (day.cityHeader?.emoji || '');

          const cityData_i = isTransitDay ? null : loadCityData(day.city || primaryCity);
          const estimatedSpend = isTransitDay ? 0 : stops
            .filter(s => !s.free && s.price_rmb)
            .reduce((sum, s) => sum + (Number(s.price_rmb) || 0), 0);

          // Stop count label for the section header
          const stopCount = isTravelDay ? null
            : isSplitTravelDay ? stops.length
            : stops.length;

          return (
            <div
              key={i}
              id={`day-section-${i}`}
              data-day-index={i}
              ref={el => { daySectionRefs.current[i] = el; }}
            >
              <DaySectionHeader
                dayNum={i + 1}
                dateStr={dateStr}
                stopCount={stopCount}
                cityName={cityName}
                cityEmoji={cityEmoji}
                estimatedSpend={estimatedSpend}
              />

              {/* ── Full travel day (long journey, no stops) ────────────── */}
              {isTravelDay && (
                <TravelDayCard day={day} />
              )}

              {/* ── Split travel day (medium journey) ───────────────────── */}
              {isSplitTravelDay && (
                <>
                  {/* Morning half — departure city stops */}
                  <SplitSectionLabel cityName={`Morning · ${day.fromCityName}`} />
                  {splitMorning && splitMorning.length > 0 ? (
                    <DayTimeline
                      stops={splitMorning}
                      dayIdx={i}
                      onDelete={deleteStop}
                      onSwap={swapStop}
                      allAttractions={
                        allAttractionsByCity?.[day.fromCity] || allAttractions
                      }
                      allUsedIds={allUsedIds}
                      allFoodItems={loadCityData(day.fromCity)?.food || []}
                      dietary={quizAnswers?.dietary || []}
                      city={day.fromCity}
                    />
                  ) : (
                    <p style={{ padding: '4px 16px 10px', fontSize: 13, color: '#999', margin: 0 }}>
                      Relax and check out — enjoy breakfast before you go
                    </p>
                  )}

                  {/* Travel connection */}
                  <TravelDayCard day={day} compact />

                  {/* Evening half — arrival city stops */}
                  <SplitSectionLabel cityName={`Evening · ${day.toCityName}`} />
                  {splitEvening && splitEvening.length > 0 ? (
                    <DayTimeline
                      stops={splitEvening}
                      dayIdx={i}
                      onDelete={deleteStop}
                      onSwap={swapStop}
                      allAttractions={
                        allAttractionsByCity?.[day.toCity] || allAttractions
                      }
                      allUsedIds={allUsedIds}
                      allFoodItems={loadCityData(day.toCity)?.food || []}
                      dietary={quizAnswers?.dietary || []}
                      city={day.toCity}
                    />
                  ) : (
                    <p style={{ padding: '4px 16px 16px', fontSize: 13, color: '#999', margin: 0 }}>
                      Settle in and explore the neighbourhood
                    </p>
                  )}
                </>
              )}

              {/* ── Normal sightseeing day ──────────────────────────────── */}
              {!isTravelDay && !isSplitTravelDay && (
                <DayTimeline
                  stops={stops}
                  dayIdx={i}
                  onDelete={deleteStop}
                  onSwap={swapStop}
                  allAttractions={
                    allAttractionsByCity?.[day.city || primaryCity] || allAttractions
                  }
                  allUsedIds={allUsedIds}
                  allFoodItems={cityData_i?.food || []}
                  dietary={quizAnswers?.dietary || []}
                  city={day.city || primaryCity}
                />
              )}

              {/* Short transit pill — shown after the last day of the departure city */}
              {day.shortTransition && (
                <ShortTransitionPill transition={day.shortTransition} />
              )}

              {/* "Before You Go" only on the very first day, never on transit days */}
              {i === 0 && !isTransitDay && cityData_i?.practical && (
                <PracticalTips practical={cityData_i.practical} />
              )}
            </div>
          );
        })}

        {/* ── Where to stay accordion ─────────────────────────────────── */}
        <WhereToStay
          cities={cities || [primaryCity]}
          days={days}
          quizAnswers={quizAnswers}
        />

        {/* ── Export / share ───────────────────────────────────────────── */}
        <ExportSection
          onExport={handleExport}
          exporting={exporting}
          onWhatsApp={handleWhatsApp}
          onReset={onReset}
        />

      </div>

      {/* ══ FLOATING MAP FAB ═════════════════════════════════════════════════ */}
      {!mapOpen && <MapFAB onClick={() => setMapOpen(true)} />}

      {/* ══ FULL-SCREEN MAP OVERLAY ══════════════════════════════════════════ */}
      {mapOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, background: '#e8eaf0' }}>
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
            onAddToDay={addStopToDay}
          />
        </div>
      )}

      {/* ══ SWIPE TUTORIAL TOOLTIP (one-time) ═══════════════════════════════ */}
      {showTutorial && !mapOpen && (
        <div
          className="swipe-tutorial"
          style={{
            position:       'fixed',
            top:            '52vh',
            left:           '50%',
            /* translateX(-50%) applied via keyframe; also set here as initial */
            transform:      'translateX(-50%)',
            zIndex:         45,
            pointerEvents:  'none',
          }}
        >
          <div style={{
            background:     'rgba(26,26,46,0.88)',
            backdropFilter: 'blur(10px)',
            borderRadius:   28,
            padding:        '11px 20px',
            display:        'flex',
            alignItems:     'center',
            gap:            10,
            boxShadow:      '0 4px 20px rgba(0,0,0,0.22)',
            whiteSpace:     'nowrap',
          }}>
            <span className="swipe-tutorial-arrow" style={{ fontSize: 18, color: '#fff' }}>←</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              Swipe to swap or remove
            </span>
          </div>
        </div>
      )}

      {/* ══ HIDDEN PRINT VIEW (PDF export) ══════════════════════════════════ */}
      <PrintView
        printRef={printRef}
        itinerary={itinerary}
        dayStops={dayStops}
        quizAnswers={quizAnswers}
      />
    </div>
  );
}
