import "./GeoDataStatus.css";

import { useEffect, useState } from "react";

import { useTranslation } from "../config/i18n";
import ErrorState from "./ui/ErrorState";
import LoadingState from "./ui/LoadingState";

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
        <LoadingState title={t("geo_loading")} />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="geo-status-wrapper is-blocking">
        <ErrorState
          title={t("geo_error_title")}
          hint={t("geo_error_hint")}
          onRetry={onRetry}
          retryLabel={t("geo_retry")}
        />
      </div>
    );
  }

  return null;
}
