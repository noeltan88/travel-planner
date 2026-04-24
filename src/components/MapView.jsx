import { useState, useEffect, useRef } from 'react';
import Map, { Marker, Popup } from 'react-map-gl/mapbox';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
const MAPBOX_STYLE = 'mapbox://styles/mapbox/streets-v12';
const ACCENT = '#E8472A';

const CITY_CENTERS = {
  guangzhou:   { lng: 113.2644, lat: 23.1291 },
  shenzhen:    { lng: 114.0579, lat: 22.5431 },
  shanghai:    { lng: 121.4737, lat: 31.2304 },
  chongqing:   { lng: 106.5516, lat: 29.5630 },
  chengdu:     { lng: 104.0668, lat: 30.5728 },
  beijing:     { lng: 116.4074, lat: 39.9042 },
  hangzhou:    { lng: 120.1551, lat: 30.2741 },
  xian:        { lng: 108.9480, lat: 34.2658 },
  guilin:      { lng: 110.2990, lat: 25.2736 },
  changsha:    { lng: 112.9388, lat: 28.2282 },
  zhangjiajie: { lng: 110.4797, lat: 29.1248 },
  yunnan:      { lng: 102.7124, lat: 25.0453 },
  suzhou:      { lng: 120.5853, lat: 31.2990 },
  jiuzhaigou:  { lng: 103.9184, lat: 33.2600 },
  harbin:      { lng: 126.5353, lat: 45.8038 },
  changbaishan:{ lng: 128.0622, lat: 42.0069 },
  sanya:       { lng: 109.5119, lat: 18.2528 },
  xiamen:      { lng: 118.0894, lat: 24.4798 },
  huangshan:   { lng: 118.3364, lat: 30.1334 },
  nanjing:     { lng: 118.7969, lat: 32.0603 },
  qingdao:     { lng: 120.3826, lat: 36.0671 },
};

function NumberedPin({ number, isSelected }) {
  return (
    <div
      style={{
        width: 30, height: 30, borderRadius: '50%',
        background: isSelected ? '#c93820' : ACCENT,
        border: '3px solid #fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: '#fff',
        boxShadow: '0 2px 10px rgba(0,0,0,0.35)',
        cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif",
        transform: isSelected ? 'scale(1.15)' : 'scale(1)',
        transition: 'transform 0.15s ease',
      }}
    >
      {number}
    </div>
  );
}

export default function MapView({ days, dayStops, activeDay, onDayChange, primaryCity }) {
  const stops = dayStops[activeDay] || [];
  const mapRef = useRef();
  const [selectedStop, setSelectedStop] = useState(null);

  const cityKey = days[activeDay]?.city || primaryCity;
  const defaultCenter = CITY_CENTERS[cityKey] || CITY_CENTERS.guangzhou;

  // Fit bounds whenever active day or stops change
  useEffect(() => {
    setSelectedStop(null);
    const valid = stops.filter(s => s.lat && s.lng);
    if (!valid.length || !mapRef.current) return;

    // Small delay to let the map settle after a day switch
    const t = setTimeout(() => {
      if (!mapRef.current) return;
      if (valid.length === 1) {
        mapRef.current.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 14, duration: 700 });
      } else {
        const lngs = valid.map(s => s.lng);
        const lats = valid.map(s => s.lat);
        mapRef.current.fitBounds(
          [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
          { padding: 60, maxZoom: 15, duration: 700 }
        );
      }
    }, 150);
    return () => clearTimeout(t);
  }, [activeDay]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleStop(stop) {
    setSelectedStop(prev => (prev?.id === stop.id ? null : stop));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden', background: '#f8fafc' }}>

      {/* Day tabs */}
      <div style={{
        display: 'flex', gap: 8, padding: '10px 12px',
        overflowX: 'auto', background: '#fff',
        borderBottom: '1px solid #f1f5f9', flexShrink: 0,
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

      {/* Map */}
      <div style={{ height: 340, flexShrink: 0, position: 'relative' }}>
        {stops.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', background: '#f1f5f9', color: '#94a3b8',
          }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🗺️</p>
            <p style={{ fontSize: 14 }}>No stops for this day</p>
          </div>
        ) : (
          <Map
            ref={mapRef}
            mapboxAccessToken={MAPBOX_TOKEN}
            initialViewState={{ longitude: defaultCenter.lng, latitude: defaultCenter.lat, zoom: 12 }}
            style={{ width: '100%', height: '100%' }}
            mapStyle={MAPBOX_STYLE}
          >
            {stops.map((stop, i) => (
              <Marker
                key={stop.id}
                longitude={stop.lng}
                latitude={stop.lat}
                anchor="center"
              >
                <div onClick={() => toggleStop(stop)}>
                  <NumberedPin number={i + 1} isSelected={selectedStop?.id === stop.id} />
                </div>
              </Marker>
            ))}

            {selectedStop && (
              <Popup
                longitude={selectedStop.lng}
                latitude={selectedStop.lat}
                anchor="bottom"
                offset={20}
                closeButton={false}
                closeOnClick={false}
                onClose={() => setSelectedStop(null)}
              >
                <div style={{ fontFamily: "'DM Sans', sans-serif", padding: '2px 4px', minWidth: 140, maxWidth: 200 }}>
                  <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px', color: '#1a1a2e' }}>
                    {selectedStop.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                    {selectedStop.startTime}–{selectedStop.endTime} · {selectedStop.district}
                  </p>
                </div>
              </Popup>
            )}
          </Map>
        )}
      </div>

      {/* Stop list below map */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {stops.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, marginTop: 24 }}>No stops planned for this day.</p>
        ) : stops.map((stop, i) => {
          const sel = selectedStop?.id === stop.id;
          return (
            <div
              key={stop.id}
              onClick={() => toggleStop(stop)}
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
