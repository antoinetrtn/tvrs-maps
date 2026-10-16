/* Dev-only component gallery (#/dev/components). Never bundled in production:
   main.jsx only imports it behind `import.meta.env.DEV`. */
import "../components/ui/ui.css";
import "../components/PassportStamp.css";
import "../multiplayer/ConquestScreen.css";
import "./DevGallery.css";

import { Close, Settings2, User } from "pixelarticons/react";
import React, { useState } from "react";

import AtlasState from "../components/AtlasState";
import GlassIconButton from "../components/GlassIconButton";
import InvaderAvatar from "../components/InvaderAvatar";
import LeaderboardRow, { LeaderboardList, LeaderboardNotice } from "../components/LeaderboardRow";
import OptionGroup from "../components/ui/OptionGroup";
import { SettingsRow, SettingsSection } from "../components/ui/Settings";
import Slider from "../components/ui/Slider";
import Switch from "../components/ui/Switch";
import { ACCENT_PRESETS, getAccentOverrides } from "../config/accentPresets";
import { getThemeCssVariables } from "../config/designSystem";

const kebab = (key) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

/** Accent tokens as scoped CSS variables, so 6 accents render side by side. */
const accentVars = (id) =>
  Object.fromEntries(
    Object.entries(getAccentOverrides(id)).map(([key, value]) => [`--${kebab(key)}`, value])
  );

const Block = ({ title, children }) => (
  <div className="dg-block">
    <h3 className="dg-block-title">{title}</h3>
    <div className="dg-block-body">{children}</div>
  </div>
);

const AccentColumn = ({ id }) => {
  const [on, setOn] = useState(true);
  const [minutes, setMinutes] = useState(10);
  const [lang, setLang] = useState("fr");
  return (
    <section className="dg-column" style={accentVars(id)} aria-label={id}>
      <h2 className="dg-column-title">{ACCENT_PRESETS[id].label.fr}</h2>
      <Block title="Button">
        <button type="button" className="btn-primary">
          Jouer
        </button>
        <button type="button" className="btn-secondary">
          Secondaire
        </button>
        <button type="button" className="btn-secondary" disabled>
          Désactivé
        </button>
      </Block>
      <Block title="GlassIconButton">
        <GlassIconButton title="Réglages">
          <Settings2 width={20} height={20} />
        </GlassIconButton>
        <GlassIconButton title="Profil">
          <User width={20} height={20} />
        </GlassIconButton>
        <button type="button" className="panel-close-btn" title="Fermer">
          <Close width={20} height={20} />
        </button>
      </Block>
      <Block title="Switch">
        <Switch checked={on} onChange={setOn} label="Démo" />
        <Switch checked={!on} onChange={(v) => setOn(!v)} label="Démo inverse" />
        <Switch checked disabled label="Désactivé" />
      </Block>
      <Block title="Slider">
        <Slider
          value={minutes}
          onChange={setMinutes}
          min={1}
          max={30}
          label="Durée"
          formatValue={(v) => `${v} min`}
        />
      </Block>
      <Block title="OptionGroup">
        <OptionGroup
          label="Langue"
          value={lang}
          onChange={setLang}
          options={[
            { value: "fr", label: "Français" },
            { value: "en", label: "English" },
          ]}
        />
      </Block>
      <Block title="SettingsSection / Row">
        <SettingsSection title="Partie">
          <SettingsRow label="Mode paisible" description="Sans vies">
            <Switch checked={false} label="Mode paisible" />
          </SettingsRow>
        </SettingsSection>
      </Block>
      <Block title="Stamp">
        <div className="passport-stamp score-stamp">
          <span className="stamp-caption">Exploré</span>
          <span className="stamp-value">72%</span>
          <span className="stamp-caption">170/236</span>
        </div>
      </Block>
      <Block title="LeaderboardRow">
        <LeaderboardNotice>Connecte-toi pour apparaître au classement.</LeaderboardNotice>
        <LeaderboardList label="démo">
          <LeaderboardRow
            rank={1}
            podium
            avatar={<InvaderAvatar invaderId="invader_1" color="cyan" size={20} />}
            name="GeoQueen"
            stat={219}
            meta="7:17"
          />
          <LeaderboardRow rank={6} name="Antoine" stat={151} meta="9:45" isMe youLabel="toi" />
        </LeaderboardList>
      </Block>
      <Block title="AtlasState">
        <AtlasState title="Rien ici" hint="État vide" />
        <AtlasState variant="error" title="Salon introuvable" />
      </Block>
    </section>
  );
};

/** Every UI primitive under the 6 accents, in the real dark theme tokens. */
const DevGallery = () => (
  <main className="dg-root" style={getThemeCssVariables("dark", "monochrome")}>
    <header className="dg-header">
      <h1>Galerie de composants</h1>
      <p>Page de développement uniquement — absente des builds de production.</p>
    </header>
    <div className="dg-grid">
      {Object.keys(ACCENT_PRESETS).map((id) => (
        <AccentColumn key={id} id={id} />
      ))}
    </div>
  </main>
);

export default DevGallery;
