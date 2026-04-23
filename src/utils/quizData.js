export const QUIZ = [
  {
    id: 'city',
    label: 'DESTINATION',
    title: 'Which city are you visiting?',
    sub: 'Select one or more cities',
    multi: true,
    deco: '中',
    options: [
      { icon: '🏯', name: 'Guangzhou', desc: 'Old Canton, food capital of China', value: 'guangzhou' },
      { icon: '🌆', name: 'Shenzhen', desc: "China's future city, tech & beaches", value: 'shenzhen' },
      { icon: '🏙️', name: 'Shanghai', desc: 'Where old Shanghai meets tomorrow', value: 'shanghai' },
      { icon: '🌆', name: 'Chongqing', desc: "China's most dramatic mountain city", value: 'chongqing' },
      { icon: '🐼', name: 'Chengdu', desc: 'Slow down, eat more, see pandas', value: 'chengdu' },
      { icon: '🏯', name: 'Beijing', desc: '5,000 years of history in one city', value: 'beijing' },
      { icon: '🌊', name: 'Hangzhou', desc: "Heaven on earth — China's most romantic city", value: 'hangzhou' },
    ]
  },
  {
    id: 'duration',
    label: 'DURATION',
    title: 'How many days?',
    sub: "We'll pace your stops accordingly",
    multi: false,
    deco: '天',
    options: [
      { icon: '⚡', name: '2–3 days', desc: 'Weekend getaway — tight but doable', value: 2 },
      { icon: '🗓️', name: '4–5 days', desc: 'Comfortable pace, most highlights', value: 4 },
      { icon: '📅', name: '6–7 days', desc: 'Deep dive with breathing room', value: 6 },
      { icon: '🌏', name: '8–10 days', desc: 'Two cities, everything worth seeing', value: 8 },
      { icon: '🚀', name: '10–14 days', desc: 'All 3 cities, full immersion', value: 12 },
    ]
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
