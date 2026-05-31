
export const getGameStats = (foundList, countryDataMap, lang = 'fr') => {
  const baseOrder = ["Europe", "Americas", "Asia", "Africa", "Oceania", "Antarctic", "France", "Unknown"];
  const dynamicRegions = Object.values(countryDataMap)
    .map(item => item?.region)
    .filter(Boolean);
  const CONTINENT_ORDER = Array.from(new Set([...baseOrder, ...dynamicRegions]));
  const s = {};
  CONTINENT_ORDER.forEach(reg => s[reg] = { total: 0, found: 0, countries: [] });
  
  Object.keys(countryDataMap).forEach(k => {
    const country = countryDataMap[k];
    let reg = country?.region;
    if (!reg || !s[reg]) reg = 'Unknown';
    
    s[reg].total++;
    const isFound = foundList.includes(k);
    if (isFound) s[reg].found++;
    s[reg].countries.push({
      key: k,
      found: isFound,
      name: lang === 'fr' ? (country.name_fr || k) : (country.name_en || k),
      capital: lang === 'fr' ? (country.capital_fr || country.capital) : country.capital
    });
  });

  CONTINENT_ORDER.forEach(reg => {
    s[reg].countries.sort((a, b) => {
      if (a.found !== b.found) return a.found ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  return { stats: s, CONTINENT_ORDER };
};
