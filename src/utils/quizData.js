import masterDb from '../data/china-master-db-v1.json';

const CITY_ORDER = [
  'guangzhou','shenzhen','shanghai','chongqing','chengdu','beijing','hangzhou',
  'xian','guilin','changsha','zhangjiajie','yunnan','suzhou','jiuzhaigou',
  'harbin','changbaishan','sanya','xiamen','huangshan','nanjing','qingdao',
];

const EMOJI_OVERRIDES = {
  guangzhou:    '🥘',
  shenzhen:     '🤖',
  shanghai:     '🌆',
  chongqing:    '🌶️',
  chengdu:      '🐼',
  beijing:      '🏯',
  hangzhou:     '🍵',
  changbaishan: '⛷️',
  sanya:        '🏖️',
  xiamen:       '🎹',
  huangshan:    '🌅',
  nanjing:      '🏯',
  qingdao:      '🍺',
  xian:         '🏺',
  guilin:       '🛶',
  changsha:     '🌶️',
  zhangjiajie:  '🏔️',
  yunnan:       '🌸',
  suzhou:       '🪷',
  jiuzhaigou:   '💎',
  harbin:       '❄️',
};

const TAGLINE_OVERRIDES = {
  changbaishan: 'Volcanic lakes & pristine ski slopes',
  sanya:        "China's tropical beach paradise",
  xiamen:       'Piano Island & colonial seaside charm',
  huangshan:    'Misty peaks & sea of clouds',
  nanjing:      'Ancient capital with Ming dynasty glory',
  qingdao:      'Beer, beaches & German heritage',
  xian:         'Terracotta warriors & the Silk Road',
  guilin:       'Karst mountains & Li River cruises',
  changsha:     "Spicy food capital & Mao's homeland",
  zhangjiajie:  "Avatar's floating mountains come to life",
  yunnan:       'Ethnic diversity & Himalayan foothills',
  suzhou:       'Venice of the East & classical gardens',
  jiuzhaigou:   'Rainbow lakes & magical waterfalls',
  harbin:       'Ice sculptures & Russian architecture',
};

const cityOptions = CITY_ORDER.map(id => {
  const c = masterDb.cities[id];
  return {
    icon: EMOJI_OVERRIDES[id] || c.emoji || '🏙️',
    name: c.name,
    desc: TAGLINE_OVERRIDES[id] || c.tagline || c.recommended_base_reason,
    value: id,
  };
});

export const QUIZ = [
  {
    id: 'country',
    label: 'DESTINATION',
    title: 'Where are you heading?',
    sub: 'Select your destination country',
    multi: false,
    deco: '国',
    options: [
      { icon: '🇨🇳', name: 'China', desc: 'Guangzhou · Shanghai · Beijing & more', value: 'china' },
      { icon: '🇹🇭', name: 'Thailand', desc: 'Bangkok, Chiang Mai, Phuket', value: 'thailand', comingSoon: true },
      { icon: '🇯🇵', name: 'Japan', desc: 'Tokyo, Osaka, Kyoto', value: 'japan', comingSoon: true },
      { icon: '🇻🇳', name: 'Vietnam', desc: 'Hanoi, Ho Chi Minh, Da Nang', value: 'vietnam', comingSoon: true },
      { icon: '🇰🇷', name: 'South Korea', desc: 'Seoul, Busan, Jeju', value: 'southkorea', comingSoon: true },
    ],
  },
  {
    id: 'city',
    label: 'DESTINATION',
    title: 'Which city are you visiting?',
    sub: 'Select one or more cities',
    multi: true,
    deco: '中',
    options: cityOptions,
  },
  {
    id: 'dates',
    label: 'YOUR DATES',
    title: 'When are you travelling?',
    sub: 'Pick your departure and return dates',
    type: 'daterange',
    multi: false,
    deco: '天',
    options: [],
  },
  {
    id: 'group',
    label: 'TRAVEL GROUP',
    title: 'Who are you travelling with?',
    sub: "We'll adjust stops for your group",
    multi: false,
    deco: '家',
    options: [
      { icon: '🧍', name: 'Solo', desc: 'Freedom, flexibility, your pace', value: 'solo' },
      { icon: '👫', name: 'Couple', desc: 'Romantic spots & date-worthy dinners', value: 'couple' },
      { icon: '👨‍👩‍👧', name: 'Family with kids', desc: 'Kid-friendly stops, less walking', value: 'family-kids' },
      { icon: '👫', name: 'Group of friends', desc: 'Good vibes, shared experiences', value: 'friends' },
      { icon: '👴', name: 'With elderly', desc: 'Accessible routes, no steep climbs', value: 'family-elderly' },
    ]
  },
  {
    id: 'pace',
    label: 'PACE',
    title: 'How packed do you like your days?',
    sub: "We'll adjust how much we fit in each day",
    multi: false,
    deco: '速',
    options: [
      { icon: '🌿', name: 'Chill', desc: '2–3 stops, lots of breathing room', value: 'chill' },
      { icon: '⚖️', name: 'Balance', desc: '4–5 stops, relaxed but fulfilling', value: 'balance' },
      { icon: '⚡', name: 'Pack it in', desc: '6+ stops, maximise every hour', value: 'pack' },
    ],
  },
  {
    id: 'vibe',
    label: 'YOUR VIBE',
    title: 'What kind of trip do you want?',
    sub: 'Pick as many as you like',
    note: 'Or let us decide 👇',
    multi: true,
    deco: '玩',
    options: [
      { icon: '🌿', name: 'Scenic & nature',     desc: 'Parks, rivers, mountains, lakes',                   value: 'scenic' },
      { icon: '🏛️', name: 'History & culture',   desc: 'Temples, museums, old towns, heritage',              value: 'culture' },
      { icon: '📸', name: 'Instagrammable',       desc: 'Photogenic, shareable, beautiful spots',             value: 'instagrammable' },
      { icon: '🛍️', name: 'Shopping & food',     desc: 'Markets, malls, street eats, cafes',                value: 'shopping' },
      { icon: '🗺️', name: 'Local & hidden gems', desc: 'Where locals go, off the beaten path',               value: 'local' },
      { icon: '🎢', name: 'Fun & adventure',      desc: 'Theme parks, cable cars, hot springs, skiing',       value: 'adventure' },
      { icon: '🎲', name: 'Surprise me',          desc: 'No preference — show me the best of everything',     value: 'surprise', exclusive: true },
    ],
  },
  {
    id: 'dietary',
    label: 'DIETARY NEEDS',
    title: 'Any dietary requirements?',
    sub: "We'll filter your food picks",
    multi: true,
    deco: '食',
    options: [
      { icon: '✅', name: 'No restrictions', desc: 'I eat everything — surprise me', value: 'none', exclusive: true },
      { icon: '🥦', name: 'Vegetarian', desc: 'No meat or fish', value: 'vegetarian' },
      { icon: '🌙', name: 'Halal', desc: 'Muslim-friendly restaurants only', value: 'halal' },
      { icon: '🐟', name: 'Pescatarian', desc: 'Fish and seafood only, no other meat', value: 'pescatarian' },
    ]
  }
];
