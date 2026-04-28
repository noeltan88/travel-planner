// ── Country-specific "Before You Go" tips ─────────────────────────────────────
const COUNTRY_TIPS = {
  china: [
    { icon: '💳', label: 'Payment',     text: 'Set up Alipay International before landing — link Visa/Mastercard.' },
    { icon: '🔐', label: 'VPN',         text: 'Install VPN before arriving. Google, Instagram & WhatsApp are blocked.' },
    { icon: '🗺️', label: 'Maps',       text: 'Download Gaode Maps (高德地图) — far better than Google Maps in China.' },
    { icon: '🚇', label: 'Metro',       text: 'Metro is clean, cheap, and bilingual. Buy a 3-day pass to save.' },
  ],
  japan: [
    { icon: '🚉', label: 'IC Card',     text: 'Get a Suica or Pasmo card at any major station for all transit.' },
    { icon: '🚄', label: 'JR Pass',     text: 'If visiting 3+ cities, a JR Pass saves significantly on Shinkansen fares.' },
    { icon: '💴', label: 'Cash',        text: 'Japan is still largely cash-based — carry ¥5,000–10,000 at all times.' },
    { icon: '🗺️', label: 'Maps',       text: 'Google Maps works well for transit planning throughout Japan.' },
    { icon: '📶', label: 'SIM / WiFi',  text: 'Pick up a pocket WiFi or data SIM at the airport on arrival.' },
  ],
  south_korea: [
    { icon: '🚇', label: 'T-money',     text: 'Get a T-money card at any convenience store for buses and metro.' },
    { icon: '🗺️', label: 'Maps',       text: 'Kakao Maps is more accurate than Google Maps for Korea.' },
    { icon: '📱', label: 'Translation', text: 'Download Naver Translate — essential for menus and street signs.' },
    { icon: '💳', label: 'Payment',     text: 'Credit cards accepted almost everywhere — very cashless.' },
    { icon: '🚕', label: 'Taxis',       text: 'Download Kakao T for reliable taxi booking.' },
  ],
  thailand: [
    { icon: '🚕', label: 'Taxis',       text: 'Use Grab for taxis — safer and fairer than hailing street taxis.' },
    { icon: '🛕', label: 'Temples',     text: 'Dress modestly at temples — cover shoulders and knees.' },
    { icon: '💵', label: 'Cash',        text: 'Thai Baht cash is still preferred at markets and street food stalls.' },
    { icon: '🆘', label: 'Tourist Police', text: 'TAT Tourist Police hotline: 1155 — English-speaking assistance.' },
    { icon: '⚠️', label: 'Tuk-tuks',   text: 'Avoid tuk-tuks offering "special tours" — a common tourist scam.' },
  ],
  vietnam: [
    { icon: '🚕', label: 'Taxis',       text: 'Use Grab for taxis and food delivery — safe and reliable.' },
    { icon: '💵', label: 'Cash',        text: 'VND cash is essential — carry small bills for street food and markets.' },
    { icon: '🛍️', label: 'Bargaining', text: 'Bargain at markets — start at 50% of the asking price.' },
    { icon: '🛵', label: 'Motorbikes',  text: 'Helmet is required when using motorbike taxis (xe om).' },
    { icon: '🛂', label: 'Visa',        text: 'Most nationalities need an e-visa — apply online before travel at evisa.xuatnhapcanh.gov.vn.' },
  ],
};

const CHINA_TIPS_FALLBACK = COUNTRY_TIPS.china;

export default function PracticalTips({ practical, country }) {
  // If the DB has structured practical data, use it (China cities have this)
  const tips = practical
    ? [
        { icon: '💳', label: 'Payment',      text: practical.payment },
        { icon: '🔐', label: 'VPN',          text: practical.connectivity },
        { icon: '🗺️', label: 'Maps',        text: practical.transport },
        { icon: '🚇', label: 'Metro',        text: practical.transport_tip || practical.language },
      ]
    : (COUNTRY_TIPS[country] || CHINA_TIPS_FALLBACK);

  const filtered = tips.filter(t => t.text);
  if (!filtered.length) return null;

  return (
    <div style={{ padding: '0 16px 24px' }}>
      <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A1A', margin: '0 0 10px', letterSpacing: 0.3 }}>
        📋 Before You Go
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((tip, i) => (
          <div
            key={i}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              padding: '12px 14px', borderRadius: 14, background: '#fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1.2 }}>{tip.icon}</span>
            <div>
              <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: '#1A1A1A', marginBottom: 2 }}>
                {tip.label}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#666', lineHeight: 1.55 }}>
                {tip.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
