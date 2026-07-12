import { useState, useEffect, useRef, useCallback } from "react";
import { BREAKPOINTS, KEYBOARD_CLOSE_DELAY_MS } from "../gameConstants";

export function useViewport() {
  const getViewport = useCallback(() => {
    const vv = window.visualViewport;
    return {
      width: vv ? vv.width : window.innerWidth,
      height: vv ? vv.height : window.innerHeight,
      top: vv ? vv.offsetTop : 0,
      left: vv ? vv.offsetLeft : 0,
    };
  }, []);

  const [viewport, setViewport] = useState(getViewport);
  const viewportFrameRef = useRef(null);
  const initialWidth = useRef(window.innerWidth);
  const initialHeight = useRef(window.innerHeight);

  useEffect(() => {
    const handleResize = () => {
      if (viewportFrameRef.current) {
        cancelAnimationFrame(viewportFrameRef.current);
      }
      viewportFrameRef.current = requestAnimationFrame(() => {
        const nextViewport = getViewport();
        setViewport((prev) => {
          const changed =
            Math.abs(prev.width - nextViewport.width) > 1 ||
            Math.abs(prev.height - nextViewport.height) > 1 ||
            Math.abs(prev.top - nextViewport.top) > 1 ||
            Math.abs(prev.left - nextViewport.left) > 1;
          return changed ? nextViewport : prev;
        });
      });
    };

    window.addEventListener("resize", handleResize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }

    return () => {
      if (viewportFrameRef.current) {
        cancelAnimationFrame(viewportFrameRef.current);
      }
      window.removeEventListener("resize", handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, [getViewport]);

  const keyboardModeCandidate =
    window.innerWidth < BREAKPOINTS.desktop &&
    ((Math.abs(viewport.width - initialWidth.current) <= 2 &&
      viewport.height < initialHeight.current * 0.85) ||
      viewport.top > 20);

  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const effectiveKeyboardMode = keyboardModeCandidate || isKeyboardMode;

  useEffect(() => {
    const keyboardLike =
      viewport.top > 20 ||
      (Math.abs(viewport.width - initialWidth.current) <= 2 &&
        viewport.height < initialHeight.current * 0.85);
    if (!keyboardLike) {
      initialWidth.current = viewport.width;
      initialHeight.current = viewport.height;
    }
  }, [viewport.width, viewport.height, viewport.top]);

  useEffect(() => {
    if (window.innerWidth >= BREAKPOINTS.desktop) {
      setIsKeyboardMode(false);
      return undefined;
    }

    if (keyboardModeCandidate) {
      setIsKeyboardMode(true);
      return undefined;
    }

    const closeTimer = setTimeout(
      () => setIsKeyboardMode(false),
      KEYBOARD_CLOSE_DELAY_MS,
    );
    return () => clearTimeout(closeTimer);
  }, [keyboardModeCandidate]);

  return {
    viewport,
    isKeyboardMode: effectiveKeyboardMode,
  };
}
