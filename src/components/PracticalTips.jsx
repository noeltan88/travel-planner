const TIPS = [
  { icon: '💳', label: 'Payment', text: 'Set up Alipay International before landing — link Visa/Mastercard.' },
  { icon: '🔐', label: 'VPN', text: 'Install VPN before arriving. Google, Instagram & WhatsApp are blocked.' },
  { icon: '🗺️', label: 'Maps', text: 'Download Gaode Maps (高德地图) — far better than Google Maps in China.' },
  { icon: '🚇', label: 'Metro', text: 'Metro is clean, cheap, and bilingual. Buy a 3-day pass to save.' },
];

export default function PracticalTips({ practical }) {
  const tips = practical
    ? [
        { icon: '💳', label: 'Payment', text: practical.payment },
        { icon: '🔐', label: 'VPN', text: practical.connectivity },
        { icon: '🗺️', label: 'Maps', text: practical.transport },
        { icon: '🚇', label: 'Metro', text: practical.transport_tip || practical.language },
      ]
    : TIPS;

  return (
    <div className="px-4 mb-6">
      <h3 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        📋 Before You Go
      </h3>
      <div className="flex flex-col gap-2">
        {tips.filter(t => t.text).map((tip, i) => (
          <div
            key={i}
            className="flex items-start gap-3 p-3 rounded-2xl bg-white"
            style={{ boxShadow: 'var(--shadow-card)' }}
          >
            <span className="text-xl flex-shrink-0">{tip.icon}</span>
            <div>
              <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>{tip.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{tip.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
