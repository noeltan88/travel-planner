import chinaDb        from '../data/china-master-db-v1.json';
import japanDb        from '../data/japan-master-db-v1.json';
import koreaDb        from '../data/korea-master-db-v1.json';
import thailandDb     from '../data/thailand-master-db-v1.json';
import vietnamDb      from '../data/vietnam-master-db-v1.json';

import chinaTravelTimes    from '../data/travel-times.json';
import japanTravelTimes    from '../data/travel-times-japan.json';
import koreaTravelTimes    from '../data/travel-times-korea.json';
import thailandTravelTimes from '../data/travel-times-thailand.json';
import vietnamTravelTimes  from '../data/travel-times-vietnam.json';

import chinaCityConnections    from '../data/city-connections.json';
import japanCityConnections    from '../data/city-connections-japan.json';
import koreaCityConnections    from '../data/city-connections-korea.json';
import thailandCityConnections from '../data/city-connections-thailand.json';
import vietnamCityConnections  from '../data/city-connections-vietnam.json';

// ── Country → data maps ────────────────────────────────────────────
const DB_MAP = {
  china:       chinaDb,
  japan:       japanDb,
  south_korea: koreaDb,
  thailand:    thailandDb,
  vietnam:     vietnamDb,
};

const TRAVEL_TIMES_MAP = {
  china:       chinaTravelTimes,
  japan:       japanTravelTimes,
  south_korea: koreaTravelTimes,
  thailand:    thailandTravelTimes,
  vietnam:     vietnamTravelTimes,
};

const CITY_CONNECTIONS_MAP = {
  china:       chinaCityConnections,
  japan:       japanCityConnections,
  south_korea: koreaCityConnections,
  thailand:    thailandCityConnections,
  vietnam:     vietnamCityConnections,
};

export const CURRENCY = {
  china:       { symbol: '¥',  code: 'CNY' },
  japan:       { symbol: '¥',  code: 'JPY' },
  south_korea: { symbol: '₩',  code: 'KRW' },
  thailand:    { symbol: '฿',  code: 'THB' },
  vietnam:     { symbol: '₫',  code: 'VND' },
};

// Active data sources — set at the start of buildFullItinerary
let masterDb        = chinaDb;
let travelTimes     = chinaTravelTimes;
let cityConnections = chinaCityConnections;

// ── Constants ─────────────────────────────────────────────────────
//
// PACE_HOURS is a total sightseeing window, not "activity hours minus lunch".
// DB avg duration_hrs = 2.38.  For 4 balance stops + 3×transit that means
// ~11 hrs of window.  Lunch is handled via food picks — not deducted here.
//
const PACE_HOURS        = { chill: 6, balance: 11, pack: 15 };
const PACE_MAX_STOPS    = { chill: 2, balance: 4,  pack: 6  };
const PACE_MAX_CLUSTERS = { chill: 1, balance: 2,  pack: 3  };
// Flat travel constants removed — real times now come from travel-times.json
// via getClusterTravelMinutes(). Kept as last-resort fallbacks only inside that fn.

const EMOJI_OVERRIDES = {
  guangzhou: '🥘', shenzhen: '🤖', shanghai: '🌆', chongqing: '🌶️',
  chengdu: '🐼', beijing: '🏯', hangzhou: '🍵', xian: '🏺', guilin: '🛶',
  changsha: '🌶️', zhangjiajie: '🏔️', yunnan: '🌸', suzhou: '🪷',
  jiuzhaigou: '💎', harbin: '❄️', changbaishan: '⛷️', sanya: '🏖️',
  xiamen: '🎹', huangshan: '🌅', nanjing: '🏯', qingdao: '🍺',
};

const COMPANION_MAP = {
  solo:             'solo',
  couple:           'couple',
  'family-kids':    'family-kids',
  friends:          'friends',
  'family-elderly': 'elderly-friendly',
};

// ── Public helpers ─────────────────────────────────────────────────

export function getDb(country) {
  return DB_MAP[country] || chinaDb;
}

export function loadCityData(city, country) {
  const db = country ? (DB_MAP[country] || chinaDb) : masterDb;
  return db.cities[city] || null;
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
    const result = {};
    let rem = totalDays;
    info.forEach((c, i) => {
      const alloc = i < info.length - 1 ? Math.min(c.min, rem) : rem;
      result[c.id] = Math.max(1, alloc);
      rem -= result[c.id];
    });
    return result;
  }

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

// ── Cluster travel time lookup ────────────────────────────────────

/**
 * Returns the recommended travel time in MINUTES between two clusters
 * within the same city, using real route data from travel-times.json.
 * Falls back to 10 min (same cluster) or 25 min (cross-cluster) if data missing.
 */
function getClusterTravelMinutes(city, clusterA, clusterB) {
  if (clusterA === clusterB) return 10; // walking within cluster
  const cityData = travelTimes[city];
  if (!cityData) {
    console.warn(`[algo] getClusterTravelMinutes: no travel-times entry for city="${city}"`);
    return 25;
  }
  const key1 = `${clusterA}→${clusterB}`;
  const key2 = `${clusterB}→${clusterA}`;
  const pair = cityData[key1] || cityData[key2];
  if (!pair) {
    console.warn(`[algo] getClusterTravelMinutes: pair not found "${key1}" in city="${city}" (available: ${Object.keys(cityData).slice(0,3).join(', ')}…)`);
    return 25;
  }
  const minutes = pair.recommended_minutes ?? 25;
  console.log(`[travel] ${city} | ${clusterA}→${clusterB} | result: ${minutes}min`);
  return minutes;
}

/**
 * Returns the city-connection object from city-connections.json for a
 * fromCity→toCity pair (or its reverse), or null if not found.
 */
function getCityConnection(fromCity, toCity) {
  const key1 = `${fromCity}→${toCity}`;
  const key2 = `${toCity}→${fromCity}`;
  return cityConnections.cities[key1] || cityConnections.cities[key2] || null;
}

// ── Scoring ───────────────────────────────────────────────────────

function scoreAttraction(a, { vibes, group, grandparents, isKidsTrip }) {
  let score = 0;

  if (vibes.includes('surprise')) {
    score += 5;
  } else {
    for (const v of vibes) {
      if (a.vibe_tags?.includes(v)) score += 15;
    }
  }

  const cTag = COMPANION_MAP[group];
  if (cTag && a.companion_tags?.includes(cTag)) score += 10;
  if (a.companion_tags?.includes('all'))         score += 3;

  if (grandparents && a.companion_tags?.includes('elderly-friendly')) score += 8;
  if (isKidsTrip && (
    a.companion_tags?.includes('family-kids') ||
    a.companion_tags?.includes('kid-friendly')
  )) score += 10;

  if (a.vibe_tags?.includes('trending'))   score += 3;
  if (a.vibe_tags?.includes('hidden-gem')) score += 2;
  if (a.free)                              score += 2;

  return { ...a, _score: score };
}

// ── Filtering ─────────────────────────────────────────────────────

function filterAttractions(pool, { pace, group, kidsAges, isKidsTrip, travelMonth, effectivelyAdults }) {
  return pool.filter(a => {
    // Seasonal exclusion
    if (a.seasonal && Array.isArray(a.best_months) && a.best_months.length && travelMonth) {
      if (!a.best_months.includes(travelMonth)) return false;
    }
    // Chill pace: no high energy
    if (pace === 'chill' && a.energy_level === 'high') return false;
    // Elderly: no high energy
    if (group === 'family-elderly' && a.energy_level === 'high') return false;
    // FIX 4/5: kids 0-3 — low energy + family-friendly companion tag required
    if (!effectivelyAdults && isKidsTrip && kidsAges.includes('0-3')) {
      if (a.energy_level !== 'low') return false;
      if (!a.companion_tags?.includes('family-kids') &&
          !a.companion_tags?.includes('kid-friendly') &&
          !a.companion_tags?.includes('all')) return false;
    }
    return true;
  });
}

// ── Day-hour budgets ──────────────────────────────────────────────

function buildDayBudgets(totalDays, pace, arrivalTime, departureTime) {
  const baseHours    = PACE_HOURS[pace] ?? 11;
  const baseMaxStops = PACE_MAX_STOPS[pace] ?? 4;

  return Array.from({ length: totalDays }, (_, i) => {
    let hours         = baseHours;
    let startHour     = 9;
    let maxStops      = baseMaxStops;
    let preferEvening = false;
    let lowEnergyOnly = false;
    let noStandalone  = false;
    let noHighEnergy  = false;

    // Day 1 arrival constraints
    if (i === 0) {
      noStandalone = true; // first day always lightest
      noHighEnergy = true;
      if (arrivalTime === 'afternoon') {
        startHour = 14;
        hours     = 5;
        maxStops  = Math.min(maxStops, 2);
      } else if (arrivalTime === 'evening') {
        startHour     = 18;
        hours         = 2;
        maxStops      = 1;
        preferEvening = true;
      }
      // morning → full hours, start 9:00
    }

    // Last day departure constraints
    if (i === totalDays - 1 && totalDays > 1) {
      if (departureTime === 'morning') {
        startHour     = 9;
        hours         = 1.5;
        maxStops      = 1;
        lowEnergyOnly = true;
      } else if (departureTime === 'afternoon') {
        startHour = 9;
        hours     = 4;
        maxStops  = Math.min(maxStops, 2);
      }
      // evening → full day, no overrides
    }

    return { hours, startHour, maxStops, preferEvening, lowEnergyOnly, noStandalone, noHighEnergy };
  });
}

// ── Energy sequencing ─────────────────────────────────────────────

// ── Nearest-neighbour geographic sort ────────────────────────────
function nearestNeighbourSort(stops) {
  if (stops.length <= 1) return stops;
  const remaining = [...stops];
  const sorted = [remaining.splice(0, 1)[0]];
  while (remaining.length > 0) {
    const last = sorted[sorted.length - 1];
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((s, i) => {
      const dist = haversine(last.lat, last.lng, s.lat, s.lng);
      if (dist < nearestDist) { nearestDist = dist; nearestIdx = i; }
    });
    sorted.push(remaining.splice(nearestIdx, 1)[0]);
  }
  return sorted;
}

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

  if (isLastDay) {
    const rank = { low: 0, medium: 1, high: 2 };
    rest.sort((a, b) => (rank[a.energy_level] ?? 1) - (rank[b.energy_level] ?? 1));
    return [...morningFirst, ...rest, ...eveningLast];
  }

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

function assignTimeSlots(stops, startHour = 9, city = null) {
  // FIX 4: snap start to nearest 15-min boundary
  let cur = Math.round((startHour * 60) / 15) * 15;
  return stops.map((s, i) => {
    const start   = formatTime(cur);
    const durMins = (s.duration_hrs ?? 1) * 60;
    const end     = formatTime(cur + durMins);
    if (i < stops.length - 1) {
      const thisCluster = s.cluster_group             || '_default';
      const nextCluster = stops[i + 1]?.cluster_group || '_default';
      const transitMins = city
        ? getClusterTravelMinutes(city, thisCluster, nextCluster)
        : (thisCluster === nextCluster ? 10 : 25);
      // Round next start to nearest 15 min to avoid odd minutes accumulating
      cur = Math.round((cur + durMins + transitMins) / 15) * 15;
    }
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
    if (!f.photo_url) return false;  // skip entries with no photo
    if (noRestrictions) return true;
    if (dietary.includes('halal')       && !f.halal)                                  return false;
    if (dietary.includes('vegetarian')  && !f.dietary_tags?.includes('veg-ok'))       return false;
    if (dietary.includes('pescatarian') &&
        !f.dietary_tags?.includes('seafood-ok') &&
        !f.dietary_tags?.includes('veg-ok'))                                          return false;
    return true;
  });

  const picked = [];

  const clusterPick = eligible.find(f => f.cluster_group === preferredCluster);
  if (clusterPick) { picked.push(clusterPick); usedFoodIds.add(clusterPick.id); }

  const cafe = eligible.find(f => !usedFoodIds.has(f.id) && f.type === 'cafe');
  if (cafe) { picked.push(cafe); usedFoodIds.add(cafe.id); }

  for (const f of eligible) {
    if (picked.length >= 2) break;
    if (!usedFoodIds.has(f.id)) { picked.push(f); usedFoodIds.add(f.id); }
  }

  return picked;
}

// ── Icon spreading ────────────────────────────────────────────────
//
// Returns an array of { icon, dayIdx } pairs that pre-assign each
// icon attraction to a specific day, spread as evenly as possible.
//
function spreadIcons(iconAttractions, numDays, excludeDays = new Set()) {
  const icons = numDays === 1
    ? iconAttractions.slice(0, 2)   // 1-day trip: cap at 2
    : iconAttractions.slice(0, 3);  // multi-day: up to 3

  // Build candidate pool: all days that aren't reserved for a standalone attraction.
  // Fall back to all days if exclusions leave nothing (degenerate edge case).
  const pool = Array.from({ length: numDays }, (_, i) => i).filter(i => !excludeDays.has(i));
  const days  = pool.length > 0 ? pool : Array.from({ length: numDays }, (_, i) => i);

  return icons.map((icon, i) => {
    const pos = days.length <= 1
      ? 0
      : Math.round(i * (days.length - 1) / Math.max(icons.length - 1, 1));
    return { icon, dayIdx: days[Math.min(pos, days.length - 1)] };
  });
}

// ── Core city-day builder ─────────────────────────────────────────

function buildCityDays(city, scoredPool, iconAttractions, kidsAttractions, foodPool, budgets, params) {
  const {
    pace = 'balance',
    group,
    dietary = ['none'],
    kids_ages: kidsAges = [],
    effectivelyAdults = false,
  } = params;

  const isKidsTrip   = group === 'family-kids';
  const realKidsTrip = isKidsTrip && !effectivelyAdults;
  const has03        = realKidsTrip && kidsAges.includes('0-3');
  const has47        = realKidsTrip && kidsAges.includes('4-7');

  const maxClusters  = PACE_MAX_CLUSTERS[pace] ?? 2;

  // Standalones never on Day 1 (FIX 8)
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

  const usedIds            = new Set();
  const usedKidsIds        = new Set();
  const usedFoodIds        = new Set();
  const usedLandmarkGroups = new Set(); // dedup: only 1 attraction per landmark_group per city
  const days               = [];
  let standaloneQ   = [...standalones];
  let clusterCursor = 0;

  // ── Pass 1: pre-mark which days will receive standalone attractions ──────────
  // This is a forward-looking heuristic — no canAdd() calls, no day state needed.
  // We simply claim the first N eligible (non-noStandalone) days, one per standalone.
  // Icons are then spread only across the remaining days (Pass 2 below).
  const standaloneDayIndices = new Set();
  if (standalones.length > 0) {
    const eligibleDays = budgets.map((b, i) => i).filter(i => !budgets[i].noStandalone);
    for (let si = 0; si < Math.min(standalones.length, eligibleDays.length); si++) {
      standaloneDayIndices.add(eligibleDays[si]);
    }
    console.log(`[algo] Standalone days pre-marked: [${[...standaloneDayIndices].map(d => d + 1).join(',')}] for ${standalones.map(s => s.name).join(', ')}`);
  }

  // ── Pass 2: spread icons across non-standalone days only ─────────────────────
  const iconSchedule = spreadIcons(iconAttractions, budgets.length, standaloneDayIndices);

  // Guarantee each icon has enough budget on its assigned day.
  // Prefer moving to the nearest earlier non-standalone day with capacity;
  // fall back to extending the assigned day's budget so the icon is never silently skipped.
  for (const assignment of iconSchedule) {
    const needed = assignment.icon.duration_hrs ?? 2;
    if (budgets[assignment.dayIdx].hours >= needed) continue; // already fits

    // Try earlier days with sufficient capacity — skip standalone days
    let moved = false;
    for (let d = assignment.dayIdx - 1; d >= 0; d--) {
      if (standaloneDayIndices.has(d)) continue; // preserve standalone days
      if (budgets[d].hours >= needed) {
        console.log(`[algo] Icon "${assignment.icon.name}" moved day ${assignment.dayIdx + 1}→${d + 1} (need ${needed}h, day had ${budgets[assignment.dayIdx].hours}h)`);
        assignment.dayIdx = d;
        moved = true;
        break;
      }
    }
    // No earlier non-standalone day fits — extend this day's budget to accommodate the icon
    if (!moved) {
      const extended = needed + 0.5; // icon duration + small buffer
      console.log(`[algo] Icon "${assignment.icon.name}" extending day ${assignment.dayIdx + 1} budget: ${budgets[assignment.dayIdx].hours}h → ${extended}h`);
      budgets[assignment.dayIdx] = { ...budgets[assignment.dayIdx], hours: extended };
    }
  }

  budgets.forEach(({
    hours: budgetHours,
    startHour,
    maxStops: budgetMaxStops,
    preferEvening,
    lowEnergyOnly,
    noStandalone,
    noHighEnergy,
  }, dayIdx) => {
    const isFirstDay = dayIdx === 0;
    const isLastDay  = dayIdx === budgets.length - 1;
    const dayStops   = [];

    // Lunch is handled via food picks — not deducted from sightseeing budget
    let available    = budgetHours;
    let prevCluster  = null;
    const clustersUsed = new Set();

    // FIX 2 + FIX 5: effective stop limit
    let effectiveMax = budgetMaxStops;
    if (has03)                          effectiveMax = Math.min(effectiveMax, 1);
    else if (has47 && pace === 'chill') effectiveMax = Math.min(effectiveMax, 2);

    // Can we add this attraction right now?
    function canAdd(a, { mustEveningBest = false } = {}) {
      if (dayStops.length >= effectiveMax)                              return false;
      if (usedIds.has(a.id))                                            return false;
      // Landmark group dedup: skip if same root landmark already scheduled this city
      if (a.landmark_group && usedLandmarkGroups.has(a.landmark_group)) return false;
      if (lowEnergyOnly && a.energy_level !== 'low')                   return false;
      if ((noHighEnergy || isFirstDay) && a.energy_level === 'high')   return false;
      // FIX 5: kids 0-3 — low energy + family-friendly required at slot level too
      if (has03 && a.energy_level !== 'low')                           return false;
      if (has03 && !a.companion_tags?.includes('family-kids') &&
          !a.companion_tags?.includes('kid-friendly') &&
          !a.companion_tags?.includes('all'))                           return false;
      // Soft evening preference (FIX 6)
      if (mustEveningBest && !a.practical_tags?.includes('evening-best')) return false;
      // FIX 3: cluster proximity
      const cluster    = a.cluster_group || '_default';
      const isNewClust = !clustersUsed.has(cluster);
      if (isNewClust && clustersUsed.size >= maxClusters)              return false;
      // FIX 1: time budget with transit (real minutes from travel-times.json)
      const transitCost = dayStops.length === 0 ? 0
        : getClusterTravelMinutes(city, prevCluster, cluster) / 60;
      if ((a.duration_hrs ?? 1) + transitCost > available)            return false;
      return true;
    }

    // Add a stop and update running state
    function addStop(a) {
      const cluster     = a.cluster_group || '_default';
      const transitCost = dayStops.length === 0 ? 0
        : getClusterTravelMinutes(city, prevCluster, cluster) / 60;
      available   -= (a.duration_hrs ?? 1) + transitCost;
      prevCluster  = cluster;
      clustersUsed.add(cluster);
      usedIds.add(a.id);
      if (a.landmark_group) usedLandmarkGroups.add(a.landmark_group);
      dayStops.push(a);
    }

    // ── 0. Icon injection (guaranteed, spread evenly across days) ─
    //    Bypasses vibe score, energy level, and cluster rules.
    //    Still respects effectiveMax and time budget.
    const todayIcons = iconSchedule.filter(q => q.dayIdx === dayIdx);
    for (const { icon } of todayIcons) {
      if (usedIds.has(icon.id)) continue;          // already placed earlier
      if (icon.landmark_group && usedLandmarkGroups.has(icon.landmark_group)) continue; // dedup
      if (dayStops.length >= effectiveMax) break;
      const cluster     = icon.cluster_group || '_default';
      const transitCost = dayStops.length === 0 ? 0
        : getClusterTravelMinutes(city, prevCluster, cluster) / 60;
      const needed = (icon.duration_hrs ?? 2) + transitCost;
      if (needed > available) {
        console.log(`[algo] Day ${dayIdx + 1}: icon "${icon.name}" skipped — no time (need ${needed.toFixed(1)}h, have ${available.toFixed(1)}h)`);
        continue;
      }
      available  -= needed;
      prevCluster = cluster;
      clustersUsed.add(cluster);
      usedIds.add(icon.id);
      if (icon.landmark_group) usedLandmarkGroups.add(icon.landmark_group);
      dayStops.push(icon);
      console.log(`[algo] Day ${dayIdx + 1}: 📍 icon "${icon.name}" injected`);
    }

    // ── 1. Standalone injection (never on Day 1 — noStandalone flag) ────────
    if (!noStandalone) {
      const wasFirstStop = dayStops.length === 0;
      const sa = standaloneQ.find(a => canAdd(a));
      if (sa) {
        standaloneQ = standaloneQ.filter(a => a.id !== sa.id);
        addStop(sa);

        // BUG 1 FIX (day-trip deduction): if the standalone was the first stop of
        // the day and is far from city clusters (> 60 min away), deduct the outbound
        // travel time from available so the remaining-time check for city stops is
        // realistic. The return transit is already counted by canAdd() when it
        // evaluates the next stop from the standalone's cluster.
        if (wasFirstStop) {
          const saCluster = sa.cluster_group || '_default';
          const ttData    = travelTimes[city];
          if (ttData) {
            let outboundMins = 999;
            for (const [k, v] of Object.entries(ttData)) {
              const [a, b] = k.split('→');
              if ((a === saCluster || b === saCluster) && a !== b) {
                const mins = v?.recommended_minutes ?? 999;
                if (mins < outboundMins) outboundMins = mins;
              }
            }
            if (outboundMins > 60 && outboundMins < 999) {
              available -= outboundMins / 60;
              console.log(`[algo] Day ${dayIdx + 1}: "${sa.name}" is day-trip (${outboundMins}min out) — deducting outbound travel from available`);
            }
          }
        }
      }
    }

    // ── 2. Cluster-based fill (always runs — time budget limits additions) ───
    // Standalone only means that attraction takes priority; remaining hours are
    // filled with non-standalone stops from other clusters as normal.
    {

      if (isFirstDay) {
        // FIX 8: Day 1 — fill from energy-ascending pool (low first, no high energy)
        const energyRank = { low: 0, medium: 1, high: 2 };
        const day1Pool   = [...scoredPool]
          .filter(a => !a.standalone)
          .sort((a, b) => (energyRank[a.energy_level] ?? 1) - (energyRank[b.energy_level] ?? 1));

        for (const a of day1Pool) {
          if (dayStops.length >= effectiveMax) break;
          if (canAdd(a)) addStop(a);
        }
        // Advance cursor past any cluster used on Day 1
        if (clusters.length > 0) {
          let next = 0;
          for (let i = 0; i < clusters.length; i++) {
            const key = clusters[i][0]?.cluster_group || '_default';
            if (!clustersUsed.has(key)) { next = i; break; }
          }
          clusterCursor = next;
        }

      } else {
        // Normal days: cluster-first fill
        // For evening arrival: sort stops within each cluster with evening-best first
        const workClusters = preferEvening
          ? clusters.map(c => [...c].sort((a, b) => {
              const aE = a.practical_tags?.includes('evening-best') ? 0 : 1;
              const bE = b.practical_tags?.includes('evening-best') ? 0 : 1;
              return aE - bE;
            }))
          : clusters;

        let clusterFound = false;
        for (let attempt = 0; attempt < workClusters.length; attempt++) {
          const cluster        = workClusters[(clusterCursor + attempt) % workClusters.length];
          let addedFromCluster = 0;

          for (const a of cluster) {
            // For evening day: prefer evening-best on first pick; fall back on same pass
            const mustEvening = preferEvening && dayStops.length === 0;
            if (!canAdd(a, { mustEveningBest: mustEvening })) {
              // soft fall-through: if only failed on mustEveningBest, allow on second check
              if (mustEvening && canAdd(a)) { addStop(a); addedFromCluster++; continue; }
              continue;
            }
            addStop(a);
            addedFromCluster++;
          }

          if (addedFromCluster > 0 && !clusterFound) {
            clusterCursor = (clusterCursor + attempt + 1) % workClusters.length;
            clusterFound  = true;
            // No break — keep trying more clusters until effectiveMax reached
          }
          if (dayStops.length >= effectiveMax) break;
        }

        // ── 3. Fallback: any unused stop that fits ─────────────────
        if (!clusterFound || dayStops.length === 0) {
          for (const a of scoredPool) {
            if (dayStops.length >= effectiveMax) break;
            if (canAdd(a)) addStop(a);
          }
        }
      }
    }

    // ── 4. Kids-attraction injection (one per day) ────────────────
    if (realKidsTrip && kidsAttractions.length > 0 && dayStops.length < effectiveMax) {
      const kidPick = kidsAttractions.find(ka => {
        if (usedKidsIds.has(ka.id)) return false;
        const cluster     = ka.cluster_group || '_default';
        const transitCost = dayStops.length === 0 ? 0
          : getClusterTravelMinutes(city, prevCluster, cluster) / 60;
        if ((ka.duration_hrs ?? 2) + transitCost > available)  return false;
        if (has03 && ka.energy_level === 'high')               return false;
        return true;
      });
      if (kidPick) {
        const cluster     = kidPick.cluster_group || '_default';
        const transitCost = dayStops.length === 0 ? 0
          : getClusterTravelMinutes(city, prevCluster, cluster) / 60;
        available  -= (kidPick.duration_hrs ?? 2) + transitCost;
        prevCluster = cluster;
        clustersUsed.add(cluster);
        dayStops.push({ ...kidPick, _score: 0, category: kidPick.category || 'attraction' });
        usedKidsIds.add(kidPick.id);
      }
    }

    // ── Debug + balance/pack under-fill warning ───────────────────
    console.log(`[algo] Day ${dayIdx + 1} | city=${city} pace=${pace} | budget=${budgetHours}h maxStops=${effectiveMax} | filled=${dayStops.length} stops (avail left=${available.toFixed(1)}h)`);
    const isConstrainedDay = budgetHours < (PACE_HOURS[pace] ?? 11);
    if (!isConstrainedDay && (pace === 'balance' || pace === 'pack') && dayStops.length < 3) {
      console.warn(
        `[algo] ⚠️  Day ${dayIdx + 1}: only ${dayStops.length} stop(s) on unconstrained ${pace} day!`,
        `budget=${budgetHours}h, leftover=${available.toFixed(1)}h`,
        `icons=${todayIcons.length}, clustersUsed=[${[...clustersUsed].join(',')}]`,
        `poolSize=${scoredPool.length}`,
      );
    }

    // ── 5. Sequence stops geographically (nearest-neighbour) ─────
    // All stops (including icons) are included in the sort so the
    // route flows in one direction with no criss-crossing.
    const ordered = nearestNeighbourSort(dayStops);

    // ── 6. Assign start/end times ─────────────────────────────────
    const withTimes = assignTimeSlots(ordered, startHour, city);

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
  // Score each candidate: cluster_group match (3) > category match (2) > shared vibe_tag (1)
  return allAttractions
    .filter(a => !usedIds.has(a.id) && a.id !== currentStop.id)
    .map(a => {
      let score = 0;
      if (a.cluster_group && a.cluster_group === currentStop.cluster_group) score += 3;
      if (a.category === currentStop.category)                               score += 2;
      if (a.vibe_tags?.some(t => currentStop.vibe_tags?.includes(t)))       score += 1;
      return { a, score };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, count)
    .map(({ a }) => a);
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
  // ── Switch active data sources based on country ───────────────────
  const country = answers.country || 'china';
  masterDb        = DB_MAP[country]              || chinaDb;
  travelTimes     = TRAVEL_TIMES_MAP[country]    || chinaTravelTimes;
  cityConnections = CITY_CONNECTIONS_MAP[country] || chinaCityConnections;

  const cities = (Array.isArray(answers.city) ? answers.city : [answers.city]).filter(Boolean);
  if (!cities.length) return { days: [], allAttractionsByCity: {}, cities: [] };

  const totalDays     = answers.duration       || 4;
  const pace          = answers.pace           || 'balance';
  const group         = answers.group          || 'solo';
  const vibes         = Array.isArray(answers.vibe)    ? answers.vibe    : [];
  const dietary       = Array.isArray(answers.dietary) ? answers.dietary : ['none'];
  const kidsAges      = answers.kids_ages      || [];
  const grandparents  = answers.grandparents   || false;
  const arrivalTime   = answers.arrival_time   || 'afternoon';
  const departureTime = answers.departure_time || 'evening';
  const isKidsTrip    = group === 'family-kids';
  const travelMonth   = answers.departure_date
    ? parseInt(answers.departure_date.split('-')[1], 10)
    : null;

  // kids 13+ only → skip all kids logic, treat as adults
  const effectivelyAdults = isKidsTrip &&
    kidsAges.length > 0 &&
    kidsAges.every(k => k === '13+');

  // ── Pre-compute transitions ───────────────────────────────────────
  // transitions[i] describes the journey FROM cities[i] TO cities[i+1].
  // type: 'short' (<3h)  → no travel day, reduce last-day hours
  //       'medium' (3-5h) → split day: morning in city[i] + evening in city[i+1]
  //       'long'   (>5h)  → full isTravelDay (no stops)
  const transitions = cities.map((city, i) => {
    if (i >= cities.length - 1) return null;
    const conn = getCityConnection(city, cities[i + 1]);
    if (!conn) {
      console.log(`[algo] city-connection ${city}→${cities[i + 1]}: ✗ NOT FOUND`);
      return null;
    }
    const hrs  = conn.duration_hrs ?? 0;
    const type = hrs < 3 ? 'short' : hrs <= 5 ? 'medium' : 'long';
    console.log(`[algo] city-connection ${city}→${cities[i + 1]}: ✓ ${conn.mode} ${conn.duration_hrs}h → ${type}`);
    return { connection: conn, type };
  });

  // FIX 1: MEDIUM split days consume one city-day from each bordering city
  // (last day of A + first day of B → 1 split day).  Inflate the allocation
  // by 1 per MEDIUM transition so the user's requested sightseeing day count
  // is preserved.  LONG transitions add a whole travel day on top automatically;
  // SHORT transitions only reduce hours (no day consumed).
  const numMediumTransitions = transitions.filter(t => t?.type === 'medium').length;
  const adjustedDays = totalDays + numMediumTransitions;

  const allBudgets = buildDayBudgets(adjustedDays, pace, arrivalTime, departureTime);
  const allocation = allocateDaysPerCity(cities, adjustedDays);

  const allDays              = [];
  const allAttractionsByCity = {};
  let   globalBudgetOffset   = 0;
  // Holds an isSplitTravelDay object that needs evening stops from the next city
  let   pendingSplitDay      = null;

  cities.forEach((city, cityIdx) => {
    const data = loadCityData(city);
    if (!data) {
      globalBudgetOffset += (allocation[city] || 1);
      // Close any pending split without evening stops
      if (pendingSplitDay) {
        pendingSplitDay.stops         = pendingSplitDay.morningStops;
        pendingSplitDay.splitIndex    = pendingSplitDay.morningStops.length;
        pendingSplitDay.morningStopIds = new Set(pendingSplitDay.morningStops.map(s => s.id));
        allDays.push(pendingSplitDay);
        pendingSplitDay = null;
      }
      return;
    }

    const outgoing = transitions[cityIdx];                              // null for last city
    const incoming = cityIdx > 0 ? transitions[cityIdx - 1] : null;    // null for first city

    const cityDayCount = allocation[city] || 1;
    const baseBudgets  = allBudgets.slice(globalBudgetOffset, globalBudgetOffset + cityDayCount);
    globalBudgetOffset += cityDayCount;

    // Clone budgets so we don't mutate allBudgets
    const cityBudgets = baseBudgets.map(b => ({ ...b }));

    // Detect conflict: single-day city with MEDIUM on both sides.
    // We can't donate the same day as both the incoming-evening half AND outgoing-morning half.
    // In this case skip budget adjustments and treat both transitions as LONG.
    const singleDayConflict =
      cityBudgets.length === 1 &&
      incoming?.type === 'medium' &&
      outgoing?.type === 'medium';

    if (!singleDayConflict) {
      // ── Adjust last day for outgoing SHORT / MEDIUM ─────────────────
      if (outgoing?.type === 'short' && cityBudgets.length > 0) {
        const last   = cityBudgets[cityBudgets.length - 1];
        const deduct = outgoing.connection.duration_hrs ?? 0;
        last.hours   = Math.max(1.5, last.hours - deduct);
      } else if (outgoing?.type === 'medium' && cityBudgets.length > 0) {
        cityBudgets[cityBudgets.length - 1] = {
          ...cityBudgets[cityBudgets.length - 1],
          hours:        2,
          maxStops:     2,
          startHour:    9,
          noHighEnergy: true,
          noStandalone: true,
        };
      }

      // ── Adjust first day for incoming MEDIUM (evening arrival) ──────
      if (incoming?.type === 'medium' && cityBudgets.length > 0) {
        cityBudgets[0] = {
          ...cityBudgets[0],
          hours:         3,
          maxStops:      2,
          startHour:     18,
          preferEvening: true,
          noHighEnergy:  true,
          noStandalone:  true,
        };
      }
    }

    // ── Build attractions pool ────────────────────────────────────────
    const effectiveKidsTrip = isKidsTrip && !effectivelyAdults;
    const scored   = (data.attractions || []).map(a =>
      scoreAttraction(a, { vibes, group, grandparents, isKidsTrip: effectiveKidsTrip })
    );
    const filtered = filterAttractions(scored, {
      pace, group, kidsAges,
      isKidsTrip: effectiveKidsTrip,
      travelMonth,
      effectivelyAdults,
    });
    filtered.sort((a, b) => b._score - a._score);

    const iconAttractions = scored.filter(a => a.icon === true).slice(0, 3);
    const kidsAttractions = effectiveKidsTrip ? (data.kids_attractions || []) : [];
    allAttractionsByCity[city] = data.attractions || [];

    // ── Build city day objects ────────────────────────────────────────
    const cityDayObjects = buildCityDays(
      city,
      filtered,
      iconAttractions,
      kidsAttractions,
      [...(data.food || [])],
      cityBudgets,
      { pace, group, dietary, kids_ages: kidsAges, grandparents, effectivelyAdults },
    );

    if (cityDayObjects.length > 0) {
      cityDayObjects[0].cityHeader = {
        name:    data.name,
        chinese: data.chinese,
        emoji:   EMOJI_OVERRIDES[city] || data.emoji || '🏙️',
        tagline: data.tagline,
      };
    }

    // ── Handle incoming MEDIUM: consume first day as evening half ─────
    const consumeAsEvening =
      incoming?.type === 'medium' &&
      pendingSplitDay &&
      cityDayObjects.length > 0 &&
      !singleDayConflict;

    if (consumeAsEvening) {
      const eveningDay   = cityDayObjects.shift();
      const morningStops = pendingSplitDay.morningStops;
      const eveningStops = eveningDay.stops || [];

      pendingSplitDay.eveningStops   = eveningStops;
      pendingSplitDay.toCityName     = data.name;
      pendingSplitDay.stops          = [...morningStops, ...eveningStops];
      pendingSplitDay.splitIndex     = morningStops.length;
      pendingSplitDay.morningStopIds = new Set(morningStops.map(s => s.id));
      allDays.push(pendingSplitDay);
      pendingSplitDay = null;

      // Re-apply cityHeader to the next remaining day (first day was consumed)
      if (cityDayObjects.length > 0) {
        cityDayObjects[0].cityHeader = {
          name:    data.name,
          chinese: data.chinese,
          emoji:   EMOJI_OVERRIDES[city] || data.emoji || '🏙️',
          tagline: data.tagline,
        };
      }
    } else if (pendingSplitDay) {
      // No MEDIUM incoming (or conflict) — close pending split without evening stops
      pendingSplitDay.stops          = pendingSplitDay.morningStops;
      pendingSplitDay.splitIndex     = pendingSplitDay.morningStops.length;
      pendingSplitDay.morningStopIds = new Set(pendingSplitDay.morningStops.map(s => s.id));
      allDays.push(pendingSplitDay);
      pendingSplitDay = null;
    }

    // ── Handle outgoing transition ────────────────────────────────────
    const nextCity = cities[cityIdx + 1];
    const nextData = nextCity ? loadCityData(nextCity) : null;

    if (outgoing?.type === 'medium' && !singleDayConflict) {
      // Pop last day as morning half, create pending split day
      const morningDay = cityDayObjects.length > 0
        ? cityDayObjects.pop()
        : { stops: [], food: [], city };

      allDays.push(...cityDayObjects);

      const morningStops = morningDay.stops || [];
      pendingSplitDay = {
        isSplitTravelDay: true,
        city:             null,
        fromCity:         city,
        toCity:           nextCity,
        fromCityName:     data.name,
        toCityName:       nextData?.name ?? nextCity,
        connection:       outgoing.connection,
        morningStops,
        eveningStops:     [],         // filled when processing nextCity
        stops:            [],         // filled when complete
        splitIndex:       morningStops.length,
        morningStopIds:   new Set(morningStops.map(s => s.id)),
        food:             morningDay.food || [],
        cityHeader:       null,
      };

    } else if (outgoing?.type === 'short') {
      // All days pushed normally; tag the last non-travel day with a transit pill
      allDays.push(...cityDayObjects);
      for (let k = allDays.length - 1; k >= 0; k--) {
        if (!allDays[k].isTravelDay && !allDays[k].isSplitTravelDay) {
          allDays[k].shortTransition = {
            connection:   outgoing.connection,
            fromCityName: data.name,
            toCityName:   nextData?.name ?? nextCity,
            toCity:       nextCity,
          };
          break;
        }
      }

    } else if (outgoing?.type === 'long' || (outgoing?.type === 'medium' && singleDayConflict)) {
      // Full travel day (no stops)
      allDays.push(...cityDayObjects);
      if (nextCity) {
        allDays.push({
          isTravelDay:  true,
          city:         null,
          fromCity:     city,
          toCity:       nextCity,
          connection:   outgoing.connection,
          fromCityName: data.name,
          toCityName:   nextData?.name ?? nextCity,
          stops:        [],
          food:         [],
          cityHeader:   null,
        });
      }

    } else {
      // No outgoing transition (last city or connection not found)
      allDays.push(...cityDayObjects);
    }
  });

  // Close any unclosed pending split day
  if (pendingSplitDay) {
    pendingSplitDay.stops          = pendingSplitDay.morningStops;
    pendingSplitDay.splitIndex     = pendingSplitDay.morningStops.length;
    pendingSplitDay.morningStopIds = new Set(pendingSplitDay.morningStops.map(s => s.id));
    allDays.push(pendingSplitDay);
  }

  allDays.forEach((d, i) => { d.day = i + 1; d.label = `Day ${i + 1}`; });

  return { days: allDays, allAttractionsByCity, cities, country };
}
