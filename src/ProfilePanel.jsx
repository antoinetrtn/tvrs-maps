import React, { useState, useEffect } from "react";
import { User, Close } from "pixelarticons/react";
import InvaderAvatar, { INVADER_DESIGNS } from "./InvaderAvatar";
import { AVATAR_COLORS } from "./designSystem";
import { useTranslation } from "./i18n";
import {
  isSupabaseConfigured,
  upsertProfile,
  isUsernameTaken
} from "./supabaseClient";
import "./ProfilePanel.css";

const ProfilePanel = ({
  userProfile,
  setUserProfile,
  onClose,
  isOpen,
  lang = "fr",
  theme = "dark"
}) => {
  const t = useTranslation(lang);

  // Profile Form State
  const [usernameInput, setUsernameInput] = useState(userProfile.username || "");
  const [selectedAvatar, setSelectedAvatar] = useState(userProfile.avatarId || "invader_1");
  const [selectedColor, setSelectedColor] = useState(userProfile.avatarColor || "cyan");
  const [formError, setFormError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Sync state with parent profile changes
  useEffect(() => {
    if (isOpen) {
      setUsernameInput(userProfile.username || "");
      setSelectedAvatar(userProfile.avatarId || "invader_1");
      setSelectedColor(userProfile.avatarColor || "cyan");
      setFormError(null);
      setSaveSuccess(false);
    }
  }, [userProfile, isOpen]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setFormError(null);
    setSaveSuccess(false);

    const cleanUsername = usernameInput.trim();

    // Validation
    if (!cleanUsername) {
      setFormError(t("username_invalid"));
      return;
    }
    if (cleanUsername.length < 3 || cleanUsername.length > 20) {
      setFormError(t("username_invalid"));
      return;
    }
    const alphanumericRegex = /^[a-zA-Z0-9_\s-]+$/;
    if (!alphanumericRegex.test(cleanUsername)) {
      setFormError(t("username_invalid"));
      return;
    }

    setIsSaving(true);

    try {
      // Check if username is taken online
      if (isSupabaseConfigured && cleanUsername.toLowerCase() !== userProfile.username?.toLowerCase()) {
        const taken = await isUsernameTaken(cleanUsername, userProfile.id);
        if (taken) {
          setFormError(t("username_taken"));
          setIsSaving(false);
          return;
        }
      }

      // Upsert profile in Supabase
      let updatedProfile = {
        ...userProfile,
        username: cleanUsername,
        avatarId: selectedAvatar,
        avatarColor: selectedColor
      };

      if (isSupabaseConfigured) {
        const { error } = await upsertProfile(
          userProfile.id,
          cleanUsername,
          selectedAvatar,
          selectedColor
        );
        if (error) {
          throw new Error(error);
        }
      }

      // Update local React state and LocalStorage
      setUserProfile(updatedProfile);
      localStorage.setItem("tvrs-user-profile", JSON.stringify(updatedProfile));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setFormError(err.message || "Erreur lors de l'enregistrement");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`settings-panel profile-panel glass-panel ${isOpen ? "open" : ""} ${theme}`}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div className="settings-header">
        <h2 className="settings-title text-natural-case">
          <User className="icon" style={{ verticalAlign: "middle", marginRight: "8px", color: "var(--accent)" }} />
          {t("profile")}
        </h2>
        <button
          className="settings-close-btn"
          onClick={onClose}
          title={t("close")}
        >
          <Close width={20} height={20} />
        </button>
      </div>

      <div className="settings-body" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <form onSubmit={handleSaveProfile} className="profile-form" style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div className="avatar-preview-container">
            <div className="avatar-glow" style={{ "--glow-color": AVATAR_COLORS[selectedColor] }}>
              <InvaderAvatar invaderId={selectedAvatar} color={selectedColor} size={48} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="profile-username-input">{t("username")}</label>
            <input
              id="profile-username-input"
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Pseudo..."
              maxLength={20}
              className="glass-panel"
            />
          </div>

          <div className="form-group">
            <label>{t("select_avatar")}</label>
            <div className="avatar-grid scrollbar-styled">
              {Object.keys(INVADER_DESIGNS).map((id) => (
                <button
                  key={id}
                  type="button"
                  className={`avatar-option glass-panel ${selectedAvatar === id ? "active" : ""}`}
                  onClick={() => setSelectedAvatar(id)}
                >
                  <InvaderAvatar invaderId={id} color={selectedColor} size={28} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>{t("select_color")}</label>
            <div className="color-selector-grid">
              {Object.keys(AVATAR_COLORS).map((cKey) => (
                <button
                  key={cKey}
                  type="button"
                  className={`color-option ${selectedColor === cKey ? "active" : ""}`}
                  style={{ "--option-color": AVATAR_COLORS[cKey] }}
                  onClick={() => setSelectedColor(cKey)}
                  title={cKey}
                />
              ))}
            </div>
          </div>

          {formError && <div className="form-feedback error">{formError}</div>}
          {saveSuccess && <div className="form-feedback success">{t("profile_saved")}</div>}

          <button type="submit" disabled={isSaving} className="btn-primary form-submit-btn">
            {isSaving ? t("saving") : t("save_profile")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default React.memo(ProfilePanel);
