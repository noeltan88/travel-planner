/**
 * UnifiedMap — single Mapbox instance powering the full-screen itinerary map.
 *
 * Changes in this version:
 *   Change 1: Dark floating day tabs (with date labels) directly above card rail
 *   Change 2: Continuous card flow across all days with day-divider pills
 *   Change 3: Enriched card info — Chinese name, rating, duration, description
 *   Change 4: Category-coded explore markers (attraction/food/hotel)
 *   Change 5: Expand/collapse white-circle button always at top-right corner
 *   Change 6: Explore filter pills with Mountain/Utensils/Bed icons + counts
 *
 * Gestures (unchanged):
 *   Swipe DOWN on drag-handle → Explore mode
 *   Swipe UP   on drag-handle → collapse map (onCollapse)
 *   Swipe UP   on Explore strip → exit Explore, return to Day view
 */
import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import AttractionImage from './AttractionImage';
import { getSwapAlternatives } from '../utils/algorithm';
import {
  ChevronRight, X, ArrowUp, ArrowDown,
  Mountain, Utensils, Bed,
  Maximize2, Minimize2,
} from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ACCENT       = '#E8472A';

// Layout constants (bottom-up stack in expanded mode):
//   CARD_BOTTOM: whole overlay sits this far from bottom
//   DAY_TABS_H:  dark floating day tabs row (top of overlay)
//   HANDLE_H:    drag handle strip (below tabs)
//   CARD_H:      each stop card
const CARD_H      = 160;
const CARD_BOTTOM = 12;
const DAY_TABS_H  = 44;
const SCROLL_PAD  = 30;
const SWIPE_THRESH = 80;

// Explore marker colours (Change 4)
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

function formatDuration(hrs) {
  if (hrs == null) return '';
  if (hrs < 1) return `${Math.round(hrs * 60)} min`;
  if (hrs === Math.floor(hrs)) return `${hrs} hr${hrs !== 1 ? 's' : ''}`;
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h} hrs`;
}

// ─── DayDivider ─── slim dark pill between days, NOT a scroll-snap target ─────
function DayDivider({ label }) {
  return (
    <div style={{
      flexShrink: 0, height: CARD_H,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 2px',
      // deliberately no scrollSnapAlign
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

// ─── StopCard ─────────────────────────────────────────────────────────────────
// Change 3: added Chinese name, rating, duration, description preview;
//           time badge moved onto photo so text panel gains a row.
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
    if (d.locked === 'y') setDragY(Math.max(-110, Math.min(80, dy)));
  }
  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY, dx = e.clientX - d.startX;
    if (d.locked === 'y' && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) onSwipeUp(); else onSwipeDown();
    }
    setDragY(0);
    dragRef.current = null;
  }

  const rating      = stop.google_rating;
  const reviewCount = stop.google_review_count;
  const durStr      = formatDuration(stop.duration_hrs);

  return (
    <div
      className="stop-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setDragY(0); dragRef.current = null; }}
      style={{
        flexShrink:      0,
        width:           'calc(100vw - 60px)',
        maxWidth:        370,
        height:          CARD_H,
        borderRadius:    16,
        background:      '#fff',
        boxShadow:       active ? '0 8px 28px rgba(0,0,0,0.18)' : '0 3px 12px rgba(0,0,0,0.10)',
        display:         'flex',
        overflow:        'hidden',
        scrollSnapAlign: 'center',
        transform:       `translateY(${dragY}px)`,
        transition:      dragY === 0
          ? 'transform 0.25s ease, box-shadow 0.2s ease, border-color 0.15s'
          : 'none',
        cursor:      'grab',
        userSelect:  'none',
        touchAction: 'pan-x',
        border:      `2px solid ${active ? ACCENT : 'transparent'}`,
      }}
    >
      {/* ── Photo (96px) with overlaid badges ── */}
      <div style={{ width: 96, height: '100%', flexShrink: 0, overflow: 'hidden', position: 'relative' }}>
        <AttractionImage src={stop.photo_url || null} alt={stop.name} category={stop.category} />

        {/* Number badge */}
        <div style={{
          position: 'absolute', top: 7, left: 7,
          width: 22, height: 22, borderRadius: '50%',
          background: active ? ACCENT : 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff', zIndex: 1,
        }}>
          {index + 1}
        </div>

        {/* Time badge pinned to photo bottom */}
        <div style={{
          position: 'absolute', bottom: 5, left: 4, right: 4,
          background: 'rgba(0,0,0,0.62)', borderRadius: 6,
          padding: '2px 4px', textAlign: 'center',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
            {stop.startTime}–{stop.endTime}
          </span>
        </div>
      </div>

      {/* ── Text panel ── */}
      <div style={{
        flex: 1, padding: '10px 10px 10px 11px',
        display: 'flex', flexDirection: 'column', minWidth: 0,
      }}>
        {/* Name — bold 15px, up to 2 lines */}
        <p style={{
          fontWeight: 700, fontSize: 14, color: '#1a1a2e', margin: '0 0 1px',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.2,
        }}>
          {stop.name}
        </p>

        {/* Chinese name */}
        {stop.chinese && (
          <p style={{
            fontSize: 11, color: '#94a3b8', margin: '0 0 3px', fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {stop.chinese}
          </p>
        )}

        {/* Rating + review count */}
        {rating != null && (
          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 2px' }}>
            ⭐ {rating}
            {reviewCount ? ` · ${Number(reviewCount).toLocaleString()} reviews` : ''}
          </p>
        )}

        {/* Duration */}
        {durStr && (
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '0 0 2px' }}>
            {durStr}
          </p>
        )}

        {/* Description preview — 1 line truncated */}
        {stop.description && (
          <p style={{
            fontSize: 11, color: '#94a3b8', margin: '0 0 2px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {stop.description}
          </p>
        )}

        {/* Swap / remove hints pushed to bottom */}
        <div style={{ marginTop: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#94a3b8' }}>
            <ArrowUp size={9} />
            <span style={{ fontSize: 9, fontWeight: 600 }}>swap</span>
          </div>
          <div style={{ width: 1, height: 9, background: '#e2e8f0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, color: '#94a3b8' }}>
            <ArrowDown size={9} />
            <span style={{ fontSize: 9, fontWeight: 600 }}>remove</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SwapPanel ────────────────────────────────────────────────────────────────
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 20px 12px', flexShrink: 0 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 16, margin: '0 0 2px', color: '#1a1a2e' }}>Swap stop</p>
            <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>Replace "{stop.name}"</p>
          </div>
          <button onClick={animatedClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6,
              color: '#94a3b8', display: 'flex', borderRadius: 8 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ overflowY: 'auto', padding: '0 16px 32px',
          display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alternatives.length === 0 ? (
            <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
              No nearby alternatives available.
            </p>
          ) : alternatives.map(alt => (
            <div key={alt.id} onClick={() => { onSwap(alt); onClose(); }}
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
                <p style={{ fontWeight: 600, fontSize: 13, margin: '0 0 3px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#1a1a2e' }}>
                  {alt.name}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                  {alt.duration_hrs ? `${alt.duration_hrs}h` : ''}{alt.vibe_tags?.[0] ? ` · ${alt.vibe_tags[0]}` : ''}
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

// ─── UnifiedMap ───────────────────────────────────────────────────────────────
export default function UnifiedMap({
  days, dayStops, activeDay, onDayChange, primaryCity, isVisible,
  expanded, onExpand, onCollapse,
  deleteStop, swapStop, allAttractions, allAttractionsByCity,
  allFoodByCity,   // { cityKey: foodArray } — for explore food markers
  depDate,
}) {
  // ── Map refs ─────────────────────────────────────────────────────────────
  const containerRef        = useRef(null);
  const mapRef              = useRef(null);
  const mapInitialized      = useRef(false);
  const markersRef          = useRef([]);
  const popupRef            = useRef(null);
  const resizeTimer         = useRef(null);
  const scrollRef           = useRef(null);

  // Stale-closure-safe copies for async map callbacks
  const allAttractionsByCity_ = useRef(allAttractionsByCity);
  const allFoodByCity_        = useRef(allFoodByCity || {});
  const activeFlatIdxRef      = useRef(0);

  // Jump-to-day guards (suppress handleScroll during programmatic scroll)
  const isJumpingRef  = useRef(false);
  const jumpTimerRef  = useRef(null);

  // Prevent re-entrant onDayChange calls
  const notifiedDayRef = useRef(activeDay);

  // Gesture refs
  const dragHandleRef = useRef(null);
  const exploreGstRef = useRef(null);

  // ── State ─────────────────────────────────────────────────────────────────
  const [activeFlatIdx, setActiveFlatIdx] = useState(0);
  const [explore,       setExplore]       = useState(false);
  const [exploreFilter, setExploreFilter] = useState(null); // 'attraction'|'food'|null
  const [swapState,     setSwapState]     = useState(null);
  const [swapAlts,      setSwapAlts]      = useState([]);

  // ── Build flat card list ──────────────────────────────────────────────────
  // Dividers before days 1…N (not before day 0).
  const cardList = [];
  days.forEach((day, dayIdx) => {
    if (dayIdx > 0) {
      const dateStr  = formatDayDate(depDate, dayIdx);
      const cityPart = day.cityHeader?.emoji ? ` ${day.cityHeader.emoji}` : '';
      const label    = dateStr
        ? `Day ${dayIdx + 1} · ${dateStr}${cityPart}`
        : `Day ${dayIdx + 1}${cityPart}`;
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

  // Counts for explore filter pills (render-time, read straight from props)
  const attrCount = (allAttractionsByCity?.[cityKey] || []).filter(a => a.lat && a.lng).length;
  const foodCount = (allFoodByCity?.[cityKey]         || []).filter(f => f.lat && f.lng).length;

  // ── Sync stale-closure refs ───────────────────────────────────────────────
  useEffect(() => { activeFlatIdxRef.current      = activeFlatIdx; },      [activeFlatIdx]);
  useEffect(() => { allAttractionsByCity_.current = allAttractionsByCity; }, [allAttractionsByCity]);
  useEffect(() => { allFoodByCity_.current        = allFoodByCity || {}; }, [allFoodByCity]);

  // ── Notify parent when displayed day changes (expanded only) ─────────────
  useEffect(() => {
    if (!expanded) return;
    if (activeFlatDay === notifiedDayRef.current) return;
    notifiedDayRef.current = activeFlatDay;
    onDayChange(activeFlatDay);
  }, [activeFlatDay, expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep notifiedDayRef in sync when parent pushes a new activeDay
  useEffect(() => { notifiedDayRef.current = activeDay; }, [activeDay]);

  // Reset explore + filter when map collapses
  useEffect(() => {
    if (!expanded) { setExplore(false); setExploreFilter(null); }
  }, [expanded]);

  // Reset filter when leaving explore mode
  useEffect(() => { if (!explore) setExploreFilter(null); }, [explore]);

  // Clamp activeFlatIdx if cardList shrinks (stop deleted)
  useEffect(() => {
    const max = Math.max(0, cardList.length - 1);
    if (activeFlatIdx > max) setActiveFlatIdx(max);
  }, [cardList.length]); // eslint-disable-line react-hooks/exhaustive-deps

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
    popupRef.current?.remove();
    popupRef.current = null;

    if (explore) {
      // ── Explore mode ─────────────────────────────────────────────────────
      const attrItems = (allAttractionsByCity_.current?.[cityKey] || [])
        .filter(a => a.lat && a.lng)
        .map(a => ({ ...a, _cat: 'attraction' }));
      const foodItems = (allFoodByCity_.current?.[cityKey] || [])
        .filter(f => f.lat && f.lng)
        .map(f => ({ ...f, _cat: 'food' }));
      const all   = [...attrItems, ...foodItems];
      const items = exploreFilter ? all.filter(i => i._cat === exploreFilter) : all;
      if (!items.length) return;

      function placeExplore() {
        items.forEach(item => {
          const el = buildExploreMarkerEl(item);
          el.addEventListener('click', () => {
            popupRef.current?.remove();
            popupRef.current = new mapboxgl.Popup({ offset: 12, closeButton: false })
              .setLngLat([item.lng, item.lat])
              .setHTML(`
                <div style="font-family:'DM Sans',sans-serif;padding:2px 4px;min-width:110px;max-width:170px">
                  <p style="font-weight:700;font-size:12px;margin:0 0 1px;color:#1a1a2e">${item.name}</p>
                  ${item.chinese ? `<p style="font-size:10px;color:#94a3b8;margin:0 0 1px">${item.chinese}</p>` : ''}
                  ${item.google_rating
                    ? `<p style="font-size:10px;color:#64748b;margin:0">⭐ ${item.google_rating}</p>`
                    : item.vibe_tags?.[0]
                    ? `<p style="font-size:10px;color:#64748b;margin:0">${item.vibe_tags[0]}</p>`
                    : ''}
                </div>
              `)
              .addTo(mapRef.current);
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
      // ── Day view — itinerary stops ────────────────────────────────────────
      const items = displayStops.filter(s => s.lat && s.lng);
      if (!items.length) return;

      function placeDay() {
        items.forEach((item, i) => {
          const curFlatItem = cardList[activeFlatIdxRef.current];
          const curStopIdx  = curFlatItem?.type === 'stop' ? curFlatItem.stopIdx : 0;
          const isActive    = expanded && i === curStopIdx;
          const el = buildMarkerEl(i + 1, isActive, expanded);
          if (!expanded) {
            el.addEventListener('click', () => {
              popupRef.current?.remove();
              popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false })
                .setLngLat([item.lng, item.lat])
                .setHTML(`
                  <div style="font-family:'DM Sans',sans-serif;padding:2px 4px;min-width:120px;max-width:180px">
                    <p style="font-weight:700;font-size:12px;margin:0 0 2px;color:#1a1a2e">${item.name}</p>
                    <p style="font-size:10px;color:#64748b;margin:0">${item.startTime}–${item.endTime}</p>
                  </div>
                `)
                .addTo(mapRef.current);
            });
          }
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

  // Update active marker highlight + pan when active card scrolls
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
    const lngs = items.map(s => s.lng), lats = items.map(s => s.lat);
    // bottomPad accounts for the card overlay height
    const bottomPad = isExplore ? 100 : (expanded ? 260 : 48);
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: 70, bottom: bottomPad, left: 60, right: 60 },
        maxZoom: isExplore ? 13 : 15, duration: 700 },
    );
  }

  // Itinerary stop markers — numbered circles (Change 5 keeps these red)
  function buildMarkerEl(num, active, isExpanded) {
    const el = document.createElement('div');
    const sz = (isExpanded && active) ? 36 : 26;
    Object.assign(el.style, {
      width: `${sz}px`, height: `${sz}px`, borderRadius: '50%',
      background: (isExpanded && active) ? '#fff' : ACCENT,
      border:     (isExpanded && active) ? `2.5px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: '12px', fontWeight: '800',
      color:     (isExpanded && active) ? ACCENT : '#fff',
      fontFamily: "'DM Sans', sans-serif",
      boxShadow: (isExpanded && active) ? `0 4px 16px rgba(232,71,42,0.45)` : '0 2px 8px rgba(0,0,0,0.28)',
      cursor: 'pointer', transition: 'all 0.25s ease',
    });
    el.textContent = String(num);
    return el;
  }

  // Explore markers — category-coded colour + SVG shape (Change 4)
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
      el.innerHTML = '<svg width="8" height="8" viewBox="0 0 8 8"><rect x="1" y="1" width="6" height="6" rx="1" fill="white"/></svg>';
    }
    return el;
  }

  function updateMarkerEl(el, num, active, isExpanded) {
    if (!el) return;
    const sz = (isExpanded && active) ? 36 : 26;
    Object.assign(el.style, {
      width: `${sz}px`, height: `${sz}px`,
      background: (isExpanded && active) ? '#fff' : ACCENT,
      border:     (isExpanded && active) ? `2.5px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      color:      (isExpanded && active) ? ACCENT : '#fff',
      boxShadow:  (isExpanded && active) ? `0 4px 16px rgba(232,71,42,0.45)` : '0 2px 8px rgba(0,0,0,0.28)',
    });
    void num;
  }

  // ── Scroll handler — skips dividers, only counts stop-cards ──────────────
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

  // ── Jump to first stop of a given day (called by day tabs) ───────────────
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
    const usedIds = new Set((dayStops[dayIdx] || []).map(s => s.id));
    const alts    = getSwapAlternatives(stop, allAttractions || [], usedIds, 3);
    setSwapAlts(alts);
    setSwapState({ stop, dayIdx });
  }

  function handleSwap(newStop) {
    if (!swapState) return;
    swapStop(swapState.dayIdx, swapState.stop.id, newStop);
    setSwapState(null);
  }

  // ── Drag handle gestures ─────────────────────────────────────────────────
  // Swipe DOWN → Explore  |  Swipe UP → collapse
  function onDragHandleTouchStart(e) {
    const t = e.touches[0];
    dragHandleRef.current = { startX: t.clientX, startY: t.clientY, locked: null };
  }
  function onDragHandleTouchMove(e) {
    const d = dragHandleRef.current;
    if (!d) return;
    const dx = e.touches[0].clientX - d.startX, dy = e.touches[0].clientY - d.startY;
    if (!d.locked && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
      d.locked = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
  }
  function onDragHandleTouchEnd(e) {
    const d = dragHandleRef.current;
    if (!d) return;
    dragHandleRef.current = null;
    if (d.locked !== 'y') return;
    const dy = e.changedTouches[0].clientY - d.startY;
    if (dy > SWIPE_THRESH) setExplore(true);
    else if (dy < -SWIPE_THRESH && onCollapse) onCollapse();
  }

  // ── Explore strip gesture — Swipe UP → exit Explore ──────────────────────
  function onExploreTouchStart(e) { exploreGstRef.current = { startY: e.touches[0].clientY }; }
  function onExploreTouchEnd(e) {
    const d = exploreGstRef.current;
    exploreGstRef.current = null;
    if (!d) return;
    if (e.changedTouches[0].clientY - d.startY < -SWIPE_THRESH) setExplore(false);
  }

  // ── Filter toggle ─────────────────────────────────────────────────────────
  function toggleFilter(cat) {
    setExploreFilter(prev => (prev === cat ? null : cat));
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', background: '#e8eaf0',
    }}>

      {/* Map canvas — always fills container */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Expand / Collapse button — always top-right (Change 5) ─────────── */}
      <button
        onClick={expanded ? onCollapse : onExpand}
        aria-label={expanded ? 'Collapse map' : 'Expand map'}
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
          {/* Empty state */}
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

          {/* ══ DAY VIEW — card rail + floating day tabs ═════════════════════ */}
          {!explore && (
            <div style={{ position: 'absolute', bottom: CARD_BOTTOM, left: 0, right: 0 }}>

              {/* ── Floating day tabs — dark strip, directly above rail (Change 1) */}
              <div style={{
                background:      'rgba(0,0,0,0.60)',
                backdropFilter:  'blur(12px)',
                height:          DAY_TABS_H,
                display:         'flex',
                alignItems:      'center',
                gap:             6,
                padding:         '0 10px',
                overflowX:       'auto',
                scrollbarWidth:  'none',
                msOverflowStyle: 'none',
                flexShrink:      0,
              }}>
                {days.map((day, i) => {
                  const active  = i === activeFlatDay;
                  const dateStr = formatDayDate(depDate, i);
                  const label   = `Day ${i + 1}${dateStr ? ` · ${dateStr}` : ''}${day.cityHeader?.emoji ? ` ${day.cityHeader.emoji}` : ''}`;
                  return (
                    <button
                      key={i}
                      onClick={() => jumpToDay(i)}
                      style={{
                        flexShrink:   0,
                        padding:      '5px 12px',
                        borderRadius: 20,
                        fontSize:     11,
                        fontWeight:   600,
                        cursor:       'pointer',
                        border:       'none',
                        whiteSpace:   'nowrap',
                        background:   active ? '#fff' : 'transparent',
                        color:        active ? '#1a1a2e' : 'rgba(255,255,255,0.62)',
                        transition:   'background 0.18s, color 0.18s',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* ── Drag handle — Swipe ↓ Explore | ↑ Collapse ─────────────── */}
              <div
                onTouchStart={onDragHandleTouchStart}
                onTouchMove={onDragHandleTouchMove}
                onTouchEnd={onDragHandleTouchEnd}
                style={{
                  display: 'flex', justifyContent: 'center',
                  padding: '8px 0 4px',
                  cursor: 'ns-resize', touchAction: 'none',
                  background: 'rgba(0,0,0,0.12)',
                }}
              >
                <div style={{
                  width: 36, height: 3, borderRadius: 2,
                  background: 'rgba(255,255,255,0.45)',
                }} />
              </div>

              {/* ── Continuous scroll rail — all days (Change 2) ─────────────── */}
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
                    paddingTop:              4,
                    paddingBottom:           10,
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
                        onSwipeDown={() => deleteStop && deleteStop(item.dayIdx, item.stop.id)}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* ══ EXPLORE MODE — filter strip + swipe hint ═════════════════════ */}
          {explore && (
            <div
              onTouchStart={onExploreTouchStart}
              onTouchEnd={onExploreTouchEnd}
              style={{
                position:       'absolute',
                bottom:         CARD_BOTTOM,
                left:           0, right: 0,
                background:     'rgba(20,20,38,0.78)',
                backdropFilter: 'blur(14px)',
                touchAction:    'none',
              }}
            >
              {/* Swipe-up hint */}
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                padding: '8px 0 4px', cursor: 'ns-resize',
              }}>
                <div style={{
                  width: 36, height: 3, borderRadius: 2,
                  background: 'rgba(255,255,255,0.35)', marginBottom: 4,
                }} />
                <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, margin: 0 }}>
                  Swipe up for day view
                </p>
              </div>

              {/* Filter pills (Change 6) */}
              <div style={{
                display: 'flex', gap: 8,
                padding: '6px 12px 14px',
                overflowX: 'auto', scrollbarWidth: 'none',
              }}>
                {[
                  { cat: 'attraction', Icon: Mountain, label: 'Attractions', count: attrCount },
                  { cat: 'food',       Icon: Utensils, label: 'Food',        count: foodCount },
                  { cat: 'hotel',      Icon: Bed,      label: 'Hotels',      count: 0 },
                ].map(({ cat, Icon, label, count }) => {
                  const active = exploreFilter === cat;
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleFilter(cat)}
                      style={{
                        flexShrink: 0,
                        display: 'flex', alignItems: 'center', gap: 5,
                        padding: '6px 13px', borderRadius: 20,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        border: active ? 'none' : '1.5px solid rgba(255,255,255,0.28)',
                        background: active ? '#fff' : 'transparent',
                        color:      active ? '#1a1a2e' : '#fff',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.18s ease',
                      }}
                    >
                      <Icon size={13} />
                      {label}{count > 0 ? ` (${count})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Swap panel */}
      {swapState && (
        <SwapPanel
          stop={swapState.stop}
          alternatives={swapAlts}
          onSwap={handleSwap}
          onClose={() => setSwapState(null)}
        />
      )}
    </div>
  );
}
