import { useCallback, useEffect, useLayoutEffect, useState } from "react";

function computeCenterScroll(track, activeEl) {
  if (!track || !activeEl) return 0;
  const target = activeEl.offsetLeft + activeEl.offsetWidth / 2 - track.clientWidth / 2;
  const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
  return Math.max(0, Math.min(target, maxScroll));
}

export function useTabBarScroll({ trackRef, value, options }) {
  const [overflow, setOverflow] = useState({ start: false, end: false });

  const updateOverflow = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const { scrollLeft, scrollWidth, clientWidth } = track;
    const maxScroll = scrollWidth - clientWidth;
    const canScroll = maxScroll > 1;
    const start = canScroll && scrollLeft > 1;
    const end = canScroll && maxScroll - scrollLeft > 1;
    setOverflow((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
  }, [trackRef]);

  const scrollToActive = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const activeEl = track.querySelector(".tab-bar-tab.active");
    if (!activeEl) return;
    track.scrollLeft = computeCenterScroll(track, activeEl);
  }, [trackRef]);

  useLayoutEffect(() => {
    scrollToActive();
    updateOverflow();
  }, [scrollToActive, updateOverflow, value, options.length]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;

    const onScroll = () => {
      updateOverflow();
    };
    track.addEventListener("scroll", onScroll, { passive: true });

    let observer;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        scrollToActive();
        updateOverflow();
      });
      observer.observe(track);
    }

    return () => {
      track.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [trackRef, scrollToActive, updateOverflow]);

  return {
    hasOverflowStart: overflow.start,
    hasOverflowEnd: overflow.end,
    scrollToActive,
    updateOverflow,
  };
}

export function useTabBarIndicator({ trackRef, value, options, level }) {
  const [plate, setPlate] = useState(null);
  const [snapping, setSnapping] = useState(false);

  const measure = useCallback(() => {
    if (level !== 1) {
      setPlate(null);
      return;
    }
    const track = trackRef.current;
    if (!track) return;
    const activeEl = track.querySelector(".tab-bar-tab.active");
    if (!activeEl || activeEl.offsetWidth === 0) {
      setPlate(null);
      return;
    }
    const next = {
      x: activeEl.offsetLeft,
      y: activeEl.offsetTop,
      w: activeEl.offsetWidth,
      h: activeEl.offsetHeight,
    };
    setPlate((prev) =>
      prev && prev.x === next.x && prev.y === next.y && prev.w === next.w && prev.h === next.h
        ? prev
        : next
    );
  }, [level, trackRef]);

  useLayoutEffect(() => {
    measure();
  }, [measure, value, options.length]);

  useEffect(() => {
    if (level !== 1 || typeof ResizeObserver === "undefined" || !trackRef.current) {
      return undefined;
    }
    const observer = new ResizeObserver(measure);
    observer.observe(trackRef.current);
    return () => observer.disconnect();
  }, [level, measure, trackRef]);

  const hasPlate = plate !== null;
  useEffect(() => {
    if (!hasPlate) return undefined;
    const id = requestAnimationFrame(() => setSnapping(true));
    return () => cancelAnimationFrame(id);
  }, [hasPlate]);

  return { plate, snapping };
}
