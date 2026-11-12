// ─────────────────────────────────────────────────────────────
// Marble hero — all tweakable settings live here.
// Edit a value, save, and the dev server hot-reloads it.
// ─────────────────────────────────────────────────────────────

export const marbleConfig = {
  // ── Grain & Noise (overlay on top of everything) ──
  grain: {
    amount: 0.03, // fine grain strength            (0 = off, ~0.3 = heavy)
    size: 0.5, // grain cell size in CSS px          (0.5 – 6)
    noise: 0.01, // coarse mottled noise strength    (0 = off, ~0.15 = heavy)
    noiseScale: 80, // coarse noise feature size, px (10 – 600)
    fps: 1, // how often the grain pattern changes   (1 – 60)
    animate: "move", // "move" = only while the mouse moves | "always" | "off"
  },

  // ── Reveal (mouse interaction) ──
  reveal: {
    enabled: false, // marble reveal on mouse move (false = off; three.js isn't loaded at all)
    radius: 0.12, // brush size, fraction of screen height   (0.03 – 0.4)
    // subtlety / mood
    strength: 0.6, // how strongly the marble shows through (0 – 1; 1 = full)
    feather: 0.2, // edge softness: 0.06 = crisp cut-out, 0.2 = soft misty edge
    edgeGlow: 0.2, // light edge + glow around the reveal (0 = none, 1 = full)
    sheen: 0.02, // polished highlight under the cursor   (0 – 0.06)
    halo: 0.04, // soft moonlight glow around the cursor while moving (0 = off)
    growIn: 0.35, // seconds: circle grows in when the mouse starts moving  (0 = instant)
    shrinkOut: 0.5, // seconds: circle shrinks away when the mouse stops   (0 = instant)
    fade: 0.85, // trail persistence; closer to 1 = longer   (0.85 – 0.995)
    smoothing: 0.5, // 0 = raw pointer, 1 = extra smooth     (0 – 1)
    //               adaptive: slow moves are smoothed, fast moves never lag
    flow: 0, // trail drift in the direction you move        (0 – 1.5)
    swirl: 0.05, // ink-like swirl while fading              (0 – 0.3)
    distortion: 0.01, // liquid bend of the marble           (0 – 0.1)
  },

  // ── Mouse-move background (GPU fluid simulation) ──
  // "relief": a carved night garden (roses, lilies, vines, moon, stars) rises out of
  //           the black wall where the mouse moves, then sinks back flat.
  //           The carving is drawn in src/components/home/fluid/reliefArt.js
  // "image":  the picture below (`image`) shows through the black wall where the mouse moves.
  // "smoke":  soft silver smoke follows the mouse instead.
  // Only moves when the mouse moves; settles and stops a few seconds after it goes still.
  fluid: {
    enabled: true,
    look: "image", // "relief" | "image" | "smoke"
    image: "/images/bg.svg", // image look: picture revealed under the mouse (cover-fitted to the screen)
    // reveal (the mouse trail)
    intensity: 0.35, // how much each move reveals (relief) / smoke it adds (smoke ≈ 0.05)
    splatRadius: 0.5, // brush size of each stir (percent of screen)
    splatForce: 900, // how far movement throws the reveal along (fluid push)
    curl: 18, // swirliness of the reveal's edges
    densityDissipation: 3, // how fast it sinks back to black (higher = faster; 0.6 = slow linger)
    velocityDissipation: 0.7, // how fast the flow calms down
    pressure: 0.8,
    pressureIterations: 20,
    simResolution: 128, // fluid grid (lower = cheaper, softer)
    dyeResolution: 768, // smoke detail
    settle: 2.5, // seconds after the last move before the simulation stops (after the carving has sunk back)
    // relief look
    depth: 40, // how deep the carving looks
    lightColor: [0.86, 0.84, 0.8], // highlight colour, rgb 0–1 (soft silver)
    diffuse: 0.75, // brightness of the lit slopes
    specular: 0.8, // polished glints on the carving
    shininess: 34, // glint sharpness
    cavity: 1.2, // darkness in the crevices
    revealGain: 3, // how quickly the carving / image fully appears under the mouse
    // smoke look
    color: [0.78, 0.76, 0.72], // smoke colour, rgb 0–1 (soft silver)
    shading: 1, // soft relief on the smoke (0 – 1)
  },

  // ── Stardust trail behind the mouse ──
  stardust: {
    enabled: false, // replaced by the fluid smoke; set true to bring the stars back
    spacing: 16, // px of mouse travel per mote (higher = sparser)
    maxPerMove: 3, // most motes added per mouse event
    maxParticles: 140,
    life: [0.9, 1.8], // seconds each mote lives (min, max)
    size: [0.5, 1.5], // px radius of a mote (min, max)
    sparkle: 0.12, // share of motes drawn as 4-point star sparkles
    spread: 14, // px scatter around the cursor
    drift: 14, // px/s gentle upward float
    color: "236, 233, 226", // r, g, b — soft silver
    opacity: 0.85,
  },

  // ── "COMING SOON" + moon phases (centered on top) ──
  comingSoon: {
    text: "COMING SOON",
    fontSize: "clamp(15px, 1.5vw, 22px)", // text size (any CSS size)
    moonSize: 34, // px, diameter of one moon
    delay: 0, // seconds before the moons start
    // sequence (loops):
    //   full moon appears → splits into 5, each waning into its phase
    //   → they glide back, waxing to full, merge into one → moon fades
    //   → text appears → text hides → repeat
    moonAppear: 0.6, // seconds for the full moon to appear in the center
    spread: 1.4, // seconds for the moons to split apart into the 5 phases
    moonHold: 0.8, // seconds all five stay spread out
    combine: 1.4, // seconds for the moons to glide back and merge into one
    oneHold: 0.1, // seconds the single combined moon stays
    moonHide: 0.6, // seconds for that moon to fade
    textIn: 1, // seconds for the text to appear
    textHold: 1.6, // seconds the text stays
    textOut: 0.7, // seconds for the text to hide
    pause: 0, // seconds of darkness before the moon comes back
    loop: true, // false = stop on the text after the first cycle
    motionBlur: 1, // blur while moving: 0 = off, 1 = normal, 2 = strong
  },

  // ── "Night Circle" logo (above the moons): draw animation ──
  // A pen draws the solid white logo stroke by stroke, from the far left to the right.
  // Artwork: public/images/night-circle-logo.svg → pen paths made by
  // scripts/generate-logo-draw.mjs (`npm run logo:draw`; run it again after changing the logo file)
  logo: {
    width: "min(720px, 90vw)", // size of the logo
    gap: 18, // px between the logo and the moons
    color: "#A8A69F", // ink colour
    delay: 0.5, // seconds after page load before the pen starts
    duration: 2.2, // seconds to draw the whole logo (lower = faster)
    ease: "none", // "none" = steady pen speed; "sine.inOut" = slow start & finish
    softEdge: 0.8, // softness of the moving ink edge (0 = hard edge)
  },

  // ── Floral ornament, top-left corner (public/images/corner-flower.png) ──
  corner: {
    width: "clamp(110px, 13vw, 190px)", // size (any CSS width)
    gap: "clamp(14px, 2vw, 28px)", // space from the top and left edges
    fadeIn: 1.2, // seconds to fade in on load
    fadeDelay: 0.2, // seconds before it starts fading in
  },

  // ── Sign-up form (bottom centre) ──
  signup: {
    placeholder: "EMAIL",
    button: "SIGN UP",
    successText: "THANK YOU",
    errorText: "PLEASE TRY AGAIN",
    invalidText: "ENTER A VALID EMAIL",
    width: 587, // px at full size, same as the design (shrinks to 92vw on small screens)
    bottom: "6vh", // distance from the bottom of the screen
    endpoint: "/api/subscribe", // server route that emails the client (src/app/api/subscribe/route.js)
  },

  // ── Colors ──
  colors: {
    bg: "#111111", // section background
    base: "#0a0a0b", // marble stone body
    cloud: "#1e1e21", // smoky clouds in the stone
    vein: "#c4c0b8", // vein lines (soft silver; was bright #ece9e2)
    accent: "#b8955a", // thin gold seam
  },
};
