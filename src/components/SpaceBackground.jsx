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

function getLimbFalloff(dist, rInner, rOuter, peak) {
  return dist < peak ? (dist - rInner) / (peak - rInner) : (rOuter - dist) / (rOuter - peak);
}

function getLimbPixelStyle(dist, limbRadius, styleDither, styleReticle, styleVignette) {
  if (dist < limbRadius * 1.04) return styleDither;
  if (dist < limbRadius * 1.18) return styleReticle;
  return styleVignette;
}

function renderLimbDither(ctx, cx, cy, limbRadius, colors) {
  const rInner = Math.round(limbRadius * 0.88);
  const rOuter = Math.round(limbRadius * 1.32);
  const peak = limbRadius * 1.05;
  const startX = Math.max(0, cx - rOuter);
  const endX = Math.min(ctx.canvas.width, cx + rOuter);
  const startY = Math.max(0, cy - rOuter);
  const endY = Math.min(ctx.canvas.height, cy + rOuter);

  const styleDither = toRgba(colors.dither, 0.38);
  const styleReticle = toRgba(colors.reticle, 0.28);
  const styleVignette = toRgba(colors.vignette, 0.22);

  for (let py = startY; py < endY; py += 2) {
    for (let px = startX; px < endX; px += 2) {
      const dist = Math.hypot(px - cx, py - cy);
      if (dist < rInner || dist > rOuter) continue;
      const falloff = getLimbFalloff(dist, rInner, rOuter, peak);
      const bayer = BAYER_4X4[(py >> 1) % 4][(px >> 1) % 4] / 16;
      if (falloff <= bayer) continue;

      ctx.fillStyle = getLimbPixelStyle(dist, limbRadius, styleDither, styleReticle, styleVignette);
      ctx.fillRect(px, py, 1, 1);
    }
  }
}

function renderVignetteDither(ctx, cx, cy, width, height, rOuter, colors) {
  const maxCornerDist = Math.hypot(cx, cy) || 1;
  const alpha = 0.22;
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

function renderReticleDetails(ctx, { cx, cy, minDim, limbRadius, width, height, colors }) {
  const rTicks = Math.round(limbRadius * 1.12);
  const tickAlpha = 0.32;
  ctx.fillStyle = toRgba(colors.reticle, tickAlpha);

  for (let step = 0; step < 72; step++) {
    const theta = (step * Math.PI) / 36;
    const isMajor = step % 6 === 0;
    const isMedium = step % 2 === 0;
    let len = 2;
    if (isMajor) len = 5;
    else if (isMedium) len = 3;
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

  const crossAlpha = 0.36;
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

// Static layer (limb dither, vignette, reticle) is centred on the globe's real
// on-screen disc when `frame` is known, so it follows the home offset and zoom
// instead of staying pinned to the viewport centre.
function renderStaticOffscreen(offscreenCanvas, width, height, colors, frame) {
  if (offscreenCanvas.width !== width) offscreenCanvas.width = width;
  if (offscreenCanvas.height !== height) offscreenCanvas.height = height;
  const ctx = offscreenCanvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  const minDim = Math.min(width, height);
  const cx = frame ? frame.cx : Math.round(width / 2);
  const cy = frame ? frame.cy : Math.round(height / 2);
  const limbRadius = frame ? frame.r : Math.round(minDim * 0.36);
  const rOuter = Math.round(limbRadius * 1.32);

  renderLimbDither(ctx, cx, cy, limbRadius, colors);
  renderVignetteDither(ctx, cx, cy, width, height, rOuter, colors);
  renderReticleDetails(ctx, { cx, cy, minDim, limbRadius, width, height, colors });
}

function spawnStarfield(stars, width, height) {
  const count = getTargetStarCount(width, height);
  stars.length = 0;

  for (let i = 0; i < count; i++) {
    const layerRand = Math.random();
    let layer = "far";
    let colorKey = "dust";
    let size = 1;
    let parallax = -4;
    let baseAlpha = 0.55;
    let isPlus = false;

    if (layerRand >= 0.85) {
      layer = "near";
      colorKey = Math.random() < 0.65 ? "ivory" : "accent";
      size = 2;
      parallax = -14;
      baseAlpha = 0.95;
      isPlus = Math.random() < 0.14;
    } else if (layerRand >= 0.5) {
      layer = "mid";
      colorKey = "normal";
      size = Math.random() < 0.28 ? 2 : 1;
      parallax = -8;
      baseAlpha = 0.75;
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

function drawStarfield({ ctx, stars, mouseX, mouseY, width, height, frameScale, colors, reduced }) {
  stars.forEach((star) => {
    if (star.x > width) star.x = Math.random() * width;
    if (star.y > height) star.y = Math.random() * height;

    if (!reduced) star.phase += star.speed * frameScale;
    const raw = Math.sin(reduced ? star.seedPhase : star.phase) * 0.5 + 0.5;
    const stepped = Math.floor(raw * 4) / 4;
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

function drawShootingStars(ctx, shootingStars, width, height, frameScale, colors) {
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
      const alpha = ratio * 0.65;
      ctx.fillStyle = toRgba(col, alpha);
      ctx.fillRect(Math.floor(p.x), Math.floor(p.y), 1, 1);
    });

    if (s.active) {
      ctx.fillStyle = toRgba(col, 0.9);
      ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    }
  });
}

function stepShootingStars(ctx, shootingStars, width, height, frameScale, colors) {
  if (Math.random() < 0.0018 * frameScale && shootingStars.length < 2) {
    spawnShootingStar(shootingStars, width, height);
  }
  const remaining = shootingStars.filter((s) => s.active);
  drawShootingStars(ctx, remaining, width, height, frameScale, colors);
  return remaining;
}

// Quantise to whole 4 px steps: keeps dither cells on true square pixels and
// avoids rebuilding the static layer for sub-pixel camera jitter.
const quantizeFrame = (f) =>
  f && Number.isFinite(f.cx) && Number.isFinite(f.cy) && Number.isFinite(f.r) && f.r > 4
    ? { cx: Math.round(f.cx / 4) * 4, cy: Math.round(f.cy / 4) * 4, r: Math.round(f.r / 4) * 4 }
    : null;
const sameFrame = (a, b) =>
  a === b || (Boolean(a) && Boolean(b) && a.cx === b.cx && a.cy === b.cy && a.r === b.r);

// Expose the globe centre to sibling CSS layers (backdrop vignette).
const publishFrameVars = (el, frame) => {
  if (!el) return;
  if (frame) {
    el.style.setProperty("--globe-cx", `${frame.cx}px`);
    el.style.setProperty("--globe-cy", `${frame.cy}px`);
  } else {
    el.style.removeProperty("--globe-cx");
    el.style.removeProperty("--globe-cy");
  }
};

const SpaceBackground = React.memo(({ getGlobeFrame }) => {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null);
  const frameGetterRef = useRef(getGlobeFrame);
  frameGetterRef.current = getGlobeFrame;

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

    const colors = SPACE_RGB_COMPONENTS;
    let globeFrame = null;
    const readFrame = () => quantizeFrame(frameGetterRef.current?.());
    const syncGlobeFrame = () => {
      const next = readFrame();
      if (sameFrame(next, globeFrame)) return false;
      globeFrame = next;
      publishFrameVars(canvas.parentElement, globeFrame);
      renderStaticOffscreen(offscreenCanvas, width, height, colors, globeFrame);
      return true;
    };

    renderStaticOffscreen(offscreenCanvas, width, height, colors, globeFrame);

    const stars = [];
    spawnStarfield(stars, width, height);

    let shootingStars = [];
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;
    let lastFrameTime = 0;

    const renderFrame = (now = performance.now()) => {
      syncGlobeFrame();
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

      drawStarfield({
        ctx,
        stars,
        mouseX,
        mouseY,
        width,
        height,
        frameScale,
        colors,
        reduced,
      });

      if (!reduced) {
        shootingStars = stepShootingStars(ctx, shootingStars, width, height, frameScale, colors);
      }
    };

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      globeFrame = readFrame();
      publishFrameVars(canvas.parentElement, globeFrame);
      renderStaticOffscreen(offscreenCanvas, width, height, colors, globeFrame);
      spawnStarfield(stars, width, height);
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

    // Reduced motion has no RAF loop: poll the globe frame cheaply instead.
    const reducedPoll = window.setInterval(() => {
      if (prefersReducedMotion() && !document.hidden && syncGlobeFrame()) {
        renderFrame(performance.now());
      }
    }, 250);

    return () => {
      window.clearInterval(reducedPoll);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      tabIndex={-1}
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
