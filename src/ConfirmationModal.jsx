import React from "react";
import { useTranslation } from "./i18n";
import "./App.css";

const ConfirmationModal = ({ message, onConfirm, onCancel, theme, lang }) => {
  const t = useTranslation(lang);
  return (
    <div className="custom-modal-overlay">
      <div className={`custom-modal-content glass-panel ${theme}`}>
        <p>{message}</p>
        <div className="modal-actions">
          <button className="modal-btn cancel" onClick={onCancel}>
            {t("cancel")}
          </button>
          <button className="modal-btn confirm" onClick={onConfirm}>
            {t("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default React.memo(ConfirmationModal);
