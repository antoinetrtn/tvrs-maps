import "./GeoDataStatus.css";

import { Reload } from "pixelarticons/react";
import { useEffect, useState } from "react";

import { useTranslation } from "../config/i18n";
import Button from "./ui/Button";

export default function GeoDataStatus({ status, onRetry, lang }) {
  const t = useTranslation(lang);
  const [showLoading, setShowLoading] = useState(false);

  useEffect(() => {
    if (status !== "loading") {
      setShowLoading(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, 400);
    return () => {
      clearTimeout(timer);
    };
  }, [status]);

  if (status === "ready" || status === "idle") {
    return null;
  }

  if (status === "loading") {
    if (!showLoading) {
      return null;
    }
    return (
      <div className="geo-status-wrapper">
        <div className="geo-status-card geo-status-card-loading" role="status" aria-live="polite">
          <div className="geo-status-track" aria-hidden="true">
            <span className="geo-status-cell" />
            <span className="geo-status-cell" />
            <span className="geo-status-cell" />
            <span className="geo-status-cell" />
            <span className="geo-status-cell" />
            <span className="geo-status-runner" />
          </div>
          <span className="geo-status-label">{t("geo_loading")}</span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="geo-status-wrapper">
        <div className="geo-status-card geo-status-card-error" role="alert">
          <div className="geo-status-header">
            <Reload width={20} height={20} aria-hidden="true" />
            <span className="geo-status-title">{t("geo_error_title")}</span>
          </div>
          <p className="geo-status-hint">{t("geo_error_hint")}</p>
          <Button variant="secondary" className="geo-status-retry" onClick={onRetry}>
            {t("geo_retry")}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
