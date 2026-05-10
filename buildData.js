import fs from 'fs';

// Fetch geojson and then restcountries, merge them into gameData.js
async function run() {
  const geo = await fetch('https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_0_countries.json').then(r => r.json());
  
  const rest = await fetch('https://raw.githubusercontent.com/mledoze/countries/master/countries.json').then(r => r.json());
  
  const restMap = {};
  rest.forEach(c => {
    restMap[c.cca2] = c;
    if (c.cca3) restMap[c.cca3] = c;
  });

  const finalMap = {};

  const capitalTranslations = {
    "Brussels": "Bruxelles", "Vienna": "Vienne", "Copenhagen": "Copenhague", "Warsaw": "Varsovie",
    "Lisbon": "Lisbonne", "London": "Londres", "Athens": "Athènes", "Moscow": "Moscou", "Beijing": "Pékin",
    "Havana": "La Havane", "Damascus": "Damas", "Jerusalem": "Jérusalem", "Beirut": "Beyrouth",
    "Seoul": "Séoul", "Riyadh": "Riyad", "Tehran": "Téhéran", "Algiers": "Alger", "Cairo": "Le Caire",
    "Kabul": "Kaboul", "Baghdad": "Bagdad", "Cape Town": "Le Cap", "Bogotá": "Bogota", "Bucharest": "Bucarest",
    "Reykjavik": "Reykjavik", "Damascus": "Damas", "Kiev": "Kiev", "Tashkent": "Tachkent", "Asuncion": "Asuncion"
  };
  
  geo.features.forEach(f => {
    const admin = f.properties.ADMIN;
    const iso2 = f.properties.ISO_A2;
    const iso3 = f.properties.ISO_A3;
    
    let match = restMap[iso2] || restMap[iso3];
    if (!match && admin === 'France') match = restMap['FR']; 
    if (!match && admin === 'Norway') match = restMap['NO'];

    if (match) {
        const capital = match.capital ? match.capital[0] : null;
        let lat = null, lng = null;
        if (match.latlng) {
            lat = match.latlng[0];
            lng = match.latlng[1];
        }
        
        let capital_fr = capital;
        if (capital && capitalTranslations[capital]) {
           capital_fr = capitalTranslations[capital];
        }

        finalMap[admin] = {
            iso2: iso2,
            name_en: match.translations?.eng?.common || match.name.common,
            name_fr: match.translations?.fra?.common || admin,
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
