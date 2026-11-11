"use client";

import { useEffect, useRef } from "react";

/**
 * Static film-grain overlay (no WebGL, no animation loop).
 * A small random-noise tile is generated once and repeated with CSS.
 * Each grain is a tiny light or dark speck, so the base colour stays the same.
 */
export default function FilmGrain({
  amount = 0.03, // grain strength (same scale as the old shader grain; 0 = off)
  size = 0.5, // grain size in CSS px
  className = "",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (amount <= 0) {
      el.style.backgroundImage = "none";
      return;
    }
    const N = 256; // tile resolution in grains
    const c = document.createElement("canvas");
    c.width = c.height = N;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(N, N);
    const d = img.data;
    const maxA = Math.min(1, amount * 3.2) * 255; // strongest speck opacity
    for (let i = 0; i < d.length; i += 4) {
      // two averaged randoms → softer, film-like distribution around zero
      const v = Math.random() + Math.random() - 1; // -1 … 1
      const light = v > 0;
      d[i] = d[i + 1] = d[i + 2] = light ? 255 : 0;
      d[i + 3] = Math.abs(v) * maxA;
    }
    ctx.putImageData(img, 0, 0);
    // write straight to the element (no React re-render needed)
    el.style.backgroundImage = `url(${c.toDataURL("image/png")})`;
    el.style.backgroundSize = `${N * size}px ${N * size}px`;
  }, [amount, size]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={className}
      style={{ imageRendering: "pixelated", ...style }}
    />
  );
}
