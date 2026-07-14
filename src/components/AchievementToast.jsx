import "./AchievementToast.css";

import React, { useEffect } from "react";

import InvaderAvatar from "./InvaderAvatar";

const AchievementToast = ({
  title,
  message,
  invaderId = "invader_3",
  color = "cyan",
  onClose,
  duration = 4000,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onClose) onClose();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className="achievement-toast-wrapper">
      <div
        className="achievement-toast-card glass-panel"
        style={{
          "--toast-color": color,
          "--toast-color-glow": `${color}33`, // transparent version for shadow glow
        }}
      >
        <div className="achievement-toast-icon-container">
          <InvaderAvatar invaderId={invaderId} color={color} size={36} />
        </div>
        <div className="achievement-toast-content">
          <div className="achievement-toast-title">{title}</div>
          <div className="achievement-toast-desc">{message}</div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(AchievementToast);
