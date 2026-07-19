/**
 * Pure gamification helpers (no React, no side effects).
 * Extracted so they can be reliably imported everywhere without bundling issues
 * tied to the useUserProfile hook module.
 */

export function getLevelAndProgress(totalXp = 0) {
  let level = 1;
  let tempXp = totalXp;
  while (true) {
    const needed = level * 200;
    if (tempXp >= needed) {
      tempXp -= needed;
      level++;
    } else {
      break;
    }
  }
  return {
    level,
    xpInLevel: tempXp,
    xpNeededForNext: level * 200,
    percent: Math.min(100, Math.floor((tempXp / (level * 200)) * 100)),
  };
}

export function getAvatarUnlockLevel(avatarId) {
  const match = avatarId.match(/^invader_(\d+)$/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (num <= 3) return 1;
    return num - 2; // invader_4 -> lvl 2, etc.
  }
  return 1;
}
