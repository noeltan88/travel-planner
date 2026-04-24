import masterDb from '../data/china-master-db-v1.json';

// ── Constants ─────────────────────────────────────────────────────
//
// PACE_HOURS is a total sightseeing window, not "activity hours minus lunch".
// DB avg duration_hrs = 2.38.  For 4 balance stops + 3×transit that means
// ~11 hrs of window.  Lunch is handled via food picks — not deducted here.
//
const PACE_HOURS        = { chill: 6, balance: 11, pack: 15 };
const PACE_MAX_STOPS    = { chill: 2, balance: 4,  pack: 6  };
const PACE_MAX_CLUSTERS = { chill: 1, balance: 2,  pack: 3  };
const TRAVEL_SAME_HRS   = 1 / 3;  // 20 min — same cluster
const TRAVEL_DIFF_HRS   = 0.5;    // 30 min — cross-cluster (subway realistic)
const TRAVEL_SAME_MINS  = 20;
const TRAVEL_DIFF_MINS  = 30;

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

function assignTimeSlots(stops, startHour = 9) {
  let cur = startHour * 60;
  return stops.map((s, i) => {
    const start = formatTime(cur);
    const end   = formatTime(cur + (s.duration_hrs ?? 1) * 60);
    if (i < stops.length - 1) {
      const thisCluster = s.cluster_group          || '_default';
      const nextCluster = stops[i + 1]?.cluster_group || '_default';
      const transitMins = thisCluster === nextCluster ? TRAVEL_SAME_MINS : TRAVEL_DIFF_MINS;
      cur += (s.duration_hrs ?? 1) * 60 + transitMins;
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
function spreadIcons(iconAttractions, numDays) {
  const icons = numDays === 1
    ? iconAttractions.slice(0, 2)   // 1-day trip: cap at 2
    : iconAttractions.slice(0, 3);  // multi-day: up to 3

  return icons.map((icon, i) => {
    const targetDay = icons.length <= 1
      ? 0
      : Math.round(i * (numDays - 1) / (icons.length - 1));
    return { icon, dayIdx: targetDay };
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

  const usedIds     = new Set();
  const usedKidsIds = new Set();
  const usedFoodIds = new Set();
  const days        = [];
  let standaloneQ   = [...standalones];
  let clusterCursor = 0;

  // Pre-assign icon attractions to days (bypasses vibe/energy/cluster rules)
  const iconSchedule = spreadIcons(iconAttractions, budgets.length);

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
      // FIX 1: time budget with transit
      const transitCost = dayStops.length === 0 ? 0
        : (cluster === prevCluster ? TRAVEL_SAME_HRS : TRAVEL_DIFF_HRS);
      if ((a.duration_hrs ?? 1) + transitCost > available)            return false;
      return true;
    }

    // Add a stop and update running state
    function addStop(a) {
      const cluster     = a.cluster_group || '_default';
      const transitCost = dayStops.length === 0 ? 0
        : (cluster === prevCluster ? TRAVEL_SAME_HRS : TRAVEL_DIFF_HRS);
      available   -= (a.duration_hrs ?? 1) + transitCost;
      prevCluster  = cluster;
      clustersUsed.add(cluster);
      usedIds.add(a.id);
      dayStops.push(a);
    }

    // ── 0. Icon injection (guaranteed, spread evenly across days) ─
    //    Bypasses vibe score, energy level, and cluster rules.
    //    Still respects effectiveMax and time budget.
    const todayIcons = iconSchedule.filter(q => q.dayIdx === dayIdx);
    for (const { icon } of todayIcons) {
      if (usedIds.has(icon.id)) continue;          // already placed earlier
      if (dayStops.length >= effectiveMax) break;
      const cluster     = icon.cluster_group || '_default';
      const transitCost = dayStops.length === 0 ? 0
        : (cluster === prevCluster ? TRAVEL_SAME_HRS : TRAVEL_DIFF_HRS);
      const needed = (icon.duration_hrs ?? 2) + transitCost;
      if (needed > available) {
        console.log(`[algo] Day ${dayIdx + 1}: icon "${icon.name}" skipped — no time (need ${needed.toFixed(1)}h, have ${available.toFixed(1)}h)`);
        continue;
      }
      available  -= needed;
      prevCluster = cluster;
      clustersUsed.add(cluster);
      usedIds.add(icon.id);
      dayStops.push(icon);
      console.log(`[algo] Day ${dayIdx + 1}: 📍 icon "${icon.name}" injected`);
    }

    // ── 1. Standalone day (never on Day 1 — FIX 8) ───────────────
    let usedStandalone = false;
    if (!noStandalone) {
      const sa = standaloneQ.find(a => canAdd(a));
      if (sa) {
        standaloneQ  = standaloneQ.filter(a => a.id !== sa.id);
        addStop(sa);
        usedStandalone = true;
      }
    }

    // ── 2. Cluster-based fill ─────────────────────────────────────
    if (!usedStandalone) {

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
          : (cluster === prevCluster ? TRAVEL_SAME_HRS : TRAVEL_DIFF_HRS);
        if ((ka.duration_hrs ?? 2) + transitCost > available)  return false;
        if (has03 && ka.energy_level === 'high')               return false;
        return true;
      });
      if (kidPick) {
        const cluster     = kidPick.cluster_group || '_default';
        const transitCost = dayStops.length === 0 ? 0
          : (cluster === prevCluster ? TRAVEL_SAME_HRS : TRAVEL_DIFF_HRS);
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

  // FIX 4: kids 13+ only → skip all kids logic, treat as adults
  const effectivelyAdults = isKidsTrip &&
    kidsAges.length > 0 &&
    kidsAges.every(k => k === '13+');

  const allBudgets = buildDayBudgets(totalDays, pace, arrivalTime, departureTime);
  const allocation = allocateDaysPerCity(cities, totalDays);

  const allDays              = [];
  const allAttractionsByCity = {};
  let   globalBudgetOffset   = 0;

  cities.forEach(city => {
    const data = loadCityData(city);
    if (!data) return;

    const cityDays    = allocation[city] || 1;
    const cityBudgets = allBudgets.slice(globalBudgetOffset, globalBudgetOffset + cityDays);
    globalBudgetOffset += cityDays;

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

    // Icons: from scored pool (for _score shape), bypassing filters
    const iconAttractions = scored.filter(a => a.icon === true).slice(0, 3);

    const kidsAttractions = effectiveKidsTrip ? (data.kids_attractions || []) : [];

    allAttractionsByCity[city] = data.attractions || [];

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

    allDays.push(...cityDayObjects);
  });

  allDays.forEach((d, i) => { d.day = i + 1; d.label = `Day ${i + 1}`; });

  return { days: allDays, allAttractionsByCity, cities };
}
