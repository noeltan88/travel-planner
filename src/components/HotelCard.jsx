import { getAgodaLink } from '../utils/affiliateLinks';

export default function HotelCard({ hotel, otherHotels }) {
  if (!hotel) return null;

  return (
    <div className="mx-4 mb-4 rounded-3xl overflow-hidden" style={{ boxShadow: 'var(--shadow-hotel)' }}>
      <div className="p-5 hero-bg">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs font-bold tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.5)' }}>
              🏨 BEST LOCATED FOR YOUR ITINERARY
            </p>
            <h3 className="text-lg font-bold text-white">{hotel.name}</h3>
            <p className="text-sm" style={{ color: 'rgba(255,255,255,0.6)' }}>{hotel.area} District</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>from</p>
            <p className="text-base font-bold" style={{ color: 'var(--accent)' }}>{hotel.price}</p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex gap-0.5">
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <span key={i} style={{ color: 'var(--accent)' }}>★</span>
            ))}
          </div>
          <span className="text-sm font-bold text-white">{hotel.rating}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>({hotel.reviews} reviews)</span>
        </div>

        {/* Why this hotel */}
        <div
          className="rounded-2xl p-3 mb-4"
          style={{ background: 'var(--accent-tint)', borderLeft: '3px solid var(--accent)' }}
        >
          <p className="text-xs text-white">
            📍 Recommended based on the geographic centre of all your stops — minimises daily commute time.
          </p>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['Central location', 'Metro nearby', 'Top rated'].map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-1 rounded-full"
              style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Agoda CTA */}
        <a
          href={getAgodaLink(hotel.agodaId)}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-3 rounded-2xl text-center font-bold text-white"
          style={{ background: 'var(--accent)', boxShadow: 'var(--shadow-agoda)' }}
        >
          Book on Agoda →
        </a>
      </div>

      {/* Other options */}
      {otherHotels?.length > 0 && (
        <div className="bg-white p-4">
          <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>OTHER OPTIONS</p>
          {otherHotels.map(h => (
            <a
              key={h.id}
              href={getAgodaLink(h.agodaId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-2.5 border-b last:border-0"
              style={{ borderColor: '#f1f5f9' }}
            >
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{h.name}</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: h.stars }).map((_, i) => (
                    <span key={i} className="text-xs" style={{ color: 'var(--accent)' }}>★</span>
                  ))}
                </div>
              </div>
              <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{h.price}</span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
