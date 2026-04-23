# CLAUDE CODE — CHINA TRAVEL GUIDE APP
# Full build prompt — paste this entire file to start your session
# Expected build time: 1–2 sessions

---

## WHAT YOU ARE BUILDING

A mobile-first React web app that:
1. Asks users 5 simple quiz questions
2. Runs a pure JS algorithm to mix-and-match pre-curated stops from a JSON database
3. Displays a beautiful interactive day-by-day itinerary
4. Each stop card is swipeable — swipe left reveals Swap and Delete
5. Shows a hotel recommendation (Agoda affiliate) and Klook ticket links
6. Exports the full itinerary to PDF

No AI API. No backend. Pure React + local JSON. Free to run.

---

## TECH STACK

```
React (Create React App)
Tailwind CSS
Mapbox GL JS (map tab)
html2canvas + jsPDF (PDF export)
Vercel (deployment)
```

---

## STEP 1 — SCAFFOLD

```bash
npx create-react-app travel-planner
cd travel-planner
npm install mapbox-gl html2canvas jspdf
```

Create this folder structure:
```
/src
  /data
    guangzhou.json
    shenzhen.json
    shanghai.json
  /components
    QuizFlow.jsx
    GeneratingScreen.jsx
    ItineraryDashboard.jsx
    SwipeCard.jsx
    DayTimeline.jsx
    MapView.jsx
    HotelCard.jsx
    SwapModal.jsx
    FoodSection.jsx
    PracticalTips.jsx
    BottomNav.jsx
  /utils
    algorithm.js
    mapUtils.js
    pdfExport.js
    affiliateLinks.js
  App.jsx
  index.css
```

---

## STEP 2 — GLOBAL STYLES (index.css)

```css
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: 'DM Sans', system-ui, sans-serif;
  background: #EEF2F7;
  max-width: 430px;
  margin: 0 auto;
  min-height: 100vh;
}

::-webkit-scrollbar { display: none; }
* { scrollbar-width: none; }

:root {
  --bg: #EEF2F7;
  --surface: #ffffff;

  /* Hero gradient — used on quiz + dashboard header */
  --hero-from: #1a0a05;
  --hero-mid: #2d1208;
  --hero-to: #0f2027;

  /* Primary accent — terracotta red, used everywhere */
  --accent: #E8472A;
  --accent-dark: #c93820;
  --accent-glow: rgba(232,71,42,0.35);
  --accent-tint: rgba(232,71,42,0.12);
  --accent-deco: rgba(232,71,42,0.07);

  /* Secondary palette — stop tags, food prices etc */
  --blue: #0EA5E9;
  --green: #10B981;
  --amber: #F59E0B;
  --purple: #8B5CF6;
  --pink: #EC4899;

  /* Action buttons */
  --swap-bg: #F59E0B;
  --delete-bg: #EF4444;
  --klook-from: #FF6B35;
  --klook-to: #FF4D1C;

  /* Text */
  --text-primary: #1a1a2e;
  --text-secondary: #64748b;
  --text-muted: #94a3b8;

  /* Shadows */
  --shadow-card: 0 2px 14px rgba(0,0,0,0.07);
  --shadow-hotel: 0 8px 32px rgba(26,10,5,0.3);
  --shadow-agoda: 0 4px 16px rgba(232,71,42,0.35);
}

.hero-bg {
  background: linear-gradient(155deg, var(--hero-from) 0%, var(--hero-mid) 40%, var(--hero-to) 100%);
}
```

---

## STEP 3 — QUIZ QUESTIONS DATA

Put this in `/src/utils/quizData.js`:

```js
export const QUIZ = [
  {
    id: 'city',
    label: 'DESTINATION',
    title: 'Which city are you visiting?',
    sub: 'You can mix cities for a longer trip',
    multi: false,
    deco: '中',
    options: [
      { icon: '🏯', name: 'Guangzhou', desc: 'Old Canton, food capital of China', value: 'guangzhou' },
      { icon: '🌆', name: 'Shenzhen', desc: "China's future city, tech & beaches", value: 'shenzhen' },
      { icon: '🏙️', name: 'Shanghai', desc: 'Where old Shanghai meets tomorrow', value: 'shanghai' },
      { icon: '🗺️', name: 'Guangzhou + Shenzhen', desc: 'Pearl River Delta combo — 6–7 days', value: 'gz-sz' },
      { icon: '✈️', name: 'All 3 cities', desc: 'The full Southern China experience', value: 'all' },
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
    sub: 'Pick up to 3 — we mix them every day',
    multi: true,
    maxSelect: 3,
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
    maxSelect: 4,
    deco: '食',
    options: [
      { icon: '✓', name: 'No restrictions', desc: 'I eat everything — surprise me', value: 'none' },
      { icon: '🌙', name: 'Halal', desc: 'Muslim-friendly restaurants only', value: 'halal' },
      { icon: '🥦', name: 'Vegetarian', desc: 'Plant-based options available', value: 'vegetarian' },
      { icon: '🚫', name: 'No pork', desc: 'Excluding pork from food picks', value: 'no-pork' },
    ]
  }
];
```

---

## STEP 4 — ALGORITHM (algorithm.js)

```js
// /src/utils/algorithm.js

export function buildItinerary(userInputs, attractionsData, foodData) {
  const { city, duration, group, vibe, dietary } = userInputs;

  // Step 1: Filter attractions by companion tags
  let pool = filterByGroup(attractionsData, group);

  // Step 2: Score attractions by vibe match
  pool = scoreByVibe(pool, vibe);

  // Step 3: Filter food by dietary needs
  let foodPool = filterByDietary(foodData, dietary);

  // Step 4: Build day blocks
  const days = buildDayBlocks(pool, foodPool, duration);

  // Step 5: Sort each day's stops by proximity (nearest-neighbour)
  days.forEach(day => {
    day.stops = sortByProximity(day.stops);
    day.stops = applyTimeCorrections(day.stops);
    day.stops = assignTimeSlots(day.stops);
  });

  return days;
}

function filterByGroup(attractions, group) {
  const hardExclude = {
    'family-elderly': (a) => !a.companion_tags.includes('elderly-friendly') && !a.companion_tags.includes('all'),
  };
  if (hardExclude[group]) {
    return attractions.filter(a => !hardExclude[group](a));
  }
  return attractions;
}

function scoreByVibe(attractions, selectedVibes) {
  return attractions
    .map(a => {
      let score = 0;
      selectedVibes.forEach(v => { if (a.vibe_tags.includes(v)) score += 10; });
      if (a.vibe_tags.includes('trending')) score += 3;
      if (a.vibe_tags.includes('hidden-gem')) score += 2;
      return { ...a, _score: score };
    })
    .sort((a, b) => b._score - a._score);
}

function filterByDietary(food, dietary) {
  if (!dietary || dietary.includes('none')) return food;
  return food.filter(f => {
    if (dietary.includes('halal') && !f.halal) return false;
    if (dietary.includes('vegetarian') && !f.dietary_tags?.includes('veg-ok')) return false;
    return true;
  });
}

function buildDayBlocks(attractions, food, totalDays) {
  const MAX_STOPS = 4;
  const MAX_HOURS = 9;
  const used = new Set();
  const usedFood = new Set();
  const days = [];

  for (let d = 0; d < totalDays; d++) {
    const day = { day: d + 1, stops: [], food: [] };
    let hours = 0;
    const catCount = {};

    for (const a of attractions) {
      if (used.has(a.id)) continue;
      if (day.stops.length >= MAX_STOPS) break;
      if (hours + a.duration_hrs > MAX_HOURS) continue;
      const cat = a.category;
      if ((catCount[cat] || 0) >= 2) continue;
      // morning-only: must be first or second stop
      if (a.practical_tags?.includes('morning-only') && day.stops.length > 1) continue;
      day.stops.push(a);
      used.add(a.id);
      catCount[cat] = (catCount[cat] || 0) + 1;
      hours += a.duration_hrs;
    }

    // Add 1–2 food stops per day
    for (const f of food) {
      if (usedFood.has(f.id)) continue;
      if (day.food.length >= 2) break;
      day.food.push(f);
      usedFood.add(f.id);
    }

    days.push(day);
  }
  return days;
}

function sortByProximity(stops) {
  if (stops.length <= 1) return stops;
  const sorted = [stops[0]];
  const remaining = [...stops.slice(1)];
  while (remaining.length > 0) {
    const cur = sorted[sorted.length - 1];
    let nearest = 0, nearestDist = Infinity;
    remaining.forEach((s, i) => {
      const d = haversine(cur.lat, cur.lng, s.lat, s.lng);
      if (d < nearestDist) { nearestDist = d; nearest = i; }
    });
    sorted.push(remaining[nearest]);
    remaining.splice(nearest, 1);
  }
  return sorted;
}

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyTimeCorrections(stops) {
  // Move morning-only stops to front
  const morning = stops.filter(s => s.practical_tags?.includes('morning-only'));
  const evening = stops.filter(s => s.practical_tags?.includes('evening-best'));
  const rest = stops.filter(s =>
    !s.practical_tags?.includes('morning-only') &&
    !s.practical_tags?.includes('evening-best')
  );
  return [...morning, ...rest, ...evening];
}

function assignTimeSlots(stops) {
  let cur = 9 * 60; // 9:00am in minutes
  const TRANSIT = 20;
  return stops.map(s => {
    const start = formatTime(cur);
    const end = formatTime(cur + s.duration_hrs * 60);
    cur += s.duration_hrs * 60 + TRANSIT;
    return { ...s, startTime: start, endTime: end };
  });
}

function formatTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function getSwapAlternatives(currentStop, allAttractions, usedIds, count = 4) {
  return allAttractions
    .filter(a =>
      !usedIds.has(a.id) &&
      a.id !== currentStop.id &&
      (a.category === currentStop.category ||
        a.vibe_tags?.some(t => currentStop.vibe_tags?.includes(t)))
    )
    .slice(0, count);
}

export function recommendHotel(dayStops, hotels) {
  if (!dayStops.length) return hotels[0];
  const avgLat = dayStops.reduce((s, d) => s + d.lat, 0) / dayStops.length;
  const avgLng = dayStops.reduce((s, d) => s + d.lng, 0) / dayStops.length;
  return hotels.reduce((best, h) => {
    const d = haversine(avgLat, avgLng, h.lat, h.lng);
    return d < haversine(avgLat, avgLng, best.lat, best.lng) ? h : best;
  });
}

export function allocateDaysPerCity(cities, totalDays) {
  if (cities.length === 1) return { [cities[0]]: totalDays };
  if (cities.length === 2) return {
    [cities[0]]: Math.floor(totalDays / 2),
    [cities[1]]: Math.ceil(totalDays / 2),
  };
  // 3 cities: Shanghai gets 40%, others 30% each
  return {
    guangzhou: Math.floor(totalDays * 0.3),
    shenzhen: Math.floor(totalDays * 0.3),
    shanghai: Math.ceil(totalDays * 0.4),
  };
}
```

---

## STEP 5 — AFFILIATE LINKS (affiliateLinks.js)

```js
// /src/utils/affiliateLinks.js
// Replace YOUR_KLOOK_AFF_ID and YOUR_AGODA_CID after registering:
// Klook: https://affiliate.klook.com
// Agoda: https://partners.agoda.com

const KLOOK_AFF = 'YOUR_KLOOK_AFF_ID';
const AGODA_CID = 'YOUR_AGODA_CID';

export const KLOOK_LINKS = {
  'gz-001': `https://www.klook.com/activity/1234/?aid=${KLOOK_AFF}`, // Canton Tower
  'gz-009': `https://www.klook.com/activity/5678/?aid=${KLOOK_AFF}`, // Pearl River Cruise
  'gz-018': `https://www.klook.com/activity/9012/?aid=${KLOOK_AFF}`, // Chimelong
  'sz-001': `https://www.klook.com/activity/3456/?aid=${KLOOK_AFF}`, // Ping An Tower
  'sz-009': `https://www.klook.com/activity/7890/?aid=${KLOOK_AFF}`, // Window of World
  'sz-020': `https://www.klook.com/activity/2345/?aid=${KLOOK_AFF}`, // Happy Valley
  'sh-006': `https://www.klook.com/activity/6789/?aid=${KLOOK_AFF}`, // Shanghai Tower
  'sh-008': `https://www.klook.com/activity/1357/?aid=${KLOOK_AFF}`, // Zhujiajiao
  'sh-015': `https://www.klook.com/activity/2468/?aid=${KLOOK_AFF}`, // Disney Shanghai
  'sh-023': `https://www.klook.com/activity/3579/?aid=${KLOOK_AFF}`, // Oriental Pearl
};

export function getKlookLink(attractionId) {
  return KLOOK_LINKS[attractionId] || null;
}

export function getAgodaLink(hotelId) {
  return `https://www.agoda.com/partners/partnersearch.aspx?pcs=1&cid=${AGODA_CID}&hid=${hotelId}`;
}
```

---

## STEP 6 — HOTEL DATA (per city)

Add this to each city JSON, or create `/src/data/hotels.js`:

```js
export const HOTELS = {
  guangzhou: [
    { id: 'gz-h1', name: 'W Guangzhou', stars: 5, area: 'Tianhe', lat: 23.1198, lng: 113.3256, price: '¥1,200/night', rating: 9.1, reviews: '1,892', agodaId: '123456' },
    { id: 'gz-h2', name: 'Marriott Tianhe', stars: 5, area: 'Tianhe', lat: 23.1225, lng: 113.3289, price: '¥800/night', rating: 8.9, reviews: '3,210', agodaId: '234567' },
    { id: 'gz-h3', name: 'White Swan Hotel', stars: 5, area: 'Shamian/Liwan', lat: 23.1076, lng: 113.2412, price: '¥900/night', rating: 8.7, reviews: '2,100', agodaId: '345678' },
    { id: 'gz-h4', name: 'Ibis Guangzhou Changlong', stars: 3, area: 'Panyu', lat: 22.9901, lng: 113.3298, price: '¥200/night', rating: 8.2, reviews: '4,500', agodaId: '456789' },
    { id: 'gz-h5', name: 'Nostalgia Hotel Yuexiu', stars: 3, area: 'Yuexiu', lat: 23.1302, lng: 113.2628, price: '¥180/night', rating: 8.0, reviews: '2,800', agodaId: '567890' },
  ],
  shenzhen: [
    { id: 'sz-h1', name: 'Four Seasons Shenzhen', stars: 5, area: 'Futian', lat: 22.5368, lng: 114.0556, price: '¥1,500/night', rating: 9.4, reviews: '1,200', agodaId: '678901' },
    { id: 'sz-h2', name: 'Marriott Hotel Futian', stars: 5, area: 'Futian', lat: 22.5345, lng: 114.0578, price: '¥700/night', rating: 9.0, reviews: '2,890', agodaId: '789012' },
    { id: 'sz-h3', name: 'Hilton Shekou Nanhai', stars: 5, area: 'Nanshan', lat: 22.4882, lng: 113.9121, price: '¥600/night', rating: 8.8, reviews: '3,100', agodaId: '890123' },
    { id: 'sz-h4', name: 'Vienna Hotel Luohu', stars: 3, area: 'Luohu', lat: 22.5445, lng: 114.1098, price: '¥200/night', rating: 8.1, reviews: '4,200', agodaId: '901234' },
    { id: 'sz-h5', name: 'Ating Hotel Nanshan', stars: 3, area: 'Nanshan', lat: 22.5287, lng: 113.9234, price: '¥180/night', rating: 7.9, reviews: '1,800', agodaId: '012345' },
  ],
  shanghai: [
    { id: 'sh-h1', name: 'The Peninsula Shanghai', stars: 5, area: 'Bund/Huangpu', lat: 31.2453, lng: 121.4898, price: '¥2,500/night', rating: 9.6, reviews: '980', agodaId: '111222' },
    { id: 'sh-h2', name: 'Waldorf Astoria Shanghai', stars: 5, area: 'Bund/Huangpu', lat: 31.2412, lng: 121.4892, price: '¥2,000/night', rating: 9.4, reviews: '1,100', agodaId: '222333' },
    { id: 'sh-h3', name: 'Grand Central Shanghai', stars: 4, area: 'Nanjing Road', lat: 31.2389, lng: 121.4723, price: '¥500/night', rating: 9.1, reviews: '2,847', agodaId: '333444' },
    { id: 'sh-h4', name: 'Sinan Mansions Hotel', stars: 4, area: 'French Concession', lat: 31.2178, lng: 121.4692, price: '¥800/night', rating: 9.0, reviews: '1,560', agodaId: '444555' },
    { id: 'sh-h5', name: 'Jinlai Hotel Nanjing East', stars: 3, area: 'Huangpu', lat: 31.2372, lng: 121.4819, price: '¥250/night', rating: 8.3, reviews: '3,900', agodaId: '555666' },
  ],
};
```

---

## STEP 7 — COMPONENT SPECS

### App.jsx — Screen Router
```jsx
// Manages which screen is visible
// States: 'quiz' | 'generating' | 'itinerary'
// Passes quiz answers down to algorithm, passes result to itinerary
```

### QuizFlow.jsx
- 5 steps, one question per view
- Progress bar at top — dots fill red as user advances
- Large decorative Chinese character background (opacity 0.07, --accent-deco)
- Options are tap-to-select cards with left icon, name, description, checkmark right
- Selected: red border + red tint background
- Back button hidden on step 1
- Continue button disabled until at least 1 option selected
- Multi-select questions (vibe, dietary): allow up to maxSelect, show count badge
- On final Continue → trigger generating screen
- Hero gradient background (same as dashboard)

### GeneratingScreen.jsx
- Same hero gradient as quiz and dashboard — seamless visual transition
- Animated plane emoji (pulse scale animation)
- City + duration from quiz answers shown below title
- 3 bouncing dots
- 4 step indicators that animate through (pending → active → done)
  - "Filtering stops by your travel style"
  - "Optimising route to cut backtracking"
  - "Finding best-located hotel for your stops"
  - "Adding local food picks & insider tips"
- Each step takes 700ms, total ~3 seconds then auto-navigate to itinerary

### ItineraryDashboard.jsx
Layout:
```
[HeroBanner with city info + stats + day tabs]
[Body scroll:]
  [Day heading + icon]
  [DayTimeline with SwipeCards]
  [FoodSection]
  [HotelCard]
  [PracticalTips]
[BottomNav — sticky]
```

Hero banner:
- Same hero gradient (visual continuity from quiz → generating → dashboard)
- Decorative city Chinese character top-right, --accent-deco colour
- City emoji + name + Chinese characters + dates
- 3 stat pills: total stops, free entry count, days
- Horizontal scrolling day tabs below stats
- Active tab: --accent-tint background + --accent border

Day tabs:
- Show: "Day 1", title preview (first 2 words), hours + stop count
- Active tab styled with terracotta accent
- Tap to switch active day (re-renders timeline and food)

### SwipeCard.jsx
- Swipe LEFT to reveal action buttons (120px wide total)
  - Left half: SWAP button (amber #F59E0B)
  - Right half: DELETE button (red #EF4444)
- Threshold: 50px before snap, 120px max reveal
- Delete: card fades out + collapses with height animation
- Swap: opens SwapModal bottom sheet
- Card face content:
  - Left: icon bubble (--accent-tint background)
  - Middle: stop name + Chinese + tag badge + district
  - Right: time + duration + price
  - Below: collapsible "💡 Insider tip" (tap to expand, left border --accent)
  - Below: "🎟️ Book on Klook" button if bookable (klook gradient orange)
- "← swipe" hint pill shows when card is at rest, hides when swiped

### SwapModal.jsx
- Bottom sheet overlay
- Dark overlay with blur
- Handle pill at top
- Title: 'Swap "[stop name]"'
- 4 alternative stops from same category
- Each row: icon + name + zh + tag + price (green if free)
- Hover: --accent border highlight
- Cancel button at bottom
- On select: close modal, card snaps back, stop replaced in state

### MapView.jsx (map tab)
- Mapbox GL JS map centred on city
- Numbered markers for each stop in active day
- Dashed route line connecting stops in order
- Tap marker → popup with name + time + tip excerpt
- Day switcher tabs at top of map (same style as timeline tabs)
- Mapbox token from env: process.env.REACT_APP_MAPBOX_TOKEN

### HotelCard.jsx
- Background: same hero gradient (--hero-from → --hero-mid)
- Hotel name + area + star rating
- Stars coloured --accent (terracotta, not gold — brand consistent)
- Rating + review count muted
- Price box top-right: "from" label + price in --accent
- "Why this hotel" callout: --accent-tint bg + --accent left border
- Tags: --accent-tint bg chips
- Agoda CTA button: --accent gradient, full width
- Box shadow: --shadow-hotel

### FoodSection.jsx
- 2-column grid
- Each card: icon + restaurant name + Chinese name + dish description + price
- Price in --blue (#0EA5E9)

### PracticalTips.jsx
- 4 tip rows: icon + text
- White surface cards, light shadow
- Tips: Payment / VPN / Maps app / Metro

### BottomNav.jsx
- Sticky bottom, white with blur backdrop
- 4 tabs: Itinerary 🗓️ / Map 🗺️ / Hotels 🏨 / Export 📋
- Active tab: dark label + small --accent dot below icon
- Map tab → show MapView
- Hotels tab → scroll to hotel card or show hotels list
- Export tab → trigger PDF export

### ExportButton / pdfExport.js
```js
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export async function exportToPDF(elementRef, city, days) {
  const canvas = await html2canvas(elementRef.current, { scale: 2, useCORS: true });
  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 210;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
  pdf.save(`${city}-${days}-day-itinerary.pdf`);
}
```

---

## STEP 8 — STATE MANAGEMENT

Use React Context or simple prop drilling. App-level state:

```js
// App.jsx state
const [screen, setScreen] = useState('quiz'); // 'quiz' | 'generating' | 'itinerary'
const [quizAnswers, setQuizAnswers] = useState({});
const [itinerary, setItinerary] = useState(null); // built by algorithm
const [activeDay, setActiveDay] = useState(0);
const [dayStops, setDayStops] = useState([]); // mutable copy for delete/swap

// When quiz completes:
// 1. setScreen('generating')
// 2. Run algorithm with quizAnswers
// 3. setItinerary(result)
// 4. setDayStops(result.days.map(d => [...d.stops]))
// 5. After 3s delay: setScreen('itinerary')

// Delete stop:
const deleteStop = (dayIdx, stopId) => {
  setDayStops(prev => prev.map((stops, i) =>
    i === dayIdx ? stops.filter(s => s.id !== stopId) : stops
  ));
};

// Swap stop:
const swapStop = (dayIdx, oldStopId, newStop) => {
  setDayStops(prev => prev.map((stops, i) =>
    i === dayIdx ? stops.map(s => s.id === oldStopId ? newStop : s) : stops
  ));
};
```

---

## STEP 9 — MULTI-CITY LOGIC

```js
// In App.jsx, after quiz completes:
function buildFullItinerary(answers) {
  const cityValue = answers.city?.[0]; // e.g. 'gz-sz' or 'all' or 'shanghai'
  const days = answers.duration?.[0] || 4;

  let cities = [];
  if (cityValue === 'guangzhou') cities = ['guangzhou'];
  else if (cityValue === 'shenzhen') cities = ['shenzhen'];
  else if (cityValue === 'shanghai') cities = ['shanghai'];
  else if (cityValue === 'gz-sz') cities = ['guangzhou', 'shenzhen'];
  else if (cityValue === 'all') cities = ['guangzhou', 'shenzhen', 'shanghai'];

  const allocation = allocateDaysPerCity(cities, days);
  const allDays = [];

  cities.forEach(city => {
    const cityDays = allocation[city];
    const data = loadCityData(city); // import from JSON
    const result = buildItinerary(answers, data.attractions, data.food);
    const trimmed = result.slice(0, cityDays);

    // Add city header to first day of each city
    trimmed[0].cityHeader = {
      name: data.name, chinese: data.chinese, emoji: data.emoji
    };
    allDays.push(...trimmed);
  });

  // Re-number days sequentially
  allDays.forEach((d, i) => { d.day = i + 1; d.label = `Day ${i + 1}`; });
  return allDays;
}
```

---

## STEP 10 — MAP SETUP (mapUtils.js)

```js
import mapboxgl from 'mapbox-gl';

export function initMap(containerId, center) {
  mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
  return new mapboxgl.Map({
    container: containerId,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [center.lng, center.lat],
    zoom: 12,
  });
}

export function plotRoute(map, stops, accent = '#E8472A') {
  // Clear previous markers and layers
  if (map.getLayer('route')) map.removeLayer('route');
  if (map.getSource('route')) map.removeSource('route');

  // Add numbered markers
  stops.forEach((stop, i) => {
    const el = document.createElement('div');
    el.style.cssText = `
      width:28px;height:28px;border-radius:50%;
      background:${accent};border:3px solid #fff;
      display:flex;align-items:center;justify-content:center;
      font-size:11px;font-weight:800;color:#fff;
      box-shadow:0 2px 8px rgba(0,0,0,0.2);cursor:pointer;
    `;
    el.textContent = i + 1;

    new mapboxgl.Marker(el)
      .setLngLat([stop.lng, stop.lat])
      .setPopup(new mapboxgl.Popup({ offset: 16 }).setHTML(`
        <strong>${stop.name}</strong><br>
        <span style="color:#666;font-size:12px">${stop.startTime} · ${stop.dur}</span>
      `))
      .addTo(map);
  });

  // Draw dashed route line
  const coords = stops.map(s => [s.lng, s.lat]);
  map.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } }
  });
  map.addLayer({
    id: 'route', type: 'line', source: 'route',
    paint: { 'line-color': accent, 'line-width': 2, 'line-dasharray': [2, 2] }
  });

  // Fit bounds
  const bounds = stops.reduce(
    (b, s) => b.extend([s.lng, s.lat]),
    new mapboxgl.LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat])
  );
  map.fitBounds(bounds, { padding: 60 });
}
```

---

## STEP 11 — ENVIRONMENT VARIABLES

Create `.env` in project root:
```
REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX1RPS0VOfQ
```

Get free token at: https://mapbox.com (50,000 map loads/month free)

---

## STEP 12 — THE DATABASE

The full JSON database is in the file: `travel-planner-db.json`

Split it into three files:
- `/src/data/guangzhou.json` — copy the `guangzhou` object
- `/src/data/shenzhen.json` — copy the `shenzhen` object
- `/src/data/shanghai.json` — copy the `shanghai` object

Import in algorithm:
```js
import guangzhouData from '../data/guangzhou.json';
import shenzhenData from '../data/shenzhen.json';
import shanghaiData from '../data/shanghai.json';

export function loadCityData(city) {
  const map = { guangzhou: guangzhouData, shenzhen: shenzhenData, shanghai: shanghaiData };
  return map[city];
}
```

---

## STEP 13 — LAUNCH CHECKLIST

Before deploying, verify:

**Quiz:**
- [ ] All 5 questions load correctly
- [ ] Progress bar fills terracotta red as user advances
- [ ] Single-select questions only allow 1 selection
- [ ] Multi-select questions cap at maxSelect (3 for vibe, 4 for dietary)
- [ ] Continue button disabled until selection made
- [ ] Back button hidden on step 1
- [ ] Generating screen shows correct city + duration from answers

**Generating Screen:**
- [ ] Steps animate in sequence (700ms each)
- [ ] Auto-navigates to itinerary after all steps done
- [ ] Same gradient as quiz — seamless

**Dashboard:**
- [ ] Day tabs scroll horizontally
- [ ] Active tab uses terracotta accent
- [ ] Stop count updates when stops are deleted
- [ ] Swipe card left → reveals Swap + Delete
- [ ] Delete → card collapses, count updates in tab
- [ ] Swap → bottom sheet appears with 4 alternatives
- [ ] Insider tip expands/collapses on tap
- [ ] Klook button only shows on bookable stops
- [ ] Agoda link opens in new tab

**Map Tab:**
- [ ] Numbered markers match day order
- [ ] Dashed route line connects stops
- [ ] Tap marker → popup shows name + time
- [ ] Day tabs at top switch map view

**Export:**
- [ ] PDF generates and downloads
- [ ] PDF filename: [city]-[days]-day-itinerary.pdf

**Responsive:**
- [ ] Works correctly at 375px (iPhone SE)
- [ ] Works correctly at 430px (iPhone Pro Max)
- [ ] No horizontal scroll on any screen

---

## STEP 14 — DEPLOY TO VERCEL

```bash
npm run build
npx vercel --prod
```

Or connect GitHub repo to Vercel for auto-deploy on push.

Add environment variable in Vercel dashboard:
- `REACT_APP_MAPBOX_TOKEN` = your token

---

## AFFILIATE SETUP (post-launch)

1. Register Klook affiliate: https://affiliate.klook.com
   - Entity: Singapore
   - Category: Travel Content
   - Replace `YOUR_KLOOK_AFF_ID` in affiliateLinks.js

2. Register Agoda affiliate: https://partners.agoda.com
   - Replace `YOUR_AGODA_CID` in affiliateLinks.js
   - Replace hotel `agodaId` values with real Agoda property IDs

3. Optional future affiliates:
   - Airalo (eSIM): https://www.airalo.com/affiliate
   - GetYourGuide: https://partner.getyourguide.com

---

## QUARTERLY REFRESH PROCESS

Every 3 months:
1. Check 小红书 and Lemon8 SG for new trending spots
2. Update tips in JSON where info has changed
3. Add/remove food spots based on closures or new openings
4. Update prices if significantly changed
5. Test all Klook and Agoda deeplinks still work
6. Bump `version` field in each city JSON

---

## FUTURE PHASES (not MVP)

Phase 2: Car rental affiliate, eSIM affiliate (Airalo), flight search (Skyscanner)
Phase 3: More cities — Beijing, Xi'an, Chengdu, Hangzhou, Chongqing
Phase 4: User-submitted tips, seasonal event flags, WhatsApp sharing
Phase 5: React Native mobile app, offline maps
