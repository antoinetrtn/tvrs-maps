/** Localized labels of the knowledge ladder categories (levels 3 to 5 + fallback). */
const LABELS = {
  tech: ["Tech", "Tech"],
  nature: ["Faune & flore", "Wildlife & flora"],
  musique: ["Musique", "Music"],
  culture: ["Culture générale", "General knowledge"],
};

/** Returns the localized label for a knowledge category (defaults to French). */
export function getCategoryLabel(category, lang = "fr") {
  const entry = LABELS[String(category || "").toLowerCase()] || LABELS.culture;
  return entry[lang === "en" ? 1 : 0];
}
