/**
 * ItineraryMap — lean 300 px map embedded at the top of the itinerary tab.
 *
 * Differences from MapView (full-screen tab):
 *  • No day-tabs, no stop list — just the canvas with numbered markers
 *  • Sized to exactly 300 px tall so the parent can use position:sticky top:0
 *  • Same single-init / never-unmount / resize-on-visible pattern
 */
import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const ACCENT       = '#E8472A';

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

export default function ItineraryMap({ days, dayStops, activeDay, primaryCity, isVisible }) {
  const containerRef   = useRef(null);
  const map            = useRef(null);
  const mapInitialized = useRef(false);
  const markersRef     = useRef([]);
  const popupRef       = useRef(null);
  const resizeTimer    = useRef(null);

  const cityKey = days[activeDay]?.city || primaryCity;
  const center  = CITY_CENTERS[cityKey] || CITY_CENTERS.guangzhou;

  // ── Init map exactly once ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapInitialized.current || !containerRef.current) return;

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      map.current = new mapboxgl.Map({
        container:          containerRef.current,
        style:              'mapbox://styles/mapbox/streets-v12',
        center:             [center.lng, center.lat],
        zoom:               12,
        attributionControl: false,
      });

      mapInitialized.current = true;
    } catch (err) {
      console.error('[ItineraryMap] init failed:', err);
    }

    return () => {
      clearTimeout(resizeTimer.current);
      if (map.current) {
        map.current.remove();
        map.current            = null;
        mapInitialized.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize when itinerary tab becomes visible ─────────────────────────────────
  useEffect(() => {
    if (isVisible && map.current) {
      clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => {
        map.current?.resize();
      }, 100);
    }
  }, [isVisible]);

  // ── Refresh markers whenever active day changes ──────────────────────────────
  useEffect(() => {
    if (!map.current) return;

    // Remove old markers and popup
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    popupRef.current?.remove();
    popupRef.current = null;

    const stops = dayStops[activeDay] || [];
    const valid = stops.filter(s => s.lat && s.lng);

    function placeMarkers() {
      // Place numbered markers
      valid.forEach((stop, i) => {
        const el = document.createElement('div');
        el.style.cssText = [
          'width:28px', 'height:28px', 'border-radius:50%',
          `background:${ACCENT}`, 'border:2.5px solid #fff',
          'display:flex', 'align-items:center', 'justify-content:center',
          'font-size:11px', 'font-weight:800', 'color:#fff',
          "font-family:'DM Sans',sans-serif",
          'box-shadow:0 2px 8px rgba(0,0,0,0.3)',
          'cursor:pointer',
        ].join(';');
        el.textContent = String(i + 1);

        el.addEventListener('click', () => {
          popupRef.current?.remove();
          popupRef.current = new mapboxgl.Popup({ offset: 18, closeButton: false })
            .setLngLat([stop.lng, stop.lat])
            .setHTML(`
              <div style="font-family:'DM Sans',sans-serif;padding:2px 4px;min-width:130px;max-width:190px">
                <p style="font-weight:700;font-size:12px;margin:0 0 2px;color:#1a1a2e">${stop.name}</p>
                <p style="font-size:10px;color:#64748b;margin:0">${stop.startTime}–${stop.endTime} · ${stop.district}</p>
              </div>
            `)
            .addTo(map.current);
        });

        markersRef.current.push(
          new mapboxgl.Marker({ element: el })
            .setLngLat([stop.lng, stop.lat])
            .addTo(map.current),
        );
      });

      // Fit viewport to markers
      if (valid.length === 1) {
        map.current.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 14, duration: 600 });
      } else if (valid.length > 1) {
        const lngs = valid.map(s => s.lng);
        const lats = valid.map(s => s.lat);
        map.current.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 48, maxZoom: 15, duration: 600 },
        );
      }
    }

    if (map.current.isStyleLoaded()) {
      placeMarkers();
    } else {
      map.current.once('load', placeMarkers);
    }
  }, [activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  // Explicit 300 px height so Mapbox can always measure the container
  return (
    <div ref={containerRef} style={{ width: '100%', height: '300px' }} />
  );
}
