import "./XpOrbsAnimation.css";

import React, { useEffect, useRef } from "react";

import { getXpOrbColors } from "../config/designSystem";
import usePrefersReducedMotion from "../hooks/usePrefersReducedMotion";

const XpOrbsAnimation = ({
  sourceRef,
  targetRef,
  onOrbCollect,
  onComplete,
  count = 15,
  active = true,
}) => {
  const canvasRef = useRef(null);
  const reducedMotion = usePrefersReducedMotion();
  const onOrbCollectRef = useRef(onOrbCollect);
  const onCompleteRef = useRef(onComplete);
  onOrbCollectRef.current = onOrbCollect;
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!active) return undefined;
    if (reducedMotion) {
      if (onCompleteRef.current) onCompleteRef.current();
      return undefined;
    }
    if (!sourceRef?.current || !targetRef?.current) return undefined;

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return undefined;

    const orbColors = getXpOrbColors(); // live --xp-* tokens

    let animationFrameId;
    const particles = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Get screen coordinates
    const sourceRect = sourceRef.current.getBoundingClientRect();
    const targetRect = targetRef.current.getBoundingClientRect();

    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;

    class Orb {
      constructor(idx) {
        this.x = startX + (Math.random() - 0.5) * 30;
        this.y = startY + (Math.random() - 0.5) * 30;

        // Bezier characteristics
        this.progress = 0;
        this.delay = idx * 80 + Math.random() * 40;
        this.speed = Math.random() * 0.025 + 0.02; // Staggered speed

        const midX = (startX + endX) / 2;

        // Push control point up for a nice arc
        this.cpX = midX + (Math.random() - 0.5) * 160;
        this.cpY = Math.min(startY, endY) - 120 - Math.random() * 80;

        // Sine wobble
        this.wobbleSpeed = Math.random() * 0.15 + 0.08;
        this.wobbleAmount = Math.random() * 20 + 10;
        this.wobblePhase = Math.random() * Math.PI * 2;

        this.size = Math.random() * 3 + 7; // 7 to 10px pixels
        this.collected = false;

        // Relief-green orbs with a few accent (teal ink) ones
        this.colorInner = orbColors.greenInner;
        this.colorOuter = orbColors.greenOuter;
        if (Math.random() > 0.6) {
          this.colorInner = orbColors.accentInner;
          this.colorOuter = orbColors.accentOuter;
        }
      }

      update(time) {
        if (this.delay > 0) {
          this.delay -= 16.7;
          return;
        }

        if (this.collected) return;

        this.progress += this.speed;
        if (this.progress >= 1) {
          this.progress = 1;
          this.collected = true;
          if (onOrbCollectRef.current) onOrbCollectRef.current();
          return;
        }

        const t = this.progress;
        const mt = 1 - t;

        // Quadratic bezier
        const bx = mt * mt * startX + 2 * mt * t * this.cpX + t * t * endX;
        const by = mt * mt * startY + 2 * mt * t * this.cpY + t * t * endY;

        // Perpendicular offset oscillation
        const wobble =
          Math.sin(time * this.wobbleSpeed + this.wobblePhase) * this.wobbleAmount * (1 - t);

        this.x = bx + wobble;
        this.y = by + wobble * 0.3;
      }

      draw(c) {
        if (this.delay > 0 || this.collected) return;

        c.save();

        const s = Math.floor(this.size);
        const border = 2;

        // Retro shadow/border
        c.fillStyle = this.colorOuter;
        c.fillRect(Math.floor(this.x - s / 2), Math.floor(this.y - s / 2), s, s);

        // Core fill
        c.fillStyle = this.colorInner;
        c.fillRect(
          Math.floor(this.x - s / 2 + border),
          Math.floor(this.y - s / 2 + border),
          s - border * 2,
          s - border * 2
        );

        c.restore();
      }
    }

    // Initialize orbs
    for (let i = 0; i < count; i++) {
      particles.push(new Orb(i));
    }

    let frame = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      frame++;

      let allCollected = true;
      particles.forEach((p) => {
        p.update(frame);
        p.draw(ctx);
        if (!p.collected) {
          allCollected = false;
        }
      });

      if (allCollected) {
        if (onCompleteRef.current) onCompleteRef.current();
      } else {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [active, reducedMotion, sourceRef, targetRef, count]);

  if (reducedMotion) return null;

  return <canvas ref={canvasRef} className="xp-orbs-canvas" />;
};

export default React.memo(XpOrbsAnimation);
