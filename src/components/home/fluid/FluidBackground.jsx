"use client";

import { useEffect, useRef } from "react";
import { VS, FS } from "./shaders";
import { buildReliefArt, groupReliefShapes, DESIGN_W, DESIGN_H } from "./reliefArt";

// ─────────────────────────────────────────────────────────────
// Mouse-driven fluid background (GPU "stable fluids", raw WebGL2).
//
// look "relief": a carved night garden rises out of the black wall wherever
//   the mouse has been, then sinks back. The fluid is the reveal mask, which
//   gives the reveal its soft, swirling, liquid edges.
// look "image":  a picture (the `image` URL, e.g. an SVG) shows through the
//   black wall wherever the mouse has been, with the same liquid edges.
// look "smoke":  the fluid itself is drawn as silver smoke.
//
// Nothing animates on its own: the simulation only runs after mouse movement
// and stops completely a few seconds after the mouse goes still.
// ─────────────────────────────────────────────────────────────

const hexToRgb = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const DOME = 0.05; // relief height per px of bevel (consistent slopes at every size)
const PETAL = 0.09; // cupped petals: thinner bevel, so a bit taller per px
const GROOVE = 0.12; // groove depth per px of blur

export default function FluidBackground({
  background = "#111111",
  look = "relief", // "relief" | "image" | "smoke"
  image = "/images/bg.svg", // image look: picture revealed under the mouse (cover-fitted)
  intensity = 0.35, // how much each move reveals (relief) / smoke it adds (smoke)
  splatRadius = 0.5, // brush size of each stir (percent of screen)
  splatForce = 900, // how strongly mouse movement pushes the fluid
  curl = 18, // swirliness of the edges (vorticity)
  densityDissipation = 3, // how fast the reveal / smoke fades (higher = faster)
  velocityDissipation = 0.7, // how fast the motion calms down
  pressure = 0.8,
  pressureIterations = 20,
  simResolution = 128,
  dyeResolution = 768,
  settle = 2.5, // seconds after the last mouse move before the simulation stops
  // relief look
  depth = 40, // how tall the carving looks
  lightColor = [0.86, 0.84, 0.8], // highlight colour, rgb 0–1
  diffuse = 0.75, // brightness of lit slopes
  specular = 0.8, // polished glints on the carving
  shininess = 34, // glint sharpness
  cavity = 1.2, // darkness in the crevices
  revealGain = 3, // how quickly the carving / image fully appears under the mouse
  // smoke look
  color = [0.78, 0.76, 0.72], // smoke colour, rgb 0–1
  shading = 1, // 0..1 soft relief on the smoke
  className = "",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false });
    if (!gl) return; // no WebGL2 → plain background stays
    const floatOk = gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float");
    if (!floatOk) return;
    gl.getExtension("OES_texture_float_linear");

    const bg = hexToRgb(background);
    const relief = look === "relief";
    const picture = look === "image";
    const reveal = relief || picture; // the dye is a white reveal mask, not coloured smoke
    let disposed = false;

    // ── programs ──
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const programs = {};
    for (const [name, src] of Object.entries(FS)) {
      const p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, src));
      gl.bindAttribLocation(p, 0, "aPosition");
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      const u = {};
      const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < n; i++) {
        const info = gl.getActiveUniform(p, i);
        u[info.name] = gl.getUniformLocation(p, info.name);
      }
      programs[name] = { p, u };
    }
    const prog = (name) => {
      gl.useProgram(programs[name].p);
      return programs[name].u;
    };

    // ── full-screen quad ──
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    const blit = (target) => {
      if (target) {
        gl.viewport(0, 0, target.w, target.h);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      } else {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };

    // ── render targets ──
    const texParams = () => {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    const createFBO = (w, h, internal, format) => {
      gl.activeTexture(gl.TEXTURE0);
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      texParams();
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      const fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return {
        tex, fbo, w, h, texel: [1 / w, 1 / h],
        attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; },
        dispose() { gl.deleteTexture(tex); gl.deleteFramebuffer(fbo); },
      };
    };
    const createDouble = (w, h, internal, format) => {
      let a = createFBO(w, h, internal, format), b = createFBO(w, h, internal, format);
      return {
        get read() { return a; }, get write() { return b; },
        swap() { const t = a; a = b; b = t; },
        dispose() { a.dispose(); b.dispose(); },
      };
    };
    const resFor = (res) => {
      let aspect = gl.drawingBufferWidth / gl.drawingBufferHeight;
      if (aspect < 1) aspect = 1 / aspect;
      const min = Math.round(res), max = Math.round(res * aspect);
      return gl.drawingBufferWidth > gl.drawingBufferHeight ? { w: max, h: min } : { w: min, h: max };
    };

    let dye, velocity, divergence, curlT, pressureT;
    const initTargets = () => {
      [dye, velocity, divergence, curlT, pressureT].forEach((t) => t && t.dispose());
      const s = resFor(simResolution), d = resFor(reveal ? Math.min(dyeResolution, 512) : dyeResolution);
      dye = createDouble(d.w, d.h, gl.RGBA16F, gl.RGBA);
      velocity = createDouble(s.w, s.h, gl.RG16F, gl.RG);
      divergence = createFBO(s.w, s.h, gl.R16F, gl.RED);
      curlT = createFBO(s.w, s.h, gl.R16F, gl.RED);
      pressureT = createDouble(s.w, s.h, gl.R16F, gl.RED);
    };

    // ── relief: bake the carving into a height map, one small batch per idle slice ──
    let reliefMap = null; // RG16F: r = height, g = cavity
    let bakeTimer = 0;
    const idle = (fn) => (window.requestIdleCallback ? window.requestIdleCallback(fn, { timeout: 250 }) : setTimeout(fn, 16));
    const cancelIdle = (id) => (window.cancelIdleCallback ? window.cancelIdleCallback(id) : clearTimeout(id));

    const bakeRelief = () => {
      const A = DESIGN_W / DESIGN_H;
      const rw = Math.round(Math.min(2048, Math.max(1280, canvas.width, canvas.height * A)));
      const rh = Math.round(rw / A);
      const k = rw / DESIGN_W;
      const groups = groupReliefShapes(buildReliefArt());
      const batches = [];
      for (let i = 0; i < groups.length; i += 3) batches.push(groups.slice(i, i + 3));

      const mc = document.createElement("canvas");
      mc.width = rw;
      mc.height = rh;
      const ctx = mc.getContext("2d");
      const maskTex = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, maskTex);
      texParams();
      const mask = { attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, maskTex); return unit; } };
      const tmpA = createFBO(rw, rh, gl.RGBA16F, gl.RGBA);
      const tmpB = createFBO(rw, rh, gl.RGBA16F, gl.RGBA);
      const height = createDouble(rw, rh, gl.R16F, gl.RED);

      const blur = (src, dst, step, sig) => {
        const u = prog("blur");
        gl.uniform2f(u.texelSize, 1 / rw, 1 / rh);
        gl.uniform1i(u.uTexture, src.attach(0));
        gl.uniform2f(u.uStep, ...step);
        gl.uniform3f(u.uSigma, ...sig);
        gl.uniform1i(u.uRadius, Math.max(1, Math.ceil(Math.max(...sig) * 2.5)));
        blit(dst);
      };

      let bi = 0;
      const work = () => {
        bakeTimer = 0;
        if (disposed) return;
        if (bi < batches.length) {
          const batch = batches[bi++];
          // 1. draw up to three shape groups into the r, g and b channels
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.globalCompositeOperation = "source-over";
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, rw, rh);
          ctx.setTransform(k, 0, 0, k, 0, 0);
          ctx.globalCompositeOperation = "lighter";
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          const sig = [0, 0, 0], amp = [0, 0, 0], groove = [0, 0, 0], cup = [0, 0, 0], over = [0, 0, 0], base = [0, 0, 0];
          batch.forEach((g, c) => {
            ctx.fillStyle = ctx.strokeStyle = ["#f00", "#0f0", "#00f"][c];
            for (const s of g.shapes) {
              if (s.stroke) {
                ctx.lineWidth = s.stroke;
                ctx.stroke(s.path);
              } else ctx.fill(s.path);
            }
            sig[c] = g.sigma * k;
            groove[c] = g.kind === "groove" ? 1 : 0;
            cup[c] = over[c] = g.kind === "petal" ? 1 : 0;
            cup[c] *= 0.6;
            base[c] = g.base * PETAL * k;
            amp[c] = (g.kind === "groove" ? -GROOVE : g.kind === "petal" ? PETAL : DOME) * g.sigma * k;
          });
          // 2. upload, blur each channel by its own amount, add to the height map
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, maskTex);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, mc);
          gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
          blur(mask, tmpA, [1 / rw, 0], sig);
          blur(tmpA, tmpB, [0, 1 / rh], sig);
          const u = prog("accumulate");
          gl.uniform2f(u.texelSize, 1 / rw, 1 / rh);
          gl.uniform1i(u.uHeight, height.read.attach(0));
          gl.uniform1i(u.uMask, tmpB.attach(1));
          gl.uniform3f(u.uAmp, ...amp);
          gl.uniform3f(u.uGroove, ...groove);
          gl.uniform3f(u.uCup, ...cup);
          gl.uniform3f(u.uOver, ...over);
          gl.uniform3f(u.uBase, ...base);
          blit(height.write);
          height.swap();
          bakeTimer = idle(work);
          return;
        }
        // 3. cavity map (how far each point sits below its surroundings) + final texture
        const s = 9 * k;
        blur(height.read, tmpA, [1 / rw, 0], [s, s, s]);
        blur(tmpA, tmpB, [0, 1 / rh], [s, s, s]);
        const out = createFBO(rw, rh, gl.RG16F, gl.RG);
        const u = prog("finalize");
        gl.uniform2f(u.texelSize, 1 / rw, 1 / rh);
        gl.uniform1i(u.uHeight, height.read.attach(0));
        gl.uniform1i(u.uBlurred, tmpB.attach(1));
        blit(out);
        tmpA.dispose();
        tmpB.dispose();
        height.dispose();
        gl.deleteTexture(maskTex);
        mc.width = mc.height = 0;
        reliefMap = out;
        if (!raf) render();
      };
      bakeTimer = idle(work);
    };

    // ── image: rasterize the picture once (SVG filters included) into a texture ──
    let imageTex = null; // { attach, dispose, aspect }
    const loadImage = () => {
      const img = new Image();
      img.decoding = "async";
      img.src = image;
      img.decode().then(() => {
        if (disposed) return;
        const iw = img.naturalWidth || 1440, ih = img.naturalHeight || 900;
        const A = iw / ih;
        // sharp at this screen size, capped so big screens don't build huge textures
        const rw = Math.round(Math.min(2560, Math.max(iw, canvas.width, canvas.height * A)));
        const rh = Math.round(rw / A);
        const c = document.createElement("canvas");
        c.width = rw;
        c.height = rh;
        c.getContext("2d").drawImage(img, 0, 0, rw, rh);
        const tex = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        texParams();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        c.width = c.height = 0;
        imageTex = {
          aspect: A,
          attach(unit) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); return unit; },
          dispose() { gl.deleteTexture(tex); },
        };
        if (!raf) render();
      }).catch(() => {}); // image failed to load → the wall just stays plain
    };

    // ── simulation step ──
    const step = (dt) => {
      gl.disable(gl.BLEND);
      const st = velocity.read.texel;
      let u;

      u = prog("curl"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(curlT);

      u = prog("vorticity"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uCurl, curlT.attach(1));
      gl.uniform1f(u.curl, curl); gl.uniform1f(u.dt, dt); blit(velocity.write); velocity.swap();

      u = prog("divergence"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uVelocity, velocity.read.attach(0)); blit(divergence);

      u = prog("clear"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uTexture, pressureT.read.attach(0)); gl.uniform1f(u.value, pressure);
      blit(pressureT.write); pressureT.swap();

      u = prog("pressure"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uDivergence, divergence.attach(0));
      for (let i = 0; i < pressureIterations; i++) {
        gl.uniform1i(u.uPressure, pressureT.read.attach(1)); blit(pressureT.write); pressureT.swap();
      }

      u = prog("gradient"); gl.uniform2f(u.texelSize, ...st);
      gl.uniform1i(u.uPressure, pressureT.read.attach(0)); gl.uniform1i(u.uVelocity, velocity.read.attach(1));
      blit(velocity.write); velocity.swap();

      u = prog("advection"); gl.uniform2f(u.texelSize, ...st);
      const vid = velocity.read.attach(0);
      gl.uniform1i(u.uVelocity, vid); gl.uniform1i(u.uSource, vid);
      gl.uniform1f(u.dt, dt); gl.uniform1f(u.dissipation, velocityDissipation);
      blit(velocity.write); velocity.swap();

      gl.uniform1i(u.uVelocity, velocity.read.attach(0)); gl.uniform1i(u.uSource, dye.read.attach(1));
      gl.uniform1f(u.dissipation, densityDissipation);
      blit(dye.write); dye.swap();
    };

    const render = () => {
      if (picture) {
        if (!imageTex) {
          // picture not loaded yet: plain wall
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.clearColor(bg[0], bg[1], bg[2], 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }
        // cover-fit the picture to the screen
        const a = canvas.width / canvas.height, A = imageTex.aspect;
        const cover = a > A ? [1, A / a, 0, (1 - A / a) / 2] : [a / A, 1, (1 - a / A) / 2, 0];
        const u = prog("image");
        gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        gl.uniform1i(u.uImage, imageTex.attach(1));
        gl.uniform4f(u.uCover, ...cover);
        gl.uniform3f(u.uBg, ...bg);
        gl.uniform1f(u.uGain, revealGain);
        blit(null);
        return;
      }
      if (relief) {
        if (!reliefMap) {
          // carving not baked yet: plain wall
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.clearColor(bg[0], bg[1], bg[2], 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          return;
        }
        // cover-fit the 16:9 carving to the screen
        const a = canvas.width / canvas.height, A = DESIGN_W / DESIGN_H;
        const cover = a > A ? [1, A / a, 0, (1 - A / a) / 2] : [a / A, 1, (1 - a / A) / 2, 0];
        const u = prog("relief");
        gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
        gl.uniform1i(u.uTexture, dye.read.attach(0));
        gl.uniform1i(u.uRelief, reliefMap.attach(1));
        gl.uniform2f(u.uReliefTexel, ...reliefMap.texel);
        gl.uniform4f(u.uCover, ...cover);
        gl.uniform3f(u.uBg, ...bg);
        gl.uniform3f(u.uLight, ...lightColor);
        gl.uniform1f(u.uDepth, depth);
        gl.uniform1f(u.uDiffuse, diffuse);
        gl.uniform1f(u.uSpecular, specular);
        gl.uniform1f(u.uShininess, shininess);
        gl.uniform1f(u.uCavity, cavity);
        gl.uniform1f(u.uGain, revealGain);
        blit(null);
        return;
      }
      const u = prog("smoke");
      gl.uniform2f(u.texelSize, 1 / gl.drawingBufferWidth, 1 / gl.drawingBufferHeight);
      gl.uniform2f(u.dyeTexel, ...dye.read.texel);
      gl.uniform1i(u.uTexture, dye.read.attach(0));
      gl.uniform3f(u.uBg, ...bg);
      gl.uniform1f(u.uShading, shading);
      blit(null);
    };

    const splat = (x, y, dx, dy, amount) => {
      const aspect = canvas.width / canvas.height;
      const u = prog("splat");
      gl.uniform2f(u.texelSize, ...velocity.read.texel);
      gl.uniform1i(u.uTarget, velocity.read.attach(0));
      gl.uniform1f(u.aspectRatio, aspect);
      gl.uniform2f(u.point, x, y);
      gl.uniform3f(u.color, dx, dy, 0);
      gl.uniform1f(u.radius, (splatRadius / 100) * (aspect > 1 ? aspect : 1));
      blit(velocity.write); velocity.swap();

      const c = reveal ? [1, 1, 1] : color;
      gl.uniform1i(u.uTarget, dye.read.attach(0));
      gl.uniform3f(u.color, c[0] * amount, c[1] * amount, c[2] * amount);
      blit(dye.write); dye.swap();
    };

    // ── pointer: only movement drives the fluid ──
    const pointer = { x: 0, y: 0, px: 0, py: 0, moved: false, primed: false };
    let lastMove = -Infinity;
    let raf = 0;
    let prevT = 0;

    const loop = (now) => {
      const dt = Math.min((now - prevT) / 1000, 1 / 30);
      prevT = now;
      if (pointer.moved) {
        pointer.moved = false;
        const dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
        pointer.px = pointer.x;
        pointer.py = pointer.y;
        const distPx = Math.hypot(dx * canvas.width, dy * canvas.height);
        if (distPx > 0.5) {
          // a slow drift reveals gently, a sweep reveals fully
          splat(pointer.x, pointer.y, dx * splatForce, dy * splatForce, intensity * Math.min(1, distPx / 24));
        }
      }
      step(dt);
      render();
      if (now - lastMove < settle * 1000) {
        raf = requestAnimationFrame(loop);
      } else {
        // fully settled: clear the fluid so nothing lingers, then stop (idle cost = 0)
        initTargets();
        render();
        raf = 0;
      }
    };

    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = 1 - (e.clientY - r.top) / r.height;
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        pointer.primed = false;
        return;
      }
      if (!pointer.primed) {
        // first contact: no jump from a stale position
        pointer.px = pointer.x = x;
        pointer.py = pointer.y = y;
        pointer.primed = true;
      } else {
        pointer.x = x;
        pointer.y = y;
        pointer.moved = true;
      }
      lastMove = performance.now();
      if (!raf) {
        prevT = performance.now();
        raf = requestAnimationFrame(loop);
      }
    };

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        initTargets();
        render();
      }
    };

    initTargets();
    resize();
    render();
    if (relief) bakeRelief();
    if (picture) loadImage();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      disposed = true;
      window.removeEventListener("pointermove", onMove);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      if (bakeTimer) cancelIdle(bakeTimer);
      [dye, velocity, divergence, curlT, pressureT, reliefMap, imageTex].forEach((t) => t && t.dispose());
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, [background, look, image, intensity, splatRadius, splatForce, curl, densityDissipation, velocityDissipation, pressure, pressureIterations, simResolution, dyeResolution, settle, depth, lightColor, diffuse, specular, shininess, cavity, revealGain, color, shading]);

  return <canvas ref={ref} aria-hidden="true" className={className} style={style} />;
}
