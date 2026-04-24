import masterDb from '../data/china-master-db-v1.json';

// ── Constants ─────────────────────────────────────────────────────
const PACE_HOURS   = { chill: 5, balance: 7, pack: 9 };
const TRANSIT_MINS = 20; // walking / taxi time between stops

const EMOJI_OVERRIDES = {
  guangzhou: '🥘', shenzhen: '🤖', shanghai: '🌆', chongqing: '🌶️',
  chengdu: '🐼', beijing: '🏯', hangzhou: '🍵', xian: '🏺', guilin: '🛶',
  changsha: '🌶️', zhangjiajie: '🏔️', yunnan: '🌸', suzhou: '🪷',
  jiuzhaigou: '💎', harbin: '❄️', changbaishan: '⛷️', sanya: '🏖️',
  xiamen: '🎹', huangshan: '🌅', nanjing: '🏯', qingdao: '🍺',
};

// companion_tags group mapping
const COMPANION_MAP = {
  solo:            'solo',
  couple:          'couple',
  'family-kids':   'family-kids',
  friends:         'friends',
  'family-elderly':'elderly-friendly',
};

// ── Public helpers ────────────────────────────────────────────────

export function loadCityData(city) {
  return masterDb.cities[city] || null;
}

/**
 * Distribute total_days across cities by min_days weight.
 * Each city gets at least its min_days; surplus distributed proportionally.
 */
export function allocateDaysPerCity(cities, totalDays) {
  if (cities.length === 1) return { [cities[0]]: totalDays };

  const info   = cities.map(c => ({ id: c, min: Math.max(1, masterDb.cities[c]?.min_days ?? 2) }));
  const sumMin = info.reduce((s, c) => s + c.min, 0);

  if (totalDays <= sumMin) {
    // Not enough days — share what we have, minimum 1 each
    const result = {};
    let rem = totalDays;
    info.forEach((c, i) => {
      const alloc = i < info.length - 1 ? Math.min(c.min, rem) : rem;
      result[c.id] = Math.max(1, alloc);
      rem -= result[c.id];
    });
    return result;
  }

  // Distribute surplus proportionally by min_days weight
  const surplus = totalDays - sumMin;
  const result  = {};
  let usedSurplus = 0;
  info.forEach((c, i) => {
    const extra = i < info.length - 1
      ? Math.round((c.min / sumMin) * surplus)
      : surplus - usedSurplus;
    result[c.id] = c.min + extra;
    usedSurplus += extra;
  });
  return result;
}

// ── Haversine ─────────────────────────────────────────────────────

function haversine(lat1, lng1, lat2, lng2) {
  const R    = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a    =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Scoring ───────────────────────────────────────────────────────

function scoreAttraction(a, { vibes, group, grandparents, isKidsTrip }) {
  let score = 0;

  // Vibe match (+15 per matching tag; 'surprise' = baseline for everything)
  if (vibes.includes('surprise')) {
    score += 5;
  } else {
    for (const v of vibes) {
      if (a.vibe_tags?.includes(v)) score += 15;
    }
  }

  // Companion group match
  const cTag = COMPANION_MAP[group];
  if (cTag && a.companion_tags?.includes(cTag)) score += 10;
  if (a.companion_tags?.includes('all'))         score += 3;

  // Elderly and kids boosts
  if (grandparents  && a.companion_tags?.includes('elderly-friendly')) score += 8;
  if (isKidsTrip    && (
    a.companion_tags?.includes('family-kids') ||
    a.companion_tags?.includes('kid-friendly')
  )) score += 10;

  // Quality signals
  if (a.vibe_tags?.includes('trending'))   score += 3;
  if (a.vibe_tags?.includes('hidden-gem')) score += 2;
  if (a.free)                              score += 2;

  return { ...a, _score: score };
}

// ── Filtering ─────────────────────────────────────────────────────

function filterAttractions(pool, { pace, group, kidsAges, isKidsTrip, travelMonth }) {
  return pool.filter(a => {
    // Seasonal: exclude if travel month not in best_months
    if (a.seasonal && Array.isArray(a.best_months) && a.best_months.length && travelMonth) {
      if (!a.best_months.includes(travelMonth)) return false;
    }
    // Chill pace: no high energy
    if (pace === 'chill'          && a.energy_level === 'high') return false;
    // Elderly travel: no high energy
    if (group === 'family-elderly' && a.energy_level === 'high') return false;
    // Very young kids (0–3): no high energy
    if (isKidsTrip && kidsAges.includes('0-3') && a.energy_level === 'high') return false;
    return true;
  });
}

// ── Day-hour budgets ──────────────────────────────────────────────

function buildDayBudgets(totalDays, pace, arrivalTime, departureTime) {
  const base = PACE_HOURS[pace] ?? 7;
  return Array.from({ length: totalDays }, (_, i) => {
    let hours     = base;
    let startHour = 9;

    if (i === 0) {
      if (arrivalTime === 'afternoon') { hours = Math.max(2, base - 3); startHour = 13; }
      if (arrivalTime === 'evening')   { hours = 2;                     startHour = 18; }
    }
    if (i === totalDays - 1) {
      if (departureTime === 'morning')   hours = 2;
      if (departureTime === 'afternoon') hours = Math.max(2, base - 3);
      // evening → full hours
    }
    return { hours, startHour };
  });
}

// ── Energy sequencing ─────────────────────────────────────────────

function sequenceByEnergy(stops, isLastDay = false) {
  const morningFirst = stops.filter(s => s.practical_tags?.includes('morning-only'));
  const eveningLast  = stops.filter(s =>
    s.practical_tags?.includes('evening-best') &&
    !s.practical_tags?.includes('morning-only')
  );
  const rest = stops.filter(s =>
    !s.practical_tags?.includes('morning-only') &&
    !s.practical_tags?.includes('evening-best')
  );

  // Last day: ascending energy (most relaxed first)
  if (isLastDay) {
    const rank = { low: 0, medium: 1, high: 2 };
    rest.sort((a, b) => (rank[a.energy_level] ?? 1) - (rank[b.energy_level] ?? 1));
    return [...morningFirst, ...rest, ...eveningLast];
  }

  // Normal days: interleave low/med before high — no two highs adjacent
  const lowMed = rest.filter(s => s.energy_level !== 'high');
  const high   = rest.filter(s => s.energy_level === 'high');
  const mixed  = [];
  let li = 0, hi = 0;
  while (li < lowMed.length || hi < high.length) {
    if (li < lowMed.length) mixed.push(lowMed[li++]);
    if (hi < high.length)   mixed.push(high[hi++]);
  }
  return [...morningFirst, ...mixed, ...eveningLast];
}

// ── Time-slot assignment ──────────────────────────────────────────

function assignTimeSlots(stops, startHour = 9) {
  let cur = startHour * 60;
  return stops.map(s => {
    const start = formatTime(cur);
    const end   = formatTime(cur + (s.duration_hrs ?? 1) * 60);
    cur += (s.duration_hrs ?? 1) * 60 + TRANSIT_MINS;
    return { ...s, startTime: start, endTime: end };
  });
}

function formatTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

// ── Food picking ──────────────────────────────────────────────────

function pickFood(foodPool, preferredCluster, dietary, usedFoodIds) {
  const noRestrictions = !dietary?.length || dietary.includes('none');

  const eligible = foodPool.filter(f => {
    if (usedFoodIds.has(f.id)) return false;
    if (noRestrictions) return true;
    if (dietary.includes('halal')       && !f.halal)                                  return false;
    if (dietary.includes('vegetarian')  && !f.dietary_tags?.includes('veg-ok'))       return false;
    if (dietary.includes('pescatarian') &&
        !f.dietary_tags?.includes('seafood-ok') &&
        !f.dietary_tags?.includes('veg-ok'))                                          return false;
    return true;
  });

  const picked = [];

  // 1. Prefer same-cluster food
  const clusterPick = eligible.find(f => f.cluster_group === preferredCluster);
  if (clusterPick) { picked.push(clusterPick); usedFoodIds.add(clusterPick.id); }

  // 2. Include a cafe if present
  const cafe = eligible.find(f => !usedFoodIds.has(f.id) && f.type === 'cafe');
  if (cafe) { picked.push(cafe); usedFoodIds.add(cafe.id); }

  // 3. Fill to 2 with anything eligible
  for (const f of eligible) {
    if (picked.length >= 2) break;
    if (!usedFoodIds.has(f.id)) { picked.push(f); usedFoodIds.add(f.id); }
  }

  return picked;
}

// ── Core city-day builder ─────────────────────────────────────────

function buildCityDays(city, scoredPool, kidsAttractions, foodPool, budgets, params) {
  const { group, dietary = ['none'], kids_ages: kidsAges = [] } = params;
  const isKidsTrip = group === 'family-kids';

  // Standalones (Great Wall, Disneyland, etc.) get their own day
  const standalones = scoredPool.filter(a => a.standalone === true);
  const regular     = scoredPool.filter(a => !a.standalone);

  // Cluster buckets sorted by score descending
  const clusterMap = {};
  for (const a of regular) {
    const key = a.cluster_group || '_default';
    (clusterMap[key] = clusterMap[key] || []).push(a);
  }
  const clusters = Object.values(clusterMap)
    .map(arr => [...arr].sort((a, b) => b._score - a._score))
    .sort((a, b) => (b[0]?._score ?? 0) - (a[0]?._score ?? 0));

  const usedIds     = new Set();
  const usedKidsIds = new Set();
  const usedFoodIds = new Set();
  const days        = [];
  let standaloneQ   = [...standalones];
  let clusterCursor = 0;

  budgets.forEach(({ hours: budget, startHour }, dayIdx) => {
    const isFirstDay = dayIdx === 0;
    const isLastDay  = dayIdx === budgets.length - 1;
    const dayStops   = [];
    let   hoursLeft  = budget;

    // ── 1. Try a standalone day ───────────────────────────────────
    const sa = standaloneQ.find(a => !usedIds.has(a.id) && a.duration_hrs <= hoursLeft);
    if (sa) {
      standaloneQ = standaloneQ.filter(a => a.id !== sa.id);
      dayStops.push(sa);
      usedIds.add(sa.id);
      hoursLeft -= sa.duration_hrs;

    } else {
      // ── 2. Cluster-based fill ─────────────────────────────────────
      // Find the next cluster that still has unused stops, fill the whole day from it
      let clusterFound = false;
      for (let attempt = 0; attempt < clusters.length; attempt++) {
        const cluster = clusters[(clusterCursor + attempt) % clusters.length];
        let addedFromCluster = 0;

        for (const a of cluster) {
          if (usedIds.has(a.id)) continue;
          if ((a.duration_hrs ?? 1) > hoursLeft) continue;
          // Rule 14: first stop on first day must not be high energy
          if (isFirstDay && dayStops.length === 0 && a.energy_level === 'high') continue;
          // Last day: ease in with low/medium first stop
          if (isLastDay  && dayStops.length === 0 && a.energy_level === 'high') continue;

          dayStops.push(a);
          usedIds.add(a.id);
          hoursLeft -= a.duration_hrs ?? 1;
          addedFromCluster++;
        }

        if (addedFromCluster > 0) {
          clusterCursor = (clusterCursor + attempt + 1) % clusters.length;
          clusterFound = true;
          break;
        }
      }

      // ── 3. Fallback: any unused stop that fits (avoids empty days) ──
      if (!clusterFound || dayStops.length === 0) {
        const fallback = scoredPool
          .filter(a => !usedIds.has(a.id) && (a.duration_hrs ?? 1) <= hoursLeft)
          .sort((a, b) => a.duration_hrs - b.duration_hrs)[0]; // shortest-first
        if (fallback) {
          dayStops.push(fallback);
          usedIds.add(fallback.id);
          hoursLeft -= fallback.duration_hrs ?? 1;
        }
      }
    }

    // ── 4. Kids-attraction injection (one per day) ────────────────
    if (isKidsTrip && kidsAttractions.length > 0) {
      const kidPick = kidsAttractions.find(ka => {
        if (usedKidsIds.has(ka.id)) return false;
        if ((ka.duration_hrs ?? 2) > hoursLeft) return false;
        if (kidsAges.includes('0-3') && ka.energy_level === 'high') return false;
        return true;
      });
      if (kidPick) {
        dayStops.push({ ...kidPick, _score: 0, category: kidPick.category || 'attraction' });
        usedKidsIds.add(kidPick.id);
        hoursLeft -= kidPick.duration_hrs ?? 2;
      }
    }

    // ── 5. Sequence by energy + practical tags ────────────────────
    const ordered = sequenceByEnergy(dayStops, isLastDay);

    // ── 6. Assign start/end times ─────────────────────────────────
    const withTimes = assignTimeSlots(ordered, startHour);

    // ── 7. Food recommendations ───────────────────────────────────
    const dayCluster = dayStops[0]?.cluster_group ?? null;
    const food       = pickFood(foodPool, dayCluster, dietary, usedFoodIds);

    days.push({ day: dayIdx + 1, city, stops: withTimes, food });
  });

  return days;
}

// ── Hotel recommendation (kept for App.jsx compatibility) ─────────

export function recommendHotel(allDayStops, hotels) {
  if (!hotels?.length) return null;
  if (!allDayStops?.length) return hotels[0];
  const avgLat = allDayStops.reduce((s, d) => s + (d.lat || 0), 0) / allDayStops.length;
  const avgLng = allDayStops.reduce((s, d) => s + (d.lng || 0), 0) / allDayStops.length;
  return hotels.reduce((best, h) =>
    haversine(avgLat, avgLng, h.lat, h.lng) < haversine(avgLat, avgLng, best.lat, best.lng)
      ? h : best
  );
}

// ── Swap alternatives ─────────────────────────────────────────────

export function getSwapAlternatives(currentStop, allAttractions, usedIds, count = 4) {
  return allAttractions
    .filter(a =>
      !usedIds.has(a.id) &&
      a.id !== currentStop.id &&
      (a.cluster_group === currentStop.cluster_group ||
        a.category      === currentStop.category      ||
        a.vibe_tags?.some(t => currentStop.vibe_tags?.includes(t)))
    )
    .slice(0, count);
}

// ── Legacy shims (keep the rest of the app compiling) ─────────────

export function buildItinerary(userInputs, attractionsData, foodData) {
  return { pool: attractionsData, foodPool: foodData };
}

export function buildDayBlocks(pool, foodPool, totalDays) {
  return Array.from({ length: totalDays }, (_, i) => ({ day: i + 1, stops: [], food: [] }));
}

// ── Main entry point ──────────────────────────────────────────────

export function buildFullItinerary(answers) {
  const cities = (Array.isArray(answers.city) ? answers.city : [answers.city]).filter(Boolean);
  if (!cities.length) return { days: [], allAttractionsByCity: {}, cities: [] };

  const totalDays    = answers.duration      || 4;
  const pace         = answers.pace          || 'balance';
  const group        = answers.group         || 'solo';
  const vibes        = Array.isArray(answers.vibe)    ? answers.vibe    : [];
  const dietary      = Array.isArray(answers.dietary) ? answers.dietary : ['none'];
  const kidsAges     = answers.kids_ages     || [];
  const grandparents = answers.grandparents  || false;
  const arrivalTime  = answers.arrival_time  || 'afternoon';
  const departureTime= answers.departure_time|| 'evening';
  const isKidsTrip   = group === 'family-kids';
  const travelMonth  = answers.departure_date
    ? parseInt(answers.departure_date.split('-')[1], 10)
    : null;

  // Pre-compute per-day hour budgets across the whole trip
  const allBudgets = buildDayBudgets(totalDays, pace, arrivalTime, departureTime);

  // Allocate days per city
  const allocation = allocateDaysPerCity(cities, totalDays);

  const allDays              = [];
  const allAttractionsByCity = {};
  let   globalBudgetOffset   = 0;

  cities.forEach((city, cityIdx) => {
    const data = loadCityData(city);
    if (!data) return;

    const cityDays    = allocation[city] || 1;
    const cityBudgets = allBudgets.slice(globalBudgetOffset, globalBudgetOffset + cityDays);
    globalBudgetOffset += cityDays;

    // Score & filter
    const scored   = (data.attractions || []).map(a =>
      scoreAttraction(a, { vibes, group, grandparents, isKidsTrip })
    );
    const filtered = filterAttractions(scored, { pace, group, kidsAges, isKidsTrip, travelMonth });
    filtered.sort((a, b) => b._score - a._score);

    const kidsAttractions = isKidsTrip ? (data.kids_attractions || []) : [];

    allAttractionsByCity[city] = data.attractions || [];

    // Build this city's days
    const cityDayObjects = buildCityDays(
      city,
      filtered,
      kidsAttractions,
      [...(data.food || [])],
      cityBudgets,
      { group, dietary, kids_ages: kidsAges, grandparents },
    );

    // City header on first day of each city block
    if (cityDayObjects.length > 0) {
      cityDayObjects[0].cityHeader = {
        name:    data.name,
        chinese: data.chinese,
        emoji:   EMOJI_OVERRIDES[city] || data.emoji || '🏙️',
        tagline: data.tagline,
      };
    }

    allDays.push(...cityDayObjects);
  });

  // Global day numbers
  allDays.forEach((d, i) => { d.day = i + 1; d.label = `Day ${i + 1}`; });

  return { days: allDays, allAttractionsByCity, cities };
}
