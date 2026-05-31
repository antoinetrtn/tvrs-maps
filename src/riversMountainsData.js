/**
 * Famous Rivers & Mountains Dataset
 */

export const riversMountainsDataMap = {
  // Mountains
  everest: {
    name_fr: 'Mont Everest',
    name_en: 'Mount Everest',
    type: 'mountain',
    lat: 27.9881,
    lng: 86.9250,
    region: 'Asia',
    height: 8848,
    aliases: ['everest', 'mont everest', 'mount everest']
  },
  montblanc: {
    name_fr: 'Mont Blanc',
    name_en: 'Mont Blanc',
    type: 'mountain',
    lat: 45.8326,
    lng: 6.8652,
    region: 'Europe',
    height: 4807,
    aliases: ['mont blanc', 'le mont blanc', 'mount blanc']
  },
  kilimanjaro: {
    name_fr: 'Kilimandjaro',
    name_en: 'Kilimanjaro',
    type: 'mountain',
    lat: -3.0674,
    lng: 37.3556,
    region: 'Africa',
    height: 5895,
    aliases: ['kilimandjaro', 'kilimanjaro', 'mont kilimandjaro', 'mount kilimanjaro']
  },
  fuji: {
    name_fr: 'Mont Fuji',
    name_en: 'Mount Fuji',
    type: 'mountain',
    lat: 35.3606,
    lng: 138.7274,
    region: 'Asia',
    height: 3776,
    aliases: ['fuji', 'mont fuji', 'mount fuji', 'fujisan', 'fujiyama']
  },
  denali: {
    name_fr: 'Denali',
    name_en: 'Denali',
    type: 'mountain',
    lat: 63.0692,
    lng: -151.0063,
    region: 'Americas',
    height: 6190,
    aliases: ['denali', 'mont mckinley', 'mount mckinley', 'mckinley']
  },
  aconcagua: {
    name_fr: 'Aconcagua',
    name_en: 'Aconcagua',
    type: 'mountain',
    lat: -32.6532,
    lng: -70.0108,
    region: 'Americas',
    height: 6961,
    aliases: ['aconcagua', 'mont aconcagua', 'mount aconcagua']
  },
  elbrus: {
    name_fr: 'Mont Elbrouz',
    name_en: 'Mount Elbrus',
    type: 'mountain',
    lat: 43.3499,
    lng: 42.4453,
    region: 'Europe',
    height: 5642,
    aliases: ['elbrouz', 'elbrus', 'mont elbrouz', 'mount elbrus']
  },
  matterhorn: {
    name_fr: 'Cervin',
    name_en: 'Matterhorn',
    type: 'mountain',
    lat: 45.9766,
    lng: 7.6585,
    region: 'Europe',
    height: 4478,
    aliases: ['cervin', 'le cervin', 'matterhorn', 'mont cervin']
  },
  kosciuszko: {
    name_fr: 'Mont Kosciuszko',
    name_en: 'Mount Kosciuszko',
    type: 'mountain',
    lat: -36.4559,
    lng: 148.2636,
    region: 'Oceania',
    height: 2228,
    aliases: ['kosciuszko', 'mont kosciuszko', 'mount kosciuszko']
  },
  vinson: {
    name_fr: 'Massif Vinson',
    name_en: 'Vinson Massif',
    type: 'mountain',
    lat: -78.5254,
    lng: -85.6171,
    region: 'Antarctic',
    height: 4892,
    aliases: ['vinson', 'massif vinson', 'vinson massif', 'mont vinson']
  },
  cook: {
    name_fr: 'Mont Cook',
    name_en: 'Mount Cook',
    type: 'mountain',
    lat: -43.5950,
    lng: 170.1410,
    region: 'Oceania',
    height: 3724,
    aliases: ['cook', 'mont cook', 'mount cook', 'aoraki']
  },
  table: {
    name_fr: 'Montagne de la Table',
    name_en: 'Table Mountain',
    type: 'mountain',
    lat: -33.9628,
    lng: 18.4098,
    region: 'Africa',
    height: 1086,
    aliases: ['table mountain', 'montagne de la table', 'la table']
  },
  rainier: {
    name_fr: 'Mont Rainier',
    name_en: 'Mount Rainier',
    type: 'mountain',
    lat: 46.8523,
    lng: -121.7603,
    region: 'Americas',
    height: 4392,
    aliases: ['rainier', 'mont rainier', 'mount rainier']
  },
  k2: {
    name_fr: 'K2',
    name_en: 'K2',
    type: 'mountain',
    lat: 35.8808,
    lng: 76.5133,
    region: 'Asia',
    height: 8611,
    aliases: ['k2', 'le k2', 'mount k2', 'godwin austen']
  },
  kenya: {
    name_fr: 'Mont Kenya',
    name_en: 'Mount Kenya',
    type: 'mountain',
    lat: -0.1521,
    lng: 37.3084,
    region: 'Africa',
    height: 5199,
    aliases: ['kenya', 'mont kenya', 'mount kenya']
  },

  // Rivers
  nile: {
    name_fr: 'Nil',
    name_en: 'Nile',
    type: 'river',
    lat: 24.1, // Point of focus
    lng: 32.9,
    region: 'Africa',
    length: 6650,
    aliases: ['nil', 'le nil', 'nile', 'the nile'],
    path: [[2.1, 32.3], [9.5, 31.8], [15.6, 32.5], [19.2, 33.0], [22.0, 31.3], [24.1, 32.9], [29.1, 31.1], [30.1, 31.3], [31.3, 30.1]]
  },
  amazon: {
    name_fr: 'Amazone',
    name_en: 'Amazon River',
    type: 'river',
    lat: -3.1019,
    lng: -60.0250,
    region: 'Americas',
    length: 6400,
    aliases: ['amazone', 'l\'amazone', 'amazon', 'the amazon', 'amazon river', 'rio amazonas'],
    path: [[-4.4, -73.2], [-3.7, -70.0], [-3.1, -60.0], [-2.3, -54.7], [-1.4, -48.5]]
  },
  yangtze: {
    name_fr: 'Yangzi Jiang',
    name_en: 'Yangtze River',
    type: 'river',
    lat: 30.6082,
    lng: 114.2982,
    region: 'Asia',
    length: 6300,
    aliases: ['yangzi', 'yangtze', 'yangzi jiang', 'fleuve bleu', 'yangtse', 'yangtse kiang'],
    path: [[33.0, 92.0], [27.0, 100.0], [26.0, 103.0], [29.5, 106.5], [30.6, 114.3], [32.0, 118.8], [31.2, 121.5]]
  },
  mississippi: {
    name_fr: 'Mississippi',
    name_en: 'Mississippi River',
    type: 'river',
    lat: 35.1495,
    lng: -90.0490,
    region: 'Americas',
    length: 3730,
    aliases: ['mississippi', 'le mississippi', 'mississippi river'],
    path: [[47.2, -95.2], [45.0, -93.2], [41.5, -90.5], [38.6, -90.2], [35.1, -90.1], [32.3, -90.9], [30.0, -90.0], [29.1, -89.2]]
  },
  volga: {
    name_fr: 'Volga',
    name_en: 'Volga River',
    type: 'river',
    lat: 53.2,
    lng: 50.1,
    region: 'Europe',
    length: 3530,
    aliases: ['volga', 'la volga', 'volga river'],
    path: [[57.2, 32.5], [56.9, 35.9], [56.3, 44.0], [55.8, 49.1], [53.2, 50.1], [48.7, 44.5], [46.3, 48.0]]
  },
  danube: {
    name_fr: 'Danube',
    name_en: 'Danube River',
    type: 'river',
    lat: 45.2,
    lng: 19.8,
    region: 'Europe',
    length: 2850,
    aliases: ['danube', 'le danube', 'danube river'],
    path: [[48.0, 8.5], [48.3, 14.3], [48.2, 16.4], [47.5, 19.0], [45.2, 19.8], [44.8, 20.4], [44.3, 22.5], [44.0, 26.6], [45.2, 29.7]]
  },
  congo: {
    name_fr: 'Congo',
    name_en: 'Congo River',
    type: 'river',
    lat: -4.3013,
    lng: 15.3090,
    region: 'Africa',
    length: 4700,
    aliases: ['congo', 'le congo', 'congo river', 'fleuve congo', 'zaire'],
    path: [[-11.5, 26.5], [-6.0, 27.0], [-0.5, 25.2], [2.0, 22.8], [-1.5, 17.0], [-4.3, 15.3], [-6.1, 12.4]]
  },
  ganges: {
    name_fr: 'Gange',
    name_en: 'Ganges River',
    type: 'river',
    lat: 25.3176,
    lng: 82.9739,
    region: 'Asia',
    length: 2525,
    aliases: ['gange', 'le gange', 'ganges', 'the ganges', 'ganges river'],
    path: [[30.1, 78.8], [28.6, 79.8], [26.5, 80.5], [25.3, 83.0], [25.2, 87.0], [23.7, 90.4], [22.0, 91.0]]
  },
  mekong: {
    name_fr: 'Mékong',
    name_en: 'Mekong River',
    type: 'river',
    lat: 11.5564,
    lng: 104.9282,
    region: 'Asia',
    length: 4350,
    aliases: ['mekong', 'le mekong', 'mekong river'],
    path: [[33.0, 94.0], [22.0, 100.5], [18.0, 102.5], [15.0, 105.8], [11.5, 104.9], [10.2, 106.2]]
  },
  murray: {
    name_fr: 'Murray',
    name_en: 'Murray River',
    type: 'river',
    lat: -34.2250,
    lng: 142.1480,
    region: 'Oceania',
    length: 2508,
    aliases: ['murray', 'le murray', 'murray river'],
    path: [[-36.5, 148.0], [-36.0, 146.4], [-35.0, 143.0], [-34.2, 142.1], [-34.3, 140.5], [-35.5, 138.9]]
  },
  rhine: {
    name_fr: 'Rhin',
    name_en: 'Rhine River',
    type: 'river',
    lat: 50.3569,
    lng: 7.5996,
    region: 'Europe',
    length: 1230,
    aliases: ['rhin', 'le rhin', 'rhine', 'rhine river'],
    path: [[46.6, 8.8], [47.6, 9.2], [47.6, 7.6], [49.0, 8.3], [50.0, 7.8], [51.0, 6.9], [51.9, 5.9], [51.9, 4.1]]
  },
  seine: {
    name_fr: 'Seine',
    name_en: 'Seine River',
    type: 'river',
    lat: 48.8566,
    lng: 2.3522,
    region: 'Europe',
    length: 777,
    aliases: ['seine', 'la seine', 'seine river'],
    path: [[47.5, 4.7], [47.8, 4.4], [48.0, 3.8], [48.3, 2.7], [48.86, 2.35], [49.2, 1.6], [49.5, 0.2]]
  },
  thames: {
    name_fr: 'Tamise',
    name_en: 'Thames River',
    type: 'river',
    lat: 51.5074,
    lng: -0.1278,
    region: 'Europe',
    length: 346,
    aliases: ['tamise', 'la tamise', 'thames', 'river thames', 'thames river'],
    path: [[51.7, -2.0], [51.8, -1.3], [51.6, -1.0], [51.4, -0.6], [51.51, -0.1], [51.54, 0.8]]
  },
  niger: {
    name_fr: 'Niger',
    name_en: 'Niger River',
    type: 'river',
    lat: 13.5116,
    lng: 2.1254,
    region: 'Africa',
    length: 4180,
    aliases: ['niger', 'le niger', 'niger river'],
    path: [[10.0, -10.0], [13.0, -6.0], [17.0, -3.0], [13.5, 2.0], [8.0, 4.5], [4.5, 7.0]]
  },
  indus: {
    name_fr: 'Indus',
    name_en: 'Indus River',
    type: 'river',
    lat: 25.3969,
    lng: 68.3569,
    region: 'Asia',
    length: 3180,
    aliases: ['indus', 'l\'indus', 'indus river'],
    path: [[31.3, 81.3], [34.0, 76.0], [34.5, 72.8], [31.5, 70.8], [27.3, 68.8], [24.0, 67.5]]
  }
};
