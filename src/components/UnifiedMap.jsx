/**
 * UnifiedMap — full-screen map + explore, Screen 4 redesign.
 *
 * Day view:
 *   - 110 px horizontal snap card rail (bottom 0), photo 110 px wide on left
 *   - Number badge bottom-left of photo, always coral
 *   - Dark floating day tabs directly above card rail
 *   - Floating "Explore" pill button above the day tabs (bottom-right)
 *   - Swipe up on card → swap modal | swipe down → delete
 *
 * Explore mode:
 *   - White filter pills at top-16px (Attractions / Food / Hotels)
 *   - Teal / amber / slate category markers; tap → 220 px bottom sheet
 *   - Bottom sheet: photo + info + Add to Day X picker
 *   - "← Back to plan" dark pill at bottom centre
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import AttractionImage from './AttractionImage';
import { getSwapAlternatives } from '../utils/algorithm';
import { ChevronRight, X, Mountain, Utensils, Bed, Minimize2, Maximize2, Compass } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ACCENT       = '#E8472A';
const TINT         = '#FEF0EC';

// Layout constants
const CARD_H     = 120;   // card rail height
const DAY_TABS_H = 44;    // dark day tabs strip
const SCROLL_PAD = 20;    // left/right padding in the scroll rail

// Explore marker colours
const EXPLORE_COLORS = {
  attraction: '#1D9E75',
  food:       '#BA7517',
  hotel:      '#4A5568',
};

const CITY_CENTERS = {
  guangzhou:    { lng: 113.2644, lat: 23.1291 },
  shenzhen:     { lng: 114.0579, lat: 22.5431 },
  shanghai:     { lng: 121.4737, lat: 31.2304 },
  chongqing:    { lng: 106.5516, lat: 29.5630 },
  chengdu:      { lng: 104.0668, lat: 30.5728 },
  beijing:      { lng: 116.4074, lat: 39.9042 },
  hangzhou:     { lng: 120.1551, lat: 30.2741 },
  xian:         { lng: 108.9480, lat: 34.2658 },
  guilin:       { lng: 110.2990, lat: 25.2736 },
  changsha:     { lng: 112.9388, lat: 28.2282 },
  zhangjiajie:  { lng: 110.4797, lat: 29.1248 },
  yunnan:       { lng: 102.7124, lat: 25.0453 },
  suzhou:       { lng: 120.5853, lat: 31.2990 },
  jiuzhaigou:   { lng: 103.9184, lat: 33.2600 },
  harbin:       { lng: 126.5353, lat: 45.8038 },
  changbaishan: { lng: 128.0622, lat: 42.0069 },
  sanya:        { lng: 109.5119, lat: 18.2528 },
  xiamen:       { lng: 118.0894, lat: 24.4798 },
  huangshan:    { lng: 118.3364, lat: 30.1334 },
  nanjing:      { lng: 118.7969, lat: 32.0603 },
  qingdao:      { lng: 120.3826, lat: 36.0671 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDayDate(departureDateStr, dayIndex) {
  if (!departureDateStr) return null;
  try {
    const base = new Date(departureDateStr + 'T12:00:00Z');
    base.setUTCDate(base.getUTCDate() + dayIndex);
    const dn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${dn[base.getUTCDay()]} ${base.getUTCDate()} ${mn[base.getUTCMonth()]}`;
  } catch { return null; }
}

// ─── DayDivider — slim dark pill, NOT a scroll-snap target ───────────────────
function DayDivider({ label }) {
  return (
    <div style={{
      flexShrink: 0, height: CARD_H,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px',
    }}>
      <div style={{
        background: 'rgba(20,20,38,0.82)', backdropFilter: 'blur(10px)',
        borderRadius: 20, padding: '7px 16px', whiteSpace: 'nowrap',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
          {label}
        </span>
      </div>
    </div>
  );
}

// ─── StopCard — Screen 4 redesign ────────────────────────────────────────────
// Photo 110 px wide on left; number badge bottom-left coral;
// info: name 14/500, Chinese 11px, time + clock, district + pin, vibe tag, hints.
function StopCard({ stop, index, active, onSwipeUp, onSwipeDown }) {
  const dragRef = useRef(null);
  const [dragY, setDragY] = useState(0);

  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, locked: null };
  }
  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (!d.locked && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      d.locked = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    if (d.locked === 'y') setDragY(Math.max(-80, Math.min(60, dy)));
  }
  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY, dx = e.clientX - d.startX;
    if (d.locked === 'y' && Math.abs(dy) > 50 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) onSwipeUp(); else onSwipeDown();
    }
    setDragY(0);
    dragRef.current = null;
  }

  return (
    <div
      className="stop-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setDragY(0); dragRef.current = null; }}
      style={{
        flexShrink:      0,
        width:           'calc(100vw - 80px)',
        maxWidth:        360,
        height:          CARD_H,
        borderRadius:    14,
        background:      '#fff',
        boxShadow:       active
          ? '0 8px 28px rgba(232,71,42,0.20)'
          : '0 3px 12px rgba(0,0,0,0.10)',
        display:         'flex',
        overflow:        'hidden',
        scrollSnapAlign: 'center',
        transform:       `translateY(${dragY}px)`,
        transition:      dragY === 0
          ? 'transform 0.25s ease, box-shadow 0.2s ease, border-color 0.15s'
          : 'none',
        cursor:          'grab',
        userSelect:      'none',
        touchAction:     'pan-x',
        border:          `2px solid ${active ? ACCENT : 'transparent'}`,
      }}
    >
      {/* ── Photo — 110 px wide, full card height ── */}
      <div style={{ width: 110, height: '100%', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
        <AttractionImage
          src={stop.photo_url || null}
          alt={stop.name}
          category={stop.category}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Number badge — bottom-left, always coral */}
        <div style={{
          position: 'absolute', bottom: 7, left: 7,
          width: 22, height: 22, borderRadius: '50%',
          background: ACCENT, border: '1.5px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff',
        }}>
          {index + 1}
        </div>
      </div>

      {/* ── Info panel ── */}
      <div style={{
        flex: 1, padding: '9px 10px 8px 10px',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}>
        {/* Name — 14px / weight 500, single-line ellipsis to prevent cutoff */}
        <p style={{
          fontWeight: 500, fontSize: 14, color: '#1a1a2e', margin: '0 0 2px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {stop.name}
        </p>

        {/* Chinese name */}
        {stop.chinese && (
          <p style={{
            fontSize: 11, color: '#94a3b8', margin: '0 0 2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {stop.chinese}
          </p>
        )}

        {/* Time with clock icon */}
        {stop.startTime && (
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
            🕐 {stop.startTime}
          </p>
        )}

        {/* District with pin */}
        {stop.district && (
          <p style={{
            fontSize: 11, color: '#64748b', margin: '0 0 2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            📍 {stop.district}
          </p>
        )}

        {/* Vibe tag */}
        {stop.vibe_tags?.[0] && (
          <span style={{
            fontSize: 10, padding: '2px 8px', borderRadius: 20,
            background: TINT, color: ACCENT, fontWeight: 600,
            alignSelf: 'flex-start', marginTop: 2,
          }}>
            {stop.vibe_tags[0]}
          </span>
        )}

        {/* Swap / remove hints pushed to bottom */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#E8472A', fontWeight: 500 }}>↑ swap</span>
          <div style={{ width: 1, height: 10, background: '#f1c9c2' }} />
          <span style={{ fontSize: 11, color: '#E8472A', fontWeight: 500 }}>↓ remove</span>
        </div>
      </div>
    </div>
  );
}

// ─── SwapPanel — bottom sheet for choosing a replacement stop ─────────────────
function SwapPanel({ stop, alternatives, onSwap, onClose }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  function animatedClose() { setVisible(false); setTimeout(onClose, 320); }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
      <div onClick={animatedClose} style={{
        position: 'absolute', inset: 0,
        background: `rgba(0,0,0,${visible ? 0.42 : 0})`,
        transition: 'background 0.3s ease',
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        transform: `translateY(${visible ? '0%' : '100%'})`,
        transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight: '65%', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px', flexShrink: 0,
        }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 2px', color: '#1a1a2e' }}>Swap stop</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Replace "{stop.name}"</p>
          </div>
          <button onClick={animatedClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: '#94a3b8' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 16px 32px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alternatives.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No nearby alternatives available.
            </p>
          ) : alternatives.map(alt => (
            <div
              key={alt.id}
              onClick={() => { onSwap(alt); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 14,
                border: '1.5px solid #f1f5f9', cursor: 'pointer',
                background: '#fafafa', transition: 'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}
            >
              <div style={{ width: 56, height: 56, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
                <AttractionImage src={alt.photo_url || null} alt={alt.name} category={alt.category} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontWeight: 600, fontSize: 13, margin: '0 0 3px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a2e',
                }}>
                  {alt.name}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                  {alt.duration_hrs ? `${alt.duration_hrs}h` : ''}
                  {alt.vibe_tags?.[0] ? ` · ${alt.vibe_tags[0]}` : ''}
                </p>
              </div>
              <ChevronRight size={16} color="#cbd5e1" style={{ flexShrink: 0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ExploreSheet — 220 px bottom sheet when a marker is tapped ──────────────
function ExploreSheet({ item, days, onAddToDay, onClose }) {
  const [visible, setVisible] = useState(false);
  const [dayPick, setDayPick] = useState(0);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function close() { setVisible(false); setTimeout(onClose, 320); }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 25 }}>
      {/* Dim backdrop */}
      <div onClick={close} style={{
        position: 'absolute', inset: 0,
        background: `rgba(0,0,0,${visible ? 0.35 : 0})`,
        transition: 'background 0.3s ease',
      }} />

      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '20px 20px 0 0',
        transform: `translateY(${visible ? '0%' : '100%'})`,
        transition: 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '50%', overflow: 'hidden',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px', flexShrink: 0 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
        </div>

        {/* Content row: photo + info + close */}
        <div style={{ display: 'flex', alignItems: 'flex-start', padding: '0 16px 12px', flexShrink: 0 }}>
          {/* Photo */}
          <div style={{ width: 88, height: 88, borderRadius: 12, overflow: 'hidden', flexShrink: 0 }}>
            <AttractionImage src={item.photo_url || null} alt={item.name} category={item._cat} />
          </div>

          {/* Info + day picker */}
          <div style={{
            flex: 1, paddingLeft: 12, display: 'flex', flexDirection: 'column',
            justifyContent: 'flex-start', minWidth: 0,
          }}>
            <p style={{
              fontWeight: 700, fontSize: 14, margin: '0 0 2px', color: '#1a1a2e',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.name}
            </p>
            {item.chinese && (
              <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 4px' }}>{item.chinese}</p>
            )}
            {item.google_rating && (
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>⭐ {item.google_rating}</p>
            )}
            {!item.google_rating && item.vibe_tags?.[0] && (
              <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 8px' }}>{item.vibe_tags[0]}</p>
            )}

            {/* Day picker */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>Day:</span>
              {days.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setDayPick(i)}
                  style={{
                    padding: '3px 9px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                    border: `1.5px solid ${dayPick === i ? ACCENT : '#e2e8f0'}`,
                    background: dayPick === i ? TINT : '#fff',
                    color: dayPick === i ? ACCENT : '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Close */}
          <button
            onClick={close}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '0 0 0 8px', color: '#94a3b8', flexShrink: 0, alignSelf: 'flex-start',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Add button */}
        <div style={{ padding: '0 16px 20px', flexShrink: 0 }}>
          <button
            onClick={() => { onAddToDay?.(item, dayPick); close(); }}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 14,
              background: ACCENT, border: 'none', color: '#fff',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >
            + Add to Day {dayPick + 1}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UnifiedMap ───────────────────────────────────────────────────────────────
export default function UnifiedMap({
  days, dayStops, activeDay, onDayChange, primaryCity, isVisible,
  expanded, onExpand, onCollapse,
  deleteStop, swapStop, allAttractions, allAttractionsByCity,
  allFoodByCity,
  allHotelsByCity,
  depDate,
  onAddToDay,       // optional: (item, dayIdx) => void — wire up in parent to add an explore item
}) {
  // ── Map refs ─────────────────────────────────────────────────────────────
  const containerRef        = useRef(null);
  const mapRef              = useRef(null);
  const mapInitialized      = useRef(false);
  const markersRef          = useRef([]);
  const resizeTimer         = useRef(null);
  const scrollRef           = useRef(null);
  const toastTimerRef       = useRef(null);

  // Stale-closure-safe refs
  const allAttractionsByCity_ = useRef(allAttractionsByCity);
  const allFoodByCity_        = useRef(allFoodByCity || {});
  const allHotelsByCity_      = useRef(allHotelsByCity || {});
  const activeFlatIdxRef      = useRef(0);
  const setExploreSelectedRef = useRef(null);   // kept in sync each render

  // Jump-to-day guards
  const isJumpingRef  = useRef(false);
  const jumpTimerRef  = useRef(null);

  // Prevent re-entrant onDayChange calls
  const notifiedDayRef = useRef(activeDay);

  // FIX 7: Tab auto-scroll refs (map screen)
  const tabsScrollRef = useRef(null);
  const tabRefs       = useRef([]);

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeFlatIdx,   setActiveFlatIdx]   = useState(0);
  const [explore,         setExplore]         = useState(false);
  const [exploreFilter,   setExploreFilter]   = useState('all'); // 'all'|'attraction'|'food'
  const [exploreSelected, setExploreSelected] = useState(null);  // item from explore marker tap
  const [swapState,       setSwapState]       = useState(null);
  const [swapAlts,        setSwapAlts]        = useState([]);
  const [addToast,        setAddToast]        = useState(null);  // { dayNum } | null

  // Keep setter ref in sync (allows marker click closures to call current setter)
  setExploreSelectedRef.current = setExploreSelected;

  // ── Build flat card list ──────────────────────────────────────────────────
  const cardList = [];
  days.forEach((day, dayIdx) => {
    if (dayIdx > 0) {
      const dateStr = formatDayDate(depDate, dayIdx);
      // FIX 3: no emoji in divider labels
      const label   = dateStr
        ? `Day ${dayIdx + 1} · ${dateStr}`
        : `Day ${dayIdx + 1}`;
      cardList.push({ type: 'divider', dayIdx, label, key: `div-${dayIdx}` });
    }
    (dayStops[dayIdx] || []).forEach((stop, stopIdx) => {
      cardList.push({ type: 'stop', dayIdx, stopIdx, stop, key: stop.id });
    });
  });

  // ── Derived values ────────────────────────────────────────────────────────
  const activeFlatItem = cardList[activeFlatIdx] ?? null;
  const activeFlatDay  = activeFlatItem?.type === 'stop'
    ? activeFlatItem.dayIdx : (activeFlatItem?.dayIdx ?? 0);
  const activeStopIdx  = activeFlatItem?.type === 'stop' ? activeFlatItem.stopIdx : 0;
  const displayDay     = expanded ? activeFlatDay : activeDay;
  const displayStops   = dayStops[displayDay] || [];
  const cityKey        = days[displayDay]?.city || primaryCity;
  const center         = CITY_CENTERS[cityKey] || CITY_CENTERS.guangzhou;
  const stopsKey       = displayStops.map(s => s.id).join(',');
  const totalStops     = cardList.filter(item => item.type === 'stop').length;

  // Counts for explore filter pills
  const attrCount  = (allAttractionsByCity?.[cityKey] || []).filter(a => a.lat && a.lng).length;
  const foodCount  = (allFoodByCity?.[cityKey]         || []).filter(f => f.lat && f.lng).length;
  const hotelCount = (allHotelsByCity?.[cityKey]       || []).filter(h => h.lat && h.lng).length;

  // ── Sync stale-closure refs ───────────────────────────────────────────────
  useEffect(() => { activeFlatIdxRef.current      = activeFlatIdx; },      [activeFlatIdx]);
  useEffect(() => { allAttractionsByCity_.current = allAttractionsByCity; }, [allAttractionsByCity]);
  useEffect(() => { allFoodByCity_.current        = allFoodByCity || {}; }, [allFoodByCity]);
  useEffect(() => { allHotelsByCity_.current      = allHotelsByCity || {}; }, [allHotelsByCity]);

  // ── Notify parent when displayed day changes ──────────────────────────────
  useEffect(() => {
    if (!expanded) return;
    if (activeFlatDay === notifiedDayRef.current) return;
    notifiedDayRef.current = activeFlatDay;
    onDayChange(activeFlatDay);
  }, [activeFlatDay, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { notifiedDayRef.current = activeDay; }, [activeDay]);

  // Reset explore state when map collapses
  useEffect(() => {
    if (!expanded) { setExplore(false); setExploreFilter('all'); setExploreSelected(null); }
  }, [expanded]);

  // Reset filter + selected when leaving explore mode
  useEffect(() => {
    if (!explore) { setExploreFilter('all'); setExploreSelected(null); }
  }, [explore]);

  // Clamp activeFlatIdx if cardList shrinks (stop deleted)
  useEffect(() => {
    const max = Math.max(0, cardList.length - 1);
    if (activeFlatIdx > max) setActiveFlatIdx(max);
  }, [cardList.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // FIX 7: Auto-scroll map day tabs to keep active tab visible
  useEffect(() => {
    const activeTab = tabRefs.current[activeFlatDay];
    const container = tabsScrollRef.current;
    if (!activeTab || !container) return;
    const scrollLeft =
      activeTab.offsetLeft - container.offsetWidth / 2 + activeTab.offsetWidth / 2;
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
  }, [activeFlatDay]);

  // ── Single-init Mapbox ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInitialized.current || !containerRef.current) return;
    mapboxgl.accessToken = MAPBOX_TOKEN;
    try {
      mapRef.current = new mapboxgl.Map({
        container: containerRef.current,
        style:     'mapbox://styles/mapbox/streets-v12',
        center:    [center.lng, center.lat],
        zoom:      12,
        attributionControl: false,
      });
      mapInitialized.current = true;
    } catch (err) {
      console.error('[UnifiedMap] init error:', err);
    }
    return () => {
      clearTimeout(resizeTimer.current);
      clearTimeout(jumpTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current         = null;
        mapInitialized.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Resize on visibility / expand changes
  useEffect(() => {
    if (isVisible && mapRef.current) {
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => { mapRef.current?.resize(); }, 60);
    }
  }, [isVisible]);

  useEffect(() => {
    clearTimeout(resizeTimer.current);
    resizeTimer.current = setTimeout(() => { mapRef.current?.resize(); }, 350);
  }, [expanded]);

  // ── Place / refresh markers ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    if (explore) {
      // ── Explore mode — category markers, tap opens ExploreSheet ──────────
      const attrItems  = (allAttractionsByCity_.current?.[cityKey] || [])
        .filter(a => a.lat && a.lng)
        .map(a => ({ ...a, _cat: 'attraction' }));
      const foodItems  = (allFoodByCity_.current?.[cityKey] || [])
        .filter(f => f.lat && f.lng && f.photo_url)  // skip entries with no photo
        .map(f => ({ ...f, _cat: 'food' }));
      const cityHotels = (allHotelsByCity_.current?.[cityKey] || []);
      console.log('Explore hotels:', cityHotels?.length, cityHotels?.[0]);
      const hotelItems = cityHotels
        .filter(h => h.lat && h.lng)
        .map(h => ({ ...h, _cat: 'hotel' }));
      const all   = [...attrItems, ...foodItems, ...hotelItems];
      const items = (exploreFilter && exploreFilter !== 'all') ? all.filter(i => i._cat === exploreFilter) : all;
      if (!items.length) return;

      function placeExplore() {
        items.forEach(item => {
          const el = buildExploreMarkerEl(item);
          el.addEventListener('click', () => {
            setExploreSelectedRef.current?.(item);
          });
          markersRef.current.push(
            new mapboxgl.Marker({ element: el })
              .setLngLat([item.lng, item.lat])
              .addTo(mapRef.current),
          );
        });
        fitBounds(items, true);
      }

      if (mapRef.current.isStyleLoaded()) placeExplore();
      else mapRef.current.once('load', placeExplore);

    } else {
      // ── Day view — numbered itinerary stop markers ────────────────────────
      const items = displayStops.filter(s => s.lat && s.lng);
      if (!items.length) return;

      function placeDay() {
        items.forEach((item, i) => {
          const curFlatItem = cardList[activeFlatIdxRef.current];
          const curStopIdx  = curFlatItem?.type === 'stop' ? curFlatItem.stopIdx : 0;
          const isActive    = expanded && i === curStopIdx;
          const el = buildMarkerEl(i + 1, isActive, expanded);
          markersRef.current.push(
            new mapboxgl.Marker({ element: el })
              .setLngLat([item.lng, item.lat])
              .addTo(mapRef.current),
          );
        });
        fitBounds(items, false);
      }

      if (mapRef.current.isStyleLoaded()) placeDay();
      else mapRef.current.once('load', placeDay);
    }
  }, [stopsKey, displayDay, expanded, explore, cityKey, exploreFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update active marker highlight + pan when active card changes ─────────
  useEffect(() => {
    if (!expanded || explore) return;
    markersRef.current.forEach((marker, i) => {
      updateMarkerEl(marker.getElement(), i + 1, i === activeStopIdx, true);
    });
    const stop = displayStops[activeStopIdx];
    if (stop?.lat && stop?.lng && mapRef.current) {
      mapRef.current.flyTo({ center: [stop.lng, stop.lat], zoom: 14, duration: 400 });
    }
  }, [activeFlatIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Map helpers ───────────────────────────────────────────────────────────
  function fitBounds(items, isExplore) {
    if (!mapRef.current || !items.length) return;
    if (items.length === 1) {
      mapRef.current.flyTo({ center: [items[0].lng, items[0].lat], zoom: 14, duration: 700 });
      return;
    }
    const lngs     = items.map(s => s.lng), lats = items.map(s => s.lat);
    const bottomPad = isExplore ? 80 : (expanded ? CARD_H + DAY_TABS_H + 20 : 48);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 70, bottom: bottomPad, left: 60, right: 60 },
        maxZoom: isExplore ? 13 : 15, duration: 700 },
    );
  }

  // Numbered itinerary marker: active = white circle coral border 3px 36 px;
  //                             inactive = solid coral 26 px
  function buildMarkerEl(num, active, isExpanded) {
    const el = document.createElement('div');
    const sz = (isExpanded && active) ? 36 : 26;
    Object.assign(el.style, {
      width:      `${sz}px`,
      height:     `${sz}px`,
      borderRadius: '50%',
      background: (isExpanded && active) ? '#fff' : ACCENT,
      border:     (isExpanded && active) ? `3px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      display:    'flex', alignItems: 'center', justifyContent: 'center',
      fontSize:   '12px', fontWeight: '800',
      color:      (isExpanded && active) ? ACCENT : '#fff',
      fontFamily: "'DM Sans', sans-serif",
      boxShadow:  (isExpanded && active) ? `0 4px 16px rgba(232,71,42,0.45)` : '0 2px 8px rgba(0,0,0,0.28)',
      cursor:     'pointer',
      transition: 'all 0.25s ease',
    });
    el.textContent = String(num);
    return el;
  }

  // Explore marker: teal / amber / slate dot with icon
  function buildExploreMarkerEl(item) {
    const cat   = item._cat || 'attraction';
    const color = EXPLORE_COLORS[cat] || '#94a3b8';
    const el = document.createElement('div');
    Object.assign(el.style, {
      width: '22px', height: '22px', borderRadius: '50%',
      background: color,
      border: '2px solid rgba(255,255,255,0.85)',
      boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    });
    if (cat === 'attraction') {
      el.innerHTML = '<svg width="10" height="9" viewBox="0 0 10 9"><polygon points="5,0.5 9.5,8.5 0.5,8.5" fill="white"/></svg>';
    } else if (cat === 'food') {
      el.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3.5" fill="white"/></svg>';
    } else {
      // Hotel — "H" letter marker
      el.innerHTML = '<span style="font-size:9px;font-weight:800;color:white;line-height:1;font-family:sans-serif">H</span>';
    }
    return el;
  }

  function updateMarkerEl(el, num, active, isExpanded) {
    if (!el) return;
    const sz = (isExpanded && active) ? 36 : 26;
    Object.assign(el.style, {
      width:      `${sz}px`,
      height:     `${sz}px`,
      background: (isExpanded && active) ? '#fff' : ACCENT,
      border:     (isExpanded && active) ? `3px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      color:      (isExpanded && active) ? ACCENT : '#fff',
      boxShadow:  (isExpanded && active) ? `0 4px 16px rgba(232,71,42,0.45)` : '0 2px 8px rgba(0,0,0,0.28)',
    });
    void num;
  }

  // ── Scroll handler — maps DOM child index → cardList index ────────────────
  // (1:1 correspondence: each cardList item renders exactly one child)
  function handleScroll() {
    if (isJumpingRef.current) return;
    const container = scrollRef.current;
    if (!container) return;
    const scrollCenter = container.scrollLeft + container.clientWidth / 2;
    let minDist = Infinity, bestIdx = activeFlatIdxRef.current;
    Array.from(container.children).forEach((child, i) => {
      if (!child.classList.contains('stop-card')) return;
      const dist = Math.abs((child.offsetLeft + child.offsetWidth / 2) - scrollCenter);
      if (dist < minDist) { minDist = dist; bestIdx = i; }
    });
    if (bestIdx !== activeFlatIdxRef.current) setActiveFlatIdx(bestIdx);
  }

  // ── Jump to first stop of a given day (called from day tab click) ─────────
  function jumpToDay(dayIdx) {
    const container = scrollRef.current;
    if (!container) return;
    const targetFlatIdx = cardList.findIndex(
      item => item.type === 'stop' && item.dayIdx === dayIdx,
    );
    if (targetFlatIdx < 0) return;
    const targetEl = Array.from(container.children)[targetFlatIdx];
    if (!targetEl) return;
    isJumpingRef.current = true;
    clearTimeout(jumpTimerRef.current);
    jumpTimerRef.current = setTimeout(() => { isJumpingRef.current = false; }, 600);
    const scrollLeft = targetEl.offsetLeft - (container.clientWidth - targetEl.offsetWidth) / 2;
    container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    setActiveFlatIdx(targetFlatIdx);
  }

  // ── Swap helpers ──────────────────────────────────────────────────────────
  function openSwap(stop, dayIdx) {
    const allUsedIds = new Set(
      days.flatMap((_, i) => (dayStops[i] || []).map(s => s.id)),
    );
    const stopCityKey     = days[dayIdx]?.city || primaryCity;
    const cityAttractions = (allAttractionsByCity?.[stopCityKey] || []);
    const pool            = cityAttractions.length > 0 ? cityAttractions : (allAttractions || []);
    const alts            = getSwapAlternatives(stop, pool, allUsedIds, 4);
    setSwapAlts(alts);
    setSwapState({ stop, dayIdx });
  }

  function handleSwap(newStop) {
    if (!swapState) return;
    swapStop(swapState.dayIdx, swapState.stop.id, newStop);
    setSwapState(null);
  }

  function toggleFilter(cat) {
    setExploreFilter(prev => (prev === cat ? 'all' : cat));
  }

  // ── Add-to-day handler — calls parent, shows success toast ───────────────
  function handleAddToDay(item, dayIdx) {
    onAddToDay?.(item, dayIdx);
    clearTimeout(toastTimerRef.current);
    setAddToast({ dayNum: dayIdx + 1 });
    toastTimerRef.current = setTimeout(() => setAddToast(null), 2200);
  }

  // Cleanup toast timer on unmount
  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', background: '#e8eaf0',
    }}>

      {/* Map canvas — always fills the container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Expand / Collapse button — always top-right ───────────────────── */}
      <button
        onClick={expanded ? onCollapse : onExpand}
        aria-label={expanded ? 'Close map' : 'Expand map'}
        style={{
          position: 'absolute', top: 12, right: 12, zIndex: 30,
          width: 36, height: 36, borderRadius: '50%',
          background: 'rgba(255,255,255,0.92)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 10px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {expanded
          ? <Minimize2 size={15} color="#1a1a2e" />
          : <Maximize2 size={15} color="#1a1a2e" />}
      </button>

      {/* ══ EXPANDED UI ══════════════════════════════════════════════════════ */}
      {expanded && (
        <>
          {/* Empty-state overlay */}
          {totalStops === 0 && !explore && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                background: 'rgba(255,255,255,0.92)', borderRadius: 20,
                padding: '24px 36px', textAlign: 'center', backdropFilter: 'blur(8px)',
              }}>
                <p style={{ fontSize: 32, margin: '0 0 8px' }}>📍</p>
                <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 600 }}>
                  No stops in your itinerary
                </p>
              </div>
            </div>
          )}

          {/* ══ DAY VIEW — card rail + day tabs + Explore pill ═════════════ */}
          {!explore && (
            <>
              {/* FIX 5: "Explore" pill — top-left with Compass icon, weight 500 */}
              <button
                onClick={() => setExplore(true)}
                style={{
                  position:     'absolute',
                  top:          16,
                  left:         16,
                  zIndex:       20,
                  background:   '#fff',
                  border:       'none',
                  borderRadius: 20,
                  padding:      '8px 16px',
                  fontSize:     13,
                  fontWeight:   500,
                  color:        '#1A1A1A',
                  cursor:       'pointer',
                  display:      'flex',
                  alignItems:   'center',
                  gap:          6,
                  boxShadow:    '0 2px 8px rgba(0,0,0,0.12)',
                }}
              >
                <Compass size={14} />
                Explore
              </button>

              {/* FIX 4: card rail + pill tabs pinned to bottom — no wrapper background */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>

                {/* FIX 3 + FIX 4: standalone pill tabs, no emoji, no bar background */}
                {/* FIX 7: tabsScrollRef + tabRefs for auto-scroll */}
                <div
                  ref={tabsScrollRef}
                  style={{
                    display:         'flex',
                    alignItems:      'center',
                    gap:             8,
                    padding:         '8px 10px',
                    overflowX:       'auto',
                    scrollbarWidth:  'none',
                    msOverflowStyle: 'none',
                    flexShrink:      0,
                  }}
                >
                  {days.map((day, i) => {
                    const active  = i === activeFlatDay;
                    // FIX 3: no emoji anywhere in tab labels
                    const dateStr = formatDayDate(depDate, i);
                    const label   = `Day ${i + 1}${dateStr ? ` · ${dateStr}` : ''}`;
                    return (
                      <button
                        key={i}
                        ref={el => { tabRefs.current[i] = el; }}
                        onClick={() => jumpToDay(i)}
                        style={{
                          flexShrink:   0,
                          padding:      '6px 14px',
                          borderRadius: 20,
                          fontSize:     11,
                          fontWeight:   600,
                          cursor:       'pointer',
                          border:       'none',
                          whiteSpace:   'nowrap',
                          background:   active ? '#E8472A' : '#fff',
                          color:        active ? '#fff' : '#1A1A1A',
                          boxShadow:    '0 2px 8px rgba(0,0,0,0.12)',
                          transition:   'background 0.18s, color 0.18s',
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>

                {/* Continuous horizontal snap card rail */}
                {totalStops > 0 && (
                  <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    style={{
                      display:                 'flex',
                      overflowX:               'auto',
                      scrollSnapType:          'x mandatory',
                      WebkitOverflowScrolling: 'touch',
                      gap:                     10,
                      paddingLeft:             SCROLL_PAD,
                      paddingRight:            SCROLL_PAD,
                      paddingTop:              8,
                      paddingBottom:           12,
                      scrollbarWidth:          'none',
                      msOverflowStyle:         'none',
                      alignItems:              'center',
                    }}
                  >
                    {cardList.map((item, flatIdx) =>
                      item.type === 'divider' ? (
                        <DayDivider key={item.key} label={item.label} />
                      ) : (
                        <StopCard
                          key={item.key}
                          stop={item.stop}
                          index={item.stopIdx}
                          active={flatIdx === activeFlatIdx}
                          onSwipeUp={() => openSwap(item.stop, item.dayIdx)}
                          onSwipeDown={() => deleteStop?.(item.dayIdx, item.stop.id)}
                        />
                      )
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ══ EXPLORE MODE ═════════════════════════════════════════════════ */}
          {explore && (
            <>
              {/* Filter pills row — leaves 52px gap on right for minimize button */}
              <div style={{
                position:       'absolute',
                top:            12,
                left:           12,
                right:          52,
                zIndex:         20,
                display:        'flex',
                flexDirection:  'row',
                alignItems:     'center',
                gap:            8,
                overflowX:      'auto',
                whiteSpace:     'nowrap',
                scrollbarWidth: 'none',
              }}>
                {[
                  { cat: 'attraction', Icon: Mountain, label: 'Attractions', count: attrCount  },
                  { cat: 'food',       Icon: Utensils, label: 'Food',        count: foodCount  },
                  { cat: 'hotel',      Icon: Bed,      label: 'Hotels',      count: hotelCount },
                ].map(({ cat, Icon, label, count }) => {
                  const active = exploreFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleFilter(cat)}
                      style={{
                        flexShrink:   0,
                        display:      'inline-flex', alignItems: 'center', gap: 6,
                        padding:      '8px 12px', borderRadius: 20,
                        fontSize:     12, fontWeight: 600, cursor: 'pointer',
                        border:       `1px solid ${active ? ACCENT : '#E0E0E0'}`,
                        background:   active ? ACCENT : '#fff',
                        color:        active ? '#fff' : '#1a1a2e',
                        boxShadow:    '0 2px 8px rgba(0,0,0,0.12)',
                        whiteSpace:   'nowrap',
                        transition:   'all 0.18s ease',
                      }}
                    >
                      <Icon size={13} />
                      {label}{count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>

              {/* FIX 6: "← Back to plan" white pill — bottom centre */}
              <button
                onClick={() => setExplore(false)}
                style={{
                  position:  'absolute',
                  bottom:    24,
                  left:      '50%',
                  transform: 'translateX(-50%)',
                  zIndex:    20,
                  background: '#fff',
                  border:    'none',
                  borderRadius: 24,
                  padding:   '11px 20px',
                  fontSize:  13,
                  fontWeight: 600,
                  color:     '#1A1A1A',
                  cursor:    'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                  whiteSpace: 'nowrap',
                }}
              >
                ← Back to plan
              </button>
            </>
          )}
        </>
      )}

      {/* ── Swap panel (bottom sheet) ─────────────────────────────────────── */}
      {swapState && (
        <SwapPanel
          stop={swapState.stop}
          alternatives={swapAlts}
          onSwap={handleSwap}
          onClose={() => setSwapState(null)}
        />
      )}

      {/* ── Explore bottom sheet — shown when a marker is tapped ─────────── */}
      {exploreSelected && (
        <ExploreSheet
          item={exploreSelected}
          days={days}
          onAddToDay={handleAddToDay}
          onClose={() => setExploreSelected(null)}
        />
      )}

      {/* ── Add-to-day success toast ─────────────────────────────────────── */}
      {addToast && (
        <div style={{
          position:      'absolute',
          top:           60,
          left:          '50%',
          transform:     'translateX(-50%)',
          zIndex:        60,
          pointerEvents: 'none',
        }}>
          <div className="explore-toast" style={{
            background:  '#10B981',
            color:       '#fff',
            borderRadius: 20,
            padding:     '9px 20px',
            fontSize:    13,
            fontWeight:  700,
            boxShadow:   '0 3px 14px rgba(16,185,129,0.38)',
            whiteSpace:  'nowrap',
          }}>
            ✓ Added to Day {addToast.dayNum}
          </div>
        </div>
      )}
    </div>
  );
}
