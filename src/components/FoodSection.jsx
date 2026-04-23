export default function FoodSection({ food }) {
  if (!food?.length) return null;

  return (
    <div className="px-4 mb-4">
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        🍜 Food Picks Today
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {food.map(f => (
          <div
            key={f.id}
            className="p-3 rounded-2xl bg-white"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <p className="font-bold text-xs leading-tight mb-0.5" style={{ color: 'var(--text-primary)' }}>
              {f.name}
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>{f.chinese}</p>
            {f.where && (
              <p className="text-xs mb-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {f.where.split('—')[0].trim()}
              </p>
            )}
            <p className="text-xs font-bold" style={{ color: 'var(--blue)' }}>{f.price_range}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
