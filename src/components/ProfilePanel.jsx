import "./ProfilePanel.css";

import { Trophy, User } from "pixelarticons/react";
import React, { useEffect, useState } from "react";

import { useTranslation } from "../config/i18n";
import { CHALLENGES } from "../data/challenges";
import {
  isSupabaseConfigured,
  isUsernameTaken,
  signOut,
  upsertProfile,
} from "../services/supabaseClient";
import { getLevelAndProgress } from "../utils/gamification";
import { ProfileTabContent, StatsTabContent } from "./ProfilePanelTabs";
import Dialog from "./ui/Dialog";
import PanelCloseButton from "./ui/PanelCloseButton";
import TabBar from "./ui/TabBar";

// Dictionnaire associant 12 succès spécifiques aux 12 modèles d'envahisseurs et leurs couleurs fixes
const CHALLENGE_AVATARS = {
  ch_gen_play_1: { invaderId: "invader_1", color: "cyan" }, // Premier Pas
  ch_gen_play_10: { invaderId: "invader_2", color: "purple" }, // Pilier Cartographe
  ch_gen_play_50: { invaderId: "invader_3", color: "magenta" }, // Géographe Suprême
  ch_cont_europe: { invaderId: "invader_4", color: "cyan" }, // Conquête de l'Europe
  ch_cont_africa: { invaderId: "invader_5", color: "yellow" }, // Terres Africaines
  ch_cont_asia: { invaderId: "invader_6", color: "magenta" }, // Soleil Levant
  ch_cont_americas: { invaderId: "invader_7", color: "lime" }, // Nouveau Monde
  ch_cont_oceania: { invaderId: "invader_8", color: "pink" }, // Archipels Lointains
  ch_score_countries_50: { invaderId: "invader_9", color: "yellow" }, // Expert Pays
  ch_score_capitals_50: { invaderId: "invader_10", color: "orange" }, // Maire du Monde
  ch_speed_fast_guess: { invaderId: "invader_11", color: "yellow" }, // Réflexe Éclair
  ch_relief_score_20: { invaderId: "invader_12", color: "green" }, // Alpiniste Amateur
};

async function saveAuthenticatedProfile({
  session,
  cleanUsername,
  selectedAvatar,
  selectedColor,
  userProfile,
  t,
}) {
  if (cleanUsername.toLowerCase() !== (userProfile.username || "").toLowerCase()) {
    const taken = await isUsernameTaken(cleanUsername);
    if (taken) {
      return { error: t("username_taken") };
    }
  }

  const updatedProfile = {
    ...userProfile,
    username: cleanUsername,
    avatarId: selectedAvatar,
    avatarColor: selectedColor,
  };

  const { error } = await upsertProfile(
    session.user.id,
    cleanUsername,
    selectedAvatar,
    selectedColor,
    userProfile.xp,
    userProfile.level,
    userProfile.unlockedBadges
  );

  if (error) throw error;
  return { profile: updatedProfile };
}

function saveGuestProfile({ cleanUsername, selectedAvatar, selectedColor, userProfile }) {
  const guestProfile = {
    ...userProfile,
    username: cleanUsername,
    avatarId: selectedAvatar,
    avatarColor: selectedColor,
  };
  return { profile: guestProfile, persistLocally: true };
}

function buildChallengeAvatarItem(chId, mapping, unlockedBadges, lang) {
  const ch = CHALLENGES.find((c) => c.id === chId);
  const isFrench = lang === "fr";
  const label = ch ? (isFrench ? ch.titleFr : ch.titleEn) : "Mission";
  const desc = ch ? (isFrench ? ch.descFr : ch.descEn) : "";
  const isLocked = chId === "ch_gen_play_1" ? false : !unlockedBadges.includes(chId);

  return {
    id: mapping.invaderId,
    challengeId: chId,
    isLocked,
    label,
    unlockDesc: `${label}: ${desc}`,
    color: mapping.color,
  };
}

function buildAllAvatars(unlockedBadges, lang) {
  return Object.entries(CHALLENGE_AVATARS).map(([chId, mapping]) =>
    buildChallengeAvatarItem(chId, mapping, unlockedBadges, lang)
  );
}

const ProfilePanel = ({
  userProfile,
  setUserProfile,
  onClose,
  isOpen,
  lang = "fr",
  localRecords,
  session,
  onOpenAuth,
}) => {
  const t = useTranslation(lang);
  const [activeTab, setActiveTab] = useState("profile"); // "profile" | "stats"
  const [usernameInput, setUsernameInput] = useState(userProfile.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarId || "invader_1");
  const [selectedColor, setSelectedColor] = useState(userProfile.avatarColor || "cyan");
  const [challengesFilter, setChallengesFilter] = useState("all");
  const [selectedChallengeId, setSelectedChallengeId] = useState(CHALLENGES[0].id);

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formError, setFormError] = useState(null);

  // Sync inputs with userProfile updates
  useEffect(() => {
    if (userProfile) {
      setUsernameInput(userProfile.username || "");
      setSelectedAvatar(userProfile.avatarId || "invader_1");
      setSelectedColor(userProfile.avatarColor || "cyan");
    }
  }, [userProfile]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(false);

    const cleanUsername = usernameInput.trim();
    if (!cleanUsername) {
      setFormError(t("username_required"));
      return;
    }

    setIsSaving(true);
    try {
      const isRemote = isSupabaseConfigured && session;
      const result = isRemote
        ? await saveAuthenticatedProfile({
            session,
            cleanUsername,
            selectedAvatar,
            selectedColor,
            userProfile,
            t,
          })
        : saveGuestProfile({ cleanUsername, selectedAvatar, selectedColor, userProfile });

      if (result.error) {
        setFormError(result.error);
        setIsSaving(false);
        return;
      }

      setUserProfile(result.profile);
      if (result.persistLocally) {
        localStorage.setItem("tvrs-user-profile", JSON.stringify(result.profile));
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setFormError(err.message || t("save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleSignOutClick = async (e) => {
    e.preventDefault();
    setFormError(null);
    try {
      await signOut();
      const guestProfile = {
        id: "guest",
        username: "Guest",
        xp: 0,
        unlockedBadges: [],
        avatarId: "invader_1",
        avatarColor: "cyan",
      };
      setUserProfile(guestProfile);
      localStorage.setItem("tvrs-user-profile", JSON.stringify(guestProfile));
    } catch (err) {
      setFormError(err.message || "Erreur de déconnexion");
    }
  };

  const { level, xpInLevel, xpNeededForNext, percent } = getLevelAndProgress(userProfile.xp || 0);
  const unlockedBadges = userProfile.unlockedBadges || [];
  const totalGamesPlayed = Object.values(localRecords || {}).reduce(
    (acc, rec) => acc + (rec.gamesPlayed || 0),
    0
  );

  const filteredChallenges = CHALLENGES.filter((ch) => {
    if (challengesFilter === "all") {
      return true;
    }
    return ch.category === challengesFilter;
  });

  const selectedChallengeObj =
    CHALLENGES.find((ch) => ch.id === selectedChallengeId) || CHALLENGES[0];
  const isSelectedChallengeUnlocked = unlockedBadges.includes(selectedChallengeId);

  // Génération des 12 avatars basés sur les missions
  const allAvatars = buildAllAvatars(unlockedBadges, lang);

  // Guard AFTER all hooks (useState/useEffect) and derived values.
  // This ensures we fully unmount the panel subtree when closed (important on mobile/guest
  // so that the blur overlay or other elements can't intercept the close button or block access).
  // Visibility is also controlled via the "open" class for transitions when mounting.
  if (!isOpen) return null;

  return (
    <Dialog
      variant="panel"
      open
      onClose={onClose}
      label={t("tab_profile")}
      className="profile-panel glass-panel"
    >
      <div className="panel-header">
        <TabBar
          level={1}
          label={t("tab_profile")}
          options={[
            {
              value: "profile",
              label: t("tab_profile"),
              icon: <User width={16} height={16} aria-hidden="true" />,
            },
            {
              value: "stats",
              label: t("tab_stats"),
              icon: <Trophy width={16} height={16} aria-hidden="true" />,
            },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />
        <PanelCloseButton label={t("close")} onClick={onClose} stopPropagation />
      </div>

      <div className="panel-body scrollbar-styled">
        {activeTab === "profile" ? (
          <ProfileTabContent
            t={t}
            session={session}
            onOpenAuth={onOpenAuth}
            handleSaveProfile={handleSaveProfile}
            usernameInput={usernameInput}
            setUsernameInput={setUsernameInput}
            selectedAvatar={selectedAvatar}
            setSelectedAvatar={setSelectedAvatar}
            selectedColor={selectedColor}
            setSelectedColor={setSelectedColor}
            level={level}
            xpInLevel={xpInLevel}
            xpNeededForNext={xpNeededForNext}
            percent={percent}
            userProfile={userProfile}
            totalGamesPlayed={totalGamesPlayed}
            unlockedBadges={unlockedBadges}
            allAvatars={allAvatars}
            formError={formError}
            isSaving={isSaving}
            saveSuccess={saveSuccess}
            handleSignOutClick={handleSignOutClick}
          />
        ) : (
          <StatsTabContent
            lang={lang}
            challengesFilter={challengesFilter}
            setChallengesFilter={setChallengesFilter}
            filteredChallenges={filteredChallenges}
            unlockedBadges={unlockedBadges}
            selectedChallengeId={selectedChallengeId}
            setSelectedChallengeId={setSelectedChallengeId}
            selectedChallengeObj={selectedChallengeObj}
            isSelectedChallengeUnlocked={isSelectedChallengeUnlocked}
          />
        )}
      </div>
    </Dialog>
  );
};

export default React.memo(ProfilePanel);
