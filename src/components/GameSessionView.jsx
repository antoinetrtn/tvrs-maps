import React from "react";
import GameHUD from "./GameHUD.jsx";
import GlobeMap from "../GlobeMap.jsx";
import EndScreen from "./EndScreen.jsx";
import GameDataPanel from "./GameDataPanel.jsx";

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
    {showEndScreen && <EndScreen {...endScreenProps} />}
    {gamePanelOpen && (
      <>
        {(isMobileViewport || panelProps?.variant === "overlay") && (
          <div
            className="panel-overlay open game-panel-overlay"
            onClick={closePanel}
            aria-hidden="true"
          />
        )}
        <GameDataPanel {...panelProps} />
      </>
    )}
  </>
);

export default React.memo(GameSessionView);