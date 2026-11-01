import React from "react";

import GlobeMap from "../globe/GlobeMapHost.jsx";
import GameHUD from "./GameHUD.jsx";

const EndScreen = React.lazy(() => import("./EndScreen.jsx"));
const GameDataPanel = React.lazy(() => import("./GameDataPanel.jsx"));

const GameSessionView = ({
  showEndScreen,
  showHud,
  hudProps,
  globeProps,
  endScreenProps,
  gamePanelOpen,
  isMobileViewport,
  closePanel,
  panelProps,
}) => (
  <>
    {showHud && <GameHUD {...hudProps} />}
    <GlobeMap {...globeProps} globeLightingEnabled isPanelOpen={gamePanelOpen} />
    {showEndScreen && (
      <React.Suspense fallback={null}>
        <EndScreen {...endScreenProps} />
      </React.Suspense>
    )}
    {gamePanelOpen && (
      <>
        {(isMobileViewport || panelProps?.variant === "overlay") && (
          <div
            className="panel-overlay open game-panel-overlay"
            onClick={closePanel}
            aria-hidden="true"
          />
        )}
        <React.Suspense fallback={null}>
          <GameDataPanel {...panelProps} />
        </React.Suspense>
      </>
    )}
  </>
);

export default React.memo(GameSessionView);
