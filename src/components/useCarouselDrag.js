import { useCallback, useEffect, useRef, useState } from "react";

const getEventClientX = (e) => {
  if (typeof e.clientX === "number" && e.clientX !== 0) return e.clientX;
  if (e.touches?.[0]?.clientX) return e.touches[0].clientX;
  if (e.changedTouches?.[0]?.clientX) return e.changedTouches[0].clientX;
  return 0;
};

const applyDragStyles = (stage, dx, reducedMotion) => {
  if (!stage) return;
  const absDx = Math.abs(dx);
  const progress = Math.min(1.0, absDx / 120);
  let dir = "none";
  if (dx < 0) {
    dir = "next";
  } else if (dx > 0) {
    dir = "prev";
  }

  stage.style.setProperty("--drag-x", `${dx}px`);
  stage.style.setProperty("--drag-abs-x", `${absDx}px`);
  stage.style.setProperty("--drag-rot", reducedMotion ? "0deg" : `${dx * 0.05}deg`);
  stage.style.setProperty("--drag-progress", String(progress));
  stage.dataset.dragDir = dir;
};

const resetStageStyles = (stage) => {
  if (!stage) return;
  stage.style.setProperty("--drag-x", "0px");
  stage.style.setProperty("--drag-abs-x", "0px");
  stage.style.setProperty("--drag-rot", "0deg");
  stage.style.setProperty("--drag-progress", "0");
  stage.dataset.dragDir = "none";
};

const SWIPE_DISTANCE_PX = 20;
const FLICK_MIN_DISTANCE_PX = 12;
const FLICK_VELOCITY_PX_PER_MS = 0.35;

const isSwipeGesture = (dx, velocity) =>
  Math.abs(dx) > SWIPE_DISTANCE_PX ||
  (velocity > FLICK_VELOCITY_PX_PER_MS && Math.abs(dx) > FLICK_MIN_DISTANCE_PX);

export default function useCarouselDrag({
  activeIndex,
  totalModes,
  onSelectIndex,
  reducedMotion = false,
  exiting = false,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const stageRef = useRef(null);
  const startXRef = useRef(0);
  const currentDxRef = useRef(0);
  const startTimeRef = useRef(0);
  const wasDraggingRef = useRef(false);
  const rafIdRef = useRef(null);
  const releaseTimerRef = useRef(null);
  const dragResetTimerRef = useRef(null);
  const cleanupListenersRef = useRef(null);

  const latestRef = useRef({ activeIndex, totalModes, onSelectIndex });
  latestRef.current = { activeIndex, totalModes, onSelectIndex };

  const scheduleRaf = useCallback(() => {
    if (!rafIdRef.current) {
      rafIdRef.current = requestAnimationFrame(() => {
        applyDragStyles(stageRef.current, currentDxRef.current, reducedMotion);
        rafIdRef.current = null;
      });
    }
  }, [reducedMotion]);

  const handlePointerDown = useCallback(
    (e) => {
      if (exiting || e.target.closest("button")) return;
      const startX = getEventClientX(e);
      if (!startX) return;

      cleanupListenersRef.current?.();
      clearTimeout(dragResetTimerRef.current);

      startXRef.current = startX;
      currentDxRef.current = 0;
      startTimeRef.current = Date.now();
      wasDraggingRef.current = false;
      setIsDragging(true);

      const onMove = (moveEvt) => {
        const currentX = getEventClientX(moveEvt);
        if (!currentX) return;
        const dx = currentX - startXRef.current;
        currentDxRef.current = dx;
        if (Math.abs(dx) > FLICK_MIN_DISTANCE_PX) wasDraggingRef.current = true;
        scheduleRaf();
      };

      const removeWindowListeners = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
        cleanupListenersRef.current = null;
      };

      const onUp = () => {
        removeWindowListeners();

        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }

        const dx = currentDxRef.current;
        const dt = Math.max(1, Date.now() - startTimeRef.current);
        const velocity = Math.abs(dx) / dt;
        const releaseType = velocity > 0.6 ? "fling" : "settle";

        resetStageStyles(stageRef.current);
        if (stageRef.current && !reducedMotion) {
          stageRef.current.dataset.release = releaseType;
          clearTimeout(releaseTimerRef.current);
          releaseTimerRef.current = setTimeout(
            () => {
              if (stageRef.current) delete stageRef.current.dataset.release;
            },
            releaseType === "fling" ? 190 : 260
          );
        }

        setIsDragging(false);

        if (isSwipeGesture(dx, velocity)) {
          wasDraggingRef.current = true;
          const {
            activeIndex: curIdx,
            totalModes: curTotal,
            onSelectIndex: selectIdx,
          } = latestRef.current;
          if (curTotal > 0) {
            const nextIdx = dx < 0 ? (curIdx + 1) % curTotal : (curIdx - 1 + curTotal) % curTotal;
            selectIdx(nextIdx);
          }
        }

        currentDxRef.current = 0;
        dragResetTimerRef.current = setTimeout(() => {
          wasDraggingRef.current = false;
        }, 100);
      };

      cleanupListenersRef.current = removeWindowListeners;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onUp);
    },
    [exiting, reducedMotion, scheduleRaf]
  );

  useEffect(() => {
    return () => {
      cleanupListenersRef.current?.();
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
      if (dragResetTimerRef.current) clearTimeout(dragResetTimerRef.current);
    };
  }, []);

  return { stageRef, isDragging, wasDraggingRef, handlePointerDown };
}
