// Skip micro-territories and tiny island dependencies so they don't crowd neighboring capitals
export const MICRO_TERRITORIES = new Set([
  "Aland",
  "Andorra",
  "Anguilla",
  "Aruba",
  "Bermuda",
  "British Virgin Islands",
  "Cayman Islands",
  "Cook Islands",
  "Curaçao",
  "Dominica",
  "Falkland Islands",
  "Faroe Islands",
  "French Polynesia",
  "Gibraltar",
  "Greenland",
  "Grenada",
  "Guam",
  "Guernsey",
  "Isle of Man",
  "Jersey",
  "Kiribati",
  "Liechtenstein",
  "Macao",
  "Maldives",
  "Malta",
  "Marshall Islands",
  "Federated States of Micronesia",
  "Monaco",
  "Montserrat",
  "Nauru",
  "New Caledonia",
  "Niue",
  "Norfolk Island",
  "Northern Mariana Islands",
  "Palau",
  "Pitcairn Islands",
  "Saint Barthelemy",
  "Saint Helena",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Martin",
  "Saint Pierre and Miquelon",
  "Saint Vincent and the Grenadines",
  "American Samoa",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Seychelles",
  "Sint Maarten",
  "Solomon Islands",
  "Tonga",
  "Turks and Caicos Islands",
  "Tuvalu",
  "United States Virgin Islands",
  "Vanuatu",
  "Vatican",
  "Wallis and Futuna",
]);

// Compact capitals in tightly packed regions get a slightly tighter reach so neighbors stay distinct
export const COMPACT_CAPITALS = new Set([
  "Albania",
  "Armenia",
  "Bosnia and Herzegovina",
  "Brunei",
  "Burundi",
  "Cyprus",
  "Djibouti",
  "Equatorial Guinea",
  "Estonia",
  "Gambia",
  "Georgia",
  "Kosovo",
  "Kuwait",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Lithuania",
  "Luxembourg",
  "Moldova",
  "Montenegro",
  "North Macedonia",
  "Palestine",
  "Qatar",
  "Rwanda",
  "Slovakia",
  "Slovenia",
  "Swaziland",
  "Switzerland",
  "Timor-Leste",
  "Trinidad and Tobago",
]);

// Major sprawling metropolises get slightly longer highway tentacles
export const MAJOR_METROPOLISES = new Set([
  "Argentina",
  "Australia",
  "Austria",
  "Belgium",
  "Brazil",
  "Canada",
  "Chile",
  "China",
  "Colombia",
  "Czechia",
  "Egypt",
  "France",
  "Germany",
  "Greece",
  "Hungary",
  "India",
  "Indonesia",
  "Iran",
  "Italy",
  "Japan",
  "Mexico",
  "Netherlands",
  "Nigeria",
  "Peru",
  "Poland",
  "Portugal",
  "Romania",
  "Russia",
  "Saudi Arabia",
  "South Africa",
  "South Korea",
  "Spain",
  "Sweden",
  "Thailand",
  "Turkey",
  "Ukraine",
  "United Kingdom",
  "United States of America",
  "Vietnam",
]);

// Secondary major cities [lat, lng] per country so medium/large countries ignite as a rich living network
export const SECONDARY_CITIES_BY_COUNTRY = {
  France: [
    [45.76, 4.84], // Lyon
    [43.3, 5.37], // Marseille
    [43.6, 1.44], // Toulouse
    [50.63, 3.06], // Lille
    [44.84, -0.58], // Bordeaux
    [47.22, -1.55], // Nantes
    [48.57, 7.75], // Strasbourg
  ],
  "United Kingdom": [
    [53.48, -2.24], // Manchester
    [52.49, -1.9], // Birmingham
    [55.86, -4.25], // Glasgow
    [55.95, -3.19], // Edinburgh
    [51.45, -2.59], // Bristol
  ],
  Spain: [
    [41.39, 2.17], // Barcelona
    [39.47, -0.38], // Valencia
    [37.39, -5.98], // Seville
    [43.26, -2.93], // Bilbao
    [36.72, -4.42], // Malaga
  ],
  Italy: [
    [45.46, 9.19], // Milan
    [40.85, 14.27], // Naples
    [45.07, 7.69], // Turin
    [45.44, 12.32], // Venice
    [38.12, 13.36], // Palermo
    [44.49, 11.34], // Bologna
  ],
  Germany: [
    [48.14, 11.58], // Munich
    [50.11, 8.68], // Frankfurt
    [53.55, 9.99], // Hamburg
    [50.94, 6.96], // Cologne/Ruhr
    [48.78, 9.18], // Stuttgart
  ],
  Poland: [
    [50.06, 19.94], // Krakow
    [51.11, 17.04], // Wroclaw
    [54.35, 18.65], // Gdansk
    [52.41, 16.93], // Poznan
  ],
  Ukraine: [
    [49.99, 36.23], // Kharkiv
    [46.48, 30.72], // Odesa
    [48.46, 35.05], // Dnipro
    [49.84, 24.03], // Lviv
  ],
  Portugal: [
    [41.16, -8.63], // Porto
    [37.02, -7.93], // Faro
  ],
  Belgium: [
    [51.22, 4.4], // Antwerp
    [50.63, 5.57], // Liege
  ],
  Netherlands: [
    [51.92, 4.48], // Rotterdam
    [51.44, 5.47], // Eindhoven
  ],
  Switzerland: [
    [47.37, 8.54], // Zurich
    [46.2, 6.14], // Geneva
  ],
  Austria: [
    [47.07, 15.44], // Graz
    [47.81, 13.05], // Salzburg
  ],
  Sweden: [
    [57.71, 11.97], // Gothenburg
    [55.61, 13.0], // Malmo
  ],
  Norway: [
    [60.39, 5.32], // Bergen
    [63.43, 10.4], // Trondheim
  ],
  Finland: [
    [61.5, 23.76], // Tampere
    [60.45, 22.27], // Turku
  ],
  Greece: [
    [40.64, 22.94], // Thessaloniki
    [35.34, 25.14], // Heraklion
  ],
  Romania: [
    [46.77, 23.62], // Cluj-Napoca
    [45.75, 21.21], // Timisoara
    [47.16, 27.59], // Iasi
  ],
  Czechia: [
    [49.19, 16.61], // Brno
    [49.82, 18.26], // Ostrava
  ],
  Turkey: [
    [41.01, 28.98], // Istanbul
    [38.42, 27.14], // Izmir
    [36.9, 30.71], // Antalya
    [37.0, 35.32], // Adana
  ],
  Russia: [
    [59.93, 30.34], // St. Petersburg
    [56.33, 44.0], // Nizhny Novgorod
    [55.79, 49.12], // Kazan
    [56.84, 60.6], // Yekaterinburg
    [55.01, 82.93], // Novosibirsk
    [47.24, 39.7], // Rostov-on-Don
  ],
  Morocco: [
    [33.57, -7.59], // Casablanca
    [31.63, -7.98], // Marrakech
    [35.76, -5.83], // Tangier
    [34.03, -5.0], // Fes
  ],
  Algeria: [
    [35.7, -0.63], // Oran
    [36.36, 6.61], // Constantine
    [36.9, 7.77], // Annaba
  ],
  Tunisia: [
    [34.74, 10.76], // Sfax
    [35.83, 10.64], // Sousse
  ],
  Egypt: [
    [31.2, 29.92], // Alexandria
    [25.69, 32.64], // Luxor
    [24.09, 32.9], // Aswan
  ],
  Nigeria: [
    [6.52, 3.38], // Lagos
    [12.0, 8.52], // Kano
    [7.38, 3.95], // Ibadan
    [4.82, 7.05], // Port Harcourt
  ],
  "South Africa": [
    [-26.2, 28.05], // Johannesburg
    [-33.92, 18.42], // Cape Town
    [-29.86, 31.02], // Durban
  ],
  "Saudi Arabia": [
    [21.49, 39.19], // Jeddah
    [26.42, 50.09], // Dammam
    [24.47, 39.61], // Medina
  ],
  Iran: [
    [36.3, 59.61], // Mashhad
    [32.65, 51.67], // Isfahan
    [29.59, 52.58], // Shiraz
    [38.08, 46.29], // Tabriz
  ],
  "United States of America": [
    [40.71, -74.01], // New York
    [34.05, -118.24], // Los Angeles
    [41.88, -87.63], // Chicago
    [29.76, -95.37], // Houston
    [37.77, -122.42], // San Francisco
    [25.76, -80.19], // Miami
    [47.61, -122.33], // Seattle
    [33.75, -84.39], // Atlanta
    [32.78, -96.8], // Dallas
    [42.36, -71.06], // Boston
  ],
  Canada: [
    [43.65, -79.38], // Toronto
    [45.5, -73.57], // Montreal
    [49.28, -123.12], // Vancouver
    [51.05, -114.07], // Calgary
    [53.54, -113.49], // Edmonton
  ],
  Mexico: [
    [20.66, -103.35], // Guadalajara
    [25.69, -100.32], // Monterrey
    [21.16, -86.85], // Cancun
  ],
  Brazil: [
    [-23.55, -46.63], // Sao Paulo
    [-22.91, -43.17], // Rio de Janeiro
    [-19.92, -43.94], // Belo Horizonte
    [-12.97, -38.5], // Salvador
    [-30.03, -51.23], // Porto Alegre
    [-8.05, -34.88], // Recife
  ],
  Argentina: [
    [-31.42, -64.19], // Cordoba
    [-32.95, -60.64], // Rosario
    [-32.89, -68.85], // Mendoza
  ],
  Colombia: [
    [6.24, -75.58], // Medellin
    [3.45, -76.53], // Cali
    [10.96, -74.8], // Barranquilla
  ],
  China: [
    [31.23, 121.47], // Shanghai
    [23.13, 113.26], // Guangzhou
    [22.54, 114.06], // Shenzhen
    [30.57, 104.07], // Chengdu
    [29.56, 106.55], // Chongqing
    [30.59, 114.31], // Wuhan
    [34.34, 108.94], // Xi'an
  ],
  India: [
    [19.08, 72.88], // Mumbai
    [12.97, 77.59], // Bengaluru
    [22.57, 88.36], // Kolkata
    [13.08, 80.27], // Chennai
    [17.39, 78.49], // Hyderabad
    [23.02, 72.57], // Ahmedabad
  ],
  Japan: [
    [34.69, 135.5], // Osaka
    [35.18, 136.91], // Nagoya
    [33.59, 130.4], // Fukuoka
    [43.06, 141.35], // Sapporo
  ],
  "South Korea": [
    [35.18, 129.08], // Busan
    [35.87, 128.6], // Daegu
  ],
  Vietnam: [
    [10.82, 106.63], // Ho Chi Minh City
    [16.05, 108.2], // Da Nang
  ],
  Indonesia: [
    [-7.26, 112.75], // Surabaya
    [-6.91, 107.62], // Bandung
    [3.6, 98.67], // Medan
  ],
  Australia: [
    [-33.87, 151.21], // Sydney
    [-37.81, 144.96], // Melbourne
    [-27.47, 153.03], // Brisbane
    [-31.95, 115.86], // Perth
    [-34.93, 138.6], // Adelaide
  ],
};
