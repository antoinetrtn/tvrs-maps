import React, { useEffect, useRef } from "react";

import { SPACE_RGB_COMPONENTS } from "../config/designSystem";
import { BREAKPOINTS, PERFORMANCE } from "../config/gameConstants";

// Reference frame duration the star speeds/probabilities were tuned at; the
// throttled loop scales its deltas by (elapsed / 16.7) so the motion stays
// identical at any frame rate.
const REFERENCE_FRAME_MS = 1000 / 60;

const getTargetStarCount = (w, h) => {
  const baseDensity = w < 768 ? 4000 : 8000;
  return Math.max(120, Math.min(Math.floor((w * h) / baseDensity), 450));
};

const spawnStars = (stars, w, h) => {
  const count = getTargetStarCount(w, h);
  stars.length = 0;
  for (let i = 0; i < count; i++) {
    let starType = "normal";
    const randType = Math.random();
    if (randType < 0.08) starType = "cyan";
    else if (randType < 0.16) starType = "magenta";

    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      size: Math.random() < 0.7 ? 2 : Math.random() < 0.9 ? 3 : 4,
      phase: Math.random() * Math.PI * 2,
      speed: 0.01 + Math.random() * 0.03,
      type: starType,
      chromaticSplit: Math.random() < 0.48,
      splitOffset: Math.random() < 0.5 ? 2.5 : 3.8,
    });
  }
};

const spawnShootingStar = (shootingStars, width, height, isLight) => {
  const side = Math.random() < 0.5;
  const startX = side ? Math.random() * (width * 0.4) : width - Math.random() * (width * 0.4);
  const startY = Math.random() * (height * 0.4);
  const angle = Math.random() * 0.15 + 0.35;
  const speed = 6 + Math.random() * 8;

  const colors = ["normal", "cyan", "magenta"];
  const randColor = isLight ? "normal" : colors[Math.floor(Math.random() * colors.length)];

  shootingStars.push({
    x: startX,
    y: startY,
    vx: side ? speed * Math.cos(angle) : -speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    size: Math.random() < 0.5 ? 3 : 4,
    trail: [],
    maxTrailLength: 12 + Math.floor(Math.random() * 16),
    colorType: randColor,
    active: true,
  });
};

const drawTwinklingStars = (
  ctx,
  stars,
  mouseX,
  mouseY,
  width,
  height,
  frameScale,
  starAlphaScales,
  starColors
) => {
  stars.forEach((star) => {
    if (star.x > width) star.x = Math.random() * width;
    if (star.y > height) star.y = Math.random() * height;

    star.phase += star.speed * frameScale;
    const opacity = Math.sin(star.phase) * 0.4 + 0.6;

    const parallaxFactor = star.type === "normal" ? -8 : -18;
    let drawX = star.x + mouseX * parallaxFactor;
    let drawY = star.y + mouseY * parallaxFactor;

    if (drawX < 0) drawX += width;
    else if (drawX > width) drawX -= width;

    if (drawY < 0) drawY += height;
    else if (drawY > height) drawY -= height;

    if (star.chromaticSplit) {
      const actualOffset = Math.floor(star.splitOffset * (star.size >= 3 ? 1.4 : 1.0));
      ctx.globalAlpha = opacity * starAlphaScales[star.type] * 0.95;
      ctx.fillStyle = starColors["glitchRed"];
      ctx.fillRect(Math.floor(drawX - actualOffset), Math.floor(drawY), star.size, star.size);

      ctx.fillStyle = starColors["glitchCyan"];
      ctx.fillRect(Math.floor(drawX + actualOffset), Math.floor(drawY), star.size, star.size);

      ctx.globalAlpha = opacity * starAlphaScales[star.type];
      ctx.fillStyle = starColors[star.type];
      ctx.fillRect(Math.floor(drawX), Math.floor(drawY), star.size, star.size);
    } else {
      ctx.globalAlpha = opacity * starAlphaScales[star.type];
      ctx.fillStyle = starColors[star.type];
      ctx.fillRect(Math.floor(drawX), Math.floor(drawY), star.size, star.size);
    }
  });
};

const drawShootingStars = (
  ctx,
  shootingStars,
  width,
  height,
  frameScale,
  starAlphaScales,
  starColors
) => {
  shootingStars.forEach((s) => {
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > s.maxTrailLength) {
      s.trail.shift();
    }

    s.x += s.vx * frameScale;
    s.y += s.vy * frameScale;

    if (s.y > height || s.x < -50 || s.x > width + 50) {
      s.active = false;
    }

    s.trail.forEach((p, index) => {
      const ratio = index / s.trail.length;
      if (Math.random() < 0.05) return;

      const trailSize = Math.max(1, Math.floor(s.size * ratio));
      const opacity = ratio * 0.7;
      const glitchOffset = Math.random() < 0.15 ? (Math.random() - 0.5) * 4 : 0;

      if (Math.random() < 0.25) {
        ctx.globalAlpha = opacity * starAlphaScales[s.colorType] * 0.6;
        ctx.fillStyle = starColors["glitchRed"];
        ctx.fillRect(Math.floor(p.x + glitchOffset - 1), Math.floor(p.y), trailSize, trailSize);

        ctx.fillStyle = starColors["glitchCyan"];
        ctx.fillRect(Math.floor(p.x + glitchOffset + 1), Math.floor(p.y), trailSize, trailSize);
      } else {
        ctx.globalAlpha = opacity * starAlphaScales[s.colorType];
        ctx.fillStyle = starColors[s.colorType];
        ctx.fillRect(Math.floor(p.x + glitchOffset), Math.floor(p.y), trailSize, trailSize);
      }
    });

    if (s.active) {
      ctx.globalAlpha = starAlphaScales[s.colorType] * 0.6;
      ctx.fillStyle = starColors["glitchRed"];
      ctx.fillRect(Math.floor(s.x - 2), Math.floor(s.y), s.size, s.size);

      ctx.fillStyle = starColors["glitchCyan"];
      ctx.fillRect(Math.floor(s.x + 2), Math.floor(s.y), s.size, s.size);

      ctx.globalAlpha = starAlphaScales[s.colorType];
      ctx.fillStyle = starColors[s.colorType];
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    }
  });
};

const SpaceBackground = React.memo(({ theme = "dark", isLight = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const stars = [];
    spawnStars(stars, width, height);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      spawnStars(stars, width, height);
    };
    window.addEventListener("resize", handleResize);

    const modeKey = isLight ? "light" : "dark";
    const starColors = {};
    const starAlphaScales = {};
    ["normal", "cyan", "magenta", "glitchRed", "glitchCyan"].forEach((type) => {
      const rgb = SPACE_RGB_COMPONENTS[modeKey][type];
      starColors[type] = `rgb` + `(${rgb[0]},${rgb[1]},${rgb[2]})`;
      starAlphaScales[type] = isLight
        ? 0.15
        : type === "normal"
          ? 0.8
          : type.startsWith("glitch")
            ? 0.95
            : 0.85;
    });

    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    let shootingStars = [];
    let lastFrameTime = 0;

    const draw = (now = performance.now()) => {
      animationFrameId = requestAnimationFrame(draw);

      const minFrameMs =
        width < BREAKPOINTS.mobile
          ? PERFORMANCE.animationFrameMs.mobile
          : PERFORMANCE.animationFrameMs.desktop;
      const elapsed = now - lastFrameTime;
      if (elapsed < minFrameMs) return;
      const frameScale = lastFrameTime ? Math.min(elapsed, 100) / REFERENCE_FRAME_MS : 1;
      lastFrameTime = now;

      ctx.clearRect(0, 0, width, height);

      mouseX += (targetMouseX - mouseX) * Math.min(1, 0.05 * frameScale);
      mouseY += (targetMouseY - mouseY) * Math.min(1, 0.05 * frameScale);

      drawTwinklingStars(
        ctx,
        stars,
        mouseX,
        mouseY,
        width,
        height,
        frameScale,
        starAlphaScales,
        starColors
      );

      if (Math.random() < 0.003 * frameScale && shootingStars.length < 3) {
        spawnShootingStar(shootingStars, width, height, isLight);
      }

      shootingStars = shootingStars.filter((s) => s.active);
      drawShootingStars(ctx, shootingStars, width, height, frameScale, starAlphaScales, starColors);

      ctx.globalAlpha = 1;
    };

    animationFrameId = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isLight, theme]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
});

export default SpaceBackground;
