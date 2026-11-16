"use client";

import { useEffect, useRef } from "react";
import { renderMoonPhase, EXTENT } from "./moonTexture";

// ── Layout in "units": each moon sits in a 100-unit cell, disc radius 46 ──
const R = 46;
const CELL = 100;
const GAP = 60;
const STEP = CELL + GAP; // distance between moon centres
const ROW_W = CELL * 5 + GAP * 4;
const IMG = R * EXTENT * 2; // rendered moon image covers disc + halo + shadow
const ROW_H = CELL * 1.6; // layout height of the row
const PAD = 16; // extra canvas on every side so the soft shadows aren't cut off (hangs outside the layout box)

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
 * The light fades softly into each moon's night side, which is a faint see-through
 * shadow (with a soft pool under the moon), so it melts into the page.
 * `delay` / `duration`: when it fades in (in step with "COMING SOON" and the form).
 */
export default function MoonPhases({
  size = 34, // px, width of one moon cell (the disc is ~92% of this)
  shadow = 0.65, // darkness of the shadow under each moon (0 = none, 1 = black)
  softness = 0.25, // how gradually the light fades into the dark side (0 = sharp edge)
  brightness = 0.66, // lit-side brightness (1 = near white)
  delay = 0, // seconds before it fades in
  duration = 1.1, // seconds to fade in
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const S = (size / CELL) * dpr; // device px per unit
    canvas.width = Math.round((ROW_W + PAD * 2) * S);
    canvas.height = Math.round((ROW_H + PAD * 2) * S);
    const ctx = canvas.getContext("2d");
    const imgPx = IMG * S;
    // render each phase a bit above its drawn size → crisp, smooth edges
    const N = Math.round(Math.min(480, Math.max(128, imgPx * 1.5)));
    const cy = canvas.height / 2;
    const look = { shadow, softness, brightness };
    PHASES.forEach((p, i) => {
      const cx = (PAD + i * STEP + CELL / 2) * S;
      ctx.drawImage(renderMoonPhase(N, p.deg, p.side, look), cx - imgPx / 2, cy - imgPx / 2, imgPx, imgPx);
    });
  }, [size, shadow, softness, brightness]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Moon phases"
      style={{
        display: "block",
        width: (size * (ROW_W + PAD * 2)) / CELL,
        height: (size * (ROW_H + PAD * 2)) / CELL,
        // the padding hangs outside the layout box, so the row sits exactly where it did before
        margin: (-size * PAD) / CELL,
        // hidden, then fades in softly (keyframes: nc-soft-in in globals.css)
        animation: `nc-soft-in ${duration}s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s both`,
      }}
    />
  );
}
