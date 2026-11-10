"use client";

import { useEffect, useRef, useState } from "react";
import { Cinzel } from "next/font/google";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { buildPhaseFrames, EXTENT } from "./moonTexture";

gsap.registerPlugin(useGSAP);

// Cinzel = free Roman-capitals face, the closest match to Trajan
const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "500"], display: "swap" });

// ── Layout in "units": each moon sits in a 100-unit cell, disc radius 46 ──
const R = 46;
const CELL = 100;
const GAP = 60;
const STEP = CELL + GAP; // distance between moon centres
const ROW_W = CELL * 5 + GAP * 4;
const IMG = R * EXTENT * 2; // rendered moon image covers disc + halo
const ROW_H = CELL * 1.6; // canvas height (room for halo + scale)

// Final phase of each moon:  (  ◐  ●  ◑  )   — degrees from full, lit side
const TARGETS = [
  { deg: 122, side: "left" },
  { deg: 90, side: "left" },
  { deg: 0, side: "left" },
  { deg: 90, side: "right" },
  { deg: 122, side: "right" },
];
// Paint order: outer first, centre (full moon) last → the others hide behind it
const DRAW_ORDER = [0, 4, 1, 3, 2];
const toCenter = (i) => (2 - i) * STEP;

export default function ComingSoon({
  text = "COMING SOON",
  delay = 0, // seconds before the moon appears
  moonSize = 34, // px, width of one moon cell (disc ≈ 92% of this)
  fontSize = "clamp(15px, 1.5vw, 22px)", // text size
  // ── Sequence (loops):
  //    full moon appears → splits into 5, each waning into its phase
  //    → they glide back, waxing to full, and merge into one
  //    → that moon fades → text appears → text fades → (repeat)
  moonAppear = 0.6,
  spread = 1.4,
  moonHold = 0.8,
  combine = 1.4,
  oneHold = 0.1,
  moonHide = 0.6,
  textIn = 1,
  textHold = 1.6,
  textOut = 0.7,
  pause = 0,
  loop = true,
  motionBlur = 1, // 0 = off, 1 = normal, 2 = strong (length of the shutter)
}) {
  const root = useRef(null);
  const canvasRef = useRef(null);
  const [frames, setFrames] = useState(null);

  // Pre-render the phase strips once, right after first paint
  useEffect(() => {
    const id = setTimeout(() => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const px = Math.round(Math.min(320, Math.max(120, (moonSize / CELL) * IMG * dpr * 1.6)));
      setFrames(buildPhaseFrames(px, 125, 10));
    }, 0);
    return () => clearTimeout(id);
  }, [moonSize]);

  useGSAP(
    () => {
      if (!frames) return;
      const canvas = canvasRef.current;
      const textEl = root.current.querySelector("[data-text]");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // ── Canvas setup (HiDPI) ──
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const ppu = moonSize / CELL; // css px per unit
      const W = ROW_W * ppu;
      const H = ROW_H * ppu;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      const ctx = canvas.getContext("2d");
      // per-moon layer used to accumulate motion-blur samples additively
      const layer = document.createElement("canvas");
      layer.width = canvas.width;
      layer.height = canvas.height;
      const lctx = layer.getContext("2d");
      const S = dpr * ppu; // device px per unit
      const imgPx = IMG * S;

      // ── Animated state (plain objects — GSAP tweens numbers, we draw) ──
      const moons = TARGETS.map((_, i) => ({ x: toCenter(i), scale: 0.75, opacity: 0 }));
      const prev = moons.map((m) => ({ x: m.x, scale: m.scale }));

      // phase for a moon from how far along its path it is (centre = full)
      const phaseOf = (i, x) => {
        if (i === 2) return 0;
        const p = 1 - Math.min(1, Math.abs(x / toCenter(i)));
        return TARGETS[i].deg * p * p * (3 - 2 * p); // eased wax/wane
      };

      // draw one moon image (cross-fading the two nearest phase frames)
      const drawPhase = (c, i, deg, cx, cy, scale, alpha) => {
        const strip = frames[TARGETS[i].side];
        const f = deg / frames.step;
        const f0 = Math.min(strip.length - 1, Math.floor(f));
        const f1 = Math.min(strip.length - 1, f0 + 1);
        const t = f - f0;
        const s = imgPx * scale;
        c.globalAlpha = alpha * (1 - t);
        c.drawImage(strip[f0], cx - s / 2, cy - s / 2, s, s);
        if (t > 0.001 && f1 !== f0) {
          c.globalAlpha = alpha * t;
          c.drawImage(strip[f1], cx - s / 2, cy - s / 2, s, s);
        }
      };

      let lastDraw = "";
      let lastBlurred = false;
      const render = (dtSec) => {
        // skip redundant frames when nothing moves (keeps idle cost ~0),
        // but always redraw once after motion so no blur streak is left behind
        const key = moons.map((m) => `${m.x.toFixed(2)}|${m.scale.toFixed(3)}|${m.opacity.toFixed(3)}`).join(",");
        const moving = moons.some((m, i) => m.x !== prev[i].x || m.scale !== prev[i].scale);
        if (key === lastDraw && !moving && !lastBlurred) return;
        lastDraw = key;
        lastBlurred = false;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cy = canvas.height / 2;

        for (const i of DRAW_ORDER) {
          const m = moons[i];
          if (m.opacity <= 0.001) continue;

          // ── shutter motion blur: average K samples along this frame's motion ──
          const dx = (m.x - prev[i].x) * S; // device px moved this frame
          const ds = m.scale - prev[i].scale;
          const frameScale = dtSec > 0 ? 1 / (dtSec * 60) : 1; // normalise to 60fps
          const shutter = 2.2 * motionBlur * frameScale; // ≈ 2 frames of exposure
          const streak = Math.abs(dx) * shutter;
          // ~1 sample per 0.7 device px of travel → smooth, band-free streaks
          const K = motionBlur > 0 ? Math.max(1, Math.min(28, Math.ceil(streak / 0.7) + (Math.abs(ds) > 0.002 ? 4 : 0))) : 1;
          if (K > 1) lastBlurred = true;

          lctx.setTransform(1, 0, 0, 1, 0, 0);
          lctx.clearRect(0, 0, layer.width, layer.height);
          lctx.globalCompositeOperation = "lighter"; // additive → exact average
          for (let k = 0; k < K; k++) {
            const u = K === 1 ? 0 : k / (K - 1); // 0 = now, 1 = earlier
            const x = m.x - (m.x - prev[i].x) * shutter * u;
            const sc = m.scale - ds * shutter * u;
            const cx = (i * STEP + 50 + x) * S;
            drawPhase(lctx, i, phaseOf(i, x), cx, cy, sc, 1 / K);
          }
          lctx.globalCompositeOperation = "source-over";

          ctx.globalAlpha = m.opacity;
          ctx.drawImage(layer, 0, 0);
        }
        ctx.globalAlpha = 1;
        moons.forEach((m, i) => {
          prev[i].x = m.x;
          prev[i].scale = m.scale;
        });
      };

      const tick = (time, deltaMs) => render(Math.min(deltaMs, 100) / 1000);
      gsap.ticker.add(tick);

      if (reduce) {
        // no motion: just show the text
        gsap.set(textEl, { opacity: 1 });
        return () => gsap.ticker.remove(tick);
      }

      const all = moons;
      const tl = gsap.timeline({ delay, repeat: loop ? -1 : 0 });

      // reset: everything stacked on the centre as one hidden full moon
      tl.set(all, { x: (i) => toCenter(i), scale: 0.75, opacity: 0 });
      tl.set(textEl, { opacity: 0 });

      // 1) The full moon rises into view
      tl.to(all, { opacity: 1, scale: 1, duration: moonAppear, ease: "sine.out" });

      // 2) It splits: copies glide outward, waning into their phases
      tl.to(all, {
        x: 0,
        duration: spread,
        ease: "expo.inOut",
        stagger: { each: 0.06, from: "center" },
      });

      // 3) Hold, then glide back — waxing to full — and merge into one
      tl.to(
        all,
        { x: (i) => toCenter(i), duration: combine, ease: "expo.inOut", stagger: { each: 0.06, from: "edges" } },
        `+=${moonHold}`
      );

      // 4) The single moon holds, then softly sinks away
      tl.to(all, { opacity: 0, scale: 0.8, duration: moonHide, ease: "sine.inOut" }, `+=${oneHold}`);

      // 5) Text appears in the same spot (GPU-only properties: no layout work)
      tl.fromTo(
        textEl,
        { opacity: 0, filter: "blur(10px)", scale: 0.94 },
        { opacity: 1, filter: "blur(0px)", scale: 1, duration: textIn, ease: "power3.out" },
        `-=${moonHide * 0.45}`
      );

      if (loop) {
        // 6) Text fades away → brief darkness → repeat
        tl.to(
          textEl,
          { opacity: 0, filter: "blur(8px)", scale: 1.03, duration: textOut, ease: "sine.in" },
          `+=${textHold}`
        );
        tl.to({}, { duration: pause });
      }

      return () => gsap.ticker.remove(tick);
    },
    { scope: root, dependencies: [frames] }
  );

  return (
    <div ref={root} className="relative grid place-items-center">
      {/* Moons and text share the exact same centre spot (stacked in one grid cell) */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{
          gridArea: "1 / 1",
          width: (moonSize * ROW_W) / CELL,
          height: (moonSize * ROW_H) / CELL,
        }}
      />

      {/* wrapper carries the shadow (text-shadow would paint over gradient text) */}
      <div
        style={{
          gridArea: "1 / 1",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))",
        }}
      >
        <p
          data-text
          className={cinzel.className}
          style={{
            margin: 0,
            opacity: 0,
            fontSize,
            fontWeight: 400,
            letterSpacing: "0.22em",
            lineHeight: 1,
            whiteSpace: "nowrap",
            textTransform: "uppercase",
            willChange: "transform, opacity, filter",
            // pale silver, slightly darker toward the bottom (like the reference)
            backgroundImage: "linear-gradient(180deg, #e6e4df 0%, #c2c0ba 48%, #8f8d88 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            WebkitTextFillColor: "transparent",
            paddingLeft: "0.22em", // optically re-centre (tracking adds space on the right)
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}
