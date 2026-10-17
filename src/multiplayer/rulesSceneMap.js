import { CaptureScene, MatchScene, ShieldScene, StealScene } from "./rulesScenes";
import { BonusScene, EloScene, EndScene, FailedStealScene } from "./rulesScenesB";

/** Rule id → animated scene (ids match conquestRulesText sections). */
export const SCENES = {
  match: MatchScene,
  capture: CaptureScene,
  shield: ShieldScene,
  steal: StealScene,
  failedSteal: FailedStealScene,
  bonus: BonusScene,
  end: EndScene,
  elo: EloScene,
};
