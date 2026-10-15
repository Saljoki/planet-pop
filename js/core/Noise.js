// Pure JS (no three.js import) so the terrain worker can use it too.

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makePerlin(seed) {
  const rng = mulberry32(seed);
  const perm = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  const p = new Uint8Array(512);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  const grad = (h, x, y, z) => {
    h &= 15;
    const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z;
    return (h & 1 ? -u : u) + (h & 2 ? -v : v);
  };
  return (x, y, z) => {
    const fx = Math.floor(x), fy = Math.floor(y), fz = Math.floor(z);
    const X = fx & 255, Y = fy & 255, Z = fz & 255;
    x -= fx; y -= fy; z -= fz;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z), u),
           lerp(grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1), u),
           lerp(grad(p[AB + 1], x, y - 1, z - 1), grad(p[BB + 1], x - 1, y - 1, z - 1), u), v),
      w);
  };
}

export class Heightfield {
  /** flats: levelled zones [{ x, y, z, cosIn, cosOut, level }]: full level inside cosIn, blending out to cosOut. */
  constructor(seed, sea = 0, flats = []) {
    this.perlin = makePerlin(seed);
    this.sea = sea;
    this.flats = flats;
  }

  fbm(x, y, z) {
    let s = 0, a = 1, f = 1.4, n = 0;
    for (let i = 0; i < 5; i++) {
      s += a * this.perlin(x * f + 31.7, y * f + 17.3, z * f + 5.9);
      n += a; a *= 0.5; f *= 2.05;
    }
    return s / n;
  }

  /** Height above sea level for a unit direction (negative = underwater). */
  height(x, y, z) {
    let h = Math.min((this.fbm(x, y, z) - this.sea) * 3.4, 1.5);
    for (const f of this.flats) {
      const c = f.x * x + f.y * y + f.z * z;
      if (c <= f.cosOut) continue;
      const t = Math.min(1, (c - f.cosOut) / (f.cosIn - f.cosOut));
      h += (f.level - h) * t * t * (3 - 2 * t);
    }
    return h;
  }

  /** Sea level that leaves `land` (0..1) of the surface above water. */
  static seaLevelFor(seed, land) {
    const hf = new Heightfield(seed), rng = mulberry32(seed ^ 0x5bd1e995), vals = [];
    for (let i = 0; i < 3000; i++) {
      const z = rng() * 2 - 1, t = rng() * Math.PI * 2, s = Math.sqrt(1 - z * z);
      vals.push(hf.fbm(s * Math.cos(t), z, s * Math.sin(t)));
    }
    vals.sort((a, b) => a - b);
    return vals[Math.min(vals.length - 1, Math.floor((1 - land) * vals.length))];
  }
}
