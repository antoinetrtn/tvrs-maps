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
