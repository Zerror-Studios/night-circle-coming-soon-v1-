// ─────────────────────────────────────────────────────────────
// Marble hero — all tweakable settings live here.
// Edit a value, save, and the dev server hot-reloads it.
// ─────────────────────────────────────────────────────────────

export const marbleConfig = {
  // ── Grain & Noise (overlay on top of everything) ──
  grain: {
    amount: 0.04, // fine grain strength            (0 = off, ~0.3 = heavy)
    size: 0.5, // grain cell size in CSS px          (0.5 – 6)
    noise: 0.015, // coarse mottled noise strength   (0 = off, ~0.15 = heavy)
    noiseScale: 80, // coarse noise feature size, px (10 – 600)
    fps: 1, // how often the grain pattern changes   (1 – 60)
    animate: "move", // "move" = only while the mouse moves | "always" | "off"
  },

  // ── Reveal (mouse interaction) ──
  reveal: {
    radius: 0.14, // brush size, fraction of screen height   (0.03 – 0.4)
    growIn: 0.35, // seconds: circle grows in when the mouse starts moving  (0 = instant)
    shrinkOut: 0.5, // seconds: circle shrinks away when the mouse stops   (0 = instant)
    fade: 0.85, // trail persistence; closer to 1 = longer   (0.85 – 0.995)
    smoothing: 0.5, // 0 = raw pointer, 1 = extra smooth     (0 – 1)
    //               adaptive: slow moves are smoothed, fast moves never lag
    flow: 0, // trail drift in the direction you move        (0 – 1.5)
    swirl: 0.05, // ink-like swirl while fading              (0 – 0.3)
    distortion: 0.01, // liquid bend of the marble           (0 – 0.1)
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

  // ── Colors ──
  colors: {
    bg: "#111111", // section background
    base: "#0a0a0b", // marble stone body
    cloud: "#1e1e21", // smoky clouds in the stone
    vein: "#ece9e2", // vein lines
    accent: "#b8955a", // thin gold seam
  },
};
