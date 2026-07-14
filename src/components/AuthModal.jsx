import "./AuthModal.css";

import { ArrowLeft, Close, Earth, Gamepad, User } from "pixelarticons/react";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "../config/i18n";
import { signInWithEmail, signInWithGoogle, signUpWithEmail } from "../services/supabaseClient";

const AuthModal = ({ isOpen, onClose, onGuest, lang = "fr", theme = "dark" }) => {
  const t = useTranslation(lang);
  const [step, setStep] = useState("initial"); // "initial" | "email" | "password"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isCooldown, setIsCooldown] = useState(false);
  const [knownAccountExists, setKnownAccountExists] = useState(null); // null | true | false

  // Hooks are declared at the very top, before ANY logic or early return.
  // This is required by React Rules of Hooks.
  const submittingRef = useRef(false);

  // On error, start a short cooldown to prevent hammering the auth endpoints (avoids 429 rate limits)
  useEffect(() => {
    if (errorMsg) {
      setIsCooldown(true);

      const timer = setTimeout(() => {
        setIsCooldown(false);
      }, 8000);

      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Reset known account status when email changes (to allow fresh detection)
  useEffect(() => {
    setKnownAccountExists(null);
  }, [email]);

  const handleEmailNext = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("Veuillez saisir une adresse e-mail valide");
      return;
    }

    setKnownAccountExists(null); // reset knowledge for new email
    // Always proceed to password step. We decide login vs signup at submit time
    // (avoids unreliable pre-check that was sending new users to "login" and then erroring "no account").
    setStep("password");
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

    if (isCooldown || submittingRef.current || loading) {
      setErrorMsg("Trop de tentatives. Attendez un peu avant de réessayer.");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    try {
      // Optimized flow to avoid unnecessary calls and rate limits (429)
      let signInError = null;

      // Only try signIn if we don't know it's a brand new account
      if (knownAccountExists !== false) {
        const signInRes = await signInWithEmail(cleanEmail, cleanPassword);
        signInError = signInRes.error;
        if (!signInError) {
          setSuccessMsg(t("auth_success"));
          setPassword("");
          setTimeout(() => onClose(), 1000);
          return;
        }
      }

      // signIn failed or we know it's new -> attempt signUp (only if not known existing)
      if (knownAccountExists !== true) {
        const signUpRes = await signUpWithEmail(cleanEmail, cleanPassword);
        const signUpError = signUpRes.error;
        const signUpData = signUpRes.data;

        if (!signUpError) {
          setSuccessMsg(t("account_created"));

          if (signUpData?.session) {
            setSuccessMsg(t("auth_success"));
            setPassword("");
            setTimeout(() => onClose(), 800);
          } else {
            const loginAfterRes = await signInWithEmail(cleanEmail, cleanPassword);
            if (!loginAfterRes.error) {
              setSuccessMsg(t("auth_success"));
              setPassword("");
              setTimeout(() => onClose(), 800);
            } else {
              // created but no immediate session (e.g. email confirm on)
              setPassword("");
              setTimeout(() => onClose(), 1500);
            }
          }
          return;
        } else {
          const msg = (signUpError.message || "").toLowerCase();
          if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
            setErrorMsg(
              "Trop de tentatives. Veuillez attendre quelques minutes (limite Supabase)."
            );
          } else if (
            msg.includes("already registered") ||
            msg.includes("user already registered")
          ) {
            setKnownAccountExists(true);
            setErrorMsg(
              "Un compte existe déjà avec cet e-mail, mais le mot de passe est incorrect."
            );
          } else {
            setErrorMsg(signUpError.message || t("auth_error"));
          }
          return;
        }
      }

      // known existing, signIn failed
      setErrorMsg(signInError?.message || "Email ou mot de passe incorrect.");
    } catch (err) {
      const msg = (err.message || "").toLowerCase();
      if (msg.includes("rate") || msg.includes("too many") || msg.includes("429")) {
        setErrorMsg("Trop de tentatives. Veuillez attendre quelques minutes (limite Supabase).");
      } else {
        setErrorMsg(err.message || t("auth_error"));
      }
    } finally {
      setLoading(false);
      submittingRef.current = false;
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
    setKnownAccountExists(null);
  };

  const goBackToEmail = () => {
    setStep("email");
    setPassword("");
    setErrorMsg(null);
    setSuccessMsg(null);
    setKnownAccountExists(null);
  };

  let passwordButtonLabel = "Continuer";
  if (knownAccountExists === true) passwordButtonLabel = "Se connecter";
  else if (knownAccountExists === false) passwordButtonLabel = "Créer le compte";

  // Reset internal state (step, fields, etc.) whenever the modal is closed.
  // This ensures that when it re-opens, we are back at the "initial" screen with the Guest option visible.
  useEffect(() => {
    if (!isOpen) {
      resetFlow();
      setKnownAccountExists(null);
    }
  }, [isOpen]);

  // Render helpers extracted to keep main return and control-flow depth low
  // (lint ratchet: max depth ≤5). Each step is a self-contained block.
  const renderInitialFlow = () => (
    <div className="auth-modal-initial-flow">
      <button type="button" onClick={() => setStep("email")} className="auth-row-btn tvrs-btn">
        <User width={16} height={16} className="auth-btn-icon" />
        <span>Compte TVRS</span>
      </button>

      <button type="button" onClick={handleGoogleSignIn} className="auth-row-btn google-btn">
        <Earth width={16} height={16} className="auth-btn-icon" />
        <span>Continuer avec Google</span>
      </button>

      <button type="button" onClick={onGuest} className="auth-row-btn guest-btn">
        <Gamepad width={16} height={16} className="auth-btn-icon" />
        <span>Continuer en invité (Guest)</span>
      </button>
    </div>
  );

  const renderEmailStep = () => (
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
          autoFocus /* eslint-disable-line jsx-a11y/no-autofocus */
        />
      </div>
      <button type="submit" disabled={loading} className="btn-primary auth-modal-submit-btn">
        {loading ? "Vérification..." : "Continuer"}
      </button>
    </form>
  );

  const renderPasswordStep = () => (
    <form onSubmit={handleSubmit} className="auth-modal-form">
      <div className="form-group">
        <label>{t("auth_email")}</label>
        <input type="email" value={email} className="glass-panel disabled-input" disabled />
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
          autoFocus /* eslint-disable-line jsx-a11y/no-autofocus */
        />
      </div>

      <button
        type="submit"
        disabled={loading || isCooldown}
        className="btn-primary auth-modal-submit-btn"
      >
        {loading ? t("saving") : isCooldown ? "Attendez..." : passwordButtonLabel}
      </button>
    </form>
  );

  if (!isOpen) return null;

  const title =
    step === "initial" ? "Authentification" : step === "email" ? "Compte TVRS" : t("auth_password");

  const renderHeader = () => (
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
      <h2 className="panel-title">{title}</h2>
      <button className="panel-close-btn" onClick={onClose} title={t("close")}>
        <Close width={18} height={18} />
      </button>
    </div>
  );

  // Compute content outside JSX to reduce brace depth in return statement
  const stepContent =
    step === "initial"
      ? renderInitialFlow()
      : step === "email"
        ? renderEmailStep()
        : !successMsg
          ? renderPasswordStep()
          : null;

  return createPortal(
    <div className={`dialog-panel ${theme}`} onClick={onClose}>
      <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
        {renderHeader()}
        {errorMsg && <div className="form-feedback error">{errorMsg}</div>}
        {successMsg && <div className="form-feedback success">{successMsg}</div>}
        {stepContent}
      </div>
    </div>,
    document.body
  );
};

export default React.memo(AuthModal);
