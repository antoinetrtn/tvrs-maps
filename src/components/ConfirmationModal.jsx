import "./ConfirmationModal.css";

import React from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "../config/i18n";
import Button from "./ui/Button";

const ConfirmationModal = ({ message, onConfirm, onCancel, theme, lang }) => {
  const t = useTranslation(lang);
  return createPortal(
    <div className={`dialog-panel ${theme}`}>
      <div className="dialog-card">
        <p>{message}</p>
        <div className="modal-actions">
          <Button variant="secondary" className="modal-btn cancel" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button variant="primary" className="modal-btn confirm" onClick={onConfirm}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default React.memo(ConfirmationModal);
