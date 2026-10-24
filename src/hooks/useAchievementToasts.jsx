import { useCallback, useRef, useState } from "react";

/** Max achievements visible at once; the rest wait in the queue (single ordered queue). */
export const ACHIEVEMENT_STACK_MAX = 3;

/**
 * Achievement queue. Up to ACHIEVEMENT_STACK_MAX cards are shown at the same time, stacked in
 * unlock order; when one is dismissed (timeout or close) the next queued one takes its place.
 */
export default function useAchievementToasts() {
  const [queue, setQueue] = useState([]);
  const idRef = useRef(0);

  const addAchievementToQueue = useCallback((a) => {
    idRef.current += 1;
    const id = idRef.current;
    setQueue((prev) => [...prev, { ...a, id }]);
  }, []);

  const dismissAchievement = useCallback(
    (id) => setQueue((prev) => prev.filter((a) => a.id !== id)),
    []
  );

  return {
    addAchievementToQueue,
    achievements: queue.slice(0, ACHIEVEMENT_STACK_MAX),
    dismissAchievement,
  };
}
