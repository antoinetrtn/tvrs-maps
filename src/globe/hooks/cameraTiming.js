export const CAMERA_MS = {
  endScreen: 700,
  home: 550,
  gameStart: 650,
  customPov: 500,
  select: 360,
  selectHome: 650,
  nudgeMobile: 340,
  nudgeDesktop: 180,
};

export function cameraDuration(ms, reduced) {
  return reduced ? 0 : ms;
}

export function selectCameraDuration({ isHomeScreen, onlyViewportNudge, isMobile }) {
  if (isHomeScreen) {
    return CAMERA_MS.selectHome;
  }
  if (onlyViewportNudge) {
    return isMobile ? CAMERA_MS.nudgeMobile : CAMERA_MS.nudgeDesktop;
  }
  return CAMERA_MS.select;
}
