import React, { useState } from "react";
import { Close, ArrowLeft, User, Earth, Gamepad } from "pixelarticons/react";
import Logo from "./Logo";
import { useTranslation } from "./i18n";
import {
  signInWithEmail,
  signUpWithEmail,
  signInWithGoogle,
  checkIfEmailRegistered
} from "./supabaseClient";
import "./AuthModal.css";

const AuthModal = ({ isOpen, onClose, onGuest, lang = "fr", theme = "dark" }) => {
  const t = useTranslation(lang);
  const [step, setStep] = useState("initial"); // "initial" | "email" | "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailNext = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Veuillez saisir une adresse e-mail valide");
      return;
    }

    setLoading(true);
    try {
      const isRegistered = await checkIfEmailRegistered(cleanEmail);
      if (isRegistered) {
        setStep("login");
      } else {
        setStep("signup");
      }
    } catch (err) {
      setErrorMsg(err.message || "Erreur lors de la vérification de l'e-mail");
    } finally {
      setLoading(false);
    }
  };

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
      if (step === "signup") {
        const { error } = await signUpWithEmail(cleanEmail, cleanPassword);
        if (error) throw error;
        setSuccessMsg(t("account_created"));
        setTimeout(() => {
          setStep("login");
          setPassword("");
          setSuccessMsg(null);
        }, 1500);
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

  const resetFlow = () => {
    setStep("initial");
    setEmail("");
    setPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const goBackToEmail = () => {
    setStep("email");
    setPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  return (
    <div className={`dialog-panel ${theme}`} onClick={onGuest}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        <div className="panel-header">
          {step !== "initial" && (
            <button
              type="button"
              className="panel-back-btn"
              onClick={step === "email" ? resetFlow : goBackToEmail}
              title={t("back")}
            >
              <ArrowLeft width={18} height={18} />
            </button>
          )}
          <h2 className="panel-title">
            {step === "initial" && "Authentification"}
            {step === "email" && "Compte TVRS"}
            {step === "login" && t("auth_sign_in")}
            {step === "signup" && t("auth_sign_up")}
          </h2>
          <button className="panel-close-btn" onClick={onGuest} title={t("close")}>
            <Close width={18} height={18} />
          </button>
        </div>

        {step === "initial" && (
          <div className="auth-modal-logo-wrapper">
            <Logo size="small" className="auth-ascii-logo" />
          </div>
        )}

        {errorMsg && <div className="form-feedback error">{errorMsg}</div>}
        {successMsg && <div className="form-feedback success">{successMsg}</div>}

        {step === "initial" && (
          <div className="auth-modal-initial-flow">
            <button
              type="button"
              onClick={() => setStep("email")}
              className="auth-row-btn tvrs-btn"
            >
              <User width={16} height={16} className="auth-btn-icon" />
              <span>Compte TVRS</span>
            </button>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="auth-row-btn google-btn"
            >
              <Earth width={16} height={16} className="auth-btn-icon" />
              <span>Continuer avec Google</span>
            </button>

            <button
              type="button"
              onClick={onGuest}
              className="auth-row-btn guest-btn"
            >
              <Gamepad width={16} height={16} className="auth-btn-icon" />
              <span>Continuer en invité (Guest)</span>
            </button>
          </div>
        )}

        {step === "email" && (
          <form onSubmit={handleEmailNext} className="auth-modal-form">
            <div className="form-group">
              <label>{t("auth_email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Ex: jean.dupont@gmail.com"
                className="glass-panel"
                disabled={loading}
                required
                autoFocus
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary auth-modal-submit-btn">
              {loading ? "Vérification..." : "Continuer"}
            </button>
          </form>
        )}

        {(step === "login" || step === "signup") && (
          <form onSubmit={handleSubmit} className="auth-modal-form">
            <div className="form-group">
              <label>{t("auth_email")}</label>
              <input
                type="email"
                value={email}
                className="glass-panel disabled-input"
                disabled
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
                disabled={loading}
                required
                autoFocus
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary auth-modal-submit-btn">
              {loading ? t("saving") : (step === "login" ? t("auth_sign_in") : t("auth_sign_up"))}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default React.memo(AuthModal);
