import { loadCityData } from '../utils/algorithm';
import { getAgodaLink } from '../utils/affiliateLinks';

const ACCENT = '#E8472A';

function getCategoryIcon(category) {
  const map = { attraction: '🏛️', nature: '🌿', shopping: '🛍️', experience: '✨', food: '🍜' };
  return map[category] || '📍';
}

export default function PrintView({ printRef, itinerary, dayStops, quizAnswers }) {
  if (!itinerary) return null;
  const { days, cities, hotel } = itinerary;
  const primaryCity = cities?.[0] || 'guangzhou';
  const cityData = loadCityData(primaryCity);
  const totalStops = dayStops.flat().length;

  return (
    <div
      ref={printRef}
      style={{
        position: 'fixed',
        left: '-9999px',
        top: 0,
        width: 390,
        background: '#EEF2F7',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        fontSize: 14,
        color: '#1a1a2e',
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(155deg, #1a0a05 0%, #2d1208 40%, #0f2027 100%)',
        padding: '40px 24px 28px',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, letterSpacing: 2, marginBottom: 6 }}>
          CHINA TRAVEL ITINERARY
        </p>
        <h1 style={{ color: '#fff', fontSize: 26, fontWeight: 800, margin: '0 0 4px' }}>
          {cities?.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(' + ')}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 13, margin: '0 0 16px' }}>
          {cityData?.tagline}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          {[`${days.length} days`, `${totalStops} stops`, `${dayStops.flat().filter(s => s.free).length} free`].map(t => (
            <span key={t} style={{
              background: 'rgba(255,255,255,0.12)', color: '#fff',
              padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
            }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Days */}
      {days.map((day, i) => {
        const stops = dayStops[i] || [];
        const food = day.food || [];
        return (
          <div key={i} style={{ margin: '16px 16px 0' }}>
            {/* City header on first day of new city */}
            {day.cityHeader && i > 0 && (
              <div style={{
                background: 'linear-gradient(135deg, #1a0a05, #2d1208)',
                borderRadius: 14, padding: '12px 16px', marginBottom: 10,
              }}>
                <p style={{ color: '#fff', fontWeight: 700, margin: 0 }}>
                  {day.cityHeader.emoji} {day.cityHeader.name} {day.cityHeader.chinese}
                </p>
              </div>
            )}

            {/* Day heading */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                background: ACCENT, color: '#fff', borderRadius: 10,
                padding: '4px 10px', fontSize: 12, fontWeight: 800,
              }}>
                {day.label}
              </div>
              <p style={{ color: '#64748b', fontSize: 12, margin: 0 }}>
                {stops.length} stops · {stops.reduce((s, st) => s + st.duration_hrs, 0).toFixed(0)}h
              </p>
            </div>

            {/* Stops */}
            {stops.map((stop, j) => (
              <div key={stop.id} style={{
                background: '#fff', borderRadius: 16, padding: '14px 14px',
                marginBottom: 10, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              }}>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'rgba(232,71,42,0.1)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: 16,
                  }}>
                    {getCategoryIcon(stop.category)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 2px' }}>{stop.name}</p>
                        <p style={{ color: '#94a3b8', fontSize: 11, margin: 0 }}>{stop.chinese}</p>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontWeight: 600, fontSize: 12, margin: '0 0 2px' }}>
                          {stop.startTime}–{stop.endTime}
                        </p>
                        <p style={{ color: stop.free ? '#10B981' : '#64748b', fontSize: 11, fontWeight: 600, margin: 0 }}>
                          {stop.free ? 'Free' : `¥${stop.price_rmb}`}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <span style={{
                        background: 'rgba(232,71,42,0.1)', color: ACCENT,
                        padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                      }}>{stop.vibe_tags?.[0] || stop.category}</span>
                      <span style={{ color: '#94a3b8', fontSize: 10 }}>📍 {stop.district}</span>
                    </div>
                    {stop.tip && (
                      <p style={{
                        fontSize: 11, color: '#64748b', marginTop: 8, lineHeight: 1.5,
                        borderLeft: `3px solid ${ACCENT}`, paddingLeft: 8,
                      }}>
                        💡 {stop.tip}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Food picks */}
            {food.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <p style={{ fontWeight: 700, fontSize: 12, color: '#64748b', marginBottom: 8 }}>🍜 FOOD PICKS</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {food.map(f => (
                    <div key={f.id} style={{
                      background: '#fff', borderRadius: 12, padding: 12,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    }}>
                      <p style={{ fontWeight: 700, fontSize: 12, margin: '0 0 2px' }}>{f.name}</p>
                      <p style={{ color: '#94a3b8', fontSize: 10, margin: '0 0 4px' }}>{f.chinese}</p>
                      <p style={{ color: '#0EA5E9', fontWeight: 700, fontSize: 11, margin: 0 }}>{f.price_range}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Hotel */}
      {hotel && (
        <div style={{ margin: '16px 16px 0' }}>
          <div style={{
            background: 'linear-gradient(155deg, #1a0a05 0%, #2d1208 40%, #0f2027 100%)',
            borderRadius: 20, padding: '20px',
          }}>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 700, letterSpacing: 2, margin: '0 0 6px' }}>
              🏨 RECOMMENDED HOTEL
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 2px' }}>{hotel.name}</p>
                <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, margin: 0 }}>{hotel.area} District</p>
              </div>
              <p style={{ color: ACCENT, fontWeight: 800, fontSize: 14, margin: 0 }}>{hotel.price}</p>
            </div>
            <div style={{ display: 'flex', gap: 4, margin: '8px 0' }}>
              {Array.from({ length: hotel.stars }).map((_, i) => (
                <span key={i} style={{ color: ACCENT, fontSize: 14 }}>★</span>
              ))}
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, marginLeft: 4 }}>{hotel.rating}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 1 }}>({hotel.reviews} reviews)</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, margin: 0 }}>
              Book via Agoda: agoda.com — search "{hotel.name}"
            </p>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{ padding: '20px 24px 32px', textAlign: 'center' }}>
        <p style={{ color: '#94a3b8', fontSize: 10, margin: 0 }}>
          Generated by China Travel Planner · chinatravelplanner.vercel.app
        </p>
      </div>
    </div>
  );
}
