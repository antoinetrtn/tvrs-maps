import React, { useEffect, useRef } from "react";
import "./PixelFireworks.css";

import { AVATAR_COLORS } from "../config/designSystem";

const RETRO_COLORS = Object.values(AVATAR_COLORS);

const PixelFireworks = ({ duration = 6000 }) => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let isActive = true;

    // Resize canvas
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Particle class representing individual pixels of the explosion
    class Particle {
      constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 3; // 3 to 6 pixel squares
        this.color = color;
        // Explode in all directions
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 4 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - 1.5; // slight upward boost
        this.alpha = 1.0;
        this.decay = Math.random() * 0.015 + 0.01;
        this.gravity = 0.08;
      }

      update() {
        this.vy += this.gravity;
        this.x += this.vx;
        this.y += this.vy;
        this.alpha -= this.decay;
      }

      draw(c) {
        c.save();
        c.globalAlpha = this.alpha;
        c.fillStyle = this.color;
        // Make it look pixelated by rendering filled squares
        c.fillRect(
          Math.floor(this.x),
          Math.floor(this.y),
          Math.floor(this.size),
          Math.floor(this.size)
        );
        c.restore();
      }
    }

    // Rocket class that shoots up and triggers explosions
    class Rocket {
      constructor() {
        this.x = Math.random() * (canvas.width - 200) + 100;
        this.y = canvas.height;
        this.targetY = Math.random() * (canvas.height * 0.4) + canvas.height * 0.15;
        this.speed = Math.random() * 5 + 8;
        this.color = RETRO_COLORS[Math.floor(Math.random() * RETRO_COLORS.length)];
        this.exploded = false;
      }

      update() {
        this.y -= this.speed;
        if (this.y <= this.targetY) {
          this.exploded = true;
        }
      }

      draw(c) {
        c.fillStyle = this.color;
        // Small 4x8 px rocket
        c.fillRect(Math.floor(this.x), Math.floor(this.y), 4, 8);
      }
    }

    const particles = [];
    const rockets = [];

    // Launch rocket function
    const spawnRocket = () => {
      if (!isActive) return;
      rockets.push(new Rocket());
      // schedule next spawn
      setTimeout(spawnRocket, Math.random() * 600 + 400);
    };

    // Initial rockets
    spawnRocket();
    setTimeout(spawnRocket, 300);

    // Animation Loop
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.update();
        r.draw(ctx);

        if (r.exploded) {
          // Spawn explosion particles
          const particleCount = Math.floor(Math.random() * 30 + 35);
          for (let p = 0; p < particleCount; p++) {
            particles.push(new Particle(r.x, r.y, r.color));
          }
          rockets.splice(i, 1);
        }
      }

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        p.draw(ctx);

        if (p.alpha <= 0) {
          particles.splice(i, 1);
        }
      }

      animationFrameId = requestAnimationFrame(tick);
    };

    tick();

    // Stop spawning new rockets after the duration
    const stopTimer = setTimeout(() => {
      isActive = false;
    }, duration - 1500);

    // Clean up
    return () => {
      isActive = false;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      clearTimeout(stopTimer);
    };
  }, [duration]);

  return <canvas ref={canvasRef} className="pixel-fireworks-canvas" />;
};

export default React.memo(PixelFireworks);
