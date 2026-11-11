"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { GLYPHS, BOUNDS } from "./glyphs";

gsap.registerPlugin(useGSAP);

const PAD = 30;
const VB = {
  x: BOUNDS.x1 - PAD,
  y: BOUNDS.y1 - PAD,
  w: BOUNDS.x2 - BOUNDS.x1 + PAD * 2,
  h: BOUNDS.y2 - BOUNDS.y1 + PAD * 2,
};

// every pen stroke of the title, in writing order
const STROKES = GLYPHS.flatMap((g, gi) => g.strokes.map((k, si) => ({ ...k, word: g.word, id: `${gi}-${si}` })));
const TOTAL_LEN = STROKES.reduce((s, k) => s + k.len, 0);

/**
 * Title written by hand, as one smooth continuous movement.
 *
 * The pen follows pre-computed centerlines through every brush stroke
 * (scripts/generate-handwriting.mjs) at a constant speed; the whole
 * movement eases in at the start and out at the end — no stop-and-go.
 */
export default function Handwriting({
  width = "min(720px, 90vw)", // rendered width of the title (incl. flourishes)
  delay = 0.5, // seconds after page load before the pen starts
  duration = 3.6, // seconds for the whole title to be written
  wordPause = 0.15, // short breath between words (seconds of the total)
  ease = "sine.inOut", // easing of the whole writing movement
  softEdge = 1, // softness of the moving ink edge (font units; 0 = hard)
  weight = 1.4, // extra ink weight added around the letters (font units; 0 = font's own)
  showPen = false, // optional glowing pen tip at the head of the ink
  className = "",
  style,
}) {
  const root = useRef(null);

  useGSAP(
    () => {
      const svg = root.current;
      const pens = STROKES.map((k) => svg.querySelector(`[data-pen="${k.id}"]`));
      const finals = svg.querySelector("[data-final]");
      const tip = svg.querySelector("[data-tip]");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (reduce) {
        gsap.set(finals, { opacity: 1 });
        return;
      }

      // 1) build the writing as LINEAR pieces back to back (constant pen speed)…
      const words = new Set(STROKES.map((k) => k.word)).size;
      const writing = Math.max(0.5, duration - wordPause * (words - 1));
      const tl = gsap.timeline({ paused: true });
      let t = 0;
      let word = STROKES[0]?.word ?? 0;

      STROKES.forEach((k, i) => {
        if (k.word !== word) {
          t += wordPause;
          word = k.word;
        }
        const el = pens[i];
        const len = el.getTotalLength();
        const d = (k.len / TOTAL_LEN) * writing;
        tl.set(el, { opacity: 1 }, t); // reveal the stroke only when the pen arrives
        tl.to(
          el,
          {
            // tween the ATTRIBUTE: the CSS property gets rounded to whole px by GSAP,
            // which made strokes pop in at their midpoint instead of drawing smoothly
            attr: { "stroke-dashoffset": 0 },
            duration: d,
            ease: "none",
            onUpdate: tip
              ? () => {
                  const done = 1 - parseFloat(el.getAttribute("stroke-dashoffset"));
                  const p = el.getPointAtLength(len * done);
                  tip.setAttribute("cx", p.x);
                  tip.setAttribute("cy", p.y);
                }
              : undefined,
          },
          t
        );
        t += d;
      });

      if (tip) tl.fromTo(tip, { opacity: 0 }, { opacity: 1, duration: 0.2 }, 0);

      // 2) …then play the whole writing with ONE ease → smooth start & finish, no stutter
      const master = gsap.timeline({ delay });
      master.add(tl.tweenFromTo(0, t, { ease }));
      // pen lifts: crisp finished title settles in (fills any hairline gaps)
      master.to(finals, { opacity: 1, duration: 0.5, ease: "sine.out" }, "-=0.1");
      if (tip) master.to(tip, { opacity: 0, duration: 0.4 }, "<");
    },
    { scope: root }
  );

  return (
    <svg
      ref={root}
      className={className}
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      role="img"
      aria-label="Night Circle"
      style={{
        width,
        height: "auto",
        overflow: "visible",
        // deep soft shadow + tight contact shadow (as in the reference), as CSS filters:
        // applied by the GPU, not re-drawn per frame like SVG filters
        filter: "drop-shadow(0 5px 6px rgba(0,0,0,0.9)) drop-shadow(0 1.5px 1px rgba(0,0,0,0.8))",
        willChange: "transform",
        ...style,
      }}
    >
      <defs>
        {/* muted, slightly warm antique silver with metallic banding (sampled from the reference) */}
        <linearGradient id="hw-ink" x1="0" y1={-160} x2="0" y2={80} gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#e2e0da" />
          <stop offset="0.3" stopColor="#bcbab4" />
          <stop offset="0.5" stopColor="#85837e" />
          <stop offset="0.62" stopColor="#cfccc5" />
          <stop offset="0.82" stopColor="#8f8d88" />
          <stop offset="1" stopColor="#5b5a56" />
        </linearGradient>
        <radialGradient id="hw-tip">
          <stop offset="0" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="0.35" stopColor="#f4f2ea" stopOpacity="0.8" />
          <stop offset="1" stopColor="#f4f2ea" stopOpacity="0" />
        </radialGradient>

        {/* softens the moving pen edge so the ink glides out instead of a hard cut-off */}
        <filter id="hw-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={softEdge} />
        </filter>

        {/* ONE mask for the whole title: the pen's strokes at the ink's own width */}
        <mask id="hw-mask" maskUnits="userSpaceOnUse" x={VB.x} y={VB.y} width={VB.w} height={VB.h}>
          <g
            fill="none"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={softEdge > 0 ? "url(#hw-soft)" : undefined}
          >
            {STROKES.map((k) => (
              <path
                key={k.id}
                data-pen={k.id}
                d={k.d}
                strokeWidth={k.width}
                pathLength="1"
                strokeDasharray="1 1"
                strokeDashoffset="1"
                opacity="0"
              />
            ))}
          </g>
        </mask>
      </defs>

      {/* ink laid down by the pen (a thin same-colour outline adds a little weight) */}
      <g
        fill="url(#hw-ink)"
        stroke={weight > 0 ? "url(#hw-ink)" : undefined}
        strokeWidth={weight}
        strokeLinejoin="round"
        mask="url(#hw-mask)"
      >
        {GLYPHS.map((g, gi) => (
          <path key={gi} d={g.d} opacity={g.opacity ?? 1} />
        ))}
      </g>

      {/* finished title */}
      <g
        fill="url(#hw-ink)"
        stroke={weight > 0 ? "url(#hw-ink)" : undefined}
        strokeWidth={weight}
        strokeLinejoin="round"
        data-final
        opacity="0"
      >
        {GLYPHS.map((g, gi) => (
          <path key={gi} d={g.d} opacity={g.opacity ?? 1} />
        ))}
      </g>

      {showPen && <circle data-tip r="8" cx="0" cy="0" fill="url(#hw-tip)" opacity="0" />}
    </svg>
  );
}
