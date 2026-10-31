const STACK_PRESETS = [
  { rotateZ: 0, translateX: 0, translateY: 0, translateZ: 80, scale: 1.0, zIndex: 100 },
  { rotateZ: 0, translateX: 0, translateY: -9, translateZ: 70, scale: 0.98, zIndex: 80 },
  { rotateZ: 0, translateX: 0, translateY: -17, translateZ: 60, scale: 0.95, zIndex: 60 },
  { rotateZ: 0, translateX: 0, translateY: -17, translateZ: 40, scale: 0.92, zIndex: 40 },
  { rotateZ: 0, translateX: 0, translateY: -17, translateZ: 20, scale: 0.9, zIndex: 20 },
];

const FRONT_POSE = { rotateZ: 0, translateX: 0, translateY: 0, translateZ: 80, scale: 1.0 };

const presetFor = (stackPos) => STACK_PRESETS[stackPos] || STACK_PRESETS[4];

/** Carte du dessus : suit le doigt pendant le drag, s'envole au clic sur une flèche. */
function getTopCardPose({ dragOffset, isDragging, animatingDirection }) {
  if (animatingDirection && !isDragging) {
    const isRight = animatingDirection === "rightSwipe";
    return {
      rotateZ: isRight ? 7 : -7,
      translateX: isRight ? 140 : -140,
      translateY: 6,
      translateZ: 80,
      scale: 0.99,
      zIndex: 100,
    };
  }
  if (!isDragging) return { ...FRONT_POSE, zIndex: 100 };
  return {
    rotateZ: dragOffset * 0.05,
    translateX: dragOffset,
    translateY: Math.abs(dragOffset) * 0.04,
    translateZ: 80,
    scale: 1.02,
    zIndex: 100,
  };
}

/** Carte de la pile : prévisualise la suivante/précédente pendant le drag. */
function getStackedCardPose({ stackPos, totalModes, dragOffset, isDragging, animatingDirection }) {
  const preset = presetFor(stackPos);

  if (animatingDirection && !isDragging) {
    const targetPos = animatingDirection === "rightSwipe" ? totalModes - 1 : 1;
    return stackPos === targetPos ? { ...FRONT_POSE, zIndex: 95 } : { ...preset };
  }

  // dragOffset < 0 (swipe vers la gauche) -> révèle la suivante (stackPos === 1)
  // dragOffset > 0 (swipe vers la droite) -> révèle la précédente (stackPos === totalModes - 1)
  let previewPos = null;
  if (dragOffset < 0) previewPos = 1;
  else if (dragOffset > 0) previewPos = totalModes - 1;

  if (!isDragging || previewPos === null || stackPos !== previewPos) return { ...preset };

  const progress = Math.min(1.0, Math.abs(dragOffset) / 120);
  return {
    rotateZ: preset.rotateZ * (1 - progress),
    translateX: preset.translateX * (1 - progress),
    translateY: preset.translateY * (1 - progress),
    translateZ: preset.translateZ + (80 - preset.translateZ) * progress,
    scale: preset.scale + (1.0 - preset.scale) * progress,
    zIndex: 95,
  };
}

/** Position 3D à plat (translate/rotate/scale) d'une carte du carrousel selon son rang dans la pile. */
export function getCardPose(args) {
  return args.stackPos === 0 ? getTopCardPose(args) : getStackedCardPose(args);
}
