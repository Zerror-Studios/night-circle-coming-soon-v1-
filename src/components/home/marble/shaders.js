// ─────────────────────────────────────────────────────────────
// Shared GLSL chunks
// ─────────────────────────────────────────────────────────────

// Full-screen quad: the plane is 2x2 in clip space, so no camera math needed.
export const fullscreenVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const noise = /* glsl */ `
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Well-distributed hash for per-pixel grain (Dave Hoskins, "hash without sine")
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  // Value noise with quintic interpolation (smooth, no grid artifacts)
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 6; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.02;
      a *= 0.5;
    }
    return v;
  }

  // Cheaper, smoother 4-octave version for large-scale warping
  float fbm4(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * vnoise(p);
      p = rot * p * 2.03;
      a *= 0.5;
    }
    return v;
  }
`;

// ─────────────────────────────────────────────────────────────
// Pass 1 — mouse trail (ping-pong render target)
//   r  = reveal intensity
//   gb = velocity painted by the cursor (screen-heights / second)
// Each frame the previous state is advected along its own velocity
// plus a little curl noise, so the trail drifts and swirls like ink.
// ─────────────────────────────────────────────────────────────
export const trailFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uPrev;
  uniform vec2  uMouse;
  uniform vec2  uPrevMouse;
  uniform vec2  uVel;       // smoothed cursor velocity
  uniform float uAspect;
  uniform float uRadius;
  uniform float uDecay;
  uniform float uVelDecay;
  uniform float uActive;
  uniform float uTime;
  uniform float uDt;
  uniform float uFlow;      // how far the trail drifts with movement
  uniform float uSwirl;     // curl-noise turbulence while fading

  ${noise}

  float sdSegment(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-6), 0.0, 1.0);
    return length(pa - ba * h);
  }

  // Divergence-free swirl from the gradient of a noise field
  vec2 curl(vec2 p) {
    float e = 0.02;
    float n1 = vnoise(p + vec2(0.0, e));
    float n2 = vnoise(p - vec2(0.0, e));
    float n3 = vnoise(p + vec2(e, 0.0));
    float n4 = vnoise(p - vec2(e, 0.0));
    return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
  }

  void main() {
    vec2 asp = vec2(uAspect, 1.0);

    // ── Advect previous frame ──
    vec4 here = texture2D(uPrev, vUv);
    vec2 sw = curl(vUv * asp * 3.0 + uTime * 0.15) * uSwirl * (1.0 - here.r);
    vec2 flow = (here.gb * uFlow + sw) * uDt;
    vec4 prev = texture2D(uPrev, vUv - flow / asp);

    float inten = max(prev.r * uDecay - 0.0012, 0.0);
    vec2  vel   = prev.gb * uVelDecay;

    // ── Paint the brush ──
    float speed = length(uVel);
    float radius = max(uRadius, 1e-4)                  // never 0 (smoothstep edge safety)
      * mix(0.75, 1.6, smoothstep(0.0, 2.5, speed))   // grows with speed
      * (1.0 + 0.05 * sin(uTime * 2.2));               // gentle breathing
    float d = sdSegment(vUv * asp, uPrevMouse * asp, uMouse * asp);
    float brush = (1.0 - smoothstep(radius * 0.15, radius, d)) * uActive;

    inten = max(inten, brush);
    vel = mix(vel, uVel, brush);

    gl_FragColor = vec4(inten, vel, 1.0);
  }
`;

// ─────────────────────────────────────────────────────────────
// Pass 2 — procedural marble, revealed through the trail mask
// ─────────────────────────────────────────────────────────────
export const marbleFragment = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uTrail;
  uniform float uDistort;

  // Grain / noise overlay
  uniform float uGrainAmount;   // fine per-pixel grain strength
  uniform float uGrainSize;     // grain cell size in CSS pixels
  uniform float uNoiseAmount;   // coarse mottled noise strength
  uniform float uNoiseScale;    // coarse noise feature size in CSS pixels
  uniform float uGrainSeed;     // changes per grain "frame"
  uniform float uPixelRatio;
  uniform float uTime;
  uniform float uAspect;
  uniform vec2  uMouse;
  uniform vec3  uBg;
  uniform vec3  uBase;
  uniform vec3  uCloud;
  uniform vec3  uVein;
  uniform vec3  uAccent;

  ${noise}

  // Perlin turbulence: sum of |noise| → sharp creases like stone
  float turb(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 5; i++) {
      v += a * abs(vnoise(p) * 2.0 - 1.0);
      p = rot * p * 2.07;
      a *= 0.5;
    }
    return v;
  }

  mat2 rot2(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

  // Vein profile from a sine phase: crisp core + wide diffused halo
  vec2 vein(float phase, float core, float halo) {
    float d = abs(sin(phase));
    return vec2(1.0 - smoothstep(0.0, core, d), 1.0 - smoothstep(0.0, halo, d));
  }

  vec3 marble(vec2 uv) {
    vec2 p = uv * vec2(uAspect, 1.0);
    float t = uTime * 0.02;

    // Slow large-scale drift field
    vec2 q = vec2(fbm4(p * 1.2 + t), fbm4(p * 1.2 + vec2(5.2, 1.3) - t));

    // Soft grey clouds in the body of the stone
    float cloud = fbm(p * 2.2 + q * 1.5);
    vec3 col = mix(uBase, uCloud, smoothstep(0.4, 0.95, cloud));

    // ── Primary veins: long diagonal streaks ──
    vec2 a = rot2(0.6) * p;
    float tb1 = turb(a * vec2(0.9, 2.2) + q * 1.2);
    vec2 v1 = vein(a.y * 5.5 + tb1 * 6.0, 0.06, 0.6);

    // ── Secondary hairline network, crossing angle ──
    vec2 b = rot2(-0.45) * p;
    float tb2 = turb(b * vec2(1.4, 3.0) + 3.7 + q);
    vec2 v2 = vein(b.y * 7.0 + tb2 * 6.0, 0.03, 0.25);

    // Veins appear/disappear along their length
    float fade1 = smoothstep(0.3, 0.6, fbm4(a * vec2(0.8, 0.3) + 11.0));
    float fade2 = smoothstep(0.4, 0.65, fbm4(b * vec2(1.2, 0.5) + 23.0));

    // Halos bleed the vein colour softly into the stone, then a crisp core on top
    col = mix(col, mix(uCloud, uVein, 0.35), v1.y * fade1 * 0.35); // diffused glow
    col = mix(col, uVein, v1.x * fade1 * 0.95);                    // crisp core
    col = mix(col, mix(uCloud, uVein, 0.25), v2.y * fade2 * 0.2);
    col = mix(col, uVein, v2.x * fade2 * 0.55);

    // Thin gold seam riding just beside the main veins
    vec2 g = vein(a.y * 5.5 + tb1 * 6.0 + 0.14, 0.022, 0.0001);
    float goldMask = smoothstep(0.45, 0.7, fbm4(a * vec2(0.6, 0.25) + 41.0));
    col = mix(col, uAccent, g.x * goldMask * 0.85);

    // Micro grain
    col += (vnoise(p * 900.0) - 0.5) * 0.018;
    return col;
  }

  void main() {
    vec2 asp = vec2(uAspect, 1.0);
    vec4 tr = texture2D(uTrail, vUv);
    float trail = tr.r;
    vec2 vel = tr.gb;

    // ── Edge: two noise scales; erosion gets stronger as the trail fades,
    //    so the reveal crumbles into fragments instead of shrinking ──
    vec2 nuv = vUv * asp;
    float nBig   = fbm(nuv * 4.0 + uTime * 0.18);
    float nSmall = vnoise(nuv * 22.0 - uTime * 0.6);
    float n = nBig * 0.75 + nSmall * 0.25;
    float erosion = mix(0.75, 0.35, smoothstep(0.3, 1.0, trail));
    float m = trail + (n - 0.5) * erosion;
    float mask = smoothstep(0.42, 0.54, m);

    // ── Liquid drag: marble bends along the movement direction ──
    vec2 disp = vel * uDistort * smoothstep(0.0, 0.8, trail);
    vec3 stone = marble(vUv - disp / asp);

    // Polished sheen right under the cursor
    vec2 dm = (vUv - uMouse) * asp;
    float sheen = exp(-dot(dm, dm) * 30.0) * 0.035;
    stone += sheen;

    vec3 col = mix(uBg, stone, mask);

    // Only light edges where there is actually trail (keeps idle screen pure #111111)
    float present = smoothstep(0.0, 0.12, trail);

    // Thin light catching the cut edge
    float edge = smoothstep(0.38, 0.47, m) * (1.0 - smoothstep(0.47, 0.56, m));
    col += uVein * edge * 0.09 * present;

    // Faint glow just outside the revealed edge
    float rim = smoothstep(0.22, 0.42, m) * (1.0 - mask);
    col += uVein * rim * 0.03 * present;

    // ── Grain + noise on top of everything ──
    vec2 px = gl_FragCoord.xy / uPixelRatio;          // CSS pixels
    vec2 seed = vec2(uGrainSeed * 71.3, uGrainSeed * 37.1);

    // Fine grain: two hashes averaged → softer, film-like distribution
    vec2 gp = floor(px / max(uGrainSize, 0.5));
    float g = (hash12(gp + seed) + hash12(gp * 1.37 + seed + vec2(413.0, 179.0))) - 1.0;
    col += g * uGrainAmount;

    // Coarse noise: smooth blotchy variation
    float cn = vnoise(px / max(uNoiseScale, 1.0) + seed * 0.37) - 0.5;
    col += cn * uNoiseAmount;

    gl_FragColor = vec4(max(col, 0.0), 1.0);
  }
`;
