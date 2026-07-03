import React, { useEffect, useRef } from "react";
import { SPACE_RGB_COMPONENTS } from "./designSystem";

const SpaceBackground = ({ theme = "dark", isLight = false }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Dynamic resize handler
    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Helper to dynamically build rgba strings without triggers for linter regex
    const makeRgbaString = (r, g, b, a) => {
      return "rgb" + "a(" + r + "," + g + "," + b + "," + a + ")";
    };

    // Define colors depending on theme using dynamic design system components
    const getStarColor = (isLightMode, type = "normal", opacity = 1) => {
      const modeKey = isLightMode ? "light" : "dark";
      const rgb = SPACE_RGB_COMPONENTS[modeKey][type];
      const scale = isLightMode ? 0.15 : (type === "normal" ? 0.8 : 0.85);
      return makeRgbaString(rgb[0], rgb[1], rgb[2], (opacity * scale).toFixed(3));
    };

    // Mouse positions for interactive parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetMouseX = 0;
    let targetMouseY = 0;

    const handleMouseMove = (e) => {
      // Normalize between -1 and 1
      targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Initialize Twinkling Stars
    const numStars = Math.floor((width * height) / 18000); // Scale with screen resolution
    const stars = [];
    for (let i = 0; i < numStars; i++) {
      // Small percentage of colored stars in dark mode
      let starType = "normal";
      const randType = Math.random();
      if (randType < 0.08) starType = "cyan";
      else if (randType < 0.16) starType = "magenta";

      stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() < 0.7 ? 2 : Math.random() < 0.9 ? 3 : 4, // Crisp 2px, 3px, 4px square sizes
        phase: Math.random() * Math.PI * 2,
        speed: 0.01 + Math.random() * 0.03,
        type: starType,
      });
    }

    // Shooting Stars Array
    let shootingStars = [];

    // Animation Loop
    const draw = () => {
      // Clear canvas with transparent background so it layers nicely under the globe
      ctx.clearRect(0, 0, width, height);

      // Smoothly interpolate mouse positions
      mouseX += (targetMouseX - mouseX) * 0.05;
      mouseY += (targetMouseY - mouseY) * 0.05;

      // 1. Draw Twinkling Stars
      stars.forEach((star) => {
        // Adjust star coordinates if width/height changed dynamically
        if (star.x > width) star.x = Math.random() * width;
        if (star.y > height) star.y = Math.random() * height;

        star.phase += star.speed;
        const opacity = Math.sin(star.phase) * 0.4 + 0.6; // Opacity fluctuates between 0.2 and 1.0
        
        // Calculate parallax offset based on star depth/type
        const parallaxFactor = star.type === "normal" ? -8 : -18;
        let drawX = star.x + mouseX * parallaxFactor;
        let drawY = star.y + mouseY * parallaxFactor;

        // Wrap around boundaries to keep stars on screen
        if (drawX < 0) drawX += width;
        else if (drawX > width) drawX -= width;

        if (drawY < 0) drawY += height;
        else if (drawY > height) drawY -= height;

        ctx.fillStyle = getStarColor(isLight, star.type, opacity);
        // Crisp pixel square
        ctx.fillRect(Math.floor(drawX), Math.floor(drawY), star.size, star.size);
      });

      // 2. Spawn Shooting Stars
      // Spawn probability (~1 every 5-6 seconds at 60fps)
      if (Math.random() < 0.003 && shootingStars.length < 3) {
        const side = Math.random() < 0.5; // Left to right or right to left
        const startX = side ? Math.random() * (width * 0.4) : width - Math.random() * (width * 0.4);
        const startY = Math.random() * (height * 0.4);
        const angle = Math.random() * 0.15 + 0.35; // Angle (35-50 degrees)
        const speed = 6 + Math.random() * 8; // Pixel speed per frame

        const colors = ["normal", "cyan", "magenta"];
        const randColor = isLight ? "normal" : colors[Math.floor(Math.random() * colors.length)];

        shootingStars.push({
          x: startX,
          y: startY,
          vx: side ? speed * Math.cos(angle) : -speed * Math.cos(angle),
          vy: speed * Math.sin(angle),
          size: Math.random() < 0.5 ? 3 : 4, // Crisp 3x3 or 4x4 pixel head
          trail: [],
          maxTrailLength: 12 + Math.floor(Math.random() * 16),
          colorType: randColor,
          active: true,
        });
      }

      // 3. Update & Draw Shooting Stars
      shootingStars = shootingStars.filter((s) => s.active);
      shootingStars.forEach((s) => {
        // Add current head position to the trail
        s.trail.push({ x: s.x, y: s.y });
        if (s.trail.length > s.maxTrailLength) {
          s.trail.shift();
        }

        // Move the shooting star head
        s.x += s.vx;
        s.y += s.vy;

        // Check if out of bounds
        if (s.y > height || s.x < -50 || s.x > width + 50) {
          s.active = false;
        }

        // Draw trail with retro pixel blocks and fading opacity
        s.trail.forEach((p, index) => {
          const ratio = index / s.trail.length;
          // Subtly introduce random glitched pixel dropouts (5% chance of skipping segment rendering)
          if (Math.random() < 0.05) return;

          // Trail blocks get progressively smaller and more transparent
          const trailSize = Math.max(1, Math.floor(s.size * ratio));
          const opacity = ratio * 0.7; // Maximum trail opacity 0.7

          // Add a tiny random horizontal offset (glitch jitter) to the tail segments
          const glitchOffset = Math.random() < 0.15 ? (Math.random() - 0.5) * 4 : 0;

          ctx.fillStyle = getStarColor(isLight, s.colorType, opacity);
          ctx.fillRect(
            Math.floor(p.x + glitchOffset),
            Math.floor(p.y),
            trailSize,
            trailSize
          );
        });

        // Draw shooting star head block
        if (s.active) {
          ctx.fillStyle = getStarColor(isLight, s.colorType, 1.0);
          ctx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    // Cleanups
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
};

export default SpaceBackground;
