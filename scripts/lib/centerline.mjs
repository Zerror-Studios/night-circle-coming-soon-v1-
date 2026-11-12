// ─────────────────────────────────────────────────────────────
// Centerline ("skeleton") extraction for a filled glyph outline.
//
// Fonts only store the outer edges of a letter. To animate a pen that
// writes the letter, we need the path through the MIDDLE of each stroke:
//
//   1. rasterize the outline (non-zero fill)
//   2. distance transform     → local stroke thickness
//   3. Zhang-Suen thinning    → 1-px skeleton
//   4. prune tiny spurs       (artefacts at blunt stroke ends)
//   5. trace into pen strokes  in writing order: start at the leftmost
//      free end, carry straight through crossings, next stroke starts
//      nearest to where the pen lifted
//   6. smooth + simplify       → SVG cubic paths in font units
// ─────────────────────────────────────────────────────────────

const N8 = [
  [1, 0], [1, 1], [0, 1], [-1, 1],
  [-1, 0], [-1, -1], [0, -1], [1, -1],
];

// ── 1. flatten + rasterize ──
export function flattenCommands(cmds, steps = 14) {
  const polys = [];
  let cur = null;
  let p = null;
  for (const c of cmds) {
    if (c.type === "M") {
      cur = [[c.x, c.y]];
      polys.push(cur);
      p = [c.x, c.y];
    } else if (c.type === "L") {
      cur.push([c.x, c.y]);
      p = [c.x, c.y];
    } else if (c.type === "Q") {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        cur.push([u * u * p[0] + 2 * u * t * c.x1 + t * t * c.x, u * u * p[1] + 2 * u * t * c.y1 + t * t * c.y]);
      }
      p = [c.x, c.y];
    } else if (c.type === "C") {
      for (let i = 1; i <= steps; i++) {
        const t = i / steps, u = 1 - t;
        cur.push([
          u * u * u * p[0] + 3 * u * u * t * c.x1 + 3 * u * t * t * c.x2 + t * t * t * c.x,
          u * u * u * p[1] + 3 * u * u * t * c.y1 + 3 * u * t * t * c.y2 + t * t * t * c.y,
        ]);
      }
      p = [c.x, c.y];
    }
  }
  return polys.filter((q) => q.length > 2);
}

function rasterize(polys, bb, S) {
  const M = 3; // margin in units
  const ox = bb.x1 - M, oy = bb.y1 - M;
  const W = Math.ceil((bb.x2 - bb.x1 + 2 * M) * S);
  const H = Math.ceil((bb.y2 - bb.y1 + 2 * M) * S);
  const img = new Uint8Array(W * H);
  const edges = [];
  for (const poly of polys) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length];
      if (a[1] !== b[1]) edges.push([a[0], a[1], b[0], b[1]]);
    }
  }
  for (let j = 0; j < H; j++) {
    const y = oy + (j + 0.5) / S;
    const hits = [];
    for (const [x0, y0, x1, y1] of edges) {
      const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
      if (y < lo || y >= hi) continue;
      hits.push([x0 + ((y - y0) / (y1 - y0)) * (x1 - x0), y1 > y0 ? 1 : -1]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    let wind = 0;
    for (let k = 0; k < hits.length - 1; k++) {
      wind += hits[k][1];
      if (wind === 0) continue;
      const xa = Math.ceil((hits[k][0] - ox) * S - 0.5);
      const xb = Math.floor((hits[k + 1][0] - ox) * S - 0.5);
      for (let i = Math.max(0, xa); i <= Math.min(W - 1, xb); i++) img[j * W + i] = 1;
    }
  }
  return { img, W, H, ox, oy };
}

// ── 2. chamfer distance transform (distance to background, in px) ──
function distance(img, W, H) {
  const INF = 1e9;
  const d = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) d[k] = img[k] ? INF : 0;
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < H; j++)
    for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (!d[k]) continue;
      if (i > 0) d[k] = Math.min(d[k], d[k - 1] + a);
      if (j > 0) {
        d[k] = Math.min(d[k], d[k - W] + a);
        if (i > 0) d[k] = Math.min(d[k], d[k - W - 1] + b);
        if (i < W - 1) d[k] = Math.min(d[k], d[k - W + 1] + b);
      }
    }
  for (let j = H - 1; j >= 0; j--)
    for (let i = W - 1; i >= 0; i--) {
      const k = j * W + i;
      if (!d[k]) continue;
      if (i < W - 1) d[k] = Math.min(d[k], d[k + 1] + a);
      if (j < H - 1) {
        d[k] = Math.min(d[k], d[k + W] + a);
        if (i < W - 1) d[k] = Math.min(d[k], d[k + W + 1] + b);
        if (i > 0) d[k] = Math.min(d[k], d[k + W - 1] + b);
      }
    }
  return d;
}

// ── 3. Zhang-Suen thinning ──
function thin(img, W, H) {
  const s = Uint8Array.from(img);
  const P = (i, j) => (i < 0 || j < 0 || i >= W || j >= H ? 0 : s[j * W + i]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const pass of [0, 1]) {
      const del = [];
      for (let j = 1; j < H - 1; j++)
        for (let i = 1; i < W - 1; i++) {
          if (!s[j * W + i]) continue;
          const p2 = P(i, j - 1), p3 = P(i + 1, j - 1), p4 = P(i + 1, j), p5 = P(i + 1, j + 1);
          const p6 = P(i, j + 1), p7 = P(i - 1, j + 1), p8 = P(i - 1, j), p9 = P(i - 1, j - 1);
          const B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (B < 2 || B > 6) continue;
          const seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2];
          let A = 0;
          for (let k = 0; k < 8; k++) if (!seq[k] && seq[k + 1]) A++;
          if (A !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 || p4 * p6 * p8 : p2 * p4 * p8 || p2 * p6 * p8) continue;
          del.push(j * W + i);
        }
      if (del.length) changed = true;
      for (const k of del) s[k] = 0;
    }
  }
  return s;
}

const neighbors = (s, W, H, k) => {
  const i = k % W, j = (k - i) / W;
  const out = [];
  for (const [dx, dy] of N8) {
    const x = i + dx, y = j + dy;
    if (x >= 0 && y >= 0 && x < W && y < H && s[y * W + x]) out.push(y * W + x);
  }
  return out;
};

// crossing number: 1 = end, 2 = line, ≥3 = junction
function crossing(s, W, H, k) {
  const i = k % W, j = (k - i) / W;
  const v = N8.map(([dx, dy]) => {
    const x = i + dx, y = j + dy;
    return x >= 0 && y >= 0 && x < W && y < H ? s[y * W + x] : 0;
  });
  let c = 0;
  for (let q = 0; q < 8; q++) if (!v[q] && v[(q + 1) % 8]) c++;
  return c;
}

// ── 4. prune short spurs (blunt-end artefacts) ──
function prune(s, W, H, dist, rounds = 3) {
  for (let r = 0; r < rounds; r++) {
    let removed = false;
    for (let k = 0; k < s.length; k++) {
      if (!s[k] || neighbors(s, W, H, k).length !== 1) continue;
      // walk from this end until a junction
      const path = [k];
      let prev = -1, cur = k;
      while (true) {
        const nb = neighbors(s, W, H, cur).filter((n) => n !== prev && !path.includes(n));
        if (nb.length !== 1 || crossing(s, W, H, nb[0]) >= 3) {
          const junction = nb.length >= 1 ? nb[0] : -1;
          const limit = Math.max(5, 1.6 * (junction >= 0 ? dist[junction] : 0));
          if (junction >= 0 && path.length < limit) {
            for (const p of path) s[p] = 0;
            removed = true;
          }
          break;
        }
        prev = cur;
        cur = nb[0];
        path.push(cur);
        if (path.length > 400) break;
      }
    }
    if (!removed) break;
  }
}

// ── 5. trace skeleton into pen strokes ──
function trace(s, W, H) {
  const visited = new Uint8Array(s.length);
  const strokes = [];
  const xy = (k) => [k % W, Math.floor(k / W)];

  const walk = (start) => {
    const pts = [start];
    visited[start] = 1;
    let cur = start;
    while (true) {
      const nb = neighbors(s, W, H, cur).filter((n) => !visited[n]);
      if (!nb.length) break;
      let next = nb[0];
      if (nb.length > 1 && pts.length > 1) {
        // carry straight on through crossings: smallest change of direction
        const back = pts[Math.max(0, pts.length - 6)];
        const [cx, cy] = xy(cur), [bx, by] = xy(back);
        const dir = Math.atan2(cy - by, cx - bx);
        let best = Infinity;
        for (const n of nb) {
          const [nx, ny] = xy(n);
          let d = Math.abs(Math.atan2(ny - cy, nx - cx) - dir);
          if (d > Math.PI) d = 2 * Math.PI - d;
          // prefer 4-neighbours slightly (avoids skipping staircase pixels)
          if (nx !== cx && ny !== cy) d += 0.05;
          if (d < best) {
            best = d;
            next = n;
          }
        }
      }
      // a diagonal step skips the "staircase" corner pixels next to it —
      // mark those as used too, otherwise they become tiny phantom strokes
      const [ax, ay] = xy(cur), [bx2, by2] = xy(next);
      if (ax !== bx2 && ay !== by2) {
        for (const k of [ay * W + bx2, by2 * W + ax]) if (s[k]) visited[k] = 1;
      }
      visited[next] = 1;
      pts.push(next);
      cur = next;
    }
    return pts.map(xy);
  };

  let pen = null;
  while (true) {
    // candidate starts: free ends first, then any unvisited pixel (closed loops)
    const ends = [];
    const rest = [];
    for (let k = 0; k < s.length; k++) {
      if (!s[k] || visited[k]) continue;
      const free = neighbors(s, W, H, k).filter((n) => !visited[n]).length;
      if (free <= 1) ends.push(k);
      else rest.push(k);
    }
    const pool = ends.length ? ends : rest;
    if (!pool.length) break;
    let start = pool[0];
    let best = Infinity;
    for (const k of pool) {
      const [x, y] = xy(k);
      // first stroke: leftmost; later strokes: nearest to where the pen lifted
      const score = pen ? Math.hypot(x - pen[0], y - pen[1]) + x * 0.15 : x * 1000 + y;
      if (score < best) {
        best = score;
        start = k;
      }
    }
    const pts = walk(start);
    if (pts.length >= 4) {
      strokes.push(pts);
      pen = pts[pts.length - 1];
    }
  }
  return strokes;
}

// ── 6. smooth / simplify / to path ──
function smooth(pts, win = 3) {
  return pts.map((p, i) => {
    let sx = 0, sy = 0, n = 0;
    for (let k = Math.max(0, i - win); k <= Math.min(pts.length - 1, i + win); k++) {
      sx += pts[k][0];
      sy += pts[k][1];
      n++;
    }
    return i === 0 || i === pts.length - 1 ? p : [sx / n, sy / n];
  });
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const [a, b] = [pts[0], pts[pts.length - 1]];
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  let idx = 0, max = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = Math.abs((b[0] - a[0]) * (a[1] - pts[i][1]) - (a[0] - pts[i][0]) * (b[1] - a[1])) / L;
    if (d > max) {
      max = d;
      idx = i;
    }
  }
  if (max <= eps) return [a, b];
  return [...rdp(pts.slice(0, idx + 1), eps).slice(0, -1), ...rdp(pts.slice(idx), eps)];
}

function toCubicPath(pts, f) {
  if (pts.length === 2) return `M${f(pts[0][0])} ${f(pts[0][1])}L${f(pts[1][0])} ${f(pts[1][1])}`;
  // Catmull-Rom → cubic Bézier
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/**
 * Order strokes the way a hand moves: each next stroke starts at the end
 * nearest to where the pen currently is; short marks (i-dots…) go last and
 * don't move the pen for the next letter.
 */
function orderLikeAHand(items, pen, markLen, glyphMidY, leftToRight = false) {
  if (leftToRight) {
    // one steady left → right pass: every stroke starts at its left end, ordered by that start
    for (const it of items) if (it.pts[0][0] > it.pts[it.pts.length - 1][0]) it.pts.reverse();
    const ordered = [...items].sort((a, b) => a.pts[0][0] - b.pts[0][0]);
    let exit = pen;
    for (const it of ordered) for (const e of [it.pts[0], it.pts[it.pts.length - 1]]) if (!exit || e[0] > exit[0]) exit = e;
    return { ordered, penEnd: exit };
  }
  // "late" strokes: dots, and flat strokes in the upper half (t-crossbars) — added after the body
  const isLate = (it) => {
    if (it.len < markLen) return true;
    const ys = it.pts.map((p) => p[1]), xs = it.pts.map((p) => p[0]);
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    return h < w * 0.35 && cy < glyphMidY && items.length > 1;
  };
  items.forEach((it) => (it.late = isLate(it)));
  const left = [...items];
  const ordered = [];
  let P = pen;
  while (left.length) {
    let best = null;
    for (const it of left) {
      const mark = it.late ? 1e4 : 0;
      for (const [end, rev] of [[it.pts[0], false], [it.pts[it.pts.length - 1], true]]) {
        const score = Math.hypot(end[0] - P[0], end[1] - P[1]) + mark;
        if (!best || score < best.score) best = { it, rev, score };
      }
    }
    left.splice(left.indexOf(best.it), 1);
    if (best.rev) best.it.pts.reverse();
    ordered.push(best.it);
    P = best.it.pts[best.it.pts.length - 1];
  }
  // joined script hands over at the letter's EXIT: its rightmost free end
  // (ignoring dots/crossbars) — that's where the next letter's pen starts
  let exit = pen;
  for (const it of ordered) {
    if (it.late) continue;
    for (const e of [it.pts[0], it.pts[it.pts.length - 1]]) if (!exit || e[0] > exit[0]) exit = e;
  }
  return { ordered, penEnd: exit };
}

/**
 * @param pen  [x, y] where the pen is coming from (end of the previous letter),
 *             or null for the first letter (then it enters from the left at the baseline)
 * @returns {{ strokes: { d: string, len: number, width: number }[], penEnd: [number, number] }}
 */
// leftToRight: ignore hand-like ordering; each stroke runs left → right, ordered by where it starts
export function centerlineStrokes(commands, bb, { S = 2, minLen = 12, markLen = 80, pen = null, leftToRight = false } = {}) {
  const polys = flattenCommands(commands);
  const { img, W, H, ox, oy } = rasterize(polys, bb, S);
  const dist = distance(img, W, H);
  const skel = thin(img, W, H);
  prune(skel, W, H, dist);
  const traced = trace(skel, W, H);
  const f = (n) => Math.round(n * 100) / 100;

  // Dots (i-dots, full stops…) thin down to a single point and get no stroke.
  // Give every separate blob of ink without a stroke a short "dab" at its centre.
  const comp = new Int32Array(W * H).fill(-1);
  let nComp = 0;
  for (let k = 0; k < W * H; k++) {
    if (!img[k] || comp[k] >= 0) continue;
    const stack = [k];
    comp[k] = nComp;
    while (stack.length) {
      const c = stack.pop();
      const ci = c % W, cj = (c - ci) / W;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = ci + dx, y = cj + dy;
        const n = y * W + x;
        if (x >= 0 && y >= 0 && x < W && y < H && img[n] && comp[n] < 0) {
          comp[n] = nComp;
          stack.push(n);
        }
      }
    }
    nComp++;
  }
  // a blob counts as covered only by strokes that will survive the length filter
  const pxLen = (px) => {
    let L = 0;
    for (let q = 1; q < px.length; q++) L += Math.hypot(px[q][0] - px[q - 1][0], px[q][1] - px[q - 1][1]);
    return L / S;
  };
  const kept = traced.filter((px) => px.length >= 4 && pxLen(px) >= minLen);
  const covered = new Uint8Array(nComp);
  for (const px of kept) for (const [i, j] of px) covered[comp[j * W + i]] = 1;
  const dabs = [];
  for (let c = 0; c < nComp; c++) {
    if (covered[c]) continue;
    let best = -1, bd = 0;
    for (let k = 0; k < W * H; k++) if (comp[k] === c && dist[k] > bd) { bd = dist[k]; best = k; }
    if (best < 0 || bd < 1.5) continue; // ignore specks
    const i = best % W, j = (best - i) / W;
    dabs.push([[i - 1, j + 1], [i, j], [i + 1, j - 1]]); // tiny upward flick through the centre
  }

  const items = [...kept, ...dabs]
    .map((px) => {
      // local half-thickness along the stroke → pen width that covers the ink
      const radii = px.map(([i, j]) => dist[j * W + i]).sort((a, b) => a - b);
      const r95 = radii[Math.floor(radii.length * 0.95)] || radii[radii.length - 1] || 1;
      const units = smooth(px).map(([i, j]) => [ox + (i + 0.5) / S, oy + (j + 0.5) / S]);
      let len = 0;
      for (let i = 1; i < units.length; i++) len += Math.hypot(units[i][0] - units[i - 1][0], units[i][1] - units[i - 1][1]);
      return { pts: units, len, width: (2 * r95) / S + 2.5, dab: px.length === 3 };
    })
    // leftover crumbs are already covered by the main strokes (dabs are kept)
    .filter((s) => s.dab || s.len >= minLen);

  const { ordered, penEnd } = orderLikeAHand(items, pen || [bb.x1 - 40, 0], markLen, (bb.y1 + bb.y2) / 2, leftToRight);

  return {
    strokes: ordered.map((s) => ({ d: toCubicPath(rdp(s.pts, 0.6), f), len: f(s.len), width: f(s.width) })),
    penEnd,
  };
}
