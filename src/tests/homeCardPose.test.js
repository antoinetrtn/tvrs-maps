import { describe, expect, it } from "vitest";

import { getCardPose } from "../components/homeCardPose";

const base = { totalModes: 6, dragOffset: 0, isDragging: false, animatingDirection: null };

describe("getCardPose", () => {
  it("carte du dessus au repos : à plat devant", () => {
    expect(getCardPose({ ...base, stackPos: 0 })).toMatchObject({
      translateX: 0,
      rotateZ: 0,
      scale: 1,
      zIndex: 100,
    });
  });

  it("carte du dessus pendant un drag : suit le doigt", () => {
    const pose = getCardPose({ ...base, stackPos: 0, isDragging: true, dragOffset: 100 });
    expect(pose).toMatchObject({ translateX: 100, rotateZ: 5, translateY: 4, scale: 1.02 });
  });

  it("carte du dessus lors d'un clic flèche : s'envole du bon côté", () => {
    expect(getCardPose({ ...base, stackPos: 0, animatingDirection: "rightSwipe" }).translateX).toBe(
      140
    );
    expect(getCardPose({ ...base, stackPos: 0, animatingDirection: "leftSwipe" }).translateX).toBe(
      -140
    );
  });

  it("la carte suivante est révélée par un drag vers la gauche", () => {
    const rest = getCardPose({ ...base, stackPos: 1 });
    const half = getCardPose({ ...base, stackPos: 1, isDragging: true, dragOffset: -60 });
    expect(rest.zIndex).toBe(80);
    expect(half.zIndex).toBe(95);
    expect(half.rotateZ).toBeCloseTo(rest.rotateZ * 0.5);
  });

  it("la dernière carte passe devant lors d'un swipe vers la droite", () => {
    const pose = getCardPose({ ...base, stackPos: 5, animatingDirection: "rightSwipe" });
    expect(pose).toMatchObject({ translateZ: 80, zIndex: 95, rotateZ: 0 });
  });

  it("les rangs au-delà des presets retombent sur le dernier preset", () => {
    expect(getCardPose({ ...base, stackPos: 5 }).zIndex).toBe(20);
  });
});
