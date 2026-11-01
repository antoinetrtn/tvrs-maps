// Attributs du champ de réponse joueur.
// Android Chrome et Gboard utilisent une heuristique sur <input type="text">
// (attributs + mots-clés dans placeholder / aria-label / DOM voisin + .focus()
// répétés) pour proposer l'autofill d'adresse ou de carte bancaire. On coupe
// toutes les sources de suggestions : autofill navigateur, gestionnaires de
// mots de passe, correcteur, capitalisation et Gboard Writing Tools, et on
// neutralise les mots-clés déclencheurs ("pays", "country", "carte", "nom"...)
// avec un séparateur invisible (U+200B) dans les libellés proches du champ.

const sessionFieldId = `answer-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

const AUTOFILL_TRIGGER_REGEX = new RegExp(
  [
    String.raw`\b(p)(ays|lace)`,
    String.raw`\b(c)(ountr(?:y|ies)|apitale?|ard|arte|ode|ity)`,
    String.raw`\b(n)(om|ame)`,
    String.raw`\b(a)(dresse|ddress)`,
    String.raw`\b(v)(ille)`,
    String.raw`\b(é|e)(tat|tats)`,
    String.raw`\b(s)(tate)`,
    String.raw`\b(d)(épartement|epartement|epartment)`,
    String.raw`\b(r)(égion|egion)`,
  ].join("|"),
  "gi"
);

/**
 * Insère un caractère zero-width space (U+200B) au milieu des mots-clés que
 * AddressFieldParser / CreditCardFieldParser de Chrome Android / Gboard
 * détectent comme champs d'adresse ou de paiement ("pays", "country", "carte",
 * "nom", "code", "état", etc.). Le rendu visuel est strictement identique.
 */
export function shieldAutofillText(text) {
  if (typeof text !== "string" || !text) return text;
  return text.replace(AUTOFILL_TRIGGER_REGEX, (...args) => {
    const match = args[0];
    if (match.includes("\u200B")) return match;
    return `${match.slice(0, 1)}\u200B${match.slice(1)}`;
  });
}

/**
 * Focus le champ de réponse uniquement s'il n'a pas déjà le focus actif, et
 * avec preventScroll: true pour éviter que Chrome Android ne réévalue la vue
 * via AutofillManager.notifyViewEntered lors d'un clic sur un pays du globe.
 */
export function focusAnswerInputSafely(inputOrRef) {
  const el = inputOrRef && "current" in inputOrRef ? inputOrRef.current : inputOrRef;
  if (!el || typeof el.focus !== "function") return false;
  if (typeof document !== "undefined" && document.activeElement === el) {
    return false;
  }
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  return true;
}

export const ANSWER_INPUT_PROPS = Object.freeze({
  type: "text",
  inputMode: "text",
  name: sessionFieldId,
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  writingsuggestions: "false",
  enterKeyHint: "done",
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-form-type": "other",
  "data-bwignore": "true",
  "data-dashlane-ignore": "true",
});
