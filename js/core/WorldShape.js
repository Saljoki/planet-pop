// Pure JS (no three.js import) so the terrain worker can use it too.
import { mulberry32 } from './Noise.js';

const DEG = Math.PI / 180;
const BLUR = 6; // pixels: how far inland the land map's "distance from the sea" reaches

/** A unit vector from latitude and longitude in degrees (north is +y; east is to the right seen from outside). */
export function fromLatLon(lat, lon) {
  const a = lat * DEG, b = lon * DEG;
  return [Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b)];
}

/** Latitude and longitude (degrees) of a unit vector. */
export function toLatLon(x, y, z) {
  return [Math.asin(Math.max(-1, Math.min(1, y))) / DEG, Math.atan2(-z, x) / DEG];
}

const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const angle = (ax, ay, az, bx, by, bz) => Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));

/**
 * The shape of a real world, laid over the usual noise: Earth's continents from a land map, and named features
 * placed at their real latitude and longitude: the Moon's dark seas and craters, Mars's Olympus Mons, canyon and
 * basins, mountain ranges, ice caps, deserts. Plain data in, so the same shape is built on the main thread and in
 * the terrain worker. Heights are in the game's units: 0 is sea level, about 1.5 the highest.
 *
 * spec: { land?: { w, h, runs } (a mask, see EarthLand.js), lift?, relief? (no-land-map worlds: base height and how much
 * the noise moves it), floor? (the lowest it goes: worlds with no sea stay above it), craters?: { count, min, max,
 * depth } (scattered, in radians), features?: [{ kind, lat, lon, r (degrees), … }] }
 */
export class WorldShape {
  constructor(spec, seed) {
    this.spec = spec;
    if (spec.land) this.readLand(spec.land);
    this.features = (spec.features || []).map((f) => this.prepare(f));
    if (spec.craters) this.scatter(spec.craters, seed);
  }

  /** The land map: unpacked, plus a blurred copy (how far from the sea). */
  readLand({ w, h, runs }) {
    const bytes = Uint8Array.from(atob(runs), (c) => c.charCodeAt(0));
    const land = new Float32Array(w * h);
    for (let i = 0, p = 0, on = 0; i < bytes.length; on ^= 1) {
      let r = 0, s = 0, b;
      do { b = bytes[i++]; r |= (b & 127) << s; s += 7; } while (b & 128);
      if (on) land.fill(1, p, p + r);
      p += r;
    }
    const tmp = new Float32Array(w * h), far = new Float32Array(w * h), n = 2 * BLUR + 1;
    for (let y = 0; y < h; y++) { // box blur across (wrapping round the world), then down
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -BLUR; k <= BLUR; k++) s += land[y * w + ((x + k + w) % w)];
        tmp[y * w + x] = s / n;
      }
    }
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        let s = 0;
        for (let k = -BLUR; k <= BLUR; k++) s += tmp[Math.max(0, Math.min(h - 1, y + k)) * w + x];
        far[y * w + x] = s / n;
      }
    }
    this.land = { w, h, sharp: land, far };
  }

  /** The land map at direction (x, y, z): [sharp, far], each 0 (sea) … 1 (land), smoothly interpolated. */
  sampleLand(x, y, z) {
    const { w, h, sharp, far } = this.land, [lat, lon] = toLatLon(x, y, z);
    const fx = ((lon + 180) / 360) * w - 0.5, fy = ((90 - lat) / 180) * h - 0.5;
    const x0 = Math.floor(fx), y0 = Math.max(0, Math.min(h - 2, Math.floor(fy))), tx = fx - x0, ty = Math.max(0, Math.min(1, fy - y0));
    const at = (m, r, c) => m[r * w + ((c % w) + w) % w];
    const lerp2 = (m) => (at(m, y0, x0) * (1 - tx) + at(m, y0, x0 + 1) * tx) * (1 - ty) + (at(m, y0 + 1, x0) * (1 - tx) + at(m, y0 + 1, x0 + 1) * tx) * ty;
    return [lerp2(sharp), lerp2(far)];
  }

  prepare(f) {
    const out = { ...f, r: (f.r ?? 0) * DEG, width: (f.width ?? 0) * DEG };
    if (f.lat !== undefined) [out.x, out.y, out.z] = fromLatLon(f.lat, f.lon ?? 0);
    if (f.points) { // a line over the ground, as great-circle legs
      const pts = f.points.map(([lat, lon]) => fromLatLon(lat, lon));
      out.legs = pts.slice(1).map((b, i) => {
        const a = pts[i], n = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], l = Math.hypot(...n);
        return { a, b, n: n.map((v) => v / l) };
      });
    }
    out.reach = Math.cos(Math.min(Math.PI, (out.r || 0) * 1.3 + (out.width || 0) * 1.3 + (f.points ? 3 : 0))); // (a quick "too far to matter")
    return out;
  }

  /** Small craters everywhere, from the seed. */
  scatter({ count, min, max, depth }, seed) {
    const rng = mulberry32(seed ^ 0x2c1b3c6d);
    for (let i = 0; i < count; i++) {
      const z = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z), r = min + (max - min) * rng() ** 2;
      this.features.push(this.prepare({ kind: 'crater', depth: depth * (r / max) ** 0.5 }));
      Object.assign(this.features.at(-1), { x: s * Math.cos(t), y: z, z: s * Math.sin(t), r, reach: Math.cos(r * 1.3) });
    }
  }

  /** Angular distance from (x, y, z) to a feature's line. */
  lineDistance(f, x, y, z) {
    let best = Math.PI;
    for (const { a, b, n } of f.legs) {
      const off = x * n[0] + y * n[1] + z * n[2];
      const pa = (a[1] * z - a[2] * y) * n[0] + (a[2] * x - a[0] * z) * n[1] + (a[0] * y - a[1] * x) * n[2]; // (a × p) · n
      const pb = (y * b[2] - z * b[1]) * n[0] + (z * b[0] - x * b[2]) * n[1] + (x * b[1] - y * b[0]) * n[2]; // (p × b) · n
      const d = pa >= 0 && pb >= 0 ? Math.abs(Math.asin(Math.max(-1, Math.min(1, off))))
        : Math.min(angle(x, y, z, ...a), angle(x, y, z, ...b));
      if (d < best) best = d;
    }
    return best;
  }

  /** Height at unit direction (x, y, z); `hf` is the planet's noise (Heightfield), for detail. */
  height(x, y, z, hf) {
    const s = this.spec, n = hf.fbm(x, y, z);
    let h;
    if (this.land) {
      const [c, far] = this.sampleLand(x, y, z);
      const land = smooth(0.5, 1, c) * (0.03 + 0.12 * far + Math.max(0, n) * 1.5 * far);
      const deep = smooth(0.5, 0, c) * (0.12 + 0.7 * (1 - far));
      h = (c - 0.5) * 0.3 + land - deep; // (exactly 0 on the real coastline)
    } else {
      h = (s.lift ?? 0.4) + n * (s.relief ?? 0.6);
    }
    for (const f of this.features) {
      const dot = f.legs ? 1 : x * f.x + y * f.y + z * f.z;
      if (dot < f.reach) continue;
      if (f.kind === 'ridge' || f.kind === 'valley') {
        const t = smooth(f.width, 0, this.lineDistance(f, x, y, z));
        if (t <= 0) continue;
        h += (f.kind === 'ridge' ? f.height * (0.75 + 0.5 * n) : -f.depth) * t;
        continue;
      }
      const a = Math.acos(Math.min(1, dot)), q = a / f.r;
      if (f.kind === 'dome') { if (q < 1) h += f.height * Math.cos(q * Math.PI / 2) ** 2; } // a shield volcano, a plateau
      else if (f.kind === 'bowl') { if (q < 1) h -= f.depth * Math.cos(q * Math.PI / 2) ** 2; } // a broad hollow
      else if (f.kind === 'basin') h += (f.level - h) * smooth(1, 0.7, q) * (f.strength ?? 1); // a flat-floored sea of old lava
      else if (f.kind === 'crater') {
        if (q < 1) h -= f.depth * (1 - q * q);
        h += f.depth * 0.45 * Math.exp(-(((q - 1) / 0.22) ** 2)); // the rim
      } else if (f.kind === 'cap') {
        const lat = Math.asin(y) / DEG;
        if (f.lat > 0 ? lat > f.lat : lat < f.lat) h += f.height * smooth(0, 4, Math.abs(lat - f.lat));
      }
    }
    return s.floor !== undefined ? Math.max(s.floor, h) : h;
  }

  /** A colour from the palette that a feature paints the ground here ('mare', 'sand', 'snow'…), or null. */
  paint(x, y, z) {
    let key = null;
    for (const f of this.features) {
      if (!f.pal) continue;
      if (f.kind === 'cap') {
        const lat = Math.asin(y) / DEG;
        if (f.lat > 0 ? lat > f.lat : lat < f.lat) key = f.pal;
        continue;
      }
      const dot = x * f.x + y * f.y + z * f.z;
      if (dot > Math.cos(f.r * (f.kind === 'basin' ? 0.85 : 1))) key = f.pal;
    }
    return key;
  }
}
