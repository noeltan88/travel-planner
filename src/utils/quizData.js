import chinaDb from '../data/china-master-db-v1.json';

// ── China city list (from DB, ordered) ───────────────────────────────────────
const CHINA_CITY_ORDER = [
  'guangzhou','shenzhen','shanghai','chongqing','chengdu','beijing','hangzhou',
  'xian','guilin','changsha','zhangjiajie','yunnan','suzhou','jiuzhaigou',
  'harbin','changbaishan','sanya','xiamen','huangshan','nanjing','qingdao',
];

const CHINA_EMOJI_OVERRIDES = {
  guangzhou: '🥘', shenzhen: '🤖', shanghai: '🌆', chongqing: '🌶️',
  chengdu: '🐼', beijing: '🏯', hangzhou: '🍵', xian: '🏺', guilin: '🛶',
  changsha: '🌶️', zhangjiajie: '🏔️', yunnan: '🌸', suzhou: '🪷',
  jiuzhaigou: '💎', harbin: '❄️', changbaishan: '⛷️', sanya: '🏖️',
  xiamen: '🎹', huangshan: '🌅', nanjing: '🏯', qingdao: '🍺',
};

const CHINA_TAGLINE_OVERRIDES = {
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

const chinaCityOptions = CHINA_CITY_ORDER.map(id => {
  const c = chinaDb.cities[id];
  return {
    icon:  CHINA_EMOJI_OVERRIDES[id] || c?.emoji || '🏙️',
    name:  c?.name || id,
    desc:  CHINA_TAGLINE_OVERRIDES[id] || c?.tagline || c?.recommended_base_reason || '',
    value: id,
  };
});

// ── Japan city list ───────────────────────────────────────────────────────────
const japanCityOptions = [
  { icon: '🗼', name: 'Tokyo',       desc: 'Where Ancient Temples Meet Neon Skies',              value: 'tokyo'       },
  { icon: '🏯', name: 'Osaka',       desc: "Japan's Kitchen and Soul",                            value: 'osaka'       },
  { icon: '⛩️', name: 'Kyoto',       desc: 'A Thousand Temples, One Ancient Soul',                value: 'kyoto'       },
  { icon: '☮️', name: 'Hiroshima',   desc: 'From the Ashes, A City Reborn',                       value: 'hiroshima'   },
  { icon: '🦌', name: 'Nara',        desc: 'Ancient Capital Where Deer Roam Free',                value: 'nara'        },
  { icon: '🗻', name: 'Hakone',      desc: 'Fuji Views, Hot Springs and Mountain Air',             value: 'hakone'      },
  { icon: '🌿', name: 'Nikko',       desc: 'Ornate Shrines Hidden in Ancient Forest',              value: 'nikko'       },
  { icon: '❄️', name: 'Sapporo',     desc: 'Snow, Beer and Wide Open Horizons',                   value: 'sapporo'     },
  { icon: '🍜', name: 'Fukuoka',     desc: 'Ramen, Nightlife and Hakata Soul',                    value: 'fukuoka'     },
  { icon: '🔔', name: 'Nagasaki',    desc: 'Where East and West Met for Centuries',               value: 'nagasaki'    },
  { icon: '🌸', name: 'Kanazawa',    desc: 'Little Kyoto With a Local Soul',                      value: 'kanazawa'    },
  { icon: '🎡', name: 'Yokohama',    desc: "Port City Where Japan Opened to the World",           value: 'yokohama'    },
  { icon: '🪷', name: 'Kamakura',    desc: 'Great Buddha, Bamboo Paths and Sea Breezes',          value: 'kamakura'    },
  { icon: '🏖️', name: 'Okinawa',    desc: "Tropical Paradise at Japan's Southern Edge",          value: 'okinawa'     },
  { icon: '🗻', name: 'Kawaguchiko', desc: 'The Perfect Frame for Mount Fuji',                    value: 'kawaguchiko' },
];

// ── South Korea city list ────────────────────────────────────────────────────
const koreaCityOptions = [
  { icon: '🏙️', name: 'Seoul',      desc: 'K-Culture, Palaces and Midnight Ramyeon',              value: 'seoul'      },
  { icon: '🌊', name: 'Busan',       desc: "Korea's Coastal Soul",                                 value: 'busan'      },
  { icon: '🌺', name: 'Jeju',        desc: 'Volcanic Island of Waterfalls and Black Rock',          value: 'jeju'       },
  { icon: '🏛️', name: 'Gyeongju',   desc: 'Open Air Museum of the Silla Kingdom',                 value: 'gyeongju'   },
  { icon: '🏮', name: 'Jeonju',      desc: 'Bibimbap, Hanok Villages and Korean Tradition',         value: 'jeonju'     },
  { icon: '🏰', name: 'Suwon',       desc: 'A UNESCO Fortress City South of Seoul',                 value: 'suwon'      },
  { icon: '🏔️', name: 'Sokcho',     desc: 'Gateway to Seoraksan and the East Sea',                 value: 'sokcho'     },
  { icon: '🎭', name: 'Andong',      desc: 'The Heart of Korean Confucian Culture',                  value: 'andong'     },
  { icon: '⚓', name: 'Tongyeong',   desc: 'The Naples of Korea on the Southern Coast',              value: 'tongyeong'  },
  { icon: '🛬', name: 'Incheon',     desc: "Korea's Gateway With a Character of Its Own",           value: 'incheon'    },
];

// ── Thailand city list ───────────────────────────────────────────────────────
const thailandCityOptions = [
  { icon: '🛕', name: 'Bangkok',        desc: 'Temples, Street Food and Controlled Chaos',                value: 'bangkok'       },
  { icon: '🌸', name: 'Chiang Mai',     desc: 'Ancient Moat City in the Mountain North',                  value: 'chiang_mai'    },
  { icon: '🏖️', name: 'Phuket',        desc: 'Andaman Beaches and Island Escapes',                       value: 'phuket'        },
  { icon: '🧗', name: 'Krabi',          desc: 'Limestone Cliffs, Emerald Water, Pure Magic',               value: 'krabi'         },
  { icon: '🌴', name: 'Koh Samui',      desc: 'Gulf Island of Coconut Palms and Warm Nights',              value: 'koh_samui'     },
  { icon: '🏯', name: 'Ayutthaya',      desc: 'Ruined Kingdom Where History Sits in the Open Air',         value: 'ayutthaya'     },
  { icon: '☕', name: 'Chiang Rai',     desc: 'White Temples, Hill Tribes and Golden Triangle',             value: 'chiang_rai'    },
  { icon: '🎡', name: 'Pattaya',        desc: 'Beach Resort That Never Sleeps',                            value: 'pattaya'       },
  { icon: '🏄', name: 'Hua Hin',        desc: 'Royal Beach Town South of Bangkok',                         value: 'hua_hin'       },
  { icon: '🌉', name: 'Kanchanaburi',   desc: 'Death Railway, River Kwai and Jungle Waterfalls',           value: 'kanchanaburi'  },
  { icon: '🪔', name: 'Sukhothai',      desc: 'Cradle of Thai Civilisation',                               value: 'sukhothai'     },
  { icon: '🌄', name: 'Pai',            desc: 'Hippie Valley in the Northern Mountains',                    value: 'pai'           },
];

// ── Vietnam city list ────────────────────────────────────────────────────────
const vietnamCityOptions = [
  { icon: '🏛️', name: 'Hanoi',              desc: 'A Thousand Years of History on Every Corner',             value: 'hanoi'              },
  { icon: '🛵', name: 'Ho Chi Minh City',    desc: 'Relentless Energy, Street Food and History',              value: 'ho_chi_minh_city'   },
  { icon: '🌉', name: 'Da Nang',             desc: 'Dragon Bridges, White Sand and Easy Living',              value: 'da_nang'            },
  { icon: '🏮', name: 'Hoi An',              desc: 'Lantern Town Frozen Beautifully in Time',                 value: 'hoi_an'             },
  { icon: '🛶', name: 'Ha Long Bay',         desc: 'Three Thousand Limestone Islands Rising from the Sea',    value: 'ha_long_bay'        },
  { icon: '👑', name: 'Hue',                 desc: 'Imperial City of Palaces, Tombs and Royal Cuisine',       value: 'hue'                },
  { icon: '🏖️', name: 'Nha Trang',          desc: "Vietnam's Beach Capital with Coastal Charm",              value: 'nha_trang'          },
  { icon: '🌾', name: 'Sapa',               desc: 'Rice Terraces, Hill Tribes and Mountain Mist',            value: 'sapa'               },
  { icon: '🌹', name: 'Da Lat',             desc: 'City of Eternal Spring and Strawberry Fields',            value: 'da_lat'             },
  { icon: '🐠', name: 'Phu Quoc',           desc: "Pearl Island at Vietnam's Tropical Southern Tip",         value: 'phu_quoc'           },
];

// ── City options map ─────────────────────────────────────────────────────────
const CITY_OPTIONS_MAP = {
  china:       chinaCityOptions,
  japan:       japanCityOptions,
  south_korea: koreaCityOptions,
  thailand:    thailandCityOptions,
  vietnam:     vietnamCityOptions,
};

export function getCityOptions(country) {
  return CITY_OPTIONS_MAP[country] || chinaCityOptions;
}

// ── QUIZ definition ──────────────────────────────────────────────────────────
export const QUIZ = [
  {
    id: 'country',
    label: 'DESTINATION',
    title: 'Where are you heading?',
    sub: 'Select your destination country',
    multi: false,
    deco: '国',
    options: [
      { icon: '🇨🇳', name: 'China',       desc: 'The Middle Kingdom Awaits',                         value: 'china'       },
      { icon: '🇯🇵', name: 'Japan',        desc: 'Where Ancient Meets Ultra-Modern',                  value: 'japan'       },
      { icon: '🇰🇷', name: 'South Korea',  desc: 'K-Culture, Temples and Midnight Ramyeon',           value: 'south_korea' },
      { icon: '🇹🇭', name: 'Thailand',     desc: 'Temples, Street Food and Tropical Beaches',         value: 'thailand'    },
      { icon: '🇻🇳', name: 'Vietnam',      desc: 'A Thousand Years of History and Flavour',           value: 'vietnam'     },
    ],
  },
  {
    id: 'city',
    label: 'DESTINATION',
    title: 'Which city are you visiting?',
    sub: 'Select one or more cities',
    multi: true,
    deco: '中',
    options: chinaCityOptions, // default; QuizFlow overrides per country
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
      { icon: '🧍', name: 'Solo',             desc: 'Freedom, flexibility, your pace',              value: 'solo'           },
      { icon: '👫', name: 'Couple',            desc: 'Romantic spots & date-worthy dinners',          value: 'couple'         },
      { icon: '👨‍👩‍👧', name: 'Family with kids', desc: 'Kid-friendly stops, less walking',             value: 'family-kids'    },
      { icon: '👫', name: 'Group of friends',  desc: 'Good vibes, shared experiences',                value: 'friends'        },
      { icon: '👴', name: 'With elderly',      desc: 'Accessible routes, no steep climbs',            value: 'family-elderly' },
    ],
  },
  {
    id: 'pace',
    label: 'PACE',
    title: 'How packed do you like your days?',
    sub: "We'll adjust how much we fit in each day",
    multi: false,
    deco: '速',
    options: [
      { icon: '🌿', name: 'Chill',      desc: '2–3 stops, lots of breathing room',        value: 'chill'   },
      { icon: '⚖️', name: 'Balance',    desc: '4–5 stops, relaxed but fulfilling',         value: 'balance' },
      { icon: '⚡', name: 'Pack it in', desc: '6+ stops, maximise every hour',             value: 'pack'    },
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
      { icon: '✅', name: 'No restrictions', desc: 'I eat everything — surprise me',          value: 'none',        exclusive: true },
      { icon: '🥦', name: 'Vegetarian',       desc: 'No meat or fish',                        value: 'vegetarian'  },
      { icon: '🌙', name: 'Halal',            desc: 'Muslim-friendly restaurants only',       value: 'halal'       },
      { icon: '🐟', name: 'Pescatarian',      desc: 'Fish and seafood only, no other meat',   value: 'pescatarian' },
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
      { icon: '🌿', name: 'Scenic & nature',     desc: 'Parks, rivers, mountains, lakes',                    value: 'scenic'         },
      { icon: '🏛️', name: 'History & culture',   desc: 'Temples, museums, old towns, heritage',               value: 'culture'        },
      { icon: '📸', name: 'Instagrammable',       desc: 'Photogenic, shareable, beautiful spots',              value: 'instagrammable' },
      { icon: '🛍️', name: 'Shopping & food',     desc: 'Markets, malls, street eats, cafes',                 value: 'shopping'       },
      { icon: '🗺️', name: 'Local & hidden gems', desc: 'Where locals go, off the beaten path',                value: 'local'          },
      { icon: '🎢', name: 'Fun & adventure',      desc: 'Theme parks, cable cars, hot springs, skiing',        value: 'adventure'      },
      { icon: '🎲', name: 'Surprise me',          desc: 'No preference — show me the best of everything',      value: 'surprise',      exclusive: true },
    ],
  },
];
