import "./RulesScene.css";
import "./RulesSceneB.css";
import "./RulesSceneC.css";
import "./RulesSceneD.css";

import { useEffect, useRef, useState } from "react";

import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";
import { SCENES } from "./rulesSceneMap";

export default function RulesScene({ id }) {
  const containerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(() => typeof IntersectionObserver === "undefined");
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return undefined;
    }
    const node = containerRef.current;
    if (!node) {
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      setIsPlaying(Boolean(entry?.isIntersecting));
    });
    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, []);

  const SceneComponent = SCENES[id];
  if (!SceneComponent) {
    return null;
  }

  const isStaticClass = reduced ? " is-static" : "";
  const isPlayingClass = isPlaying ? " is-playing" : "";
  const className = `rules-scene${isPlayingClass}${isStaticClass}`;

  return (
    <div ref={containerRef} className={className} data-scene={id}>
      <SceneComponent />
    </div>
  );
}
