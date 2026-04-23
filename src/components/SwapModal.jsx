export default function SwapModal({ stop, alternatives, onSwap, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full rounded-t-3xl p-6"
        style={{ background: 'var(--surface)', maxWidth: 430, margin: '0 auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: '#e2e8f0' }} />

        <h3 className="font-bold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
          Swap "{stop?.name}"
        </h3>
        <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>
          Choose a replacement from similar stops
        </p>

        <div className="flex flex-col gap-3">
          {alternatives.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-muted)' }}>
              No alternatives available
            </p>
          ) : (
            alternatives.map(alt => (
              <button
                key={alt.id}
                onClick={() => onSwap(alt)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all"
                style={{ background: '#f8fafc', border: '2px solid transparent' }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                  style={{ background: 'var(--accent-tint)' }}
                >
                  {getCategoryIcon(alt.category)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {alt.name}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {alt.chinese} · {alt.district}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'var(--accent-tint)', color: 'var(--accent)' }}
                    >
                      {alt.vibe_tags?.[0] || alt.category}
                    </span>
                    <span
                      className="text-xs font-semibold"
                      style={{ color: alt.free ? 'var(--green)' : 'var(--text-secondary)' }}
                    >
                      {alt.free ? 'Free' : `¥${alt.price_rmb}`}
                    </span>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-2xl font-semibold text-sm"
          style={{ background: '#f1f5f9', color: 'var(--text-secondary)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function getCategoryIcon(category) {
  const map = {
    attraction: '🏛️', nature: '🌿', shopping: '🛍️', experience: '✨',
    food: '🍜', nightlife: '🌃',
  };
  return map[category] || '📍';
}
