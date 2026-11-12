"use client";

import { useEffect, useRef } from "react";
import { renderMoonPhase, EXTENT } from "./moonTexture";

// ── Layout in "units": each moon sits in a 100-unit cell, disc radius 46 ──
const R = 46;
const CELL = 100;
const GAP = 60;
const STEP = CELL + GAP; // distance between moon centres
const ROW_W = CELL * 5 + GAP * 4;
const IMG = R * EXTENT * 2; // rendered moon image covers disc + halo
const ROW_H = CELL * 1.6; // canvas height (room for the halo)

// Phase of each moon:  (  ◐  ●  ◑  )   — degrees from full, lit side
const PHASES = [
  { deg: 122, side: "left" },
  { deg: 90, side: "left" },
  { deg: 0, side: "left" },
  { deg: 90, side: "right" },
  { deg: 122, side: "right" },
];

/**
 * Five moon phases in a row — a still graphic (no animation of its own).
 * The unlit side of each moon is transparent, so the shadow melts into the page.
 * `delay` / `duration`: when it fades in (in step with "COMING SOON" and the form).
 */
export default function MoonPhases({
  size = 34, // px, width of one moon cell (the disc is ~92% of this)
  delay = 0, // seconds before it fades in
  duration = 1.1, // seconds to fade in
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = (size / CELL) * dpr; // device px per unit
    canvas.width = Math.round(ROW_W * S);
    canvas.height = Math.round(ROW_H * S);
    const ctx = canvas.getContext("2d");
    const imgPx = IMG * S;
    // render each phase a bit above its drawn size → crisp, smooth edges
    const N = Math.round(Math.min(360, Math.max(96, imgPx * 1.5)));
    const cy = canvas.height / 2;
    PHASES.forEach((p, i) => {
      const cx = (i * STEP + CELL / 2) * S;
      ctx.drawImage(renderMoonPhase(N, p.deg, p.side), cx - imgPx / 2, cy - imgPx / 2, imgPx, imgPx);
    });
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Moon phases"
      style={{
        display: "block",
        width: (size * ROW_W) / CELL,
        height: (size * ROW_H) / CELL,
        // soft shadow under the lit edges, blending into the background
        filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.65))",
        // hidden, then fades in softly (keyframes: nc-soft-in in globals.css)
        animation: `nc-soft-in ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
      }}
    />
  );
}
