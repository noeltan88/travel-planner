import { useEffect, useRef, useState, Component } from 'react';
import mapboxgl from 'mapbox-gl';

// Token from .env.local (VITE_MAPBOX_TOKEN) — set there so it is never
// committed to git, but is always defined for local dev and CI/CD builds.
const TOKEN  = import.meta.env.VITE_MAPBOX_TOKEN;
const STYLE  = 'mapbox://styles/mapbox/streets-v12';
const ACCENT = '#E8472A';

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

// ── Error boundary ────────────────────────────────────────────────────────────
export class MapErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: '100%', color: '#94a3b8', gap: 8,
        }}>
          <p style={{ fontSize: 32 }}>🗺️</p>
          <p style={{ fontSize: 14 }}>Map unavailable</p>
          <button
            onClick={() => this.setState({ error: false })}
            style={{ marginTop: 8, fontSize: 12, color: ACCENT, background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── MapView ───────────────────────────────────────────────────────────────────

export default function MapView({ days, dayStops, activeDay, onDayChange, primaryCity, isVisible }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const initedRef    = useRef(false);   // guarantees init runs exactly once
  const markersRef   = useRef([]);
  const popupRef     = useRef(null);
  const [selectedId, setSelectedId] = useState(null);

  const stops   = dayStops[activeDay] || [];
  const cityKey = days[activeDay]?.city || primaryCity;
  const center  = CITY_CENTERS[cityKey] || CITY_CENTERS.guangzhou;

  // ── Initialise map exactly once ───────────────────────────────────────────
  useEffect(() => {
    if (initedRef.current || !containerRef.current) return;
    initedRef.current = true;

    mapboxgl.accessToken = TOKEN;
    mapRef.current = new mapboxgl.Map({
      container:          containerRef.current,
      style:              STYLE,
      center:             [center.lng, center.lat],
      zoom:               12,
      attributionControl: false,
    });
    mapRef.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

    return () => {
      // Only clean up if the component is truly removed from the DOM
      mapRef.current?.remove();
      mapRef.current  = null;
      initedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize whenever the map container becomes visible ────────────────────
  useEffect(() => {
    if (isVisible && mapRef.current) {
      // rAF ensures the CSS display:block has been painted before resize
      requestAnimationFrame(() => {
        mapRef.current?.resize();
      });
    }
  }, [isVisible]);

  // ── Refresh markers whenever the active day changes ───────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;
    setSelectedId(null);

    const valid = stops.filter(s => s.lat && s.lng);
    if (!valid.length) return;

    function placeMarkers() {
      valid.forEach((stop, i) => {
        const el = document.createElement('div');
        el.style.cssText = [
          'width:30px', 'height:30px', 'border-radius:50%',
          `background:${ACCENT}`, 'border:3px solid #fff',
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:12px', 'font-weight:800', 'color:#fff',
          "font-family:'DM Sans',sans-serif",
          'box-shadow:0 2px 10px rgba(0,0,0,0.35)',
          'cursor:pointer', 'transition:transform 0.15s',
        ].join(';');
        el.textContent = String(i + 1);

        el.addEventListener('click', () => {
          setSelectedId(prev => (prev === stop.id ? null : stop.id));
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ offset: 20, closeButton: false })
            .setLngLat([stop.lng, stop.lat])
            .setHTML(`
              <div style="font-family:'DM Sans',sans-serif;padding:2px 4px;min-width:140px;max-width:200px">
                <p style="font-weight:700;font-size:13px;margin:0 0 3px;color:#1a1a2e">${stop.name}</p>
                <p style="font-size:11px;color:#64748b;margin:0">${stop.startTime}–${stop.endTime} · ${stop.district}</p>
              </div>
            `)
            .addTo(map);
        });

        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([stop.lng, stop.lat])
            .addTo(map),
        );
      });

      if (valid.length === 1) {
        map.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 14, duration: 700 });
      } else {
        const lngs = valid.map(s => s.lng);
        const lats = valid.map(s => s.lat);
        map.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 15, duration: 700 },
        );
      }
    }

    if (map.isStyleLoaded()) {
      placeMarkers();
    } else {
      map.once('load', placeMarkers);
    }
  }, [activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Day tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px', overflowX: 'auto',
        background: '#fff', borderBottom: '1px solid #f1f5f9', flexShrink: 0,
      }}>
        {days.map((day, i) => {
          const active = i === activeDay;
          return (
            <button
              key={i}
              onClick={() => onDayChange(i)}
              style={{
                flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: active ? 'rgba(232,71,42,0.12)' : '#f1f5f9',
                color: active ? ACCENT : '#64748b',
                outline: active ? `1.5px solid ${ACCENT}` : 'none',
              }}
            >
              {day.label}{day.cityHeader ? ` ${day.cityHeader.emoji}` : ''}
            </button>
          );
        })}
      </div>

      {/* Map container — always in DOM, never conditionally rendered */}
      <div style={{ height: 340, flexShrink: 0, position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        {stops.length === 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8',
          }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🗺️</p>
            <p style={{ fontSize: 14 }}>No stops for this day</p>
          </div>
        )}
      </div>

      {/* Stop list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stops.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 24 }}>
            No stops planned for this day.
          </p>
        ) : stops.map((stop, i) => {
          const sel = selectedId === stop.id;
          return (
            <div
              key={stop.id}
              onClick={() => {
                const nowSelected = !sel;
                setSelectedId(nowSelected ? stop.id : null);
                popupRef.current?.remove();
                popupRef.current = null;
                if (nowSelected && mapRef.current && stop.lng && stop.lat) {
                  mapRef.current.flyTo({ center: [stop.lng, stop.lat], zoom: 15, duration: 500 });
                }
              }}
              style={{
                background: sel ? 'rgba(232,71,42,0.06)' : '#fff',
                border: `1.5px solid ${sel ? ACCENT : '#f1f5f9'}`,
                borderRadius: 14, padding: '10px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                cursor: 'pointer', transition: 'border-color 0.15s',
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: ACCENT,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 800, color: '#fff', flexShrink: 0,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 13, color: '#1a1a2e', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {stop.name}
                </p>
                <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                  {stop.startTime}–{stop.endTime} · {stop.district}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
