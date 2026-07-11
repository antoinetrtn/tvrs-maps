import React, { useState } from "react";
import { Close } from "pixelarticons/react";
import { useTranslation } from "./i18n";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle
} from "./supabaseClient";
import "./AuthModal.css";

const AuthModal = ({ isOpen, onClose, onGuest, lang = "fr", theme = "dark" }) => {
  const t = useTranslation(lang);
  const [authType, setAuthType] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg("Veuillez remplir tous les champs");
      return;
    }

    setLoading(true);

    try {
      if (authType === "signup") {
        const { error } = await signUpWithEmail(cleanEmail, cleanPassword);
        if (error) throw error;
        setSuccessMsg(t("account_created"));
        setEmail("");
        setPassword("");
      } else {
        const { error } = await signInWithEmail(cleanEmail, cleanPassword);
        if (error) throw error;
        setSuccessMsg(t("auth_success"));
        setTimeout(() => {
          onClose();
        }, 1000);
      }
    } catch (err) {
      setErrorMsg(err.message || t("auth_error"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
    } catch (err) {
      setErrorMsg(err.message || t("auth_error"));
    }
  };

  return (
    <div className={`auth-modal-overlay ${theme}`} onClick={onGuest}>
      <div className="auth-modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2 className="auth-modal-title text-natural-case">
            {authType === "login" ? t("auth_sign_in") : t("auth_sign_up")}
          </h2>
          <button className="auth-modal-close-btn" onClick={onGuest} title={t("close")}>
            <Close width={18} height={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-modal-form">
          <div className="form-group">
            <label>{t("auth_email")}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ex: jean.dupont@gmail.com"
              className="glass-panel"
              required
            />
          </div>

          <div className="form-group">
            <label>{t("auth_password")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-panel"
              required
            />
          </div>

          {errorMsg && <div className="form-feedback error">{errorMsg}</div>}
          {successMsg && <div className="form-feedback success">{successMsg}</div>}

          <button type="submit" disabled={loading} className="btn-primary auth-modal-submit-btn">
            {loading ? t("saving") : (authType === "login" ? t("auth_sign_in") : t("auth_sign_up"))}
          </button>

          <button type="button" onClick={handleGoogleSignIn} className="auth-modal-google-btn glass-panel">
            <span>{t("auth_google")}</span>
          </button>

          <div className="auth-modal-switch-wrapper">
            <button
              type="button"
              className="auth-modal-switch-btn"
              onClick={() => setAuthType(authType === "login" ? "signup" : "login")}
            >
              {authType === "login" ? t("auth_no_account") : t("auth_has_account")}
            </button>
          </div>

          <div className="auth-modal-guest-wrapper">
            <button type="button" onClick={onGuest} className="auth-modal-guest-btn">
              Continuer en invité (Guest)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default React.memo(AuthModal);
