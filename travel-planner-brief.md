# Travel Planner — Algorithm Logic & Full Build Brief
# Version 1.0 | For Claude Code

---

## PROJECT OVERVIEW

A web app that takes simple user inputs and generates a detailed, personalised day-by-day China travel itinerary. No AI API. Pure algorithm + pre-curated JSON database. Monetised via Agoda and Klook affiliate links.

**Stack:**
- Frontend: React + Tailwind CSS
- Logic: Pure JavaScript algorithm (no backend needed at MVP)
- Database: Local JSON files (imported directly)
- Map: Mapbox GL JS (free tier: 50k map loads/month)
- PDF Export: html2canvas + jsPDF
- Affiliate: Agoda + Klook deeplinks (hardcoded per attraction)
- Hosting: Vercel (free tier)

---

## FILE STRUCTURE

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
    DayTimeline.jsx
    MapView.jsx
    StopCard.jsx
    HotelRecommendation.jsx
    SwapModal.jsx
    ExportButton.jsx
  /utils
    algorithm.js
    mapUtils.js
    pdfExport.js
    affiliateLinks.js
  App.jsx
  index.js
```

---

## SCREEN 1 — QUIZ FLOW

5 questions. Simple, mobile-first. One question per screen with progress bar.

### Question 1: City
```
Which city are you visiting?
○ Guangzhou 广州
○ Shenzhen 深圳
○ Shanghai 上海
○ Guangzhou + Shenzhen (combo)
○ All 3 cities
```

### Question 2: Duration
```
How many days?
○ 2–3 days
○ 4–5 days
○ 6–7 days
○ 8–10 days
○ 10–14 days
```

### Question 3: Travel Group
```
Who are you travelling with?
○ Solo
○ Couple
○ Family with kids
○ Family with elderly
○ Family with kids + elderly
○ Group of friends
```

### Question 4: Vibe (multi-select, pick up to 3)
```
What kind of trip do you want? (pick up to 3)
☐ Local hangouts & neighbourhood life
☐ Instagrammable spots & photo ops
☐ Scenic & nature
☐ History & culture
☐ Hidden gems & off the beaten path
☐ Shopping & food streets
☐ Theme parks & attractions
```

### Question 5: Dietary Needs (multi-select)
```
Any dietary requirements?
☐ None
☐ Halal
☐ Vegetarian
☐ No pork
```

**After quiz → GeneratingScreen (2–3 second animated build)**

---

## SCREEN 2 — GENERATING SCREEN

Animated screen showing:
- "Building your [City] itinerary..."
- Progress dots or animated route trail
- Duration: 2.5 seconds
- Transitions to Dashboard

---

## SCREEN 3 — ITINERARY DASHBOARD

Two-panel layout (desktop). Single scroll (mobile).

**Left Panel: Day-by-Day Timeline**
- Day tabs at top (Day 1, Day 2, Day 3...)
- Each day shows 4–5 stops in order
- Each stop card shows:
  - Attraction name (English + Chinese)
  - Category icon
  - Time allocation (e.g. "2 hrs")
  - District badge
  - Insider tip (collapsed, tap to expand)
  - Klook ticket link (if bookable) — affiliate link
  - ⇄ Swap button (opens SwapModal with 3 alternatives)

**Right Panel: Map**
- Mapbox map
- Numbered markers matching the day's stops
- Route line connecting stops in order (proximity-optimised)
- Day selector to switch map view between days

**Bottom of Dashboard:**
- Hotel Recommendation Card (see Hotel Section)
- Export to PDF button

---

## ALGORITHM LOGIC (algorithm.js)

### Step 1 — Load City Data
```javascript
function loadCityData(city) {
  // Import the correct JSON file based on city selection
  // For multi-city: merge arrays with city prefix on IDs
  return attractionsArray, foodArray
}
```

### Step 2 — Filter by Companion Tags
```javascript
function filterByCompanion(attractions, travelGroup) {
  const tagMap = {
    'solo': ['solo'],
    'couple': ['couple', 'solo'],
    'family-kids': ['kid-friendly', 'couple', 'solo'],
    'family-elderly': ['elderly-friendly', 'couple', 'solo'],
    'family-kids-elderly': ['kid-friendly', 'elderly-friendly'],
    'friends': ['solo', 'couple', 'local', 'trending']
  }
  
  const requiredTags = tagMap[travelGroup]
  
  // HARD FILTER: If travelling with elderly, remove anything NOT tagged elderly-friendly
  // SOFT FILTER: For kids, deprioritise (move to bottom of pool) rather than remove
  
  if (travelGroup === 'family-elderly' || travelGroup === 'family-kids-elderly') {
    return attractions.filter(a => 
      a.companion_tags.includes('elderly-friendly') || 
      a.companion_tags.includes('all')
    )
  }
  
  // For other groups: keep all, but score elderly-incompatible lower
  return attractions.map(a => ({
    ...a,
    score: calculateScore(a, travelGroup)
  }))
}
```

### Step 3 — Score by Vibe Tags
```javascript
function scoreByVibe(attractions, selectedVibes) {
  return attractions.map(a => {
    let vibeScore = 0
    
    selectedVibes.forEach(vibe => {
      if (a.vibe_tags.includes(vibe)) vibeScore += 10
    })
    
    // Bonus: trending items always get +3
    if (a.vibe_tags.includes('trending')) vibeScore += 3
    
    return { ...a, vibeScore }
  }).sort((a, b) => b.vibeScore - a.vibeScore)
}
```

### Step 4 — Filter by Dietary Needs
```javascript
function filterByDietary(foodItems, dietaryNeeds) {
  if (dietaryNeeds.includes('none')) return foodItems
  
  return foodItems.filter(f => {
    if (dietaryNeeds.includes('halal') && !f.halal) return false
    if (dietaryNeeds.includes('vegetarian') && !f.dietary_tags.includes('veg-ok')) return false
    if (dietaryNeeds.includes('no-pork') && f.dietary_tags.includes('contains-pork')) return false
    return true
  })
}
```

### Step 5 — Calculate Day Count
```javascript
function calculateDaySlots(duration) {
  const dayMap = {
    '2-3': 2,
    '4-5': 4,
    '6-7': 6,
    '8-10': 8,
    '10-14': 12
  }
  return dayMap[duration]
}
```

### Step 6 — Build Day Blocks
```javascript
function buildDayBlocks(scoredAttractions, foodItems, days, city) {
  const MAX_STOPS_PER_DAY = 4  // attractions
  const FOOD_STOPS_PER_DAY = 2  // 1 lunch + 1 dinner recommendation
  const MAX_HOURS_PER_DAY = 9   // realistic touring hours
  
  const dayBlocks = []
  const usedAttractions = new Set()
  const usedFood = new Set()
  
  for (let day = 1; day <= days; day++) {
    const dayBlock = {
      day,
      title: generateDayTitle(day, city),
      stops: [],
      foodStops: [],
      totalHours: 0
    }
    
    // DIVERSITY RULE: Each day must have at least:
    // - 1 touristy/classic item (if available and not already used)
    // - 1 local/hidden-gem item
    // - 1 food/experience item
    // - Max 2 items of same category per day
    
    const categoryCount = {}
    
    // Pick attractions for the day
    for (const attraction of scoredAttractions) {
      if (usedAttractions.has(attraction.id)) continue
      if (dayBlock.stops.length >= MAX_STOPS_PER_DAY) break
      if (dayBlock.totalHours + attraction.duration_hrs > MAX_HOURS_PER_DAY) continue
      
      // Category diversity check
      const cat = attraction.category
      if ((categoryCount[cat] || 0) >= 2) continue
      
      // Time-of-day logic
      if (attraction.practical_tags.includes('morning-only') && dayBlock.stops.length > 1) continue
      if (attraction.practical_tags.includes('evening-best') && dayBlock.stops.length < 2) continue
      
      dayBlock.stops.push(attraction)
      usedAttractions.add(attraction.id)
      categoryCount[cat] = (categoryCount[cat] || 0) + 1
      dayBlock.totalHours += attraction.duration_hrs
    }
    
    // Pick food for the day (1 main meal + 1 snack/drink)
    for (const food of foodItems) {
      if (usedFood.has(food.id)) continue
      if (dayBlock.foodStops.length >= FOOD_STOPS_PER_DAY) break
      dayBlock.foodStops.push(food)
      usedFood.add(food.id)
    }
    
    dayBlocks.push(dayBlock)
  }
  
  return dayBlocks
}
```

### Step 7 — Sort Stops by Proximity (Route Optimisation)
```javascript
function sortByProximity(stops) {
  // Simple nearest-neighbour algorithm
  // Start from first stop, always go to nearest unvisited stop
  
  if (stops.length <= 1) return stops
  
  const sorted = [stops[0]]
  const remaining = stops.slice(1)
  
  while (remaining.length > 0) {
    const current = sorted[sorted.length - 1]
    let nearestIdx = 0
    let nearestDist = Infinity
    
    remaining.forEach((stop, idx) => {
      const dist = haversineDistance(
        current.lat, current.lng,
        stop.lat, stop.lng
      )
      if (dist < nearestDist) {
        nearestDist = dist
        nearestIdx = idx
      }
    })
    
    sorted.push(remaining[nearestIdx])
    remaining.splice(nearestIdx, 1)
  }
  
  // TIME-OF-DAY CORRECTION after sorting:
  // If a morning-only stop ends up later in the day, move it to position 0
  // If an evening-best stop ends up first, move it to last position
  
  return applyTimeCorrections(sorted)
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}
```

### Step 8 — Generate Time Slots
```javascript
function assignTimeSlots(dayStops) {
  let currentTime = 9 * 60 // Start at 9:00am (minutes from midnight)
  const TRAVEL_TIME = 20   // 20 minutes between stops (metro/taxi)
  
  return dayStops.map(stop => {
    const startTime = formatTime(currentTime)
    const endTime = formatTime(currentTime + stop.duration_hrs * 60)
    currentTime += stop.duration_hrs * 60 + TRAVEL_TIME
    
    return { ...stop, startTime, endTime }
  })
}

function formatTime(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${h}:${m.toString().padStart(2, '0')}`
}
```

### Step 9 — Generate Swap Alternatives
```javascript
function getSwapAlternatives(currentStop, allAttractions, usedIds, count = 3) {
  return allAttractions
    .filter(a => 
      !usedIds.has(a.id) &&
      a.id !== currentStop.id &&
      // Same or similar category
      (a.category === currentStop.category || 
       a.vibe_tags.some(t => currentStop.vibe_tags.includes(t)))
    )
    .slice(0, count)
}
```

---

## HOTEL RECOMMENDATION LOGIC

Shown after itinerary is generated. One recommendation card.

### Logic:
```javascript
function recommendHotel(allDayStops, city) {
  // 1. Calculate geographic centroid of all stops across all days
  const avgLat = average(allDayStops.map(s => s.lat))
  const avgLng = average(allDayStops.map(s => s.lng))
  
  // 2. Select the pre-curated hotel recommendation whose location
  //    is closest to the centroid
  
  // 3. Return hotel object with:
  //    - Name, stars, price range, review score
  //    - Distance to centroid (in km)
  //    - "Why this hotel" copy (e.g. "5 min walk from 3 of your stops")
  //    - Agoda affiliate deeplink
  //    - Booking button
}
```

### Pre-curated Hotel Data (per city):

**Guangzhou**
```javascript
const guangzhouHotels = [
  { name: "W Guangzhou", stars: 5, area: "Tianhe", lat: 23.1198, lng: 113.3256, price: "¥1200+", agodaLink: "https://www.agoda.com/partners/partnersearch.aspx?pcs=1&cid=YOUR_CID&hid=HOTEL_ID" },
  { name: "Marriott Tianhe", stars: 5, area: "Tianhe", lat: 23.1225, lng: 113.3289, price: "¥800+", agodaLink: "..." },
  { name: "Ibis Guangzhou Changlong", stars: 3, area: "Panyu", lat: 22.9901, lng: 113.3298, price: "¥200+", agodaLink: "..." },
  { name: "White Swan Hotel", stars: 5, area: "Liwan/Shamian", lat: 23.1076, lng: 113.2412, price: "¥900+", agodaLink: "..." },
  { name: "Guangzhou Marriott Hotel Tianhe", stars: 5, area: "Tianhe", lat: 23.1198, lng: 113.3270, price: "¥700+", agodaLink: "..." },
  { name: "Nostalgia Hotel Guangzhou", stars: 3, area: "Yuexiu", lat: 23.1302, lng: 113.2628, price: "¥180+", agodaLink: "..." }
]
```

**Shenzhen**
```javascript
const shenzhenHotels = [
  { name: "Four Seasons Shenzhen", stars: 5, area: "Futian", lat: 22.5368, lng: 114.0556, price: "¥1500+", agodaLink: "..." },
  { name: "Marriott Hotel Futian", stars: 5, area: "Futian", lat: 22.5345, lng: 114.0578, price: "¥700+", agodaLink: "..." },
  { name: "Hilton Shenzhen Shekou", stars: 5, area: "Nanshan", lat: 22.4882, lng: 113.9121, price: "¥600+", agodaLink: "..." },
  { name: "Conrad Shenzhen", stars: 5, area: "Futian", lat: 22.5356, lng: 114.0467, price: "¥900+", agodaLink: "..." },
  { name: "Vienna Hotel Shenzhen", stars: 3, area: "Luohu", lat: 22.5445, lng: 114.1098, price: "¥200+", agodaLink: "..." },
  { name: "Ating Hotel Nanshan", stars: 3, area: "Nanshan", lat: 22.5287, lng: 113.9234, price: "¥180+", agodaLink: "..." }
]
```

**Shanghai**
```javascript
const shanghaiHotels = [
  { name: "The Peninsula Shanghai", stars: 5, area: "Bund/Huangpu", lat: 31.2453, lng: 121.4898, price: "¥2500+", agodaLink: "..." },
  { name: "Waldorf Astoria Shanghai", stars: 5, area: "Bund/Huangpu", lat: 31.2412, lng: 121.4892, price: "¥2000+", agodaLink: "..." },
  { name: "Grand Central Shanghai", stars: 4, area: "Nanjing Road", lat: 31.2389, lng: 121.4723, price: "¥500+", agodaLink: "..." },
  { name: "Jinlai Hotel Nanjing East", stars: 3, area: "Huangpu", lat: 31.2372, lng: 121.4819, price: "¥250+", agodaLink: "..." },
  { name: "Sinan Mansions Hotel", stars: 4, area: "French Concession", lat: 31.2178, lng: 121.4692, price: "¥800+", agodaLink: "..." },
  { name: "Jianguo Hotel Shanghai", stars: 4, area: "Xujiahui", lat: 31.2001, lng: 121.4389, price: "¥400+", agodaLink: "..." }
]
```

---

## AFFILIATE LINKS STRUCTURE (affiliateLinks.js)

### Klook (Activity/Ticket Links)
```javascript
const klookLinks = {
  // Guangzhou
  "gz-001": "https://www.klook.com/activity/CANTON-TOWER-ID/?aid=YOUR_AFF_ID",
  "gz-009": "https://www.klook.com/activity/PEARL-RIVER-CRUISE-ID/?aid=YOUR_AFF_ID",
  "gz-018": "https://www.klook.com/activity/CHIMELONG-ID/?aid=YOUR_AFF_ID",
  
  // Shenzhen  
  "sz-001": "https://www.klook.com/activity/PING-AN-ID/?aid=YOUR_AFF_ID",
  "sz-009": "https://www.klook.com/activity/WINDOW-WORLD-ID/?aid=YOUR_AFF_ID",
  "sz-015": "https://www.klook.com/activity/HAPPY-VALLEY-ID/?aid=YOUR_AFF_ID",
  "sz-016": "https://www.klook.com/activity/OCT-HARBOUR-ID/?aid=YOUR_AFF_ID",
  
  // Shanghai
  "sh-006": "https://www.klook.com/activity/SHANGHAI-TOWER-ID/?aid=YOUR_AFF_ID",
  "sh-008": "https://www.klook.com/activity/ZHUJIAJIAO-ID/?aid=YOUR_AFF_ID",
  "sh-015": "https://www.klook.com/activity/DISNEY-SHANGHAI-ID/?aid=YOUR_AFF_ID",
  "sh-023": "https://www.klook.com/activity/ORIENTAL-PEARL-ID/?aid=YOUR_AFF_ID"
}

// Replace placeholder IDs with real Klook affiliate links after registration
// Klook affiliate registration: https://affiliate.klook.com
// Agoda affiliate registration: https://partners.agoda.com
```

---

## MAP LOGIC (mapUtils.js)

### Mapbox Setup
```javascript
const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN

function initMap(containerId, center, zoom = 12) {
  return new mapboxgl.Map({
    container: containerId,
    style: 'mapbox://styles/mapbox/streets-v12',
    center: [center.lng, center.lat],
    zoom
  })
}

function plotDayRoute(map, stops) {
  // 1. Add numbered markers for each stop
  stops.forEach((stop, index) => {
    const el = createNumberedMarker(index + 1, stop.category)
    new mapboxgl.Marker(el)
      .setLngLat([stop.lng, stop.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`
        <strong>${stop.name}</strong><br>
        ${stop.startTime} – ${stop.endTime}<br>
        ${stop.tip.substring(0, 80)}...
      `))
      .addTo(map)
  })
  
  // 2. Draw route line connecting stops in order
  const coordinates = stops.map(s => [s.lng, s.lat])
  
  map.addSource('route', {
    type: 'geojson',
    data: {
      type: 'Feature',
      geometry: { type: 'LineString', coordinates }
    }
  })
  
  map.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: {
      'line-color': '#E74C3C',
      'line-width': 2,
      'line-dasharray': [2, 2]
    }
  })
  
  // 3. Fit map bounds to all stops
  const bounds = stops.reduce(
    (b, s) => b.extend([s.lng, s.lat]),
    new mapboxgl.LngLatBounds([stops[0].lng, stops[0].lat], [stops[0].lng, stops[0].lat])
  )
  map.fitBounds(bounds, { padding: 60 })
}
```

---

## PDF EXPORT LOGIC (pdfExport.js)

```javascript
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

async function exportToPDF(itineraryRef, city, days) {
  const canvas = await html2canvas(itineraryRef.current, {
    scale: 2,
    useCORS: true,
    logging: false
  })
  
  const pdf = new jsPDF('p', 'mm', 'a4')
  const imgWidth = 210  // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight)
  pdf.save(`${city}-${days}-day-itinerary.pdf`)
}
```

---

## SWAP MODAL LOGIC

When user taps the ⇄ swap button on any stop:

```javascript
function SwapModal({ currentStop, alternatives, onSwap, onClose }) {
  // Shows 3 alternative attractions
  // Each card shows: name, category, tip, duration
  // User taps one → replaces current stop
  // Map re-renders with new stop in same position
  // Route re-optimised with new stop coordinates
}
```

---

## DAY TITLE GENERATOR

```javascript
function generateDayTitle(day, stops) {
  // Based on the districts covered in that day's stops
  const districts = [...new Set(stops.map(s => s.district))]
  
  const titleMap = {
    'Haizhu,Tianhe': 'Canton Tower & Pearl River',
    'Liwan': 'Old West Guangzhou',
    'Yuexiu': 'Ancient Canton',
    'Futian': 'Modern Shenzhen',
    'Nanshan': 'Art & Sea',
    'Huangpu': 'The Bund & Old Shanghai',
    'Xuhui': 'French Concession Walk',
    'Pudong': 'Futuristic Shanghai'
    // etc.
  }
  
  return titleMap[districts.join(',')] || `Day ${day} — ${districts[0]}`
}
```

---

## MULTI-CITY LOGIC

If user selects Guangzhou + Shenzhen or all 3 cities:

```javascript
function buildMultiCityItinerary(cities, totalDays, userInputs) {
  // Allocate days per city proportionally
  // GZ+SZ: split evenly
  // All 3: Shanghai gets slightly more (more to do)
  
  const cityDays = {
    'gz-sz': { guangzhou: Math.floor(totalDays/2), shenzhen: Math.ceil(totalDays/2) },
    'all-3': { 
      guangzhou: Math.floor(totalDays * 0.3), 
      shenzhen: Math.floor(totalDays * 0.3), 
      shanghai: Math.ceil(totalDays * 0.4) 
    }
  }
  
  // Build itinerary for each city separately
  // Combine into unified day blocks with city headers
  // Add travel day between cities (high-speed rail GZ↔SZ is 30 min, so no full travel day needed)
  // SZ→Shanghai or GZ→Shanghai: flag as flight day
}
```

---

## UI COMPONENT NOTES

### StopCard Component
```
┌─────────────────────────────────────────┐
│ 1  🏯  Canton Tower          [ICONIC]   │
│    📍 Haizhu  •  9:00 – 11:00  •  2hrs  │
│    ▼ Insider tip (tap to expand)        │
│    [🎟 Book on Klook] [⇄ Swap]          │
└─────────────────────────────────────────┘
```

### HotelRecommendation Component
```
┌─────────────────────────────────────────┐
│ 🏨 BEST LOCATED FOR YOUR ITINERARY      │
│                                         │
│ W Guangzhou  ⭐⭐⭐⭐⭐                   │
│ Tianhe District                         │
│ ¥1,200/night • 9.2/10 rating            │
│ 📍 8 min walk from 3 of your stops      │
│                                         │
│ [Book on Agoda →]                       │
│                                         │
│ See other options ▼                     │
│  • Marriott Tianhe  ⭐⭐⭐⭐⭐  ¥800+     │
│  • Nostalgia Hotel  ⭐⭐⭐     ¥180+     │
└─────────────────────────────────────────┘
```

### ExportButton Component
```
[📥 Export Full Itinerary as PDF]
Includes: All days, map, hotel recommendation, practical tips
```

---

## PRACTICAL INFO SECTION

Each city has a practical info block in the database. This renders at the bottom of the itinerary as a collapsible "Before You Go" section:

- Payment setup (Alipay/WeChat)
- Transport (metro apps, DiDi)
- Connectivity (VPN reminder, eSIM)
- Language tips
- What to book in advance
- Best time to visit note

---

## RESPONSIVE DESIGN NOTES

**Mobile (default):**
- Quiz: full screen per question, swipe or tap Next
- Dashboard: single column, map above timeline or toggle between views
- Stop cards: full width, tap to expand tip
- Hotel card: full width below itinerary

**Desktop:**
- Quiz: centered card, max-width 480px
- Dashboard: 40% timeline left / 60% map right
- Hotel card: sidebar or below timeline

---

## ENVIRONMENT VARIABLES NEEDED

```
REACT_APP_MAPBOX_TOKEN=pk.eyJ1IjoiWU9VUl9VU0VSTkFNRSIsImEiOiJZT1VSX1RPS0VOfQ
```

No other API keys needed at MVP. All other services are free-tier or affiliate links.

---

## AFFILIATE SETUP CHECKLIST (post-build)

1. Register at https://affiliate.klook.com (Singapore entity)
2. Register at https://partners.agoda.com
3. Replace placeholder affiliate IDs in affiliateLinks.js
4. Add hotel Agoda property IDs to hotel objects in algorithm.js
5. Test deeplinks work with correct tracking

---

## LAUNCH CHECKLIST

- [ ] Quiz flow works on mobile
- [ ] Algorithm produces different itineraries for different inputs
- [ ] No duplicate stops in same itinerary
- [ ] Morning-only stops always appear first in day
- [ ] Evening stops always appear last in day
- [ ] Elderly mode removes non-elderly-friendly stops
- [ ] Halal filter removes non-halal food
- [ ] Map renders correctly with numbered markers
- [ ] Route line draws between stops
- [ ] Swap modal shows 3 alternatives
- [ ] Swapping a stop re-optimises route
- [ ] Hotel card shows correct recommendation
- [ ] Agoda link opens correctly
- [ ] Klook links open correctly
- [ ] PDF export generates clean output
- [ ] Multi-city mode allocates days correctly
- [ ] App works offline after first load (JSON is local)
- [ ] Vercel deployment successful

---

## QUARTERLY REFRESH PROCESS

Every 3 months:
1. Research new trending spots (小红书, Lemon8 SG)
2. Update attraction tips where information has changed
3. Add/remove food spots based on closures or new openings
4. Update prices if significantly changed
5. Update Klook/Agoda affiliate links if URLs change
6. Bump version number in JSON

---

## FUTURE PHASES (NOT MVP)

**Phase 2:**
- Car rental affiliate (GetYourGuide, Klook Transfers)
- eSIM affiliate (Airalo)
- Flight search integration (Skyscanner affiliate)
- User accounts + saved itineraries

**Phase 3:**
- More cities (Beijing, Xi'an, Chengdu, Chongqing, Hangzhou)
- User-submitted tips (crowd-source layer)
- Seasonal event flags (Cherry blossom, Hairy crab season, etc.)
- WhatsApp sharing of itinerary

**Phase 4:**
- Native mobile app (React Native)
- Offline maps
- Real-time Klook pricing via API
