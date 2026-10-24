import "./ConquestShieldLayer.css";

import { Shield } from "pixelarticons/react";
import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";

import { countryDataMap } from "../data/gameData";
import { isBeyondHorizon } from "./conquestCursorView";
import { formatShieldSeconds, getPaletteEntry, shieldCountdowns } from "./conquestLogic";

const GLOBE_RADIUS = 100;
const DEG = Math.PI / 180;
const MAX_BADGES = 12;
const DOM_UPDATE_INTERVAL_MS = 250; // DOM update rate ~4 Hz

const getGlobe = () => (typeof window === "undefined" ? null : window.__TVRS_GLOBE_EL__);

const _v = new THREE.Vector3();
const _cam = [0, 0, 0];
const _dir = [0, 0, 0];

/**
 * Pure badge model computation: owner color, formatted text, pips and blink state.
 * Fortify step 1 adds +30 s, step 2 adds +60 s (total base 20 s / 50 s / 110 s).
 */
/* eslint-disable-next-line react-refresh/only-export-components */
export function computeShieldBadge(shield, player) {
  const color = getPaletteEntry(player?.color).hex;
  const ms = Math.max(0, Number(shield.ms) || 0);
  const isBlinking = ms > 0 && ms <= 5000;
  const level = Math.max(0, Math.min(2, Number(shield.level) || 0));
  const text = formatShieldSeconds(ms);

  const maxMs = level === 2 ? 110000 : level === 1 ? 50000 : 20000;
  const fraction = Math.min(1, Math.max(0, ms / maxMs));
  const step = Math.min(8, Math.max(0, Math.ceil(fraction * 8)));

  return {
    id: shield.id,
    color,
    mine: Boolean(shield.mine),
    ownerId: shield.ownerId,
    level,
    pips: [level >= 1, level >= 2],
    ms,
    text,
    isBlinking,
    step,
  };
}

/**
 * Projects country centroid onto screen coordinates, culling behind the horizon
 * or outside viewport bounds.
 */
function projectCentroid(data, camera, box, rect) {
  const phi = (90 - data.lat) * DEG;
  const theta = (90 - data.lng) * DEG;
  const sinPhi = Math.sin(phi);
  const x = GLOBE_RADIUS * sinPhi * Math.cos(theta);
  const y = GLOBE_RADIUS * Math.cos(phi);
  const z = GLOBE_RADIUS * sinPhi * Math.sin(theta);

  _dir[0] = x / GLOBE_RADIUS;
  _dir[1] = y / GLOBE_RADIUS;
  _dir[2] = z / GLOBE_RADIUS;

  if (isBeyondHorizon(_dir, _cam, GLOBE_RADIUS)) return null;

  _v.set(x, y, z).project(camera);
  if (_v.z >= 1) return null;

  const sx = box.left + (_v.x * 0.5 + 0.5) * box.width;
  const sy = box.top + (-_v.y * 0.5 + 0.5) * box.height;

  if (sx < -40 || sx > rect.width + 40 || sy < -40 || sy > rect.height + 40) return null;

  return { sx: Math.round(sx), sy: Math.round(sy) };
}

function buildFallbackBadges(activeShields, players) {
  return activeShields.map((shield) => {
    const player = (players || []).find((p) => p.user_id === shield.ownerId);
    return { ...computeShieldBadge(shield, player), sx: 0, sy: 0 };
  });
}

function buildScreenBadges(activeShields, players, camera, box, rect) {
  const nextBadges = [];
  for (const shield of activeShields) {
    const data = countryDataMap[shield.id];
    if (!data || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) continue;
    const screenPos = projectCentroid(data, camera, box, rect);
    if (!screenPos) continue;
    const player = (players || []).find((p) => p.user_id === shield.ownerId);
    nextBadges.push({
      ...computeShieldBadge(shield, player),
      sx: screenPos.sx,
      sy: screenPos.sy,
    });
  }
  return nextBadges;
}

/**
 * Renders small square pixel badges for active shields projected on the globe.
 * DOM updates are throttled at ~4 Hz and capped at 12 badges.
 */
const ConquestShieldLayer = ({ conquest }) => {
  const live = conquest?.match?.status === "live";
  const [badges, setBadges] = useState([]);
  const stateRef = useRef({ conquest });
  stateRef.current = { conquest };

  useEffect(() => {
    if (!live) {
      setBadges([]);
      return undefined;
    }

    const update = () => {
      const cur = stateRef.current.conquest;
      if (!cur) return;
      const now = Date.now();
      const activeShields = shieldCountdowns(
        cur.claims,
        cur.userId,
        now,
        cur.clockOffset || 0
      ).slice(0, MAX_BADGES);

      if (activeShields.length === 0) {
        setBadges((prev) => (prev.length === 0 ? prev : []));
        return;
      }

      const globe = getGlobe();
      const camera = globe?.camera?.();
      const canvas = globe?.renderer?.()?.domElement;
      if (!camera || !canvas) {
        setBadges(buildFallbackBadges(activeShields, cur.players));
        return;
      }

      camera.updateMatrixWorld();
      _cam[0] = camera.position.x;
      _cam[1] = camera.position.y;
      _cam[2] = camera.position.z;

      const box = canvas.getBoundingClientRect();
      const rect = { width: window.innerWidth, height: window.innerHeight };
      setBadges(buildScreenBadges(activeShields, cur.players, camera, box, rect));
    };

    update();
    const intervalId = setInterval(update, DOM_UPDATE_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [live]);

  if (!live || badges.length === 0) return null;

  return (
    <div className="cq-shields" aria-hidden="true">
      {badges.map((badge) => (
        <div
          key={badge.id}
          className={`cq-shield-badge${badge.isBlinking ? " is-blinking" : ""}${badge.mine ? " is-mine" : " is-enemy"}`}
          style={{
            "--shield-color": badge.color,
            "--shield-step": badge.step,
            transform: `translate(${badge.sx}px, ${badge.sy}px) translate(-50%, -50%)`,
          }}
          data-step={badge.step}
          data-country={badge.id}
        >
          <div className="cq-shield-badge__content">
            <Shield className="cq-shield-badge__icon" />
            <span className="cq-shield-badge__text">{badge.text}</span>
            <div className="cq-shield-badge__pips">
              <span className={`cq-shield-badge__pip${badge.pips[0] ? " is-filled" : ""}`} />
              <span className={`cq-shield-badge__pip${badge.pips[1] ? " is-filled" : ""}`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ConquestShieldLayer;
