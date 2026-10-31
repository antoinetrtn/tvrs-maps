/**
 * Category metadata and localized labels for the Conquête knowledge escalation QCM.
 * Category-agnostic fallback supports any future server category while knowing the
 * 4 canonical categories: tech, nature, musique, culture.
 */
export const KNOWLEDGE_CATEGORIES = {
  tech: { fr: "Tech", en: "Tech", iconId: "tech-cpu" },
  nature: { fr: "Faune & flore", en: "Wildlife & flora", iconId: "plant-tree" },
  musique: { fr: "Musique", en: "Music", iconId: "music-note" },
  culture: { fr: "Culture générale", en: "General knowledge", iconId: "symbol-star" },
  societe: { fr: "Société", en: "Society", iconId: "landmark-column" },
  science: { fr: "Sciences", en: "Science", iconId: "mineral-crystal" },
};

/** Returns the localized label for a knowledge category (defaults to French). */
export function getCategoryLabel(category, lang = "fr") {
  const key = String(category || "")
    .trim()
    .toLowerCase();
  const entry = KNOWLEDGE_CATEGORIES[key];
  const locale = lang === "en" ? "en" : "fr";
  if (entry) return entry[locale];
  if (!key) return KNOWLEDGE_CATEGORIES.culture[locale];
  return `${key.charAt(0).toUpperCase()}${key.slice(1)}`;
}
