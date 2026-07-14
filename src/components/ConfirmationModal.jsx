import React from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "../config/i18n";
import "../App.css";

const ConfirmationModal = ({ message, onConfirm, onCancel, theme, lang }) => {
  const t = useTranslation(lang);
  return createPortal(
    <div className={`dialog-panel ${theme}`}>
      <div className="dialog-card">
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
    </div>,
    document.body,
  );
};

export default React.memo(ConfirmationModal);
