/**
 * create-country-databases.js
 *
 * Builds master DB JSON files for Japan, South Korea, Thailand, and Vietnam
 * from their enriched staging files, matching the structure of china-master-db-v1.json.
 *
 * Output:
 *   src/data/japan-master-db-v1.json
 *   src/data/korea-master-db-v1.json
 *   src/data/thailand-master-db-v1.json
 *   src/data/vietnam-master-db-v1.json
 *
 * Run: node scripts/create-country-databases.js
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA      = resolve(__dirname, '../src/data');

// ── Helpers ────────────────────────────────────────────────────────────────────
function pad(n, width = 3) { return String(n).padStart(width, '0'); }

function readJson(path) { return JSON.parse(readFileSync(path, 'utf8')); }

// Flatten { cluster: [entries] } → [entries], dedup by lowercase name
function flattenAndDedup(byCluster) {
  const seen = new Set();
  const out  = [];
  for (const entries of Object.values(byCluster)) {
    for (const e of entries) {
      const key = (e.name || '').toLowerCase().trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
  }
  return out;
}

// ── Country config ─────────────────────────────────────────────────────────────
const COUNTRIES = [
  {
    key:          'japan',
    clusterKey:   'japan',
    outputFile:   'japan-master-db-v1.json',
    cities: {
      tokyo:        { code: 'tok', name: 'Tokyo',        localName: '東京'                     },
      osaka:        { code: 'osa', name: 'Osaka',        localName: '大阪'                     },
      kyoto:        { code: 'kyo', name: 'Kyoto',        localName: '京都'                     },
      hiroshima:    { code: 'hir', name: 'Hiroshima',    localName: '広島'                     },
      nara:         { code: 'nar', name: 'Nara',         localName: '奈良'                     },
      hakone:       { code: 'hak', name: 'Hakone',       localName: '箱根'                     },
      nikko:        { code: 'nik', name: 'Nikko',        localName: '日光'                     },
      sapporo:      { code: 'sap', name: 'Sapporo',      localName: '札幌'                     },
      fukuoka:      { code: 'fuk', name: 'Fukuoka',      localName: '福岡'                     },
      nagasaki:     { code: 'nag', name: 'Nagasaki',     localName: '長崎'                     },
      kanazawa:     { code: 'kan', name: 'Kanazawa',     localName: '金沢'                     },
      yokohama:     { code: 'yok', name: 'Yokohama',     localName: '横浜'                     },
      kamakura:     { code: 'kam', name: 'Kamakura',     localName: '鎌倉'                     },
      okinawa:      { code: 'oki', name: 'Okinawa',      localName: '沖縄'                     },
      kawaguchiko:  { code: 'kaw', name: 'Kawaguchiko',  localName: '河口湖'                   },
    },
  },
  {
    key:          'korea',
    clusterKey:   'south_korea',
    outputFile:   'korea-master-db-v1.json',
    cities: {
      seoul:        { code: 'seo', name: 'Seoul',        localName: '서울'                     },
      busan:        { code: 'bus', name: 'Busan',        localName: '부산'                     },
      jeju:         { code: 'jej', name: 'Jeju',         localName: '제주'                     },
      gyeongju:     { code: 'gye', name: 'Gyeongju',    localName: '경주'                     },
      jeonju:       { code: 'jeo', name: 'Jeonju',       localName: '전주'                     },
      suwon:        { code: 'suw', name: 'Suwon',        localName: '수원'                     },
      sokcho:       { code: 'sok', name: 'Sokcho',       localName: '속초'                     },
      andong:       { code: 'and', name: 'Andong',       localName: '안동'                     },
      tongyeong:    { code: 'ton', name: 'Tongyeong',    localName: '통영'                     },
      incheon:      { code: 'inc', name: 'Incheon',      localName: '인천'                     },
    },
  },
  {
    key:          'thailand',
    clusterKey:   'thailand',
    outputFile:   'thailand-master-db-v1.json',
    cities: {
      bangkok:       { code: 'bkk', name: 'Bangkok',       localName: 'กรุงเทพมหานคร'          },
      chiang_mai:    { code: 'cnx', name: 'Chiang Mai',    localName: 'เชียงใหม่'               },
      phuket:        { code: 'hkt', name: 'Phuket',        localName: 'ภูเก็ต'                  },
      krabi:         { code: 'kbv', name: 'Krabi',         localName: 'กระบี่'                  },
      koh_samui:     { code: 'ksu', name: 'Koh Samui',     localName: 'เกาะสมุย'               },
      ayutthaya:     { code: 'aya', name: 'Ayutthaya',     localName: 'อยุธยา'                  },
      chiang_rai:    { code: 'cei', name: 'Chiang Rai',    localName: 'เชียงราย'                },
      pattaya:       { code: 'pty', name: 'Pattaya',       localName: 'พัทยา'                   },
      hua_hin:       { code: 'hhn', name: 'Hua Hin',       localName: 'หัวหิน'                  },
      kanchanaburi:  { code: 'kan', name: 'Kanchanaburi',  localName: 'กาญจนบุรี'               },
      sukhothai:     { code: 'suk', name: 'Sukhothai',     localName: 'สุโขทัย'                 },
      pai:           { code: 'pai', name: 'Pai',           localName: 'ปาย'                     },
    },
  },
  {
    key:          'vietnam',
    clusterKey:   'vietnam',
    outputFile:   'vietnam-master-db-v1.json',
    cities: {
      hanoi:            { code: 'han', name: 'Hanoi',            localName: 'Hà Nội'            },
      ho_chi_minh_city: { code: 'hcm', name: 'Ho Chi Minh City', localName: 'Thành phố Hồ Chí Minh' },
      da_nang:          { code: 'dad', name: 'Da Nang',          localName: 'Đà Nẵng'           },
      hoi_an:           { code: 'hoi', name: 'Hoi An',           localName: 'Hội An'            },
      ha_long_bay:      { code: 'hlb', name: 'Ha Long Bay',      localName: 'Vịnh Hạ Long'      },
      hue:              { code: 'hue', name: 'Hue',              localName: 'Huế'               },
      nha_trang:        { code: 'nha', name: 'Nha Trang',        localName: 'Nha Trang'         },
      sapa:             { code: 'sap', name: 'Sapa',             localName: 'Sa Pa'             },
      da_lat:           { code: 'dal', name: 'Da Lat',           localName: 'Đà Lạt'            },
      phu_quoc:         { code: 'pqu', name: 'Phu Quoc',         localName: 'Phú Quốc'          },
    },
  },
];

// ── Load shared data ───────────────────────────────────────────────────────────
const clustersMeta = readJson(resolve(DATA, 'country-clusters.json'));

// ── Build each country DB ──────────────────────────────────────────────────────
for (const country of COUNTRIES) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`🌏  ${country.key.toUpperCase()}`);
  console.log('═'.repeat(60));

  // Load all three staging files for this country
  const stagingAttr   = readJson(resolve(DATA, `staging-${country.key}-attractions.json`));
  const stagingFood   = readJson(resolve(DATA, `staging-${country.key}-food.json`));
  const stagingHotels = readJson(resolve(DATA, `staging-${country.key}-hotels.json`));

  const ccCities = clustersMeta[country.clusterKey] || {};

  let totalAttr = 0, totalFood = 0, totalHotels = 0;

  const db = {
    country:      country.key,
    cities:       {},
  };

  for (const [cityKey, cfg] of Object.entries(country.cities)) {
    const meta = ccCities[cityKey] || {};

    // Flatten + dedup each type from the staged cluster maps
    const rawAttr   = flattenAndDedup(stagingAttr[cityKey]   || {});
    const rawFood   = flattenAndDedup(stagingFood[cityKey]   || {});
    const rawHotels = flattenAndDedup(stagingHotels[cityKey] || {});

    // Assign sequential IDs and ensure show_in_explore
    const attractions = rawAttr.map((e, i) => ({
      ...e,
      id:             `${cfg.code}-${pad(i + 1)}`,
      show_in_explore: true,
    }));

    const food = rawFood.map((e, i) => ({
      ...e,
      id:             `${cfg.code}-f${pad(i + 1)}`,
      show_in_explore: true,
    }));

    const hotels = rawHotels.map((e, i) => ({
      ...e,
      id:             `${cfg.code}-h${pad(i + 1)}`,
      show_in_explore: true,
    }));

    db.cities[cityKey] = {
      name:        cfg.name,
      local_name:  cfg.localName,
      emoji:       meta.emoji   || '',
      tagline:     meta.tagline || '',
      clusters:    meta.clusters || [],
      attractions,
      food,
      hotels,
    };

    console.log(
      `  ${cfg.name.padEnd(18)} attr:${String(attractions.length).padStart(4)}`
      + `  food:${String(food.length).padStart(4)}`
      + `  hotels:${String(hotels.length).padStart(4)}`
      + `  total:${String(attractions.length + food.length + hotels.length).padStart(5)}`,
    );

    totalAttr   += attractions.length;
    totalFood   += food.length;
    totalHotels += hotels.length;
  }

  const outPath = resolve(DATA, country.outputFile);
  writeFileSync(outPath, JSON.stringify(db, null, 2));

  const grandTotal = totalAttr + totalFood + totalHotels;
  console.log(`\n  ✓ Cities: ${Object.keys(country.cities).length}`);
  console.log(`    Attractions : ${totalAttr}`);
  console.log(`    Food        : ${totalFood}`);
  console.log(`    Hotels      : ${totalHotels}`);
  console.log(`    Total       : ${grandTotal}`);
  console.log(`  → ${outPath}`);
}

console.log('\n' + '═'.repeat(60));
console.log('ALL DONE');
console.log('═'.repeat(60));
