const TABS = [
  { id: 'itinerary', icon: '🗓️', label: 'Itinerary' },
  { id: 'map', icon: '🗺️', label: 'Map' },
  { id: 'hotels', icon: '🏨', label: 'Hotels' },
  { id: 'export', icon: '📋', label: 'Export' },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <div
      className="bottom-nav fixed bottom-0 left-0 right-0 bg-white flex"
      style={{
        maxWidth: 430,
        margin: '0 auto',
        borderTop: '1px solid #f1f5f9',
        backdropFilter: 'blur(12px)',
        zIndex: 40,
      }}
    >
      {TABS.map(tab => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className="flex-1 flex flex-col items-center justify-center py-3 gap-0.5 transition-all"
          >
            <span className="text-xl">{tab.icon}</span>
            <span
              className="text-xs font-semibold"
              style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {tab.label}
            </span>
            {isActive && (
              <div
                className="w-1 h-1 rounded-full mt-0.5"
                style={{ background: 'var(--accent)' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
