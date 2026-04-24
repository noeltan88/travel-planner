import { useEffect, useRef, useState, Component } from 'react';
import mapboxgl from 'mapbox-gl';
import AttractionImage from './AttractionImage';
import { getSwapAlternatives } from '../utils/algorithm';
import { ChevronRight, X, ArrowUp, ArrowDown } from 'lucide-react';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ACCENT = '#E8472A';
const DAY_TABS_H = 56;   // px — height of day-tab row
const CARD_H     = 160;  // px — card height

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

// ─── Error boundary (re-exported so ItineraryDashboard can wrap us) ───────────
export class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', height:'100%', color:'#94a3b8', gap:8, background:'#f1f5f9' }}>
        <span style={{ fontSize:36 }}>🗺️</span>
        <p style={{ fontSize:14, margin:0 }}>Map unavailable</p>
        <button onClick={() => this.setState({ error:false })}
          style={{ fontSize:12, fontWeight:600, color:ACCENT, background:'none', border:'none', cursor:'pointer' }}>
          Try again
        </button>
      </div>
    );
    return this.props.children;
  }
}

// ─── StopCard ─────────────────────────────────────────────────────────────────
function StopCard({ stop, index, active, onSwipeUp, onSwipeDown }) {
  const dragRef  = useRef(null);
  const [dragY, setDragY] = useState(0);

  function onPointerDown(e) {
    dragRef.current = { startX: e.clientX, startY: e.clientY, locked: null };
  }

  function onPointerMove(e) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;

    if (!d.locked) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8)
        d.locked = Math.abs(dy) > Math.abs(dx) ? 'y' : 'x';
    }
    if (d.locked === 'y') setDragY(Math.max(-110, Math.min(80, dy)));
  }

  function onPointerUp(e) {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;
    if (d.locked === 'y' && Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx)) {
      if (dy < 0) onSwipeUp();
      else        onSwipeDown();
    }
    setDragY(0);
    dragRef.current = null;
  }

  const distLabel = (stop.district || (stop.cluster_group || '').replace(/-/g, ' ')).trim();

  return (
    <div
      className="stop-card"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => { setDragY(0); dragRef.current = null; }}
      style={{
        flexShrink:     0,
        width:          'calc(100vw - 60px)',
        maxWidth:       370,
        height:         CARD_H,
        borderRadius:   16,
        background:     '#fff',
        boxShadow:      active
          ? '0 8px 28px rgba(0,0,0,0.18)'
          : '0 3px 12px rgba(0,0,0,0.10)',
        display:        'flex',
        overflow:       'hidden',
        scrollSnapAlign:'center',
        transform:      `translateY(${dragY}px)`,
        transition:     dragY === 0
          ? 'transform 0.25s ease, box-shadow 0.2s ease, border-color 0.15s'
          : 'none',
        cursor:         'grab',
        userSelect:     'none',
        touchAction:    'pan-x',
        border:         `2px solid ${active ? ACCENT : 'transparent'}`,
      }}
    >
      {/* Photo */}
      <div style={{ width:100, height:'100%', flexShrink:0, overflow:'hidden', position:'relative' }}>
        <AttractionImage src={stop.photo_url || null} alt={stop.name} category={stop.category} />
        <div style={{
          position:'absolute', top:8, left:8,
          width:22, height:22, borderRadius:'50%',
          background: active ? ACCENT : 'rgba(0,0,0,0.55)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:11, fontWeight:800, color:'#fff', zIndex:1,
        }}>
          {index + 1}
        </div>
      </div>

      {/* Text */}
      <div style={{ flex:1, padding:'14px 14px 10px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
        <div>
          <p style={{
            fontWeight:700, fontSize:14, color:'#1a1a2e',
            margin:'0 0 4px',
            overflow:'hidden', display:'-webkit-box',
            WebkitLineClamp:2, WebkitBoxOrient:'vertical',
          }}>
            {stop.name}
          </p>
          <p style={{ fontSize:12, color:'#64748b', margin:'0 0 3px', fontWeight:500 }}>
            {stop.startTime}–{stop.endTime}
          </p>
          {distLabel && (
            <p style={{ fontSize:11, color:'#94a3b8', margin:0,
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {distLabel}
            </p>
          )}
        </div>

        {/* Swipe hints */}
        <div style={{ display:'flex', gap:8, alignItems:'center', marginTop:6 }}>
          <div style={{ display:'flex', alignItems:'center', gap:2, color:'#94a3b8' }}>
            <ArrowUp size={9} />
            <span style={{ fontSize:9, fontWeight:600 }}>swap</span>
          </div>
          <div style={{ width:1, height:9, background:'#e2e8f0' }} />
          <div style={{ display:'flex', alignItems:'center', gap:2, color:'#94a3b8' }}>
            <ArrowDown size={9} />
            <span style={{ fontSize:9, fontWeight:600 }}>remove</span>
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

  function animatedClose() {
    setVisible(false);
    setTimeout(onClose, 320);
  }

  return (
    <div style={{ position:'absolute', inset:0, zIndex:25 }}>
      {/* Backdrop */}
      <div
        onClick={animatedClose}
        style={{
          position:'absolute', inset:0,
          background: `rgba(0,0,0,${visible ? 0.42 : 0})`,
          transition: 'background 0.3s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position:'absolute', bottom:0, left:0, right:0,
        background:'#fff',
        borderRadius:'24px 24px 0 0',
        transform:`translateY(${visible ? '0%' : '100%'})`,
        transition:'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        maxHeight:'65%',
        display:'flex', flexDirection:'column',
        overflow:'hidden',
      }}>
        {/* Handle */}
        <div style={{ display:'flex', justifyContent:'center', padding:'12px 0 4px', flexShrink:0 }}>
          <div style={{ width:40, height:4, borderRadius:2, background:'#e2e8f0' }} />
        </div>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 20px 12px', flexShrink:0 }}>
          <div>
            <p style={{ fontWeight:700, fontSize:16, margin:'0 0 2px', color:'#1a1a2e' }}>Swap stop</p>
            <p style={{ fontSize:11, color:'#64748b', margin:0 }}>Replace "{stop.name}"</p>
          </div>
          <button onClick={animatedClose}
            style={{ background:'none', border:'none', cursor:'pointer', padding:6,
              color:'#94a3b8', display:'flex', borderRadius:8 }}>
            <X size={18} />
          </button>
        </div>

        {/* Alternatives */}
        <div style={{ overflowY:'auto', padding:'0 16px 32px',
          display:'flex', flexDirection:'column', gap:10 }}>
          {alternatives.length === 0 ? (
            <p style={{ color:'#94a3b8', fontSize:13, textAlign:'center', padding:'24px 0' }}>
              No nearby alternatives available.
            </p>
          ) : alternatives.map(alt => (
            <div
              key={alt.id}
              onClick={() => { onSwap(alt); onClose(); }}
              style={{
                display:'flex', alignItems:'center', gap:12,
                padding:'10px 12px', borderRadius:14,
                border:'1.5px solid #f1f5f9', cursor:'pointer',
                background:'#fafafa', transition:'border-color 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = ACCENT}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#f1f5f9'}
            >
              <div style={{ width:56, height:56, borderRadius:10, overflow:'hidden', flexShrink:0 }}>
                <AttractionImage src={alt.photo_url || null} alt={alt.name} category={alt.category} />
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontWeight:600, fontSize:13, margin:'0 0 3px',
                  overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'#1a1a2e' }}>
                  {alt.name}
                </p>
                <p style={{ fontSize:11, color:'#64748b', margin:0 }}>
                  {alt.duration_hrs ? `${alt.duration_hrs}h` : ''}{alt.vibe_tags?.[0] ? ` · ${alt.vibe_tags[0]}` : ''}
                </p>
              </div>
              <ChevronRight size={16} color="#cbd5e1" style={{ flexShrink:0 }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MapView ──────────────────────────────────────────────────────────────────
export default function MapView({
  days, dayStops, activeDay, onDayChange, primaryCity, isVisible,
  deleteStop, swapStop, allAttractions,
}) {
  const mapRef          = useRef(null);
  const mapInitialized  = useRef(false);
  const containerRef    = useRef(null);
  const markersRef      = useRef([]);
  const resizeTimer     = useRef(null);
  const scrollRef       = useRef(null);
  // Keep a ref of activeCardIdx so effects that fire asynchronously
  // (e.g. map.once('load')) can read the current value without stale closure.
  const activeCardIdxRef = useRef(0);

  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [swapState, setSwapState]         = useState(null); // { stop, dayIdx }
  const [swapAlts, setSwapAlts]           = useState([]);

  const stops   = dayStops[activeDay] || [];
  const cityKey = days[activeDay]?.city || primaryCity;
  const center  = CITY_CENTERS[cityKey] || CITY_CENTERS.guangzhou;

  // Sync ref so async callbacks read current value
  useEffect(() => { activeCardIdxRef.current = activeCardIdx; }, [activeCardIdx]);

  // ── Single-init Mapbox instance ────────────────────────────────────────────
  useEffect(() => {
    if (mapInitialized.current || !containerRef.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;
    try {
      mapRef.current = new mapboxgl.Map({
        container:          containerRef.current,
        style:              'mapbox://styles/mapbox/streets-v12',
        center:             [center.lng, center.lat],
        zoom:               12,
        attributionControl: false,
      });
      mapInitialized.current = true;
    } catch (err) {
      console.error('[MapView] init error:', err);
    }

    return () => {
      clearTimeout(resizeTimer.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current       = null;
        mapInitialized.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize on visibility change (60 ms delay per spec) ────────────────────
  useEffect(() => {
    if (isVisible && mapRef.current) {
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => { mapRef.current?.resize(); }, 60);
    }
  }, [isVisible]);

  // ── Place / refresh markers when day or stops change ──────────────────────
  const stopsKey = stops.map(s => s.id).join(',');

  useEffect(() => {
    if (!mapRef.current) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    const valid = stops.filter(s => s.lat && s.lng);
    if (!valid.length) return;

    function place() {
      valid.forEach((stop, i) => {
        const active = i === activeCardIdxRef.current;
        const el = buildMarkerEl(i + 1, active);
        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([stop.lng, stop.lat])
            .addTo(mapRef.current),
        );
      });
      fitBounds(valid);
    }

    if (mapRef.current.isStyleLoaded()) place();
    else mapRef.current.once('load', place);

  }, [stopsKey, activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update marker styles + pan when active card changes ───────────────────
  useEffect(() => {
    markersRef.current.forEach((marker, i) => {
      updateMarkerEl(marker.getElement(), i + 1, i === activeCardIdx);
    });
    const stop = stops[activeCardIdx];
    if (stop?.lat && stop?.lng && mapRef.current) {
      mapRef.current.flyTo({ center: [stop.lng, stop.lat], zoom: 14, duration: 400 });
    }
  }, [activeCardIdx]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reset card position when switching days ────────────────────────────────
  useEffect(() => {
    setActiveCardIdx(0);
    activeCardIdxRef.current = 0;
    // Instant scroll-to-start without animation to avoid fighting scroll-snap
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollLeft = 0;
    }, 30);
  }, [activeDay]);

  // ── Clamp card index if stops were deleted ─────────────────────────────────
  useEffect(() => {
    const max = Math.max(0, stops.length - 1);
    if (activeCardIdx > max) setActiveCardIdx(max);
  }, [stops.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fitBounds(valid) {
    if (!mapRef.current || !valid.length) return;
    if (valid.length === 1) {
      mapRef.current.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 14, duration: 700 });
    } else {
      const lngs = valid.map(s => s.lng);
      const lats = valid.map(s => s.lat);
      mapRef.current.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        // Extra bottom padding so markers aren't hidden behind cards
        { padding: { top: 70, bottom: 270, left: 60, right: 60 }, maxZoom: 15, duration: 700 },
      );
    }
  }

  function buildMarkerEl(num, active) {
    const el   = document.createElement('div');
    const size = active ? 36 : 26;
    Object.assign(el.style, {
      width:        `${size}px`,
      height:       `${size}px`,
      borderRadius: '50%',
      background:   active ? '#fff' : ACCENT,
      border:       active ? `2.5px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'center',
      fontSize:     '12px',
      fontWeight:   '800',
      color:        active ? ACCENT : '#fff',
      fontFamily:   "'DM Sans', sans-serif",
      boxShadow:    active
        ? `0 4px 16px rgba(232,71,42,0.45)`
        : '0 2px 8px rgba(0,0,0,0.28)',
      cursor:       'pointer',
      transition:   'all 0.25s ease',
    });
    el.textContent = String(num);
    return el;
  }

  function updateMarkerEl(el, num, active) {
    if (!el) return;
    const size = active ? 36 : 26;
    Object.assign(el.style, {
      width:      `${size}px`,
      height:     `${size}px`,
      background: active ? '#fff' : ACCENT,
      border:     active ? `2.5px solid ${ACCENT}` : '2.5px solid rgba(255,255,255,0.9)',
      color:      active ? ACCENT : '#fff',
      boxShadow:  active
        ? `0 4px 16px rgba(232,71,42,0.45)`
        : '0 2px 8px rgba(0,0,0,0.28)',
    });
    void num; // suppress unused-var lint
  }

  // ── Detect centred card on scroll ──────────────────────────────────────────
  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const scrollCenter = container.scrollLeft + container.clientWidth / 2;
    const cards        = Array.from(container.children);
    let minDist = Infinity, idx = 0;
    cards.forEach((card, i) => {
      const dist = Math.abs((card.offsetLeft + card.offsetWidth / 2) - scrollCenter);
      if (dist < minDist) { minDist = dist; idx = i; }
    });
    if (idx !== activeCardIdx) setActiveCardIdx(idx);
  }

  // ── Open swap panel ────────────────────────────────────────────────────────
  function openSwap(stop) {
    const usedIds = new Set(stops.map(s => s.id));
    const alts    = getSwapAlternatives(stop, allAttractions || [], usedIds, 3);
    setSwapAlts(alts);
    setSwapState({ stop, dayIdx: activeDay });
  }

  function handleSwap(newStop) {
    if (!swapState) return;
    swapStop(swapState.dayIdx, swapState.stop.id, newStop);
    setSwapState(null);
  }

  // ── Layout constants ────────────────────────────────────────────────────────
  // 30 px side-padding on the scroll container → 20 px peek after 10 px gap
  const SCROLL_PADDING = 30;
  const CARDS_BOTTOM   = DAY_TABS_H + 12; // px from bottom of container

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      overflow: 'hidden', background: '#e8eaf0',
    }}>

      {/* ── Map canvas fills everything ──────────────────────────────────── */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* ── Empty-day overlay ────────────────────────────────────────────── */}
      {stops.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.92)', borderRadius: 20,
            padding: '24px 36px', textAlign: 'center',
            backdropFilter: 'blur(8px)',
          }}>
            <p style={{ fontSize: 32, margin: '0 0 8px' }}>📍</p>
            <p style={{ fontSize: 14, color: '#64748b', margin: 0, fontWeight: 600 }}>
              No stops for Day {activeDay + 1}
            </p>
          </div>
        </div>
      )}

      {/* ── Horizontal snap-scroll cards ─────────────────────────────────── */}
      {stops.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom:   CARDS_BOTTOM,
          left: 0, right: 0,
        }}>
          {/* Webkit scrollbar: handled by global CSS or hidden on mobile by default */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            style={{
              display:               'flex',
              overflowX:             'auto',
              scrollSnapType:        'x mandatory',
              WebkitOverflowScrolling:'touch',
              gap:                   10,
              paddingLeft:           SCROLL_PADDING,
              paddingRight:          SCROLL_PADDING,
              paddingTop:            8,
              paddingBottom:         8,
              scrollbarWidth:        'none',
              msOverflowStyle:       'none',
            }}
          >
            {stops.map((stop, i) => (
              <StopCard
                key={stop.id}
                stop={stop}
                index={i}
                active={i === activeCardIdx}
                onSwipeUp={()  => openSwap(stop)}
                onSwipeDown={() => deleteStop && deleteStop(activeDay, stop.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Day tabs — pinned at the bottom ──────────────────────────────── */}
      <div style={{
        position:        'absolute',
        bottom:          0, left: 0, right: 0,
        height:          DAY_TABS_H,
        display:         'flex',
        alignItems:      'center',
        gap:             8,
        padding:         '0 12px',
        overflowX:       'auto',
        background:      'rgba(255,255,255,0.92)',
        backdropFilter:  'blur(12px)',
        borderTop:       '1px solid rgba(241,245,249,0.8)',
        scrollbarWidth:  'none',
        msOverflowStyle: 'none',
      }}>
        {days.map((day, i) => {
          const active = i === activeDay;
          return (
            <button
              key={i}
              onClick={() => onDayChange(i)}
              style={{
                flexShrink:   0,
                padding:      '6px 14px',
                borderRadius: 20,
                fontSize:     12,
                fontWeight:   600,
                cursor:       'pointer',
                border:       'none',
                background:   active ? 'rgba(232,71,42,0.12)' : '#f1f5f9',
                color:        active ? ACCENT : '#64748b',
                outline:      active ? `1.5px solid ${ACCENT}` : 'none',
                whiteSpace:   'nowrap',
              }}
            >
              Day {i + 1}{day.cityHeader ? ` ${day.cityHeader.emoji}` : ''}
            </button>
          );
        })}
      </div>

      {/* ── Swap panel (slides up from bottom) ───────────────────────────── */}
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
