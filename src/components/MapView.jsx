import { useEffect, useRef } from 'react';
import { initMap, plotRoute } from '../utils/mapUtils';

const CITY_CENTERS = {
  guangzhou: { lat: 23.1291, lng: 113.2644 },
  shenzhen: { lat: 22.5431, lng: 114.0579 },
  shanghai: { lat: 31.2304, lng: 121.4737 },
};

export default function MapView({ days, dayStops, activeDay, onDayChange, primaryCity }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

    const center = CITY_CENTERS[days[activeDay]?.city || primaryCity] || CITY_CENTERS.guangzhou;

    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token) {
      return; // Map container shows fallback
    }

    const map = initMap(containerRef.current, center);
    mapRef.current = map;

    map.on('load', () => {
      const stops = dayStops[activeDay] || [];
      if (stops.length > 0) plotRoute(map, stops);
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [activeDay, primaryCity]);

  // Update route when day changes but map already loaded
  useEffect(() => {
    if (!mapRef.current) return;
    const stops = dayStops[activeDay] || [];
    if (mapRef.current.isStyleLoaded()) {
      plotRoute(mapRef.current, stops);
    }
  }, [dayStops, activeDay]);

  const hasToken = !!import.meta.env.VITE_MAPBOX_TOKEN;

  return (
    <div className="flex flex-col h-screen" style={{ paddingBottom: 64 }}>
      {/* Day tabs */}
      <div className="flex gap-2 p-3 overflow-x-auto" style={{ background: 'var(--surface)' }}>
        {days.map((day, i) => {
          const isActive = i === activeDay;
          return (
            <button
              key={i}
              onClick={() => onDayChange(i)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: isActive ? 'var(--accent-tint)' : '#f1f5f9',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                border: isActive ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              }}
            >
              {day.label}
              {day.cityHeader && <span className="ml-1">{day.cityHeader.emoji}</span>}
            </button>
          );
        })}
      </div>

      {/* Map or fallback */}
      <div className="flex-1 relative">
        {hasToken ? (
          <div ref={containerRef} id="map-container" style={{ width: '100%', height: '100%' }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center"
            style={{ background: '#f8fafc' }}>
            <p className="text-4xl mb-4">🗺️</p>
            <h3 className="font-bold text-base mb-2" style={{ color: 'var(--text-primary)' }}>
              Map needs a Mapbox token
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Add <code className="bg-gray-100 px-1 rounded">VITE_MAPBOX_TOKEN</code> to your <code className="bg-gray-100 px-1 rounded">.env</code> file
            </p>
            <a
              href="https://mapbox.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold"
              style={{ color: 'var(--accent)' }}
            >
              Get a free token →
            </a>
            {/* Stop list fallback */}
            <div className="w-full mt-8 text-left">
              {(dayStops[activeDay] || []).map((stop, i) => (
                <div key={stop.id} className="flex items-center gap-3 py-2 border-b" style={{ borderColor: '#e2e8f0' }}>
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: 'var(--accent)' }}
                  >
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stop.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stop.startTime} · {stop.district}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
