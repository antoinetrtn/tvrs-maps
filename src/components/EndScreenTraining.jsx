import "./EndScreenTraining.css";

import React from "react";

import { getTrainingLabel } from "../utils/trainingPool";

const EndScreenTraining = ({
  trainingMode = "countries",
  trainingReviewKeys = [],
  lang = "fr",
  t,
}) => {
  const hasReview = Boolean(trainingReviewKeys && trainingReviewKeys.length > 0);

  return (
    <div className="end-screen-training glass-panel scrollbar-styled">
      <h3 className="training-review-title text-natural-case">{t("training_end_review")}</h3>
      {hasReview ? (
        <div className="training-review-chips">
          {trainingReviewKeys.map((key) => (
            <span key={key} className="training-review-chip">
              {getTrainingLabel(trainingMode, key, lang, true)}
            </span>
          ))}
        </div>
      ) : (
        <p className="training-review-empty">{t("training_end_all")}</p>
      )}
    </div>
  );
};

export default React.memo(EndScreenTraining);
