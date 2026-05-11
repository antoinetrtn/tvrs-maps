import fs from 'fs';

// Fetch geojson and then restcountries, merge them into gameData.js
async function run() {
  const geo = await fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_0_countries.json').then(r => r.json());
  
  // Use official restcountries.com API for the most accurate and up-to-date data (especially capital coordinates)
  const rest = await fetch('https://restcountries.com/v3.1/all?fields=name,capital,latlng,capitalInfo,cca2,cca3,translations,region').then(r => r.json());
  
  const restMap = {};
  rest.forEach(c => {
    if (c.cca2) restMap[c.cca2] = c;
    if (c.cca3) restMap[c.cca3] = c;
  });

  const finalMap = {};

  const capitalTranslations = {
    // Europe
    "Brussels": "Bruxelles", "Vienna": "Vienne", "Copenhagen": "Copenhague", "Warsaw": "Varsovie",
    "Lisbon": "Lisbonne", "London": "Londres", "Athens": "Athènes", "Moscow": "Moscou",
    "Bucharest": "Bucarest", "Reykjavik": "Reykjavik", "Kiev": "Kiev", "Bern": "Berne",
    "Nicosia": "Nicosie", "Valletta": "La Valette", "Andorra la Vella": "Andorre-la-Vieille",
    "Luxembourg": "Luxembourg", "Monaco": "Monaco", "San Marino": "Saint-Marin", "Vatican City": "Vatican",
    
    // Asia
    "Beijing": "Pékin", "Seoul": "Séoul", "Tokyo": "Tokyo", "Riyadh": "Riyad", "Tehran": "Téhéran",
    "Kabul": "Kaboul", "Baghdad": "Bagdad", "Damascus": "Damas", "Beirut": "Beyrouth",
    "Jerusalem": "Jérusalem", "Amman": "Amman", "Kuwait City": "Koweït", "Muscat": "Mascate",
    "Abu Dhabi": "Abou Dabi", "Doha": "Doha", "Manama": "Manama", "Baku": "Bakou",
    "Yerevan": "Erevan", "Tbilisi": "Tbilissi", "Astana": "Astana", "Tashkent": "Tachkent",
    "Ashgabat": "Achgabat", "Dushanbe": "Douchanbé", "Bishkek": "Bichkek", "Kathmandu": "Katmandou",
    "Dhaka": "Dacca", "Colombo": "Colombo", "Thimphu": "Thimphou", "Naypyidaw": "Naypyidaw",
    "Bangkok": "Bangkok", "Vientiane": "Vientiane", "Phnom Penh": "Phnom Penh", "Hanoi": "Hanoï",
    "Kuala Lumpur": "Kuala Lumpur", "Singapore": "Singapour", "Jakarta": "Jakarta", "Manila": "Manille",
    "Ulan Bator": "Oulan-Bator", "Dili": "Dili", "Male": "Malé",
    
    // Americas
    "Havana": "La Havane", "Bogotá": "Bogota", "Asuncion": "Asuncion", "Mexico City": "Mexico",
    "Washington, D.C.": "Washington", "Washington D.C.": "Washington", "Ottawa": "Ottawa",
    "San José": "San José", "Panama City": "Panama", "Guatemala City": "Guatemala",
    "Port-au-Prince": "Port-au-Prince", "Santo Domingo": "Saint-Domingue", "Kingston": "Kingston",
    "Port of Spain": "Port-d'Espagne", "Georgetown": "Georgetown", "Paramaribo": "Paramaribo",
    "Cayenne": "Cayenne", "Saint George's": "Saint-Georges", "St. George's": "Saint-Georges",
    
    // Africa
    "Algiers": "Alger", "Cairo": "Le Caire", "Tunis": "Tunis", "Rabat": "Rabat", "Tripoli": "Tripoli",
    "Addis Ababa": "Addis-Abeba", "Nairobi": "Nairobi", "Mogadishu": "Mogadiscio", "Khartoum": "Khartoum",
    "Antananarivo": "Antananarivo", "Port Louis": "Port-Louis", "Cape Town": "Le Cap", "Pretoria": "Pretoria",
    "Johannesburg": "Johannesburg", "Dakar": "Dakar", "Abidjan": "Abidjan", "Yamoussoukro": "Yamoussoukro",
    "Accra": "Accra", "Lagos": "Lagos", "Abuja": "Abuja", "Kinshasa": "Kinshasa", "Brazzaville": "Brazzaville",
    "Luanda": "Luanda", "Libreville": "Libreville", "Yaoundé": "Yaoundé", "Bangui": "Bangui",
    "N'Djamena": "N'Djaména", "Niamey": "Niamey", "Bamako": "Bamako", "Ouagadougou": "Ouagadougou",
    "Nouakchott": "Nouakchott", "Conakry": "Conakry", "Freetown": "Freetown", "Monrovia": "Monrovia",
    "Lomé": "Lomé", "Porto-Novo": "Porto-Novo", "Banjul": "Banjul", "Bissau": "Bissau", "Malabo": "Malabo",
    
    // Oceania
    "Canberra": "Canberra", "Wellington": "Wellington", "Port Vila": "Port-Vila", "Suva": "Suva",
    "Apia": "Apia", "Nuku'alofa": "Nuku'alofa", "Honiara": "Honiara"
  };

  const countryNameOverrides = {
    "Democratic Republic of the Congo": {
      name_en: "DR Congo",
      name_fr: "République Démocratique du Congo"
    },
    "Republic of the Congo": {
      name_en: "Congo",
      name_fr: "République du Congo"
    },
    "Vietnam": {
      name_en: "Vietnam",
      name_fr: "Vietnam"
    },
    "Cote d'Ivoire": {
      name_en: "Ivory Coast",
      name_fr: "Côte d'Ivoire"
    },
    "Curaçao": {
       name_en: "Curaçao",
       name_fr: "Curaçao"
    },
    "Palestine": {
       name_en: "Palestine",
       name_fr: "Palestine"
    },
    "Cape Verde": {
       name_en: "Cape Verde",
       name_fr: "Cap-Vert"
    },
    "Palau": {
       name_en: "Palau",
       name_fr: "Palaos"
    },
    "Aland": {
       name_en: "Åland Islands",
       name_fr: "Åland"
    },
    "Myanmar": {
       name_en: "Myanmar",
       name_fr: "Myanmar"
    },
    "Swaziland": {
       name_en: "Eswatini",
       name_fr: "Eswatini"
    },
    "Western Sahara": {
       name_en: "Western Sahara",
       name_fr: "Sahara occidental"
    },
    "Sint Maarten": {
       name_en: "Sint Maarten",
       name_fr: "Saint-Martin néerlandais"
    }
  };
  
  geo.features.forEach(f => {
    const admin = f.properties.ADMIN;
    const iso2 = f.properties.ISO_A2;
    const iso3 = f.properties.ISO_A3;
    
    let match = restMap[iso2] || restMap[iso3];
    if (!match && admin === 'France') match = restMap['FR']; 
    if (!match && admin === 'Norway') match = restMap['NO'];

    if (match) {
        let capital = match.capital?.length ? match.capital[0] : null;
        
        // Use capital-specific coordinates if available in match (restcountries)
        // Note: capitalInfo.latlng is the standard field for capital coords in restcountries
        let lat = null, lng = null;
        if (match.capitalInfo?.latlng) {
            lat = match.capitalInfo.latlng[0];
            lng = match.capitalInfo.latlng[1];
        } else if (match.latlng) {
            lat = match.latlng[0];
            lng = match.latlng[1];
        }
        
        // Natural Earth Fallback for common mismatches or missing capital info
        // (LABEL_X/LABEL_Y are often better for centroids, but here we want capitals)
        // If the country has a known capital point in properties, we could use it, 
        // but Natural Earth's main country file usually has LABEL_X/LABEL_Y.
        
        let capital_fr = capital;
        if (capital && capitalTranslations[capital]) {
           capital_fr = capitalTranslations[capital];
        }

        let name_en = match.translations?.eng?.common || match.name.common;
        let name_fr = match.translations?.fra?.common || admin;

        if (countryNameOverrides[admin]) {
           if (countryNameOverrides[admin].name_en) name_en = countryNameOverrides[admin].name_en;
           if (countryNameOverrides[admin].name_fr) name_fr = countryNameOverrides[admin].name_fr;
        } else if (countryNameOverrides[name_en]) {
           if (countryNameOverrides[name_en].name_en) name_en = countryNameOverrides[name_en].name_en;
           if (countryNameOverrides[name_en].name_fr) name_fr = countryNameOverrides[name_en].name_fr;
        }

        // Fix specific known issues from restcountries/NaturalEarth
        if (name_fr === "Viêt Nam") name_fr = "Vietnam";
        if (name_fr === "République démocratique du Congo") name_fr = "République Démocratique du Congo";
        if (name_fr === "République du Congo") name_fr = "République du Congo";

        // Use restcountries ISO code primarily to fix flags (e.g. France -99 -> FR)
        let finalIso2 = match.cca2 || iso2;
        if (admin === "France") finalIso2 = "FR";

        // Hard fix for French Southern and Antarctic Lands (restcountries has wrong capital latlng)
        if (admin === "French Southern and Antarctic Lands" || finalIso2 === "TF") {
           lat = -49.35;
           lng = 70.21;
           name_fr = "Terres australes et antarctiques françaises";
        }
        
        // Ensure Paris is perfectly placed
        if (finalIso2 === "FR") {
           lat = 48.8566;
           lng = 2.3522;
        }

        // restcountries currently exposes the Western Sahara capital coordinates
        // with latitude/longitude inverted in this dataset path.
        if (finalIso2 === "EH" || admin === "Western Sahara") {
           lat = 27.15;
           lng = -13.2;
           name_fr = "Sahara occidental";
        }

        if (finalIso2 === "GD" || admin === "Grenada") {
           lat = 12.05;
           lng = -61.75;
        }

        if (finalIso2 === "MO" || admin === "Macao S.A.R") {
           capital = "Macao";
           capital_fr = "Macao";
           lat = 22.16666666;
           lng = 113.55;
           name_fr = "Macao";
        }

        finalMap[admin] = {
            iso2: finalIso2,
            name_en: name_en,
            name_fr: name_fr,
            capital: capital,
            capital_fr: capital_fr,
            lat: lat,
            lng: lng,
            region: match.region || 'Unknown'
        };
    }
  });

  const fileContent = `
// Auto-generated geographic mapping dataset 
export const countryDataMap = ${JSON.stringify(finalMap, null, 2)};

export const normalizeString = (str) => {
  if (!str) return "";
  return str.toString().normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toLowerCase().trim();
};
`;

  fs.writeFileSync('src/gameData.js', fileContent);
  console.log("gameData.js populated with " + Object.keys(finalMap).length + " countries.");
}
run();
