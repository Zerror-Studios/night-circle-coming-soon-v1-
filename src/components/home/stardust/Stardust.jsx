"use client";

import { useEffect, useRef } from "react";

/**
 * Stardust trail: as the mouse moves, a few tiny silver motes spill from the
 * cursor, drift and twinkle while they fade. An occasional mote is a 4-point
 * star sparkle. The loop only runs while motes are alive → zero cost when idle.
 */
export default function Stardust({
  enabled = true,
  spacing = 16, // px of mouse travel per new mote (higher = sparser)
  maxPerMove = 3, // cap per pointer event
  maxParticles = 140,
  life = [0.9, 1.8], // seconds
  size = [0.5, 1.5], // px radius of a mote
  sparkle = 0.12, // fraction of motes drawn as 4-point star sparkles
  spread = 14, // px scatter around the cursor
  drift = 14, // px/s gentle float (mostly upward)
  color = "236, 233, 226", // r, g, b (soft silver)
  opacity = 0.85,
  className = "",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const parts = [];
    let raf = 0;
    let last = null; // last pointer position (canvas px)
    let carry = 0; // accumulated travel since the last mote

    // pre-rendered soft glow sprite (cheap to draw many times)
    const glow = document.createElement("canvas");
    glow.width = glow.height = 64;
    const g = glow.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${color}, 1)`);
    grad.addColorStop(0.25, `rgba(${color}, 0.55)`);
    grad.addColorStop(1, `rgba(${color}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(r.width * dpr));
      canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const rand = (a, b) => a + Math.random() * (b - a);

    const spawn = (x, y) => {
      if (parts.length >= maxParticles) parts.shift();
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * spread;
      parts.push({
        x: x + Math.cos(a) * d,
        y: y + Math.sin(a) * d,
        vx: rand(-0.5, 0.5) * drift,
        vy: -rand(0.2, 1) * drift, // float upward, like dust in moonlight
        r: rand(size[0], size[1]),
        life: rand(life[0], life[1]),
        age: 0,
        tw: rand(5, 11), // twinkle speed
        ph: Math.random() * Math.PI * 2,
        star: Math.random() < sparkle,
        sway: rand(0.6, 1.6),
      });
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) {
        last = null;
        return;
      }
      if (last) {
        const dx = x - last.x, dy = y - last.y;
        const dist = Math.hypot(dx, dy);
        carry += dist;
        let n = Math.min(maxPerMove, Math.floor(carry / spacing));
        carry -= n * spacing;
        // spread new motes along the path travelled since the last event
        for (let i = 0; i < n; i++) {
          const t = (i + 1) / (n + 1);
          spawn(last.x + dx * t, last.y + dy * t);
        }
      }
      last = { x, y };
      if (!raf && parts.length) raf = requestAnimationFrame(tick);
    };

    let prevT = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";

      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.age += dt;
        if (p.age >= p.life) {
          parts.splice(i, 1);
          continue;
        }
        const k = p.age / p.life;
        p.x += (p.vx + Math.sin(p.age * 3 + p.ph) * p.sway * 4) * dt;
        p.y += p.vy * dt;
        p.vx *= 0.985;
        p.vy *= 0.985;

        // fade in quickly, fade out slowly, twinkle in between
        const fade = Math.min(1, k * 8) * Math.pow(1 - k, 1.6);
        const tw = 0.55 + 0.45 * Math.sin(p.age * p.tw + p.ph);
        const a = opacity * fade * tw;
        if (a <= 0.01) continue;

        const s = p.r * 6; // glow sprite size
        ctx.globalAlpha = a * 0.7;
        ctx.drawImage(glow, p.x - s / 2, p.y - s / 2, s, s);

        ctx.globalAlpha = a;
        ctx.fillStyle = `rgb(${color})`;
        if (p.star) {
          // 4-point star sparkle with thin rays
          const L = p.r * 5 * (0.7 + 0.3 * tw);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y - L);
          ctx.quadraticCurveTo(p.x, p.y, p.x + L, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y + L);
          ctx.quadraticCurveTo(p.x, p.y, p.x - L, p.y);
          ctx.quadraticCurveTo(p.x, p.y, p.x, p.y - L);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
      raf = parts.length ? requestAnimationFrame(tick) : 0;
      if (!raf) ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [enabled, spacing, maxPerMove, maxParticles, life, size, sparkle, spread, drift, color, opacity]);

  if (!enabled) return null;
  return <canvas ref={ref} aria-hidden="true" className={className} style={style} />;
}
