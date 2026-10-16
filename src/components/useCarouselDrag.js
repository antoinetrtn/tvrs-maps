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
  const dir = dx < 0 ? "next" : dx > 0 ? "prev" : "none";

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
        if (Math.abs(dx) > 8) wasDraggingRef.current = true;
        scheduleRaf();
      };

      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);

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

        if (Math.abs(dx) > 20 || (velocity > 0.15 && Math.abs(dx) > 6)) {
          const nextIdx =
            dx < 0 ? (activeIndex + 1) % totalModes : (activeIndex - 1 + totalModes) % totalModes;
          onSelectIndex(nextIdx);
        }

        currentDxRef.current = 0;
        setTimeout(() => {
          wasDraggingRef.current = false;
        }, 100);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("touchmove", onMove, { passive: true });
      window.addEventListener("touchend", onUp);
    },
    [exiting, reducedMotion, activeIndex, totalModes, onSelectIndex, scheduleRaf]
  );

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  return { stageRef, isDragging, wasDraggingRef, handlePointerDown };
}
