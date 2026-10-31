import React from "react";

import { setGlobePref, useGlobePrefs } from "../globe/globePrefs";
import {
  hasWebGPUSupport,
  isRendererForcedByUrl,
  resolveGlobeRenderer,
} from "../globe/render/globeRendererFlag";
import { SettingsRow } from "./ui/Settings";
import Switch from "./ui/Switch";

/** Globe-only display rows of the settings sheet (renderer). */
const GlobeDisplaySettings = ({ t }) => {
  const prefs = useGlobePrefs();
  const supported = hasWebGPUSupport();
  const forced = isRendererForcedByUrl();
  const isWebGPU = resolveGlobeRenderer({ preference: prefs.renderer }) === "webgpu";
  let visibleDesc;
  let srDesc = t("renderer_webgpu_desc");
  if (!supported) {
    visibleDesc = t("renderer_webgpu_unsupported_short");
    srDesc = t("renderer_webgpu_unsupported");
  } else if (forced) {
    visibleDesc = t("renderer_webgpu_forced_short");
    srDesc = t("renderer_webgpu_forced");
  }

  return (
    <>
      <SettingsRow label={t("renderer_webgpu")} description={visibleDesc} srDescription={srDesc}>
        <Switch
          checked={isWebGPU}
          disabled={!supported || forced}
          onChange={(on) => setGlobePref("renderer", on ? "webgpu" : "webgl")}
          label={t("renderer_webgpu")}
        />
      </SettingsRow>
    </>
  );
};

export default GlobeDisplaySettings;
