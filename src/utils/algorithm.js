import guangzhouData from '../data/guangzhou.json';
import shenzhenData from '../data/shenzhen.json';
import shanghaiData from '../data/shanghai.json';
import chongqingData from '../data/chongqing.json';
import chengduData from '../data/chengdu.json';
import beijingData from '../data/beijing.json';
import hangzhouData from '../data/hangzhou.json';

export function loadCityData(city) {
  const map = {
    guangzhou: guangzhouData,
    shenzhen: shenzhenData,
    shanghai: shanghaiData,
    chongqing: chongqingData,
    chengdu: chengduData,
    beijing: beijingData,
    hangzhou: hangzhouData,
  };
  return map[city];
}

export function allocateDaysPerCity(cities, totalDays) {
  if (cities.length === 1) return { [cities[0]]: totalDays };
  if (cities.length === 2) return {
    [cities[0]]: Math.floor(totalDays / 2),
    [cities[1]]: Math.ceil(totalDays / 2),
  };
  // 3+ cities: distribute as evenly as possible, last city gets remainder
  const base = Math.floor(totalDays / cities.length);
  const remainder = totalDays - base * cities.length;
  const result = {};
  cities.forEach((c, i) => { result[c] = base + (i === cities.length - 1 ? remainder : 0); });
  return result;
}

export function buildItinerary(userInputs, attractionsData, foodData) {
  const { group, vibe, dietary } = userInputs;

  let pool = filterByGroup(attractionsData, group);
  pool = scoreByVibe(pool, vibe || []);
  let foodPool = filterByDietary(foodData, dietary || ['none']);

  return { pool, foodPool };
}

function filterByGroup(attractions, group) {
  if (group === 'family-elderly') {
    return attractions.filter(a =>
      a.companion_tags.includes('elderly-friendly') ||
      a.companion_tags.includes('all')
    );
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
    if (dietary.includes('no-pork') && f.dietary_tags?.includes('contains-pork')) return false;
    return true;
  });
}

export function buildDayBlocks(pool, foodPool, totalDays) {
  const MAX_STOPS = 4;
  const MAX_HOURS = 9;
  const used = new Set();
  const usedFood = new Set();
  const days = [];

  for (let d = 0; d < totalDays; d++) {
    const day = { day: d + 1, stops: [], food: [] };
    let hours = 0;
    const catCount = {};

    for (const a of pool) {
      if (used.has(a.id)) continue;
      if (day.stops.length >= MAX_STOPS) break;
      if (hours + a.duration_hrs > MAX_HOURS) continue;
      const cat = a.category;
      if ((catCount[cat] || 0) >= 2) continue;
      if (a.practical_tags?.includes('morning-only') && day.stops.length > 1) continue;
      day.stops.push(a);
      used.add(a.id);
      catCount[cat] = (catCount[cat] || 0) + 1;
      hours += a.duration_hrs;
    }

    for (const f of foodPool) {
      if (usedFood.has(f.id)) continue;
      if (day.food.length >= 2) break;
      day.food.push(f);
      usedFood.add(f.id);
    }

    day.stops = sortByProximity(day.stops);
    day.stops = applyTimeCorrections(day.stops);
    day.stops = assignTimeSlots(day.stops);

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
  const morning = stops.filter(s => s.practical_tags?.includes('morning-only'));
  const evening = stops.filter(s => s.practical_tags?.includes('evening-best'));
  const rest = stops.filter(s =>
    !s.practical_tags?.includes('morning-only') &&
    !s.practical_tags?.includes('evening-best')
  );
  return [...morning, ...rest, ...evening];
}

function assignTimeSlots(stops) {
  let cur = 9 * 60;
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

export function recommendHotel(allDayStops, hotels) {
  if (!allDayStops.length || !hotels?.length) return hotels?.[0] || null;
  const avgLat = allDayStops.reduce((s, d) => s + d.lat, 0) / allDayStops.length;
  const avgLng = allDayStops.reduce((s, d) => s + d.lng, 0) / allDayStops.length;
  return hotels.reduce((best, h) => {
    const d = haversine(avgLat, avgLng, h.lat, h.lng);
    const bd = haversine(avgLat, avgLng, best.lat, best.lng);
    return d < bd ? h : best;
  });
}

export function buildFullItinerary(answers) {
  // city is now always an array from multi-select
  const cities = Array.isArray(answers.city) ? answers.city : [answers.city].filter(Boolean);
  const totalDays = answers.duration || 4;

  const allocation = allocateDaysPerCity(cities, totalDays);
  const allDays = [];
  const allAttractionsByCity = {};

  cities.forEach(city => {
    const data = loadCityData(city);
    if (!data) return;
    const cityDays = allocation[city] || 0;
    const { pool, foodPool } = buildItinerary(answers, data.attractions || [], data.food || []);
    allAttractionsByCity[city] = data.attractions || [];
    const days = buildDayBlocks(pool, foodPool, cityDays);

    if (days.length > 0) {
      days[0].cityHeader = {
        name: data.name,
        chinese: data.chinese,
        emoji: data.emoji || { guangzhou: '🏯', shenzhen: '🌆', shanghai: '🏙️' }[city] || '🏙️',
        tagline: data.tagline,
      };
    }
    days.forEach(d => { d.city = city; });
    allDays.push(...days);
  });

  allDays.forEach((d, i) => { d.day = i + 1; d.label = `Day ${i + 1}`; });

  return { days: allDays, allAttractionsByCity, cities };
}
