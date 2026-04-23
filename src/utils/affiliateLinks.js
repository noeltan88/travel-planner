const KLOOK_AFF = 'YOUR_KLOOK_AFF_ID';
const AGODA_CID = 'YOUR_AGODA_CID';

export const KLOOK_LINKS = {
  'gz-001': `https://www.klook.com/activity/1234/?aid=${KLOOK_AFF}`,
  'gz-009': `https://www.klook.com/activity/5678/?aid=${KLOOK_AFF}`,
  'gz-018': `https://www.klook.com/activity/9012/?aid=${KLOOK_AFF}`,
  'sz-001': `https://www.klook.com/activity/3456/?aid=${KLOOK_AFF}`,
  'sz-009': `https://www.klook.com/activity/7890/?aid=${KLOOK_AFF}`,
  'sz-015': `https://www.klook.com/activity/2345/?aid=${KLOOK_AFF}`,
  'sz-016': `https://www.klook.com/activity/6543/?aid=${KLOOK_AFF}`,
  'sh-006': `https://www.klook.com/activity/6789/?aid=${KLOOK_AFF}`,
  'sh-008': `https://www.klook.com/activity/1357/?aid=${KLOOK_AFF}`,
  'sh-015': `https://www.klook.com/activity/2468/?aid=${KLOOK_AFF}`,
  'sh-023': `https://www.klook.com/activity/3579/?aid=${KLOOK_AFF}`,
};

export function getKlookLink(attractionId) {
  return KLOOK_LINKS[attractionId] || null;
}

export function getAgodaLink(agodaId) {
  return `https://www.agoda.com/partners/partnersearch.aspx?pcs=1&cid=${AGODA_CID}&hid=${agodaId}`;
}

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
  chongqing: [
    { id: 'cq-h1', name: 'Raffles Chongqing', stars: 5, area: 'Chaotianmen, Yuzhong', lat: 29.5687, lng: 106.5888, price: '¥2,500/night', rating: 9.5, reviews: '890', agodaId: '701234' },
    { id: 'cq-h2', name: 'Hyatt Regency Chongqing', stars: 5, area: 'Jiefangbei, Yuzhong', lat: 29.5591, lng: 106.5765, price: '¥900/night', rating: 9.1, reviews: '2,100', agodaId: '702345' },
    { id: 'cq-h3', name: 'JW Marriott Chongqing', stars: 5, area: 'Guanyinqiao, Jiangbei', lat: 29.5923, lng: 106.5414, price: '¥800/night', rating: 9.0, reviews: '1,800', agodaId: '703456' },
    { id: 'cq-h4', name: 'Vienna Hotel Jiefangbei', stars: 3, area: 'Jiefangbei, Yuzhong', lat: 29.5572, lng: 106.5742, price: '¥220/night', rating: 8.2, reviews: '3,400', agodaId: '704567' },
    { id: 'cq-h5', name: 'Home Inn Plus Hongyadong', stars: 3, area: 'Hongyadong, Yuzhong', lat: 29.5645, lng: 106.5793, price: '¥190/night', rating: 8.0, reviews: '2,100', agodaId: '705678' },
  ],
  chengdu: [
    { id: 'cd-h1', name: 'The Temple House Chengdu', stars: 5, area: 'Taikoo Li, Jinjiang', lat: 30.6578, lng: 104.0812, price: '¥1,800/night', rating: 9.6, reviews: '760', agodaId: '801234' },
    { id: 'cd-h2', name: 'Shangri-La Chengdu', stars: 5, area: 'Renmin Road, Jinjiang', lat: 30.6512, lng: 104.0714, price: '¥1,100/night', rating: 9.2, reviews: '1,980', agodaId: '802345' },
    { id: 'cd-h3', name: 'Crowne Plaza Chengdu City Center', stars: 5, area: 'Chunxi Road, Jinjiang', lat: 30.6569, lng: 104.0778, price: '¥700/night', rating: 8.9, reviews: '2,450', agodaId: '803456' },
    { id: 'cd-h4', name: 'Vienna Hotel Chunxi Road', stars: 3, area: 'Chunxi Road, Jinjiang', lat: 30.6578, lng: 104.0798, price: '¥210/night', rating: 8.3, reviews: '4,100', agodaId: '804567' },
    { id: 'cd-h5', name: 'Ibis Chengdu Kuanzhai Alley', stars: 3, area: 'Kuanzhai Alley, Qingyang', lat: 30.6670, lng: 104.0528, price: '¥180/night', rating: 8.1, reviews: '2,900', agodaId: '805678' },
  ],
  beijing: [
    { id: 'bj-h1', name: 'Aman at Summer Palace', stars: 5, area: 'Summer Palace, Haidian', lat: 40.0006, lng: 116.2746, price: '¥4,500/night', rating: 9.8, reviews: '420', agodaId: '901234' },
    { id: 'bj-h2', name: 'The Peninsula Beijing', stars: 5, area: 'Wangfujing, Dongcheng', lat: 39.9178, lng: 116.4108, price: '¥3,000/night', rating: 9.5, reviews: '890', agodaId: '902345' },
    { id: 'bj-h3', name: 'Regent Beijing', stars: 5, area: 'Jinbao Street, Dongcheng', lat: 39.9159, lng: 116.4204, price: '¥1,200/night', rating: 9.2, reviews: '1,780', agodaId: '903456' },
    { id: 'bj-h4', name: 'ibis Beijing Sanyuan Bridge', stars: 3, area: 'Chaoyang', lat: 39.9646, lng: 116.4671, price: '¥250/night', rating: 8.3, reviews: '5,200', agodaId: '904567' },
    { id: 'bj-h5', name: 'Nostalgia Hotel Qianmen', stars: 3, area: 'Qianmen, Dongcheng', lat: 39.8982, lng: 116.3957, price: '¥220/night', rating: 8.1, reviews: '3,100', agodaId: '905678' },
  ],
  hangzhou: [
    { id: 'hz-h1', name: 'Amanfayun Hangzhou', stars: 5, area: 'Lingyin Temple, Xihu', lat: 30.2442, lng: 120.0961, price: '¥5,000/night', rating: 9.8, reviews: '320', agodaId: '111234' },
    { id: 'hz-h2', name: 'Four Seasons Hangzhou', stars: 5, area: 'West Lake, Xihu', lat: 30.2442, lng: 120.0994, price: '¥3,500/night', rating: 9.6, reviews: '580', agodaId: '112345' },
    { id: 'hz-h3', name: 'Banyan Tree Hangzhou', stars: 5, area: 'West Lake South', lat: 30.2298, lng: 120.1367, price: '¥2,200/night', rating: 9.4, reviews: '720', agodaId: '113456' },
    { id: 'hz-h4', name: 'Radisson Blu Hangzhou', stars: 4, area: 'Qianjiang New City', lat: 30.2301, lng: 120.2012, price: '¥450/night', rating: 8.8, reviews: '2,100', agodaId: '114567' },
    { id: 'hz-h5', name: 'ibis Hangzhou West Lake', stars: 3, area: 'Wensan Road, Xihu', lat: 30.2721, lng: 120.1248, price: '¥220/night', rating: 8.2, reviews: '3,800', agodaId: '115678' },
  ],
};
