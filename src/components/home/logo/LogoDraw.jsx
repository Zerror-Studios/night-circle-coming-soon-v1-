"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { VIEWBOX, FILLS, PENS } from "./logoPaths";

gsap.registerPlugin(useGSAP);

const [VX, VY, VW, VH] = VIEWBOX;
const TOTAL_LEN = PENS.reduce((s, k) => s + k.len, 0);

/**
 * The Night Circle logo, drawn in solid white as if by a pen.
 *
 * An invisible pen moves through the middle of every stroke of the lettering,
 * one stroke after another from the far left to the right, at a steady speed.
 * The white logo appears only where the pen has been — no outlines.
 * When the pen lifts, the crisp artwork settles in (fills any hairline gaps).
 *
 * Pen paths: src/components/home/logo/logoPaths.js (`npm run logo:draw`).
 */
export default function LogoDraw({
  width = "min(720px, 90vw)", // rendered width of the logo
  color = "#ffffff", // ink colour
  delay = 0.5, // seconds after page load before the pen starts
  duration = 2.2, // seconds for the whole logo to be drawn (lower = faster)
  ease = "none", // speed of the whole drawing ("none" = steady pen)
  softEdge = 0.8, // softness of the moving ink edge (logo units; 0 = hard)
  decorative = false, // true = hidden from screen readers (when the text is given next to it, e.g. in an <h1>)
  className = "",
  style,
}) {
  const root = useRef(null);

  useGSAP(
    () => {
      const svg = root.current;
      const pens = [...svg.querySelectorAll("[data-pen]")];
      const final = svg.querySelector("[data-final]");

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(final, { opacity: 1 });
        return;
      }

      // each stroke gets time in proportion to its length → the pen moves at one steady speed
      const tl = gsap.timeline({ paused: true });
      let t = 0;
      PENS.forEach((k, i) => {
        const d = (k.len / TOTAL_LEN) * duration;
        tl.set(pens[i], { opacity: 1 }, t); // show the stroke only when the pen arrives
        // tween the ATTRIBUTE (the CSS property would be rounded to whole px by GSAP)
        tl.to(pens[i], { attr: { "stroke-dashoffset": 0 }, duration: d, ease: "none" }, t);
        t += d;
      });

      const master = gsap.timeline({ delay });
      master.add(tl.tweenFromTo(0, t, { ease }));
      master.to(final, { opacity: 1, duration: 0.3, ease: "sine.out" }, "-=0.05");
    },
    { scope: root }
  );

  return (
    <svg
      ref={root}
      className={className}
      viewBox={VIEWBOX.join(" ")}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Night Circle"}
      aria-hidden={decorative || undefined}
      focusable="false"
      style={{
        width,
        height: "auto",
        overflow: "visible",
        // soft shadow so the white lettering sits on the dark wall
        filter: "drop-shadow(0 5px 6px rgba(0,0,0,0.9)) drop-shadow(0 1.5px 1px rgba(0,0,0,0.8))",
        ...style,
      }}
    >
      <defs>
        {/* softens the moving pen edge so the ink glides out instead of a hard cut-off */}
        <filter id="logo-soft" x="-5%" y="-5%" width="110%" height="110%">
          <feGaussianBlur stdDeviation={softEdge} />
        </filter>
        {/* where the pen has been */}
        <mask id="logo-pen" maskUnits="userSpaceOnUse" x={VX} y={VY} width={VW} height={VH}>
          <g
            fill="none"
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={softEdge > 0 ? "url(#logo-soft)" : undefined}
          >
            {PENS.map((k, i) => (
              <path
                key={i}
                data-pen
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

      {/* ink drawn by the pen */}
      <g fill={color} mask="url(#logo-pen)">
        {FILLS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>

      {/* finished logo, exactly as the artwork */}
      <g fill={color} data-final opacity="0">
        {FILLS.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
