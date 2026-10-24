import "./ConfirmationModal.css";

import React from "react";

import { useTranslation } from "../config/i18n";
import Button from "./ui/Button";
import Dialog, { DialogTitle } from "./ui/Dialog";

const ConfirmationModal = ({ message, onConfirm, onCancel, theme, lang }) => {
  const t = useTranslation(lang);
  return (
    <Dialog onClose={onCancel} theme={theme} closeOnBackdrop={false}>
      <DialogTitle as="p" className="panel-title confirmation-message">
        {message}
      </DialogTitle>
      <div className="modal-actions">
        <Button variant="secondary" className="modal-btn cancel" onClick={onCancel}>
          {t("cancel")}
        </Button>
        <Button variant="primary" className="modal-btn confirm" onClick={onConfirm}>
          {t("confirm")}
        </Button>
      </div>
    </Dialog>
  );
};

export default React.memo(ConfirmationModal);
