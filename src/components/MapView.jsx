import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';

const ACCENT = '#E8472A';

const CITY_CENTERS = {
  guangzhou: [23.1291, 113.2644],
  shenzhen: [22.5431, 114.0579],
  shanghai: [31.2304, 121.4737],
};

function numberedIcon(n) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width:30px;height:30px;border-radius:50%;
      background:${ACCENT};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:800;color:#fff;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
      font-family:'DM Sans',sans-serif;
    ">${n}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

function FitBounds({ stops }) {
  const map = useMap();
  useEffect(() => {
    if (!stops.length) return;
    if (stops.length === 1) {
      map.setView([stops[0].lat, stops[0].lng], 14);
    } else {
      map.fitBounds(
        stops.map(s => [s.lat, s.lng]),
        { padding: [40, 40], maxZoom: 15 }
      );
    }
  }, [stops, map]);
  return null;
}

export default function MapView({ days, dayStops, activeDay, onDayChange, primaryCity }) {
  const stops = dayStops[activeDay] || [];
  const positions = stops.map(s => [s.lat, s.lng]);
  const center = CITY_CENTERS[days[activeDay]?.city || primaryCity] || CITY_CENTERS.guangzhou;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Day tabs */}
      <div
        style={{
          display: 'flex', gap: 8, padding: '10px 12px',
          overflowX: 'auto', background: '#fff',
          borderBottom: '1px solid #f1f5f9', flexShrink: 0,
        }}
      >
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
              {day.label}
              {day.cityHeader ? ` ${day.cityHeader.emoji}` : ''}
            </button>
          );
        })}
      </div>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        {stops.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', height: '100%', color: '#94a3b8',
          }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🗺️</p>
            <p style={{ fontSize: 14 }}>No stops for this day</p>
          </div>
        ) : (
          <MapContainer
            center={center}
            zoom={13}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <FitBounds stops={stops} />

            {/* Dashed route line */}
            {positions.length > 1 && (
              <Polyline
                positions={positions}
                pathOptions={{
                  color: ACCENT,
                  weight: 2.5,
                  dashArray: '8, 6',
                  opacity: 0.85,
                }}
              />
            )}

            {/* Numbered pins */}
            {stops.map((stop, i) => (
              <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={numberedIcon(i + 1)}>
                <Popup closeButton={false} offset={[0, -10]}>
                  <div style={{ fontFamily: "'DM Sans', sans-serif", padding: '2px 4px', minWidth: 140 }}>
                    <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 3px', color: '#1a1a2e' }}>
                      {stop.name}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748b', margin: 0 }}>
                      {stop.startTime}–{stop.endTime} · {stop.district}
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
      </div>
    </div>
  );
}
