// ─────────────────────────────────────────────────────────────
// Procedural, physically-lit moon phases (rendered once on a 2D canvas).
//
// • One fixed near-side surface (the moon is tidally locked, so the face we
//   see never changes): maria, highlands, ~150 craters with rims, Tycho rays.
// • Each phase is the same surface lit from a different sun direction using
//   the Lommel-Seeliger law (why a real full moon looks flat & evenly bright),
//   with bump-mapped crater relief that shows along the terminator.
// • No visible night side: the shadow fades softly into the background
//   (transparent), and a soft halo glows only around the lit edge.
// ─────────────────────────────────────────────────────────────

// Image covers [-EXTENT, EXTENT] in disc units (disc radius = 1) → room for the halo
export const EXTENT = 1.3;

// ── tiny seeded RNG + 3D value noise ──
function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a, b, t) => a + (b - a) * t;
  const c = (dx, dy, dz) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  );
}

function fbm(x, y, z, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * vnoise(x * f, y * f, z * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// Unit vector from selenographic lat/lon (degrees). +x = east (right), +y = north (up), +z = toward us
function fromLatLon(lat, lon) {
  const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180;
  return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}

// Major maria (approximate real positions), angular radius in radians
const MARIA = [
  { c: fromLatLon(33, -16), r: 0.36 }, // Imbrium
  { c: fromLatLon(10, -50), r: 0.42 }, // Procellarum (west)
  { c: fromLatLon(-5, -38), r: 0.3 },  // Procellarum (south)
  { c: fromLatLon(28, 17), r: 0.21 },  // Serenitatis
  { c: fromLatLon(8, 31), r: 0.25 },   // Tranquillitatis
  { c: fromLatLon(17, 59), r: 0.13 },  // Crisium
  { c: fromLatLon(-5, 51), r: 0.17 },  // Fecunditatis
  { c: fromLatLon(-14, 35), r: 0.12 }, // Nectaris
  { c: fromLatLon(-21, -17), r: 0.2 }, // Nubium
  { c: fromLatLon(-24, -39), r: 0.13 },// Humorum
  { c: fromLatLon(-10, -7), r: 0.13 }, // Insularum / Cognitum
  { c: fromLatLon(56, 2), r: 0.22 },   // Frigoris (northern band)
];

const TYCHO = fromLatLon(-43, -11);
const COPERNICUS = fromLatLon(10, -20);

let surfaceCache = null;

// Shared surface: per-pixel bumped normal, plain sphere normal, albedo
function buildSurface(N) {
  if (surfaceCache && surfaceCache.N === N) return surfaceCache;

  const rand = mulberry32(1969);
  // Craters: power-law sizes, random positions on the visible hemisphere
  const craters = [];
  for (let i = 0; i < 150; i++) {
    const u = rand(), v = rand();
    const lat = Math.asin(2 * u - 1) * 0.95;
    const lon = (v - 0.5) * Math.PI * 0.98;
    const r = 0.01 + Math.pow(rand(), 3.4) * 0.09;
    // real craters are shallow relative to their width
    craters.push({ c: [Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon)], r, d: r * (0.05 + rand() * 0.06) });
  }
  craters.push({ c: TYCHO, r: 0.04, d: 0.004 }, { c: COPERNICUS, r: 0.045, d: 0.004 });

  const size = N * N;
  const H = new Float32Array(size);
  const A = new Float32Array(size);
  const NX = new Float32Array(size), NY = new Float32Array(size), NZ = new Float32Array(size);
  const inside = new Uint8Array(size);

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const x = ((i + 0.5) / N) * 2 * EXTENT - EXTENT;
      const y = EXTENT - ((j + 0.5) / N) * 2 * EXTENT;
      const rr = x * x + y * y;
      if (rr > 1.0) continue;
      inside[k] = 1;
      const z = Math.sqrt(1 - rr);
      NX[k] = x; NY[k] = y; NZ[k] = z;

      // ── albedo: maria (dark) vs highlands (bright) ──
      // soft overlapping basins → one continuous field, then a noisy shoreline
      let m = 0;
      for (const b of MARIA) {
        const ang = Math.acos(Math.min(1, x * b.c[0] + y * b.c[1] + z * b.c[2])) / b.r;
        m += Math.exp(-ang * ang * 1.6);
      }
      const edge = fbm(x * 4.3 + 11, y * 4.3, z * 4.3, 5); // organic, ragged shorelines
      const mare = smooth(0.24, 0.72, m + (edge - 0.5) * 0.75);
      // maria aren't uniformly dark: lighter and darker lava flows inside them
      const flow = fbm(x * 7 + 5, y * 7, z * 7, 4);
      let alb = 1 - mare * (0.24 + 0.12 * flow);
      alb *= 0.9 + 0.18 * fbm(x * 14 + 3, y * 14, z * 14, 4); // fine mottling

      // Tycho & Copernicus ray systems (bright streaks radiating outward)
      for (const [src, len, gain] of [[TYCHO, 0.9, 0.22], [COPERNICUS, 0.45, 0.14]]) {
        const dp = x * src[0] + y * src[1] + z * src[2];
        const ang = Math.acos(Math.min(1, dp));
        if (ang < len) {
          const az = Math.atan2(y - src[1], x - src[0]);
          const streak = Math.pow(vnoise(az * 6 + 40, 0, 0), 3);
          alb += gain * streak * (1 - ang / len) + (ang < 0.06 ? 0.25 * (1 - ang / 0.06) : 0);
        }
      }

      // ── height: gentle terrain + crater bowls with raised rims ──
      // highlands are rougher than the smooth maria
      let h = (fbm(x * 8, y * 8, z * 8, 4) - 0.5) * 0.006 * (1 - 0.7 * mare);
      for (const c of craters) {
        const dp = x * c.c[0] + y * c.c[1] + z * c.c[2];
        if (dp < 0.95) continue; // quick reject (> ~0.32 rad away)
        const d = Math.acos(Math.min(1, dp)) / c.r;
        if (d < 1) h -= c.d * (1 - d * d);
        else if (d < 1.5) h += c.d * 0.3 * Math.sin(((d - 1) / 0.5) * Math.PI);
        // fresh ejecta: slightly brighter ring around craters
        if (d < 2.2) alb += 0.05 * (1 - d / 2.2) * (c.r / 0.09);
      }
      A[k] = alb;
      H[k] = h;
    }
  }

  // Bump-map: perturb the sphere normal by the height gradient
  const BX = new Float32Array(size), BY = new Float32Array(size), BZ = new Float32Array(size);
  const px = (2 * EXTENT) / N;
  const strength = 1.0;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      if (!inside[k]) continue;
      const hl = inside[k - 1] ? H[k - 1] : H[k];
      const hr = inside[k + 1] ? H[k + 1] : H[k];
      const hu = inside[k - N] ? H[k - N] : H[k];
      const hd = inside[k + N] ? H[k + N] : H[k];
      const gx = (hr - hl) / (2 * px);
      const gy = (hu - hd) / (2 * px);
      let bx = NX[k] - gx * strength, by = NY[k] - gy * strength, bz = NZ[k];
      const len = Math.hypot(bx, by, bz) || 1;
      BX[k] = bx / len; BY[k] = by / len; BZ[k] = bz / len;
    }
  }

  surfaceCache = { N, A, NZ, BX, BY, BZ, inside };
  return surfaceCache;
}

/**
 * Render one phase.
 * @param {number} N            texture size in px
 * @param {number} phaseDeg     0 = full, 90 = half, 180 = new
 * @param {"left"|"right"} lit  which side faces the sun
 * @returns {HTMLCanvasElement}
 */
export function renderMoonPhase(N, phaseDeg, lit = "left") {
  const S = buildSurface(N);
  const a = (phaseDeg * Math.PI) / 180;
  const sx = (lit === "left" ? -1 : 1) * Math.sin(a);
  const L = [sx, 0.04, Math.cos(a)]; // tiny tilt so the terminator isn't perfectly vertical
  const ll = Math.hypot(...L);
  L[0] /= ll; L[1] /= ll; L[2] /= ll;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = N;
  const ctx = canvas.getContext("2d");
  const img = ctx.createImageData(N, N);
  const d = img.data;
  const litFraction = (1 + Math.cos(a)) / 2;

  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const o = k * 4;
      const x = ((i + 0.5) / N) * 2 * EXTENT - EXTENT;
      const y = EXTENT - ((j + 0.5) / N) * 2 * EXTENT;
      const r = Math.hypot(x, y);

      if (!S.inside[k]) {
        // soft halo outside the disc, only next to the lit edge (so the dark side has no outline)
        const g = Math.max(0, 1 - (r - 1) / (EXTENT - 1));
        const limbLit = smooth(-0.15, 0.3, (x * L[0] + y * L[1]) / r + L[2] * 0.9);
        const ha = Math.pow(g, 3) * 0.16 * litFraction * limbLit;
        d[o] = 230; d[o + 1] = 228; d[o + 2] = 222;
        d[o + 3] = Math.round(255 * ha);
        continue;
      }

      const mu = S.NZ[k]; // view = +z
      const mu0 = S.BX[k] * L[0] + S.BY[k] * L[1] + S.BZ[k] * L[2];
      // Lommel-Seeliger (normalised so full moon ≈ 1 everywhere, 0 at the terminator)
      let I = mu0 > 0 ? (2 * mu0) / (mu0 + mu) : 0;
      // soft terminator (atmosphere-free but blurred by optics)
      I *= smooth(-0.03, 0.12, mu0);

      const alb = S.A[k];
      const v = Math.pow(Math.min(1, I * alb * 0.9), 0.85); // gentle tone curve

      // warm-neutral lunar grey
      d[o] = Math.round(255 * v * 0.98);
      d[o + 1] = Math.round(255 * v * 0.965);
      d[o + 2] = Math.round(255 * v * 0.93);

      // the night side is see-through: the shadow melts into the background instead of
      // drawing a dark disc. Anti-aliased disc edge × how lit this point is.
      const edgeA = Math.min(1, (1 - r) * N * 0.5 + 0.5);
      d[o + 3] = Math.round(255 * edgeA * smooth(0, 0.5, I));
    }
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}
