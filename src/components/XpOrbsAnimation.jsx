import React, { useEffect, useRef } from "react";
import { GAME_XP_COLORS } from "../config/designSystem";
import "./XpOrbsAnimation.css";

const XpOrbsAnimation = ({
  sourceRef,
  targetRef,
  onOrbCollect,
  onComplete,
  count = 15,
  active = true
}) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!active || !sourceRef?.current || !targetRef?.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let particles = [];

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

        // Green-Yellow retro pixel look
        this.colorInner = GAME_XP_COLORS.greenInner;
        this.colorOuter = GAME_XP_COLORS.greenOuter;
        if (Math.random() > 0.6) {
          this.colorInner = GAME_XP_COLORS.yellowInner;
          this.colorOuter = GAME_XP_COLORS.yellowOuter;
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
          if (onOrbCollect) onOrbCollect();
          return;
        }

        const t = this.progress;
        const mt = 1 - t;
        
        // Quadratic bezier
        const bx = mt * mt * startX + 2 * mt * t * this.cpX + t * t * endX;
        const by = mt * mt * startY + 2 * mt * t * this.cpY + t * t * endY;
        
        // Perpendicular offset oscillation
        const wobble = Math.sin(time * this.wobbleSpeed + this.wobblePhase) * this.wobbleAmount * (1 - t);

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
        if (onComplete) onComplete();
      } else {
        animationFrameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [active, sourceRef, targetRef, count, onOrbCollect, onComplete]);

  return <canvas ref={canvasRef} className="xp-orbs-canvas" />;
};

export default React.memo(XpOrbsAnimation);
