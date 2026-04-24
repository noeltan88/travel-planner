import masterDb from '../data/china-master-db-v1.json';

const CITY_ORDER = [
  'guangzhou','shenzhen','shanghai','chongqing','chengdu','beijing','hangzhou',
  'xian','guilin','changsha','zhangjiajie','yunnan','suzhou','jiuzhaigou',
  'harbin','changbaishan','sanya','xiamen','huangshan','nanjing','qingdao',
];

const cityOptions = CITY_ORDER.map(id => {
  const c = masterDb.cities[id];
  return {
    icon: c.emoji || '🏙️',
    name: c.name,
    desc: c.tagline || c.recommended_base_reason,
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
      { icon: '👴', name: 'With elderly', desc: 'Accessible routes, no steep climbs', value: 'family-elderly' },
      { icon: '👥', name: 'Group of friends', desc: 'Nightlife, food & hidden gems', value: 'friends' },
    ]
  },
  {
    id: 'vibe',
    label: 'YOUR VIBE',
    title: 'What kind of trip do you want?',
    sub: 'Pick as many as you like',
    multi: true,
    deco: '玩',
    options: [
      { icon: '🏘️', name: 'Local hangouts', desc: 'Where the locals actually go', value: 'local' },
      { icon: '📸', name: 'Instagrammable', desc: 'Photogenic, shareable, beautiful', value: 'instagrammable' },
      { icon: '🌿', name: 'Scenic & nature', desc: 'Parks, rivers, mountain views', value: 'scenic' },
      { icon: '🏛️', name: 'History & culture', desc: 'Temples, museums, old towns', value: 'culture' },
      { icon: '💎', name: 'Hidden gems', desc: 'Off the beaten path, crowd-free', value: 'hidden-gem' },
      { icon: '🛍️', name: 'Shopping & food', desc: 'Markets, malls, street eats', value: 'shopping' },
    ]
  },
  {
    id: 'dietary',
    label: 'DIETARY NEEDS',
    title: 'Any dietary requirements?',
    sub: "We'll filter your food picks",
    multi: true,
    deco: '食',
    options: [
      { icon: '✓', name: 'No restrictions', desc: 'I eat everything — surprise me', value: 'none' },
      { icon: '🥦', name: 'Vegetarian', desc: 'Plant-based, no meat or fish', value: 'vegetarian' },
      { icon: '🌱', name: 'Vegan', desc: 'No animal products at all', value: 'vegan' },
      { icon: '🌙', name: 'Halal', desc: 'Muslim-friendly restaurants only', value: 'halal' },
      { icon: '✏️', name: 'Others', desc: 'Type your own requirement', value: 'others' },
    ]
  }
];
