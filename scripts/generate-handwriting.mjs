// Builds the data for the "Night Circle" pen-writing animation.
//
//   npm run handwriting                               → writes src/components/home/handwriting/glyphs.js
//   node scripts/generate-handwriting.mjs --inspect   → prints font info only
//
// Style matches the reference artwork: copperplate script (Pinyon Script — the
// closest free match to Bickham Script), a steeper slant, a long entry flourish
// into the first letter, an exit flourish off the last letter and a faint
// hairline tail on the "g".
//
// For each piece it stores:
//   d        the filled shape (the ink)
//   strokes  the pen's path through the middle of each stroke, in writing order,
//            with the pen width needed to cover the ink

import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import { centerlineStrokes } from "./lib/centerline.mjs";

const TEXT = "Night Circle";
// Herr Von Muellerhoff: Spencerian script — closest free match to the reference
// (steep slant, tiny x-height with tall loops, "V"-style N, straight hairline g-tail, looped C)
const FONT_FILE = "node_modules/@fontsource/herr-von-muellerhoff/files/herr-von-muellerhoff-latin-400-normal.woff";
// const FONT_FILE = "node_modules/@fontsource/pinyon-script/files/pinyon-script-latin-400-normal.woff";
// const FONT_FILE = "public/fonts/Jabetta.otf";   // ← the brush font (lowercase only)
const FONT_SIZE = 200;
const SLANT_DEG = 0; // extra italic slant, applied before the pen paths are computed
const STRETCH = 1.05; // horizontal stretch (matched to the reference's width : height ratio)
const TRACKING = 6; // extra space between letters (font units)
const OUT_FILE = "src/components/home/handwriting/glyphs.js";

// Flourishes (font units, baseline y = 0, text starts at x = 0). Set to null to disable.
const FLOURISHES = {
  // long arc rising from lower-left into the start of the "N" (shaped from the reference)
  entry: { pts: [[-325, 32], [-200, -6], [-85, -6], [6, 3]], width: 5, peak: 0.55 },
  // leaves the "e" and sweeps away to the right with a slight dip
  exit: { pts: [[697, -23], [760, -4], [850, 2], [915, -12]], width: 4.5, peak: 0.3 },
};

const load = (file) => {
  const b = fs.readFileSync(file);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const font = load(FONT_FILE);
const chars = [...TEXT];
const glyphs = font.stringToGlyphs(TEXT);

if (process.argv.includes("--inspect")) {
  console.log("font:", font.names.fullName?.en || path.basename(FONT_FILE), "| upm:", font.unitsPerEm, "| glyphs:", font.glyphs.length);
  console.log("mapping:", glyphs.map((g, i) => `${chars[i]}=${g.name}`).join(" "));
  process.exit(0);
}

const r = (n) => Math.round(n * 100) / 100;
const scale = FONT_SIZE / font.unitsPerEm;
const SK = Math.tan((SLANT_DEG * Math.PI) / 180);

// stretch horizontally and lean right around the baseline (x' = x·stretch − tan·y; y < 0 is up)
function slant(cmds) {
  return cmds.map((c) => {
    const o = { ...c };
    if ("x" in o) o.x = c.x * STRETCH - SK * c.y;
    if ("x1" in o) o.x1 = c.x1 * STRETCH - SK * c.y1;
    if ("x2" in o) o.x2 = c.x2 * STRETCH - SK * c.y2;
    return o;
  });
}
const cmdsToD = (cmds) =>
  cmds
    .map((c) =>
      c.type === "M" ? `M${r(c.x)} ${r(c.y)}`
      : c.type === "L" ? `L${r(c.x)} ${r(c.y)}`
      : c.type === "Q" ? `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`
      : c.type === "C" ? `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`
      : "Z"
    )
    .join("");
function bboxOf(cmds) {
  const xs = [], ys = [];
  for (const c of cmds) {
    for (const [kx, ky] of [["x", "y"], ["x1", "y1"], ["x2", "y2"]]) if (kx in c) { xs.push(c[kx]); ys.push(c[ky]); }
  }
  return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
}

// ── flourish: tapered filled shape + its exact centerline as the pen path ──
function bez(p, t) {
  const u = 1 - t;
  return [0, 1].map((k) => u * u * u * p[0][k] + 3 * u * u * t * p[1][k] + 3 * u * t * t * p[2][k] + t * t * t * p[3][k]);
}
function flourish(f, word) {
  const N = 80, left = [], right = [];
  let len = 0, prev = null;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const [x, y] = bez(f.pts, t);
    const a = bez(f.pts, Math.max(0, t - 0.001)), b = bez(f.pts, Math.min(1, t + 0.001));
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const nx = -(b[1] - a[1]) / L, ny = (b[0] - a[0]) / L;
    const k = t < f.peak ? t / f.peak : (1 - t) / (1 - f.peak);
    const w = (f.width / 2) * Math.pow(Math.sin((k * Math.PI) / 2), 1.4) + 0.15;
    left.push(`${r(x + nx * w)} ${r(y + ny * w)}`);
    right.unshift(`${r(x - nx * w)} ${r(y - ny * w)}`);
    if (prev) len += Math.hypot(x - prev[0], y - prev[1]);
    prev = [x, y];
  }
  const [p0, p1, p2, p3] = f.pts;
  const xs = f.pts.map((p) => p[0]), ys = f.pts.map((p) => p[1]);
  return {
    char: "~",
    word,
    flourish: true,
    opacity: f.opacity ?? 1,
    d: `M${left.join(" L")} L${right.join(" L")} Z`,
    strokes: [{ d: `M${p0[0]} ${p0[1]}C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`, len: r(len), width: r(f.width + 2.5) }],
    x1: Math.min(...xs) - f.width, y1: Math.min(...ys) - f.width, x2: Math.max(...xs) + f.width, y2: Math.max(...ys) + f.width,
  };
}

// ── letters ──
const out = [];
let x = 0;
let word = 0;
let pen = FLOURISHES.entry ? FLOURISHES.entry.pts[3] : null; // pen arrives from the entry flourish

if (FLOURISHES.entry) out.push(flourish(FLOURISHES.entry, 0));

glyphs.forEach((glyph, i) => {
  const ch = chars[i];
  if (ch === " ") {
    word++;
  } else {
    const cmds = slant(glyph.getPath(x, 0, FONT_SIZE).commands);
    const bb = bboxOf(cmds);
    const res = centerlineStrokes(cmds, bb, { S: 2, pen, minLen: 3 });
    pen = res.penEnd;
    out.push({ char: ch, word, d: cmdsToD(cmds), strokes: res.strokes, x1: r(bb.x1), y1: r(bb.y1), x2: r(bb.x2), y2: r(bb.y2) });

    for (const f of Object.values(FLOURISHES)) {
      if (f && f.after === ch) out.push(flourish(f, word));
    }
  }
  x += glyph.advanceWidth * scale + TRACKING / STRETCH;
  const next = glyphs[i + 1];
  if (next) x += font.getKerningValue(glyph, next) * scale;
});

if (FLOURISHES.exit) out.push(flourish(FLOURISHES.exit, word));

if (process.argv.includes("--boxes")) {
  out.forEach((g) => console.log(g.flourish ? "~" : g.char, "x", Math.round(g.x1), "→", Math.round(g.x2), "  y", Math.round(g.y1), "→", Math.round(g.y2)));
}

const bounds = out.reduce(
  (b, g) => ({ x1: Math.min(b.x1, g.x1), y1: Math.min(b.y1, g.y1), x2: Math.max(b.x2, g.x2), y2: Math.max(b.y2, g.y2) }),
  { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
);

const file = `// AUTO-GENERATED by scripts/generate-handwriting.mjs — do not edit by hand.
// Font: ${path.basename(FONT_FILE)}. Text: "${TEXT}", size ${FONT_SIZE}, slant ${SLANT_DEG}°, baseline y = 0.
// strokes = pen paths through the middle of each stroke, in writing order.

export const GLYPHS = ${JSON.stringify(out, null, 2)};

export const BOUNDS = ${JSON.stringify({ x1: r(bounds.x1), y1: r(bounds.y1), x2: r(bounds.x2), y2: r(bounds.y2) })};
`;

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, file);
console.log(`Wrote ${out.length} pieces → ${OUT_FILE}`);
out.forEach((g) =>
  console.log(
    (g.flourish ? "~" : g.char).padEnd(2),
    `word ${g.word}`,
    `strokes: ${g.strokes.map((s) => `${Math.round(s.len)}u/w${Math.round(s.width)}`).join(", ")}`
  )
);
console.log("Bounds:", bounds);
