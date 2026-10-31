import React, { useEffect, useRef } from "react";

import { SPACE_RGB_COMPONENTS } from "../config/designSystem";
import { BREAKPOINTS, PERFORMANCE } from "../config/gameConstants";
import { prefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const REFERENCE_FRAME_MS = 1000 / 60;

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const toRgb = (c) => "rgb" + `(${c[0]},${c[1]},${c[2]})`;
const toRgba = (c, a) => (a >= 1 ? toRgb(c) : "rgb" + `a(${c[0]},${c[1]},${c[2]},${a})`);

const getTargetStarCount = (w, h) => {
  const baseDensity = w < BREAKPOINTS.mobile ? 4500 : 7500;
  return Math.max(100, Math.min(Math.floor((w * h) / baseDensity), 420));
};

function renderLimbDither(ctx, cx, cy, limbRadius, colors, isLight) {
  const rInner = Math.round(limbRadius * 0.88);
  const rOuter = Math.round(limbRadius * 1.32);
  const peak = limbRadius * 1.05;
  const startX = Math.max(0, cx - rOuter);
  const endX = Math.min(ctx.canvas.width, cx + rOuter);
  const startY = Math.max(0, cy - rOuter);
  const endY = Math.min(ctx.canvas.height, cy + rOuter);

  for (let py = startY; py < endY; py += 2) {
    for (let px = startX; px < endX; px += 2) {
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < rInner || dist > rOuter) continue;
      const falloff =
        dist < peak ? (dist - rInner) / (peak - rInner) : (rOuter - dist) / (rOuter - peak);
      const bayer = BAYER_4X4[(py >> 1) % 4][(px >> 1) % 4] / 16;
      if (falloff <= bayer) continue;

      let col = colors.vignette;
      let alpha = isLight ? 0.12 : 0.22;
      if (dist < limbRadius * 1.04) {
        col = colors.dither;
        alpha = isLight ? 0.22 : 0.38;
      } else if (dist < limbRadius * 1.18) {
        col = colors.reticle;
        alpha = isLight ? 0.16 : 0.28;
      }
      ctx.fillStyle = toRgba(col, alpha);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function renderVignetteDither(ctx, cx, cy, width, height, rOuter, colors, isLight) {
  const maxCornerDist = Math.hypot(cx, cy) || 1;
  const alpha = isLight ? 0.12 : 0.22;
  ctx.fillStyle = toRgba(colors.vignette, alpha);

  for (let py = 0; py < height; py += 4) {
    for (let px = 0; px < width; px += 4) {
      const dist = Math.hypot(px - cx, py - cy);
      if (dist <= rOuter) continue;
      const cornerRatio = dist / maxCornerDist;
      if (cornerRatio <= 0.58) continue;
      const norm = (cornerRatio - 0.58) / 0.42;
      const bayer = BAYER_4X4[(py >> 2) % 4][(px >> 2) % 4] / 16;
      if (norm * 0.7 > bayer) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
}

function renderReticleDetails(ctx, cx, cy, minDim, limbRadius, width, height, colors, isLight) {
  const rTicks = Math.round(limbRadius * 1.12);
  const tickAlpha = isLight ? 0.2 : 0.32;
  ctx.fillStyle = toRgba(colors.reticle, tickAlpha);

  for (let step = 0; step < 72; step++) {
    const theta = (step * Math.PI) / 36;
    const isMajor = step % 6 === 0;
    const isMedium = step % 2 === 0;
    const len = isMajor ? 5 : isMedium ? 3 : 2;
    const cos = Math.cos(theta);
    const sin = Math.sin(theta);
    const x1 = Math.round(cx + cos * rTicks);
    const y1 = Math.round(cy + sin * rTicks);
    const x2 = Math.round(cx + cos * (rTicks + len));
    const y2 = Math.round(cy + sin * (rTicks + len));
    const rx = Math.min(x1, x2);
    const ry = Math.min(y1, y2);
    const rw = Math.max(1, Math.abs(x2 - x1) + 1);
    const rh = Math.max(1, Math.abs(y2 - y1) + 1);
    ctx.fillRect(rx, ry, rw, rh);
  }

  const crosshairAnchors = [
    [-0.38, -0.28, 5],
    [0.38, -0.28, 5],
    [-0.38, 0.28, 5],
    [0.38, 0.28, 5],
    [-0.22, -0.42, 3],
    [0.22, -0.42, 3],
    [-0.22, 0.42, 3],
    [0.22, 0.42, 3],
    [-0.45, 0, 5],
    [0.45, 0, 5],
    [0, -0.44, 5],
    [0, 0.44, 5],
  ];

  const crossAlpha = isLight ? 0.22 : 0.36;
  ctx.fillStyle = toRgba(colors.reticle, crossAlpha);
  crosshairAnchors.forEach(([fx, fy, size]) => {
    const hx = Math.round(cx + fx * width);
    const hy = Math.round(cy + fy * height);
    if (hx >= 0 && hx < width && hy >= 0 && hy < height) {
      const half = Math.floor(size / 2);
      ctx.fillRect(hx - half, hy, size, 1);
      ctx.fillRect(hx, hy - half, 1, size);
    }
  });

  const axisStart = Math.round(limbRadius * 1.25);
  const axisEnd = Math.round(minDim * 0.48);
  for (let r = axisStart; r < axisEnd; r += 44) {
    ctx.fillRect(cx - 2, cy - r, 5, 1);
    ctx.fillRect(cx - 2, cy + r, 5, 1);
    ctx.fillRect(cx - r, cy - 2, 1, 5);
    ctx.fillRect(cx + r, cy - 2, 1, 5);
  }
}

function renderStaticOffscreen(offscreenCanvas, width, height, colors, isLight) {
  offscreenCanvas.width = width;
  offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const cx = Math.round(width / 2);
  const cy = Math.round(height / 2);
  const minDim = Math.min(width, height);
  const limbRadius = Math.round(minDim * 0.36);
  const rOuter = Math.round(limbRadius * 1.32);

  renderLimbDither(ctx, cx, cy, limbRadius, colors, isLight);
  renderVignetteDither(ctx, cx, cy, width, height, rOuter, colors, isLight);
  renderReticleDetails(ctx, cx, cy, minDim, limbRadius, width, height, colors, isLight);
}

function spawnStarfield(stars, width, height, isLight) {
  const count = getTargetStarCount(width, height);
  stars.length = 0;

  for (let i = 0; i < count; i++) {
    const layerRand = Math.random();
    let layer = "far";
    let colorKey = "dust";
    let size = 1;
    let parallax = -4;
    let baseAlpha = isLight ? 0.32 : 0.55;
    let isPlus = false;

    if (layerRand >= 0.85) {
      layer = "near";
      colorKey = Math.random() < 0.65 ? "ivory" : "accent";
      size = 2;
      parallax = -14;
      baseAlpha = isLight ? 0.65 : 0.95;
      isPlus = Math.random() < 0.14;
    } else if (layerRand >= 0.5) {
      layer = "mid";
      colorKey = "normal";
      size = Math.random() < 0.28 ? 2 : 1;
      parallax = -8;
      baseAlpha = isLight ? 0.45 : 0.75;
    }

    const seedPhase = Math.random() * Math.PI * 2;
    stars.push({
      x: Math.random() * width,
      y: Math.random() * height,
      size,
      layer,
      colorKey,
      parallax,
      baseAlpha,
      isPlus,
      seedPhase,
      phase: seedPhase,
      speed: 0.012 + Math.random() * 0.024,
    });
  }
}

function drawSingleStar(ctx, star, drawX, drawY, opacity, colors) {
  const col = colors[star.colorKey] || colors.normal;
  ctx.fillStyle = toRgba(col, opacity);
  const ix = Math.floor(drawX);
  const iy = Math.floor(drawY);

  if (star.isPlus) {
    ctx.fillRect(ix - 1, iy, 3, 1);
    ctx.fillRect(ix, iy - 1, 1, 3);
  } else {
    ctx.fillRect(ix, iy, star.size, star.size);
  }
}

function drawStarfield(ctx, stars, mouseX, mouseY, width, height, frameScale, colors, reduced) {
  stars.forEach((star) => {
    if (star.x > width) star.x = Math.random() * width;
    if (star.y > height) star.y = Math.random() * height;

    let stepped = 0.5;
    if (!reduced) {
      star.phase += star.speed * frameScale;
      const raw = Math.sin(star.phase) * 0.5 + 0.5;
      stepped = Math.floor(raw * 4) / 4;
    } else {
      const raw = Math.sin(star.seedPhase) * 0.5 + 0.5;
      stepped = Math.floor(raw * 4) / 4;
    }
    const opacity = star.baseAlpha * (0.35 + stepped * 0.65);

    let drawX = star.x + (reduced ? 0 : mouseX * star.parallax);
    let drawY = star.y + (reduced ? 0 : mouseY * star.parallax);

    if (drawX < 0) drawX += width;
    else if (drawX > width) drawX -= width;

    if (drawY < 0) drawY += height;
    else if (drawY > height) drawY -= height;

    drawSingleStar(ctx, star, drawX, drawY, opacity, colors);
  });
}

function spawnShootingStar(shootingStars, width, height) {
  const side = Math.random() < 0.5;
  const startX = side ? Math.random() * (width * 0.4) : width - Math.random() * (width * 0.4);
  const startY = Math.random() * (height * 0.35);
  const angle = Math.random() * 0.12 + 0.36;
  const speed = 5 + Math.random() * 6;

  shootingStars.push({
    x: startX,
    y: startY,
    vx: side ? speed * Math.cos(angle) : -speed * Math.cos(angle),
    vy: speed * Math.sin(angle),
    size: Math.random() < 0.5 ? 1 : 2,
    trail: [],
    maxTrailLength: 10 + Math.floor(Math.random() * 12),
    colorKey: Math.random() < 0.65 ? "ivory" : "normal",
    active: true,
  });
}

function drawShootingStars(ctx, shootingStars, width, height, frameScale, colors, isLight) {
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

    const col = colors[s.colorKey] || colors.normal;
    s.trail.forEach((p, index) => {
      const ratio = index / s.trail.length;
      const alpha = ratio * (isLight ? 0.35 : 0.65);
      ctx.fillStyle = toRgba(col, alpha);
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
    });

    if (s.active) {
      ctx.fillStyle = toRgba(col, isLight ? 0.6 : 0.9);
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    }
  });
}

function stepShootingStars(ctx, shootingStars, width, height, frameScale, colors, isLight) {
  if (Math.random() < 0.0018 * frameScale && shootingStars.length < 2) {
    spawnShootingStar(shootingStars, width, height);
  }
  const remaining = shootingStars.filter((s) => s.active);
  drawShootingStars(ctx, remaining, width, height, frameScale, colors, isLight);
  return remaining;
}

const SpaceBackground = React.memo(({ theme = "dark", isLight = false }) => {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!offscreenRef.current) {
      offscreenRef.current = document.createElement("canvas");
    }
    const offscreenCanvas = offscreenRef.current;

    let animationFrameId = null;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const modeKey = isLight ? "light" : "dark";
    const colors = SPACE_RGB_COMPONENTS[modeKey];

    renderStaticOffscreen(offscreenCanvas, width, height, colors, isLight);

    const stars = [];
    spawnStarfield(stars, width, height, isLight);

    let shootingStars = [];
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let lastFrameTime = 0;

    const renderFrame = (now = performance.now()) => {
      const reduced = prefersReducedMotion();
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(offscreenCanvas, 0, 0);

      const elapsed = lastFrameTime ? now - lastFrameTime : 16.7;
      const frameScale = Math.min(elapsed, 100) / REFERENCE_FRAME_MS;
      lastFrameTime = now;

      if (!reduced) {
        mouseX += (targetMouseX - mouseX) * Math.min(1, 0.05 * frameScale);
        mouseY += (targetMouseY - mouseY) * Math.min(1, 0.05 * frameScale);
      }

      drawStarfield(ctx, stars, mouseX, mouseY, width, height, frameScale, colors, reduced);

      if (!reduced) {
        shootingStars = stepShootingStars(
          ctx,
          shootingStars,
          width,
          height,
          frameScale,
          colors,
          isLight
        );
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      renderStaticOffscreen(offscreenCanvas, width, height, colors, isLight);
      spawnStarfield(stars, width, height, isLight);
      if (prefersReducedMotion()) {
        renderFrame(performance.now());
      }
    };
    window.addEventListener("resize", handleResize);

    const handleMouseMove = (e) => {
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    const loop = (now) => {
      const reduced = prefersReducedMotion();
      if (reduced) {
        renderFrame(now);
        return;
      }
      animationFrameId = requestAnimationFrame(loop);

      const minFrameMs =
        width < BREAKPOINTS.mobile
          ? PERFORMANCE.animationFrameMs.mobile
          : PERFORMANCE.animationFrameMs.desktop;
      const elapsed = now - lastFrameTime;
      if (elapsed < minFrameMs) return;

      renderFrame(now);
    };

    if (prefersReducedMotion()) {
      renderFrame(performance.now());
    } else {
      animationFrameId = requestAnimationFrame(loop);
    }

    const handleVisibilityChange = () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (!document.hidden && !prefersReducedMotion()) {
        lastFrameTime = 0;
        animationFrameId = requestAnimationFrame(loop);
      } else if (!document.hidden) {
        renderFrame(performance.now());
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isLight, theme]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
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
