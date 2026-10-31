import React from "react";

import Button from "./ui/Button";

/** Sticky footer of the profile form: save button + (optional) sign-out link. */
export default function ProfileFooter({
  t,
  disabled,
  isSaving,
  saveSuccess,
  showSignOut,
  onSignOut,
}) {
  let saveLabel = t("save_profile");
  if (saveSuccess) saveLabel = `✓ ${t("profile_saved")}`;
  else if (isSaving) saveLabel = t("saving");

  return (
    <div className="profile-sticky-footer">
      <Button
        type="submit"
        variant="primary"
        disabled={disabled}
        look="form-submit"
        className={`${saveSuccess ? "save-success-glow" : ""}`}
      >
        {saveLabel}
      </Button>

      {showSignOut && (
        <div className="profile-signout-wrapper">
          <Button variant="ghost" size="sm" className="profile-signout-link" onClick={onSignOut}>
            {t("auth_sign_out")}
          </Button>
        </div>
      )}
    </div>
  );
}
