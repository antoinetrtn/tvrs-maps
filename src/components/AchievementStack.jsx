import React, { useEffect, useLayoutEffect, useRef } from "react";

import InvaderAvatar from "./InvaderAvatar.jsx";
import { Toast } from "./ui/Toast.jsx";

const TOAST_MS = 4000;
const STAGGER_MS = 240;

const AchievementItem = ({ achievement, index, onDismiss }) => {
  const { id, title, message, invaderId, color } = achievement;
  // Each card lives TOAST_MS after its own (staggered) appearance.
  const delayRef = useRef(index * STAGGER_MS);
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(id), TOAST_MS + delayRef.current);
    return () => clearTimeout(timer);
  }, [id, onDismiss]);

  return (
    <li className="achievement-stack-item" style={{ "--i": index }}>
      <Toast
        tone="success"
        title={title}
        message={message}
        icon={<InvaderAvatar invaderId={invaderId} color={color} size={36} />}
        onClose={() => onDismiss(id)}
      />
    </li>
  );
};

/**
 * Ordered stack of achievement toasts. Its height is published as --achievement-stack-h on
 * <html> so the end screen can reserve the space on mobile (no overlap with title or buttons).
 */
const AchievementStack = ({ achievements, onDismiss }) => {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return undefined;
    const update = () => {
      // Bottom edge of the stack (top offset included) so the reserved room clears it.
      const h = el.childElementCount ? Math.ceil(el.getBoundingClientRect().bottom) : 0;
      root.style.setProperty("--achievement-stack-h", `${h}px`);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--achievement-stack-h");
    };
  }, []);

  return (
    <ol
      ref={ref}
      className="achievement-stack"
      role="status"
      aria-live="polite"
      data-count={achievements.length}
    >
      {achievements.map((a, i) => (
        <AchievementItem key={a.id} achievement={a} index={i} onDismiss={onDismiss} />
      ))}
    </ol>
  );
};

export default React.memo(AchievementStack);
