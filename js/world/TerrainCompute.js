// Pure JS (no three.js) so it runs inside the terrain worker and as a main-thread fallback.
import { Heightfield } from '../core/Noise.js';

const linear = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
};
const PAL = {
  seabed: linear('#2c6fbf'), sand: linear('#ffe08a'), g1: linear('#a6e35d'), g2: linear('#66c94e'),
  g3: linear('#3f9f4d'), rock: linear('#a28fd0'), snow: linear('#ffffff'), city: linear('#d9d2ea'),
};

/**
 * unit: icosphere positions (non-indexed triangle soup on the unit sphere).
 * Returns the displaced flat-shaded mesh, a vertex-merged hull with smooth normals for the ink outline,
 * and an equirectangular height map the ocean shader uses for shallows and foam.
 */
export function computeTerrain({ seed, sea, flats = [], radius, unit, cities, cityCos, mapW = 512, mapH = 256 }) {
  const hf = new Heightfield(seed, sea, flats);
  const n = unit.length / 3;

  // 1. merge duplicates (shared edges of the subdivided icosahedron)
  const ids = new Map(), index = new Uint32Array(n), uniq = [];
  for (let i = 0; i < n; i++) {
    const x = unit[i * 3], y = unit[i * 3 + 1], z = unit[i * 3 + 2];
    const key = ((Math.round(x * 1e4) + 10001) * 20003 + (Math.round(y * 1e4) + 10001)) * 20003 + (Math.round(z * 1e4) + 10001);
    let id = ids.get(key);
    if (id === undefined) { id = uniq.length / 3; ids.set(key, id); uniq.push(x, y, z); }
    index[i] = id;
  }

  // 2. displace unique vertices once
  const m = uniq.length / 3, hts = new Float32Array(m), opos = new Float32Array(m * 3);
  for (let k = 0; k < m; k++) {
    let x = uniq[k * 3], y = uniq[k * 3 + 1], z = uniq[k * 3 + 2];
    const l = Math.hypot(x, y, z);
    x /= l; y /= l; z /= l;
    const h = hf.height(x, y, z), r = radius + Math.max(h, -0.8);
    hts[k] = h;
    opos[k * 3] = x * r; opos[k * 3 + 1] = y * r; opos[k * 3 + 2] = z * r;
  }

  // 3. flat triangle soup, one colour per face
  const inCity = (x, y, z) => cities.some(([a, b, c]) => a * x + b * y + c * z > cityCos);
  const colorFor = (h, x, y, z) => {
    if (h < -0.2) return PAL.seabed;
    if (inCity(x, y, z)) return PAL.city;
    if (h < 0.07) return PAL.sand;
    const j = h + hf.perlin(x * 7 + 3, y * 7, z * 7) * 0.25;
    return j < 0.32 ? PAL.g1 : j < 0.62 ? PAL.g2 : j < 0.9 ? PAL.g3 : j < 1.12 ? PAL.rock : PAL.snow;
  };
  const pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
  for (let f = 0; f < n; f += 3) {
    let cx = 0, cy = 0, cz = 0, h = 0;
    for (let j = 0; j < 3; j++) {
      const k = index[f + j] * 3, o = (f + j) * 3;
      pos[o] = opos[k]; pos[o + 1] = opos[k + 1]; pos[o + 2] = opos[k + 2];
      cx += opos[k]; cy += opos[k + 1]; cz += opos[k + 2]; h += hts[index[f + j]];
    }
    const l = Math.hypot(cx, cy, cz), c = colorFor(h / 3, cx / l, cy / l, cz / l);
    for (let j = 0; j < 3; j++) col.set(c, (f + j) * 3);
  }

  // 4. smooth normals for the outline hull
  const onrm = new Float32Array(m * 3);
  for (let f = 0; f < n; f += 3) {
    const a = index[f] * 3, b = index[f + 1] * 3, c = index[f + 2] * 3;
    const e1x = opos[b] - opos[a], e1y = opos[b + 1] - opos[a + 1], e1z = opos[b + 2] - opos[a + 2];
    const e2x = opos[c] - opos[a], e2y = opos[c + 1] - opos[a + 1], e2z = opos[c + 2] - opos[a + 2];
    const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) { onrm[v] += nx; onrm[v + 1] += ny; onrm[v + 2] += nz; }
  }
  for (let k = 0; k < m * 3; k += 3) {
    let x = onrm[k], y = onrm[k + 1], z = onrm[k + 2];
    if (x * opos[k] + y * opos[k + 1] + z * opos[k + 2] < 0) { x = -x; y = -y; z = -z; }
    const l = Math.hypot(x, y, z) || 1;
    onrm[k] = x / l; onrm[k + 1] = y / l; onrm[k + 2] = z / l;
  }

  // 5. equirectangular height map, h in [-1, 0.5] → byte
  const hmap = new Uint8Array(mapW * mapH);
  for (let j = 0; j < mapH; j++) {
    const lat = ((j + 0.5) / mapH - 0.5) * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
    for (let i = 0; i < mapW; i++) {
      const lon = ((i + 0.5) / mapW - 0.5) * Math.PI * 2;
      const h = hf.height(cl * Math.cos(lon), sl, cl * Math.sin(lon));
      hmap[j * mapW + i] = Math.round(((Math.min(Math.max(h, -1), 0.5) + 1) / 1.5) * 255);
    }
  }
  return { pos, col, opos, onrm, index, hmap, hmapW: mapW, hmapH: mapH };
}
