import "./GeoDataStatus.css";

import { useTranslation } from "../config/i18n";
import ErrorState from "./ui/ErrorState";

/**
 * GeoDataStatus — Error boundary overlay for geo data loading failures.
 * The previous 400ms LoadingState has been superseded by the unified #tvrs-boot overlay.
 */
export default function GeoDataStatus({ status, onRetry, lang }) {
  const t = useTranslation(lang);

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
