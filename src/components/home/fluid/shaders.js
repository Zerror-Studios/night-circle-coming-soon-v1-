// GLSL for FluidBackground (WebGL2).
//
// Fluid ("stable fluids"):  curl → vorticity → divergence → pressure (Jacobi)
//                          → subtract gradient → advect velocity → advect dye
// Relief bake (once):       blur shape masks → add domes / carve grooves → cavity map
// Display:                  "relief" = carving rises where the fluid dye is
//                           "image"  = a picture shows through where the fluid dye is
//                           "smoke"  = the dye itself drawn as soft smoke

export const VS = `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv, vL, vR, vT, vB;
out vec4 fragColor;
`;

export const FS = {
  // ── fluid ──
  clear: `${HEAD}
uniform sampler2D uTexture; uniform float value;
void main () { fragColor = value * texture(uTexture, vUv); }`,

  splat: `${HEAD}
uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
void main () {
  vec2 p = vUv - point; p.x *= aspectRatio;
  vec3 s = exp(-dot(p, p) / radius) * color;
  fragColor = vec4(texture(uTarget, vUv).xyz + s, 1.0);
}`,

  advection: `${HEAD}
uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main () {
  vec2 coord = vUv - dt * texture(uVelocity, vUv).xy * texelSize;
  fragColor = texture(uSource, coord) / (1.0 + dissipation * dt);
}`,

  divergence: `${HEAD}
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).x, R = texture(uVelocity, vR).x;
  float T = texture(uVelocity, vT).y, B = texture(uVelocity, vB).y;
  vec2 C = texture(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x;  if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y;  if (vB.y < 0.0) B = -C.y;
  fragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,

  curl: `${HEAD}
uniform sampler2D uVelocity;
void main () {
  float L = texture(uVelocity, vL).y, R = texture(uVelocity, vR).y;
  float T = texture(uVelocity, vT).x, B = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,

  vorticity: `${HEAD}
uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main () {
  float L = texture(uCurl, vL).x, R = texture(uCurl, vR).x;
  float T = texture(uCurl, vT).x, B = texture(uCurl, vB).x, C = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C; force.y *= -1.0;
  vec2 vel = texture(uVelocity, vUv).xy + force * dt;
  fragColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}`,

  pressure: `${HEAD}
uniform sampler2D uPressure, uDivergence;
void main () {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  float div = texture(uDivergence, vUv).x;
  fragColor = vec4((L + R + B + T - div) * 0.25, 0.0, 0.0, 1.0);
}`,

  gradient: `${HEAD}
uniform sampler2D uPressure, uVelocity;
void main () {
  float L = texture(uPressure, vL).x, R = texture(uPressure, vR).x;
  float T = texture(uPressure, vT).x, B = texture(uPressure, vB).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(R - L, T - B);
  fragColor = vec4(vel, 0.0, 1.0);
}`,

  // ── relief bake ──
  // separable gaussian, its own sigma per channel (3 shape groups per pass)
  blur: `${HEAD}
uniform sampler2D uTexture; uniform vec2 uStep; uniform vec3 uSigma; uniform int uRadius;
void main () {
  vec3 inv = 1.0 / (2.0 * max(uSigma, vec3(0.3)) * max(uSigma, vec3(0.3)));
  vec3 sum = vec3(0.0), wsum = vec3(0.0);
  for (int i = -uRadius; i <= uRadius; i++) {
    float x = float(i);
    vec3 w = exp(-x * x * inv);
    sum += texture(uTexture, vUv + uStep * x).rgb * w;
    wsum += w;
  }
  fragColor = vec4(sum / wsum, 1.0);
}`,

  // blurred mask → rounded dome (crisp edge, soft top), cupped petal (raised rim,
  // hollow middle) or a carved groove. Domes and grooves add to the surface;
  // petals ("over") sit at their own base level and hide what is beneath them.
  accumulate: `${HEAD}
uniform sampler2D uHeight, uMask; uniform vec3 uAmp, uGroove, uCup, uOver, uBase;
vec3 dome (vec3 b) { vec3 p = clamp(2.0 * b - 1.0, 0.0, 1.0); return p * (2.0 - p); }
void main () {
  vec3 b = texture(uMask, vUv).rgb;
  vec3 solid = dome(b) - uCup * smoothstep(0.7, 1.0, b);
  vec3 add = uAmp * mix(solid, b, uGroove);
  vec3 cov = smoothstep(0.42, 0.58, b) * uOver;
  float h = texture(uHeight, vUv).r;
  h = mix(h + add.r, uBase.r + add.r, cov.r);
  h = mix(h + add.g, uBase.g + add.g, cov.g);
  h = mix(h + add.b, uBase.b + add.b, cov.b);
  fragColor = vec4(h, 0.0, 0.0, 1.0);
}`,

  // r = height, g = cavity (how far below its surroundings a point sits)
  finalize: `${HEAD}
uniform sampler2D uHeight, uBlurred;
void main () {
  float h = texture(uHeight, vUv).r;
  fragColor = vec4(h, max(texture(uBlurred, vUv).r - h, 0.0), 0.0, 1.0);
}`,

  // ── display ──
  // carved relief rising out of the wall wherever the fluid dye is
  relief: `${HEAD}
uniform sampler2D uTexture, uRelief;
uniform vec3 uBg, uLight;
uniform vec2 uReliefTexel;
uniform vec4 uCover;
uniform float uDepth, uDiffuse, uSpecular, uShininess, uCavity, uGain;
void main () {
  float m = 1.0 - exp(-texture(uTexture, vUv).r * uGain);  float s = smoothstep(0.04, 0.85, m);
  if (s <= 0.0) { fragColor = vec4(uBg, 1.0); return; }
  vec2 ruv = vUv * uCover.xy + uCover.zw;
  vec2 dx = vec2(uReliefTexel.x, 0.0), dy = vec2(0.0, uReliefTexel.y);
  vec2 g = 0.5 * vec2(texture(uRelief, ruv + dx).r - texture(uRelief, ruv - dx).r,
                      texture(uRelief, ruv + dy).r - texture(uRelief, ruv - dy).r);
  vec3 n = normalize(vec3(-g * uDepth * s, 1.0));
  vec3 L = normalize(vec3(-0.55, 0.62, 0.56)); // light from the top left
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  // both terms are exactly 0 on the flat wall, so untouched areas stay the page colour
  float diff = dot(n, L) - L.z;
  float spec = pow(max(dot(n, H), 0.0), uShininess) - pow(H.z, uShininess);
  vec3 c = uBg + uLight * (diff * uDiffuse + spec * uSpecular);
  c *= 1.0 - clamp(texture(uRelief, ruv).g * uCavity * s, 0.0, 0.85);
  fragColor = vec4(max(c, 0.0), 1.0);
}`,

  // a picture (e.g. /images/bg.svg) shows through wherever the fluid dye is
  image: `${HEAD}
uniform sampler2D uTexture, uImage;
uniform vec3 uBg;
uniform vec4 uCover;
uniform float uGain;
void main () {
  float m = 1.0 - exp(-texture(uTexture, vUv).r * uGain);
  float s = smoothstep(0.04, 0.85, m);
  if (s <= 0.0) { fragColor = vec4(uBg, 1.0); return; }
  vec3 img = texture(uImage, vUv * uCover.xy + uCover.zw).rgb;
  fragColor = vec4(mix(uBg, img, s), 1.0);
}`,

  // the dye as soft smoke, with relief shading for a silky look
  smoke: `${HEAD}
uniform sampler2D uTexture; uniform vec3 uBg; uniform vec2 dyeTexel; uniform float uShading;
void main () {
  vec3 c = texture(uTexture, vUv).rgb;
  vec3 lc = texture(uTexture, vUv - vec2(dyeTexel.x, 0.0)).rgb;
  vec3 rc = texture(uTexture, vUv + vec2(dyeTexel.x, 0.0)).rgb;
  vec3 tc = texture(uTexture, vUv + vec2(0.0, dyeTexel.y)).rgb;
  vec3 bc = texture(uTexture, vUv - vec2(0.0, dyeTexel.y)).rgb;
  float dx = length(rc) - length(lc), dy = length(tc) - length(bc);
  vec3 n = normalize(vec3(dx, dy, length(dyeTexel)));
  float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.7, 0.7, 1.0);
  c *= mix(1.0, diffuse, uShading);
  c = c / (1.0 + c); // soft tone curve: dense smoke stays silver, never blown-out white
  fragColor = vec4(uBg + c, 1.0);
}`,
};
