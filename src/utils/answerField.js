/**
 * Attributes for the free-text answer input. Goal: no autofill history,
 * no password-manager prompt, no SMS-code bar, no auto-capitalisation.
 *
 * - type="text" (not "search"): search fields get a clear button and, on some
 *   Android keyboards, a "search" action instead of "done".
 * - autocomplete="off": the documented way to opt out of autofill
 *   (HTML spec / MDN). "one-time-code" was a hack: iOS then offers SMS codes
 *   in the QuickType bar and Android may surface OTP autofill.
 * - A random `name` per page session: Chrome keys its autocomplete history by
 *   field name and sometimes ignores autocomplete="off"; a fresh name gives
 *   it nothing to match.
 * - autoCorrect/autoCapitalize/spellCheck off: honoured by iOS Safari and
 *   Chrome. Gboard's own predictions can still appear (keyboard-side).
 */
const randomSuffix = () => {
  const bytes = new Uint8Array(6);
  globalThis.crypto?.getRandomValues?.(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("");
};

const ANSWER_FIELD_NAME = `answer-${randomSuffix()}`;

export const ANSWER_INPUT_PROPS = Object.freeze({
  type: "text",
  name: ANSWER_FIELD_NAME,
  inputMode: "text",
  enterKeyHint: "done",
  autoComplete: "off",
  autoCorrect: "off",
  autoCapitalize: "off",
  spellCheck: false,
  "data-lpignore": "true",
  "data-1p-ignore": "true",
  "data-form-type": "other",
});
