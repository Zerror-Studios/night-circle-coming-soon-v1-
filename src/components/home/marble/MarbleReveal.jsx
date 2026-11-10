"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { fullscreenVertex, trailFragment, marbleFragment } from "./shaders";

const OFFSCREEN = -10;

// One Euro filter tuning (units: screen-heights / second)
const ONE_EURO_BETA = 40; // how quickly smoothing turns off as speed rises
const ONE_EURO_D_CUTOFF = 10; // Hz, smoothing of the speed estimate itself

// The canvas outputs raw values (flat + linear), so keep hex colours un-converted:
// "#111111" in → exactly #111111 on screen.
const raw = (hex) => new THREE.Color().setStyle(hex, THREE.LinearSRGBColorSpace);
const setRaw = (color, hex) => color.setStyle(hex, THREE.LinearSRGBColorSpace);

/**
 * Full-screen black plane that reveals procedural marble around the cursor.
 *
 * Two passes every frame:
 *   1. trail  – ping-pong render targets store reveal intensity + cursor velocity;
 *               the trail drifts along that velocity and swirls as it fades
 *   2. marble – samples the trail, bends the marble along the motion and
 *               mixes #111111 → marble with an eroding, light-catching edge
 */
export default function MarbleReveal({
  radius = 0.14, // brush size, in screen-height units
  growIn = 0.35, // seconds for the circle to grow in when the mouse starts moving
  shrinkOut = 0.5, // seconds for the circle to shrink away when the mouse stops
  fade = 0.955, // trail persistence per 60fps frame (higher = longer trail)
  smoothing = 0.5, // 0 = raw pointer, 1 = extra smooth (adaptive: never lags on fast moves)
  flow = 0.35, // how far the trail drifts in the direction you move
  swirl = 0.05, // ink-like curl turbulence while the trail fades
  distortion = 0.02, // liquid drag on the marble along the movement
  trailScale = 0.5, // trail buffer resolution vs canvas
  colors = {},
  grain = {},
}) {
  const g = {
    amount: 0.05, // fine grain strength (0 = off)
    size: 1, // grain cell size in CSS px
    noise: 0.015, // coarse mottled noise strength (0 = off)
    noiseScale: 160, // coarse noise feature size in CSS px
    fps: 24, // how often the grain pattern changes
    animate: "move", // "move" = only while the mouse moves | "always" | "off"
    ...grain,
  };
  const { gl, size, invalidate } = useThree();

  const palette = {
    bg: "#111111",
    base: "#0a0a0b", // deep black stone body
    cloud: "#1e1e21", // faint smoky clouds
    vein: "#ece9e2", // white veins
    accent: "#b8955a", // thin gold seam
    ...colors,
  };

  const mouse = useRef({
    target: new THREE.Vector2(OFFSCREEN, OFFSCREEN),
    current: new THREE.Vector2(OFFSCREEN, OFFSCREEN),
    prev: new THREE.Vector2(OFFSCREEN, OFFSCREEN),
    vel: new THREE.Vector2(0, 0), // smoothed, aspect-corrected, screen-heights / sec
    speedHat: new THREE.Vector2(0, 0), // One Euro filter speed estimate
    activity: 0, // 0 = mouse still, 1 = moving
    lastMove: -Infinity, // timestamp of the last pointermove (ms)
    presence: 0, // 0..1 linear progress of the circle grow/shrink tween
    scale: 0, // eased brush radius scale (smoothstep of presence)
    time: 0, // animation clock — only advances while the mouse moves
    energy: 0, // rough estimate of how much trail is still visible
    grainClock: 0, // drives grain frame changes
    inside: false,
    entered: false,
  });

  // ── Trail pass resources ──────────────────────────────────
  const trail = useMemo(() => {
    const opts = {
      type: THREE.HalfFloatType, // float precision so the fade never gets stuck
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    };
    const read = new THREE.WebGLRenderTarget(1, 1, opts);
    const write = new THREE.WebGLRenderTarget(1, 1, opts);

    const material = new THREE.ShaderMaterial({
      vertexShader: fullscreenVertex,
      fragmentShader: trailFragment,
      uniforms: {
        uPrev: { value: null },
        uMouse: { value: new THREE.Vector2(OFFSCREEN, OFFSCREEN) },
        uPrevMouse: { value: new THREE.Vector2(OFFSCREEN, OFFSCREEN) },
        uVel: { value: new THREE.Vector2(0, 0) },
        uAspect: { value: 1 },
        uRadius: { value: radius },
        uDecay: { value: fade },
        uVelDecay: { value: 0.96 },
        uActive: { value: 0 },
        uTime: { value: 0 },
        uDt: { value: 1 / 60 },
        uFlow: { value: flow },
        uSwirl: { value: swirl },
      },
      depthTest: false,
      depthWrite: false,
    });

    const scene = new THREE.Scene();
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    quad.frustumCulled = false;
    scene.add(quad);

    return { read, write, material, scene, camera: new THREE.Camera() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Display material ──────────────────────────────────────
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVertex,
        fragmentShader: marbleFragment,
        uniforms: {
          uTrail: { value: null },
          uDistort: { value: distortion },
          uGrainAmount: { value: g.amount },
          uGrainSize: { value: g.size },
          uNoiseAmount: { value: g.noise },
          uNoiseScale: { value: g.noiseScale },
          uGrainSeed: { value: 0 },
          uPixelRatio: { value: 1 },
          uTime: { value: 0 },
          uAspect: { value: 1 },
          uMouse: { value: new THREE.Vector2(OFFSCREEN, OFFSCREEN) },
          uBg: { value: raw(palette.bg) },
          uBase: { value: raw(palette.base) },
          uCloud: { value: raw(palette.cloud) },
          uVein: { value: raw(palette.vein) },
          uAccent: { value: raw(palette.accent) },
        },
        depthTest: false,
        depthWrite: false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Keep colours / tuning in sync with props
  useEffect(() => {
    const u = material.uniforms;
    setRaw(u.uBg.value, palette.bg);
    setRaw(u.uBase.value, palette.base);
    setRaw(u.uCloud.value, palette.cloud);
    setRaw(u.uVein.value, palette.vein);
    setRaw(u.uAccent.value, palette.accent);
    u.uDistort.value = distortion;
    u.uGrainAmount.value = g.amount;
    u.uGrainSize.value = g.size;
    u.uNoiseAmount.value = g.noise;
    u.uNoiseScale.value = g.noiseScale;
    invalidate();
  }, [
    invalidate,
    g.amount,
    g.size,
    g.noise,
    g.noiseScale,
    g.animate,
    material,
    trail,
    palette.bg,
    palette.base,
    palette.cloud,
    palette.vein,
    palette.accent,
    radius,
    distortion,
  ]);

  // Resize trail buffers with the canvas, and clear them
  useEffect(() => {
    const dpr = gl.getPixelRatio();
    const w = Math.max(1, Math.floor(size.width * dpr * trailScale));
    const h = Math.max(1, Math.floor(size.height * dpr * trailScale));
    trail.read.setSize(w, h);
    trail.write.setSize(w, h);

    const prevTarget = gl.getRenderTarget();
    const prevClear = gl.getClearColor(new THREE.Color());
    const prevAlpha = gl.getClearAlpha();
    gl.setClearColor(0x000000, 1);
    for (const rt of [trail.read, trail.write]) {
      gl.setRenderTarget(rt);
      gl.clear(true, false, false);
    }
    gl.setRenderTarget(prevTarget);
    gl.setClearColor(prevClear, prevAlpha);

    const aspect = size.width / size.height;
    trail.material.uniforms.uAspect.value = aspect;
    material.uniforms.uAspect.value = aspect;
    material.uniforms.uPixelRatio.value = dpr;
  }, [gl, size, trail, material, trailScale]);

  // Track the pointer on window so overlays (header, text) don't block it
  useEffect(() => {
    const el = gl.domElement;
    const m = mouse.current;

    const onMove = (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      m.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      m.target.set(x, y);
      m.lastMove = performance.now();
      // First contact: jump there instead of streaking in from off-screen
      if (!m.entered && m.inside) {
        m.current.copy(m.target);
        m.prev.copy(m.target);
        m.speedHat.set(0, 0);
        m.entered = true;
      }
      invalidate(); // wake the render loop (Canvas uses frameloop="demand")
    };
    const onLeave = () => {
      m.inside = false;
      invalidate();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [gl, invalidate]);

  useEffect(
    () => () => {
      trail.read.dispose();
      trail.write.dispose();
      trail.material.dispose();
      material.dispose();
    },
    [trail, material]
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const m = mouse.current;

    const aspect = size.width / size.height;

    // ── Cursor: One Euro filter ──
    // Adaptive smoothing: slow/tiny movements are smoothed (no jitter), fast
    // movements raise the cutoff so the brush stays glued to the pointer.
    m.prev.copy(m.current);
    if (smoothing <= 0) {
      m.current.copy(m.target);
    } else {
      const alpha = (cutoff) => 1 / (1 + 1 / (2 * Math.PI * cutoff) / dt);
      // smoothed estimate of pointer speed (aspect-corrected)
      const rvx = ((m.target.x - m.current.x) * aspect) / dt;
      const rvy = (m.target.y - m.current.y) / dt;
      const ad = alpha(ONE_EURO_D_CUTOFF);
      m.speedHat.x += ad * (rvx - m.speedHat.x);
      m.speedHat.y += ad * (rvy - m.speedHat.y);

      const minCutoff = THREE.MathUtils.lerp(30, 2, smoothing); // Hz
      const cutoff = minCutoff + ONE_EURO_BETA * m.speedHat.length();
      m.current.lerp(m.target, alpha(cutoff));
    }

    // Velocity in screen-heights / second (aspect-corrected), lightly smoothed
    const vx = ((m.current.x - m.prev.x) * aspect) / dt;
    const vy = (m.current.y - m.prev.y) / dt;
    const instSpeed = Math.hypot(vx, vy);
    m.vel.lerp({ x: vx, y: vy }, 1 - Math.exp(-dt * 25));
    if (!m.inside) m.vel.multiplyScalar(0.9);
    m.vel.clampLength(0, 4);

    // Activity: switches on instantly when the pointer moves, eases out when it stops
    const target = m.inside ? THREE.MathUtils.smoothstep(instSpeed, 0.005, 0.08) : 0;
    if (target > m.activity) m.activity = target;
    else m.activity += (target - m.activity) * (1 - Math.exp(-dt * 6));
    if (m.activity < 0.001) m.activity = 0;

    // Animation clock only runs while moving → still mouse = frozen effect
    m.time += dt * m.activity;

    // ── Circle grow / shrink ──
    // "Moving" = a pointermove arrived in the last ~90ms. The circle tweens
    // linearly toward its goal and is eased with smoothstep → ease-in-out both
    // ways, and it reverses smoothly if you start/stop mid-tween.
    const moving = m.inside && performance.now() - m.lastMove < 90;
    const tweenTime = moving ? growIn : shrinkOut;
    const step = tweenTime <= 0 ? 1 : dt / tweenTime;
    m.presence = moving ? Math.min(1, m.presence + step) : Math.max(0, m.presence - step);
    m.scale = m.presence * m.presence * (3 - 2 * m.presence);
    const decay = Math.pow(fade, dt * 60); // frame-rate independent

    // ── Pass 1: trail ──
    const tu = trail.material.uniforms;
    tu.uPrev.value = trail.read.texture;
    tu.uMouse.value.copy(m.current);
    tu.uPrevMouse.value.copy(m.prev);
    tu.uVel.value.copy(m.vel);
    tu.uDecay.value = decay;
    tu.uVelDecay.value = Math.pow(0.96, dt * 60);
    tu.uRadius.value = radius * m.scale; // circle grows in / shrinks away
    tu.uActive.value = m.scale > 0.001 ? 1 : 0;
    tu.uFlow.value = flow * m.activity;
    tu.uSwirl.value = swirl * m.activity;
    tu.uTime.value = m.time;
    tu.uDt.value = dt;

    const prevTarget = gl.getRenderTarget();
    gl.setRenderTarget(trail.write);
    gl.render(trail.scene, trail.camera);
    gl.setRenderTarget(prevTarget);

    // swap
    const tmp = trail.read;
    trail.read = trail.write;
    trail.write = tmp;

    // ── Pass 2: marble (rendered by R3F right after this) ──
    const u = material.uniforms;
    u.uTrail.value = trail.read.texture;
    u.uTime.value = m.time;
    u.uMouse.value.copy(m.current);

    // Grain frames: stepped at `fps`, advancing always / only while moving / never
    const grainOn = g.amount > 0 || g.noise > 0;
    const grainAlways = grainOn && g.animate === "always";
    if (grainAlways) m.grainClock += dt;
    else if (g.animate === "move") m.grainClock += dt * m.activity;
    u.uGrainSeed.value = Math.floor(m.grainClock * g.fps) % 97;

    // Keep rendering only while something is still changing on screen.
    // Once the trail has fully faded and the mouse is still, the GPU idles
    // (unless grain is set to animate "always").
    m.energy = Math.max(m.energy * decay - 0.0012, m.activity, m.scale);
    const settling = m.current.distanceToSquared(m.target) > 1e-8;
    if (m.energy > 0.002 || settling || grainAlways) invalidate();
  });

  return (
    <mesh frustumCulled={false} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
