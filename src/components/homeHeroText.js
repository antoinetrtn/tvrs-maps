import { HOME_CONQUEST_KEY } from "./homeModes";

/** Home hero tagline (FR/EN). */
const HOME_HERO_TEXT = {
  fr: {
    title: "Le monde\nen 15 minutes.",
    sub: "236 pays à retrouver sur le globe. Combien en connais-tu ?",
  },
  en: {
    title: "The world\nin 15 minutes.",
    sub: "236 countries to find on the globe. How many do you know?",
  },
};

export const getHomeHeroText = (lang) => HOME_HERO_TEXT[lang] || HOME_HERO_TEXT.fr;

export const getGameModesMetadata = ({
  countriesCount = 0,
  capitalsCount = 0,
  departmentsCount = 0,
  usStatesCount = 0,
  riversMountainsCount = 0,
  includeConquest = false,
} = {}) => {
  const conquestCard = {
    key: HOME_CONQUEST_KEY,
    titleFr: "Conquête\n1v1",
    titleEn: "Conquest\n1v1",
    descFr: "Duel en ligne : capturez des pays, volez ceux de l'adversaire.",
    descEn: "Online duel: capture countries, steal your opponent's.",
    badgeFr: "1V1",
    badgeEn: "1V1",
    countLabelFr: "1V1 en ligne",
    countLabelEn: "Online 1v1",
  };

  return [
    ...(includeConquest ? [conquestCard] : []),
    {
      key: "countries",
      titleFr: "Pays du\nMonde",
      titleEn: "World\nCountries",
      descFr: `${countriesCount} pays et territoires à localiser sur le globe 3D interactif.`,
      descEn: `${countriesCount} countries and territories to locate on the interactive 3D globe.`,
      badgeFr: `${countriesCount}`,
      badgeEn: `${countriesCount}`,
      countLabelFr: `${countriesCount} pays`,
      countLabelEn: `${countriesCount} countries`,
    },
    {
      key: "capitals",
      titleFr: "Capitales du\nMonde",
      titleEn: "World\nCapitals",
      descFr: `Retrouvez la capitale de chaque pays et territoire (${capitalsCount} au total).`,
      descEn: `Find the capital of every country and territory (${capitalsCount} total).`,
      badgeFr: `${capitalsCount}`,
      badgeEn: `${capitalsCount}`,
      countLabelFr: `${capitalsCount} capitales`,
      countLabelEn: `${capitalsCount} capitals`,
    },
    {
      key: "departments",
      titleFr: "Départements\nFrançais",
      titleEn: "French\nDepartments",
      descFr: `Placement des ${departmentsCount} départements et collectivités d'Outre-mer.`,
      descEn: `Locate all ${departmentsCount} French departments across mainland & overseas.`,
      badgeFr: `${departmentsCount}`,
      badgeEn: `${departmentsCount}`,
      countLabelFr: `${departmentsCount} départements`,
      countLabelEn: `${departmentsCount} departments`,
    },
    {
      key: "us_states",
      titleFr: "États\nAméricains",
      titleEn: "US\nStates",
      descFr: `Testez vos connaissances sur les ${usStatesCount} États américains.`,
      descEn: `Test your knowledge on all ${usStatesCount} US States.`,
      badgeFr: `${usStatesCount}`,
      badgeEn: `${usStatesCount}`,
      countLabelFr: `${usStatesCount} états`,
      countLabelEn: `${usStatesCount} states`,
    },
    {
      key: "rivers_mountains",
      titleFr: "Montagnes &\nFleuves",
      titleEn: "Rivers &\nMountains",
      descFr: `${riversMountainsCount} reliefs majeurs : chaînes de montagnes et grands fleuves du monde.`,
      descEn: `${riversMountainsCount} major reliefs: mountain ranges and famous rivers.`,
      badgeFr: `${riversMountainsCount}`,
      badgeEn: `${riversMountainsCount}`,
      countLabelFr: `${riversMountainsCount} reliefs et fleuves`,
      countLabelEn: `${riversMountainsCount} reliefs and rivers`,
    },
  ];
};
