import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ANSWER_INPUT_PROPS } from "../utils/answerField";

// Régression Android (barre clavier proposant l'autofill carte bancaire) :
// chaque champ de saisie de pays doit étaler ANSWER_INPUT_PROPS.
const FILES = [
  "src/components/GameHUD.jsx",
  "src/multiplayer/ConquestHud.jsx",
  "src/multiplayer/ConquestStealPanel.jsx",
];

describe("champs de saisie de pays", () => {
  it("figent les attributs anti-autofill", () => {
    expect(ANSWER_INPUT_PROPS).toMatchObject({
      type: "text",
      inputMode: "text",
      autoComplete: "off",
      autoCorrect: "off",
      autoCapitalize: "off",
      spellCheck: false,
      "data-lpignore": "true",
      "data-1p-ignore": "true",
      "data-form-type": "other",
    });
  });

  it.each(FILES)("%s utilise ANSWER_INPUT_PROPS", (file) => {
    const src = readFileSync(file, "utf8");
    expect(src).toContain("{...ANSWER_INPUT_PROPS}");
    expect(src).not.toMatch(/autoComplete="(on|one-time-code|cc-|new-password)/);
  });
});
