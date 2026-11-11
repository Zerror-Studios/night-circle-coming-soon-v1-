// ─────────────────────────────────────────────────────────────
// The carved "night garden" hidden in the wall (original composition).
//
// Roses, lilies, small blossoms, leafy vines with tendrils and berries,
// a crescent moon, stars and a thin "night circle" ring around the centre.
// Everything is a Path2D in a 1600 × 900 design space; FluidBackground bakes
// it into a height map on the GPU (cover-fitted to the screen) and the mouse
// reveals it.
//
// Each shape: { path, layer, sigma, kind, stroke }
//   kind "dome"   → raised, rounded (sigma ≈ how soft / how tall its bevel is)
//   kind "petal"  → raised shell: crisp rim, slightly hollow middle
//   kind "groove" → carved line (veins, spirals)
//   layer         → shapes on different layers stack; same layer must not overlap
//   stroke        → line width for stroked shapes (stems, veins); 0 = filled
// ─────────────────────────────────────────────────────────────

export const DESIGN_W = 1600;
export const DESIGN_H = 900;
const TAU = Math.PI * 2;

// deterministic random, so the carving is identical on every visit
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const circle = (x, y, r) => {
  const p = new Path2D();
  p.arc(x, y, r, 0, TAU);
  return p;
};

// a petal from (cx,cy) outwards: rounded (rose, blossom) or pointed (lily, bud, leaf-like)
function petal(cx, cy, a, base, len, wid, pointed) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const bx = cx + dx * base, by = cy + dy * base;
  const tx = bx + dx * len, ty = by + dy * len;
  const tipW = pointed ? 0.06 : 0.5, tipL = pointed ? 0.9 : 1.08, side = pointed ? 0.5 : 0.62;
  const p = new Path2D();
  p.moveTo(bx, by);
  p.bezierCurveTo(
    bx + dx * len * 0.25 + nx * wid * side, by + dy * len * 0.25 + ny * wid * side,
    bx + dx * len * tipL + nx * wid * tipW, by + dy * len * tipL + ny * wid * tipW,
    tx, ty,
  );
  p.bezierCurveTo(
    bx + dx * len * tipL - nx * wid * tipW, by + dy * len * tipL - ny * wid * tipW,
    bx + dx * len * 0.25 - nx * wid * side, by + dy * len * 0.25 - ny * wid * side,
    bx, by,
  );
  p.closePath();
  return p;
}

const line = (x0, y0, x1, y1) => {
  const p = new Path2D();
  p.moveTo(x0, y0);
  p.lineTo(x1, y1);
  return p;
};

// cubic bezier helpers for walking along vines
const cub = (a, b, c, d, t) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};
const cubD = (a, b, c, d, t) => {
  const u = 1 - t;
  return 3 * u * u * (b - a) + 6 * u * t * (c - b) + 3 * t * t * (d - c);
};

export function buildReliefArt(seed = 11) {
  const rand = mulberry32(seed);
  const jit = (a) => (rand() * 2 - 1) * a;
  const shapes = [];
  const add = (path, layer, sigma, kind = "dome", stroke = 0, base = 0) =>
    shapes.push({ path, layer, sigma, kind, stroke, base });

  // ── composition ──
  const flowers = [
    { type: "rose", x: 300, y: 235, r: 125 },
    { type: "rose", x: 1335, y: 655, r: 145 },
    { type: "rose", x: 1495, y: 135, r: 88 },
    { type: "rose", x: 125, y: 765, r: 95 },
    { type: "lily", x: 615, y: 115, r: 100 },
    { type: "lily", x: 1050, y: 800, r: 105 },
    { type: "lily", x: 530, y: 805, r: 70 },
    { type: "blossom", x: 85, y: 470, r: 48 },
    { type: "blossom", x: 1555, y: 420, r: 52 },
    { type: "blossom", x: 775, y: 880, r: 42 },
    { type: "blossom", x: 1240, y: 340, r: 44 },
    { type: "blossom", x: 1190, y: 65, r: 38 },
    { type: "blossom", x: 425, y: 520, r: 40 },
    { type: "blossom", x: 790, y: 245, r: 30 },
  ];
  const moon = { x: 1300, y: 225, r: 78, rot: -0.55 }; // right of the title, not behind it
  const stars = [
    [968, 288, 18], [1165, 300, 11], [945, 140, 10], [1085, 175, 9], [1010, 352, 7],
    [700, 330, 9], [880, 600, 8], [640, 560, 11], [960, 520, 6], [560, 380, 6],
  ];
  const ring = { x: 800, y: 455, r: 300 };

  // places a leaf should not grow (flower heads, the moon)
  const blocked = (x, y) =>
    flowers.some((f) => Math.hypot(x - f.x, y - f.y) < f.r * 0.9) ||
    Math.hypot(x - moon.x, y - moon.y) < moon.r + 14;

  // ── leaf with a carved midrib and side veins ──
  const leaf = (x, y, a, len, wid, layer) => {
    const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
    const bend = jit(0.22) * len;
    const tx = x + dx * len + nx * bend, ty = y + dy * len + ny * bend;
    const p = new Path2D();
    p.moveTo(x, y);
    p.quadraticCurveTo(x + dx * len * 0.45 + nx * (wid + bend * 0.5), y + dy * len * 0.45 + ny * (wid + bend * 0.5), tx, ty);
    p.quadraticCurveTo(x + dx * len * 0.45 - nx * (wid - bend * 0.5), y + dy * len * 0.45 - ny * (wid - bend * 0.5), x, y);
    p.closePath();
    add(p, layer, wid * 0.24);
    // midrib
    const rib = new Path2D();
    rib.moveTo(x + dx * len * 0.06, y + dy * len * 0.06);
    rib.quadraticCurveTo(x + dx * len * 0.5 + nx * bend * 0.3, y + dy * len * 0.5 + ny * bend * 0.3, x + dx * len * 0.88 + nx * bend * 0.8, y + dy * len * 0.88 + ny * bend * 0.8);
    add(rib, 0, 1.1, "groove", Math.max(1.6, wid * 0.07));
    // side veins, angled towards the tip
    for (const t of [0.26, 0.42, 0.58, 0.72]) {
      const mx = x + dx * len * t + nx * bend * t * t, my = y + dy * len * t + ny * bend * t * t;
      for (const s of [1, -1]) {
        const reach = wid * 0.42 * (1 - t * 0.55);
        add(line(mx, my, mx + dx * len * 0.14 + nx * reach * s, my + dy * len * 0.14 + ny * reach * s), 0, 1, "groove", 1.2);
      }
    }
  };

  // ── curling tendril ──
  const tendril = (x, y, a, size, dir) => {
    const p = new Path2D();
    p.moveTo(x, y);
    let h = a;
    const step = size / 13;
    for (let i = 0; i < 40; i++) {
      h += dir * (0.04 + i * 0.011);
      x += Math.cos(h) * step * (1 - i / 48);
      y += Math.sin(h) * step * (1 - i / 48);
      p.lineTo(x, y);
    }
    add(p, 3, 1.1, "dome", 2.8);
  };

  const berries = (x, y) => {
    const n = 3 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const r = 5 + rand() * 3, a = rand() * TAU, d = 6 + rand() * 7;
      add(circle(x + Math.cos(a) * d, y + Math.sin(a) * d, r), 6 + (i % 2), r * 0.42);
    }
  };

  const bud = (x, y, a, len) => {
    add(petal(x, y, a, 0, len, len * 0.62, true), 6, len * 0.13);
    add(petal(x, y, a + 0.5, 0, len * 0.55, len * 0.26, true), 7, 1.6);
    add(petal(x, y, a - 0.5, 0, len * 0.55, len * 0.26, true), 7, 1.6);
  };

  // ── vine: a stem with leaves (alternating sides), tendrils, berries and buds ──
  const vine = (pts, width, spacing = 62) => {
    const stem = new Path2D();
    stem.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i + 2 < pts.length; i += 3) stem.bezierCurveTo(...pts[i], ...pts[i + 1], ...pts[i + 2]);
    add(stem, 2, width * 0.36, "dome", width);

    let next = spacing * (0.3 + rand() * 0.5);
    let side = rand() < 0.5 ? 1 : -1;
    let count = 0;
    let [px, py] = pts[0];
    for (let i = 0; i + 3 < pts.length; i += 3) {
      const [a, b, c, d] = [pts[i], pts[i + 1], pts[i + 2], pts[i + 3]];
      for (let s = 1; s <= 90; s++) {
        const t = s / 90;
        const x = cub(a[0], b[0], c[0], d[0], t), y = cub(a[1], b[1], c[1], d[1], t);
        next -= Math.hypot(x - px, y - py);
        px = x;
        py = y;
        if (next > 0) continue;
        next = spacing * (0.8 + rand() * 0.4);
        if (x < -30 || x > DESIGN_W + 30 || y < -30 || y > DESIGN_H + 30 || blocked(x, y)) continue;
        const ta = Math.atan2(cubD(a[1], b[1], c[1], d[1], t), cubD(a[0], b[0], c[0], d[0], t));
        const len = 44 + rand() * 28;
        leaf(x, y, ta + side * (0.75 + jit(0.25)), len, len * 0.4, 4 + (count % 2));
        count++;
        const extra = rand();
        if (count % 4 === 2) tendril(x, y, ta - side * 0.9, 26 + rand() * 12, side);
        else if (extra < 0.18) berries(x - Math.sin(ta) * side * -16, y + Math.cos(ta) * side * -16);
        else if (extra < 0.3) bud(x, y, ta - side * 0.8, 22 + rand() * 10);
        side = -side;
      }
    }
  };

  // ── flowers ──
  const rose = (cx, cy, R, rot) => {
    // a few broad leaves tucked behind the head
    for (let k = 0; k < 4; k++) {
      const a = rot + k * (TAU / 4) + 0.4 + jit(0.2);
      leaf(cx + Math.cos(a) * R * 0.55, cy + Math.sin(a) * R * 0.55, a, R * 0.72, R * 0.3, 4 + (k % 2));
    }
    const rings = [
      { n: 8, base: 0.3, len: 0.68 },
      { n: 6, base: 0.2, len: 0.55 },
      { n: 6, base: 0.12, len: 0.42 },
      { n: 4, base: 0.05, len: 0.3 },
    ];
    // outer petals first; each inner ring sits higher and hides what is beneath it
    const s0 = 0.12 * R * rings[0].len;
    rings.forEach((r, j) => {
      const mid = R * (r.base + r.len * 0.6);
      const wid = ((TAU * mid) / r.n) * 1.35;
      for (let i = 0; i < r.n; i++) {
        const a = rot + ((i + (j % 2) * 0.5) * TAU) / r.n + jit(0.08);
        const len = R * r.len * (1 + jit(0.06));
        const lift = (j * 0.7 + (i % 2) * 0.25) * s0;
        add(petal(cx, cy, a, R * r.base, len, wid, false), 10 + j * 2 + (i % 2), 0.12 * Math.min(wid, len), "petal", 0, lift);
      }
    });
    add(circle(cx, cy, R * 0.11), 20, R * 0.045);
    // carved spiral at the heart
    const sp = new Path2D();
    for (let i = 0; i <= 60; i++) {
      const t = i / 60, a = rot + t * TAU * 1.7, rr = R * (0.015 + 0.2 * t);
      if (i === 0) sp.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      else sp.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    add(sp, 30, 1.3, "groove", Math.max(2, R * 0.022));
  };

  const lily = (cx, cy, R, rot) => {
    for (let i = 0; i < 6; i++) {
      const a = rot + (i * TAU) / 6 + jit(0.05);
      const len = R * (i % 2 ? 0.9 : 1);
      add(petal(cx, cy, a, R * 0.05, len, R * 0.46, true), 10 + (i % 2), R * 0.085);
      const g0 = R * 0.05 + len * 0.12, g1 = R * 0.05 + len * 0.8;
      add(line(cx + Math.cos(a) * g0, cy + Math.sin(a) * g0, cx + Math.cos(a) * g1, cy + Math.sin(a) * g1), 30, 1.2, "groove", Math.max(1.8, R * 0.024));
    }
    add(circle(cx, cy, R * 0.09), 13, R * 0.04);
    for (let k = 0; k < 5; k++) {
      const a = rot + ((k + 0.5) * TAU) / 5 + jit(0.1);
      const ex = cx + Math.cos(a) * R * 0.5, ey = cy + Math.sin(a) * R * 0.5;
      const st = new Path2D();
      st.moveTo(cx, cy);
      st.quadraticCurveTo(cx + Math.cos(a + 0.35) * R * 0.28, cy + Math.sin(a + 0.35) * R * 0.28, ex, ey);
      add(st, 14, 1.2, "dome", Math.max(2.4, R * 0.024));
      add(circle(ex, ey, R * 0.045), 15, R * 0.022);
    }
  };

  const blossom = (cx, cy, R, rot) => {
    // overlapping like a pinwheel: each petal a little higher than the one before
    for (let i = 0; i < 5; i++) {
      const a = rot + (i * TAU) / 5 + jit(0.06);
      add(petal(cx, cy, a, R * 0.08, R * 0.92, R * 0.95, false), 10 + i, R * 0.11, "petal", 0, i * 0.35 * R * 0.11);
    }
    add(circle(cx, cy, R * 0.24), 16, R * 0.08);
    for (let i = 0; i < 7; i++) {
      const a = rot + (i * TAU) / 7;
      add(circle(cx + Math.cos(a) * R * 0.13, cy + Math.sin(a) * R * 0.13, R * 0.028), 30, 1, "groove");
    }
  };

  // crescent moon with the dark side drawn as a faint carved outline
  const crescent = ({ x, y, r, rot }) => {
    const r2 = r * 0.92, d = r * 0.42;
    const xi = (d * d + r * r - r2 * r2) / (2 * d), yi = Math.sqrt(Math.max(r * r - xi * xi, 0));
    const t1 = Math.atan2(yi, xi);
    const p = new Path2D();
    p.arc(x, y, r, rot + t1, rot + TAU - t1, false);
    p.arc(x + Math.cos(rot) * d, y + Math.sin(rot) * d, r2, rot + Math.atan2(-yi, xi - d), rot + Math.atan2(yi, xi - d), true);
    p.closePath();
    add(p, 6, r * 0.11);
    const rim = new Path2D();
    rim.arc(x, y, r, rot - t1, rot + t1, false);
    add(rim, 0, 1.2, "groove", 2);
  };

  const star = (cx, cy, r, rot) => {
    const p = new Path2D();
    for (let i = 0; i <= 4; i++) {
      const a = rot + (i / 4) * TAU;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (i === 0) p.moveTo(x, y);
      else {
        const am = a - TAU / 8;
        p.quadraticCurveTo(cx + Math.cos(am) * r * 0.2, cy + Math.sin(am) * r * 0.2, x, y);
      }
    }
    p.closePath();
    add(p, 6, Math.max(1, r * 0.14));
  };

  // ── vines (drawn first; leaves avoid the flower heads) ──
  vine([[300, 235], [225, 380], [385, 500], [300, 625], [230, 720], [190, 765], [125, 765]], 11);
  vine([[300, 235], [420, 110], [505, 190], [615, 115], [720, 45], [830, 150], [960, 95], [1040, 60], [1120, 40], [1190, 65], [1260, 110], [1390, 80], [1495, 135]], 9);
  vine([[-40, 560], [30, 520], [55, 480], [85, 470]], 8);
  vine([[1335, 655], [1240, 760], [1150, 705], [1050, 800], [950, 890], [860, 820], [775, 880]], 10);
  vine([[1335, 655], [1470, 560], [1590, 520], [1555, 420], [1525, 320], [1420, 250], [1495, 135], [1530, 70], [1600, 30], [1660, -30]], 10);
  vine([[1335, 655], [1430, 790], [1520, 870], [1650, 885]], 10);
  vine([[300, 560], [380, 505], [400, 515], [425, 520], [500, 610], [580, 700], [530, 805]], 8);
  vine([[1335, 655], [1290, 520], [1270, 420], [1240, 340]], 8);
  vine([[615, 115], [690, 170], [740, 230], [790, 245]], 6, 54);
  vine([[125, 765], [60, 840], [20, 880], [-40, 935]], 9);

  for (const f of flowers) {
    const rot = rand() * TAU;
    if (f.type === "rose") rose(f.x, f.y, f.r, rot);
    else if (f.type === "lily") lily(f.x, f.y, f.r, rot);
    else blossom(f.x, f.y, f.r, rot);
  }

  crescent(moon);
  for (const [x, y, r] of stars) star(x, y, r, Math.PI / 4 + jit(0.3));

  // the "night circle": a thin raised ring with a carved line inside it
  const outer = new Path2D();
  outer.arc(ring.x, ring.y, ring.r, 0, TAU);
  add(outer, 1, 1.8, "dome", 5);
  const inner = new Path2D();
  inner.arc(ring.x, ring.y, ring.r - 12, 0, TAU);
  add(inner, 0, 1, "groove", 1.6);

  return shapes;
}

// Shapes are baked in groups that share a kind, a layer, a blur size and a base
// level, bottom layer first (so upper petals cover the ones beneath them).
const BUCKETS = [1, 1.6, 2.5, 4, 6, 9, 13, 18];
const snap = (s) =>
  BUCKETS.reduce((best, v) => (Math.abs(Math.log(v / s)) < Math.abs(Math.log(best / s)) ? v : best), BUCKETS[0]);

export function groupReliefShapes(shapes) {
  const groups = new Map();
  for (const s of shapes) {
    const sigma = snap(Math.max(s.sigma, 0.5));
    const base = Math.round(s.base * 2) / 2;
    const key = `${s.kind}|${s.layer}|${sigma}|${base}`;
    if (!groups.has(key)) groups.set(key, { kind: s.kind, layer: s.layer, sigma, base, shapes: [] });
    groups.get(key).shapes.push(s);
  }
  return [...groups.values()].sort((a, b) => a.layer - b.layer);
}
