import { useCallback, useEffect, useRef, useState } from "react";

import InvaderAvatar from "../components/InvaderAvatar.jsx";
import { showToast } from "../components/ui/Toast.jsx";

/**
 * Achievement queue rendered through the single kit toast: achievements are shown one at a time
 * and the next one appears once the previous toast is dismissed (timeout, close or replaced).
 */
export default function useAchievementToasts() {
  const [queue, setQueue] = useState([]);
  const active = queue[0] || null;
  const shownRef = useRef(null);

  const addAchievementToQueue = useCallback((a) => setQueue((prev) => [...prev, a]), []);
  const closeAchievement = useCallback(() => setQueue((prev) => prev.slice(1)), []);

  useEffect(() => {
    if (!active || shownRef.current === active) return;
    shownRef.current = active;
    const { title, message, invaderId, color } = active;
    showToast({
      title,
      message,
      icon: <InvaderAvatar invaderId={invaderId} color={color} size={36} />,
      duration: 4000,
      onDismiss: closeAchievement,
    });
  }, [active, closeAchievement]);

  return { addAchievementToQueue };
}
