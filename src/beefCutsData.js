const makeCut = (code, key, name_fr, name_en, x, y, aliases = []) => [
  key,
  {
    code,
    name_fr,
    name_en,
    capital: 'Boeuf',
    capital_fr: 'Bœuf',
    aliases,
    region: 'Boeuf',
    lat: y,
    lng: x,
    x,
    y
  }
];

export const beefCutsDataMap = Object.fromEntries([
  makeCut('01', 'basses_cotes', 'Basses côtes', 'Chuck ribs', 232.8784, 49.528126, ['basses cotes', 'basse cote', 'basses-côtes']),
  makeCut('02', 'cotes_entrecotes', 'Côtes, entrecôtes', 'Ribs, ribeye', 185.1573, 67.344002, ['cotes', 'côte', 'cote', 'entrecote', 'entrecôte']),
  makeCut('03', 'faux_filet', 'Faux-filet', 'Striploin', 153.34325, 65.435158, ['faux filet', 'striploin', 'contre filet']),
  makeCut('04', 'filet', 'Filet', 'Tenderloin', 111.47111, 83.18708, ['tenderloin']),
  makeCut('05', 'rumsteck', 'Rumsteck', 'Rump steak', 82.079758, 51.43697, ['rump steak', 'rumsteak']),
  makeCut('06', 'rond_de_gite', 'Rond de gîte', 'Eye of round', 22.269321, 99.794342, ['rond de gite', 'eye of round']),
  makeCut('07', 'tende_de_tranche', 'Tende de tranche', 'Top round', 55.355942, 91.522682, ['poire', 'merlan', 'top round']),
  makeCut('08', 'gite_a_la_noix', 'Gîte à la noix', 'Knuckle', 40.085194, 118.2465, ['gite a la noix', 'knuckle']),
  makeCut('09', 'araignee', 'Araignée', 'Spider steak', 54.719662, 123.97303, ['araignee', 'spider steak']),
  makeCut('10', 'plat_de_tranche', 'Plat de tranche', 'Bottom round', 65.536446, 137.97121, ['rond de tranche', 'mouvant', 'bottom round']),
  makeCut('11', 'bavette_d_aloyau', "Bavette d'aloyau", 'Sirloin flap', 91.733139, 132.88097, ['bavette daloyau', 'bavette d aloyau', 'sirloin flap']),
  makeCut('12', 'hampe', 'Hampe', 'Skirt steak', 63.79483, 142.19594, ['skirt steak']),
  makeCut('13', 'onglet', 'Onglet', 'Hanger steak', 104.72232, 97.076096, ['hanger steak']),
  makeCut('14', 'aiguillette_baronne', 'Aiguillette baronne', 'Rump cap', 83.353, 88.978, ['aiguillette', 'baronne', 'rump cap']),
  makeCut('15', 'bavette_de_flanchet', 'Bavette de flanchet', 'Flank steak', 131.70969, 118.2465, ['flank steak']),
  makeCut('16', 'plat_de_cotes', 'Plat de côtes', 'Short ribs', 180.06706, 114.42881, ['plat de cotes', 'short ribs']),
  makeCut('17', 'macreuse_a_bifteck', 'Macreuse à bifteck', 'Chuck tender', 220.78906, 111.24741, ['macreuse a bifteck', 'chuck tender']),
  makeCut('18', 'paleron', 'Paleron', 'Shoulder blade', 240.51378, 90.250122, ['shoulder blade']),
  makeCut('19', 'jumeau_a_bifteck', 'Jumeau à bifteck', 'Shoulder tender', 267.87387, 96.612938, ['jumeau a bifteck', 'shoulder tender']),
  makeCut('20', 'jumeau_a_pot_au_feu', 'Jumeau à pot-au-feu', 'Stewing shoulder', 265.96503, 130.97212, ['jumeau a pot au feu', 'pot au feu']),
  makeCut('21', 'macreuse_a_pot_au_feu', 'Macreuse à pot-au-feu', 'Stewing chuck', 242.42262, 130.97212, ['macreuse a pot au feu', 'pot au feu']),
  makeCut('22', 'queue', 'Queue', 'Tail', 22.250591, 44.509586, ['oxtail', 'tail']),
  makeCut('23', 'gite', 'Gîte', 'Shank', 43.266602, 167.87643, ['gite', 'jarret', 'shank']),
  makeCut('24', 'flanchet', 'Flanchet', 'Flank', 122.80175, 143.06146, ['flank']),
  makeCut('25', 'tendron', 'Tendron, milieu de poitrine', 'Breast', 183.88475, 145.60658, ['tendron', 'milieu de poitrine', 'poitrine', 'breast']),
  makeCut('26', 'gros_bout_de_poitrine', 'Gros bout de poitrine', 'Brisket point', 288.87115, 135.42609, ['brisket', 'poitrine']),
  makeCut('27', 'collier', 'Collier', 'Neck', 288.23486, 73.070534, ['cou', 'neck']),
  makeCut('28', 'plat_de_joue', 'Plat de joue', 'Cheek', 328.32059, 79.433342, ['joue', 'cheek']),
  makeCut('29', 'langue', 'Langue', 'Tongue', 358.2258, 85.796158, ['tongue'])
]);
