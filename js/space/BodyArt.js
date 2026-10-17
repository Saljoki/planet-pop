import { canvasTexture } from '../core/Geo.js';
import { EARTH_LAND } from './EarthLand.js';
import { WORLDS } from './Worlds.js';
import { mulberry32 } from '../core/Noise.js';

const TAU = Math.PI * 2;

/**
 * The pictures wrapped round each globe on the system map, drawn once on a canvas: latitude and longitude map to the
 * canvas as on the worlds themselves (column (lon + 180) / 360, row (90 − lat) / 180), so Earth's continents, the
 * Moon's dark seas and Mars's dark patches sit where they really are. look: the `look` of a body in Bodies.js.
 */
export class BodyArt {
  /** A canvas texture for a body's look (null for the Sun, which glows a plain colour). */
  static texture(look, id) {
    const draw = {
      earth: BodyArt.earth, moon: BodyArt.moon, rock: BodyArt.rock, cloud: BodyArt.bands, gas: BodyArt.bands,
      ice: BodyArt.ice, sulphur: BodyArt.sulphur,
    }[look.kind];
    if (!draw) return null;
    const w = look.kind === 'earth' ? 1024 : 256, h = w / 2;
    return canvasTexture(w, h, (ctx) => draw(ctx, w, h, look, mulberry32(id.length * 7919 + id.charCodeAt(0))));
  }

  /** A round patch at a latitude and longitude, r degrees across the ground (wider on the canvas near the poles). */
  static spot(ctx, w, h, lat, lon, r) {
    const x = ((lon + 180) / 360) * w, y = ((90 - lat) / 180) * h, ry = (r / 180) * h;
    const rx = Math.min(w / 2, ry / Math.max(0.15, Math.cos((lat * Math.PI) / 180)));
    for (const dx of [-w, 0, w]) { // (wrapping round the back)
      ctx.beginPath();
      ctx.ellipse(x + dx, y, rx, ry, 0, 0, TAU);
      ctx.fill();
    }
  }

  /** Sea, the real continents (from the same land map as the world), deserts and ice. */
  static earth(ctx, w, h, look) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    const { w: mw, h: mh, runs } = EARTH_LAND, sx = w / mw, sy = h / mh;
    const bytes = Uint8Array.from(atob(runs), (c) => c.charCodeAt(0));
    ctx.fillStyle = look.land;
    for (let i = 0, p = 0, on = 0; i < bytes.length; on ^= 1) { // runs of sea and land, row after row
      let r = 0, s = 0, b;
      do { b = bytes[i++]; r |= (b & 127) << s; s += 7; } while (b & 128);
      for (let q = p, left = r; on && left > 0;) {
        const row = Math.floor(q / mw), col = q % mw, n = Math.min(left, mw - col);
        ctx.fillRect(col * sx, row * sy, n * sx + 0.5, sy + 0.5);
        q += n;
        left -= n;
      }
      p += r;
    }
    ctx.fillStyle = '#f2d38b';
    for (const f of WORLDS.earth.shape.features) if (f.kind === 'paint' && f.pal === 'sand') BodyArt.spot(ctx, w, h, f.lat, f.lon, f.r * 0.8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h * (12 / 180));            // the Arctic
    ctx.fillRect(0, h * (154 / 180), w, h * (26 / 180)); // Antarctica
    BodyArt.spot(ctx, w, h, 73, -40, 9);               // Greenland
  }

  /** Pale grey, the dark seas where they really are, and a sprinkle of craters. */
  static moon(ctx, w, h, look, rng) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = look.spots;
    for (const f of WORLDS.moon.shape.features) if (f.pal === 'mare') BodyArt.spot(ctx, w, h, f.lat, f.lon, f.r);
    BodyArt.craters(ctx, w, h, rng, 40);
  }

  /** Bare rock with darker patches; Mars's dark areas and ice caps, Pluto's pale heart, Charon's red pole. */
  static rock(ctx, w, h, look, rng) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = look.spots;
    const real = look.caps ? WORLDS.mars.shape.features.filter((f) => f.kind === 'paint' && f.pal === 'mare') : [];
    for (const f of real) BodyArt.spot(ctx, w, h, f.lat, f.lon, f.r * 1.6);
    if (!real.length) for (let i = 0; i < 9; i++) BodyArt.spot(ctx, w, h, rng() * 140 - 70, rng() * 360 - 180, 6 + rng() * 14);
    BodyArt.craters(ctx, w, h, rng, look.caps ? 12 : 30);
    if (look.caps) {
      ctx.fillStyle = look.caps;
      ctx.fillRect(0, 0, w, h * (9 / 180));
      ctx.fillRect(0, h * (172 / 180), w, h * (8 / 180));
    }
    if (look.pole) { // Charon's red north pole
      ctx.fillStyle = look.pole;
      ctx.fillRect(0, 0, w, h * (22 / 180));
    }
    if (look.heart) { // Tombaugh Regio, the heart, faces Charon's way round from longitude 180
      ctx.fillStyle = look.heart;
      BodyArt.spot(ctx, w, h, 25, 165, 20);
      BodyArt.spot(ctx, w, h, 10, -170, 24);
    }
  }

  static craters(ctx, w, h, rng, n) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#4a4560';
    for (let i = 0; i < n; i++) BodyArt.spot(ctx, w, h, rng() * 160 - 80, rng() * 360 - 180, 1 + rng() * 3);
    ctx.globalAlpha = 1;
  }

  /** Europa: smooth ice criss-crossed by long reddish-brown cracks. */
  static ice(ctx, w, h, look, rng) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = look.cracks;
    for (let i = 0; i < 22; i++) {
      let x = rng() * w, y = h * (0.15 + rng() * 0.7), a = rng() * TAU;
      ctx.lineWidth = 0.6 + rng() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let k = 0; k < 14; k++) {
        a += (rng() - 0.5) * 0.4;
        x += Math.cos(a) * 9;
        y += Math.sin(a) * 4;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /** Io: sulphur yellow, blotched with red, orange and the black of fresh lava, and no craters (it's always being resurfaced). */
  static sulphur(ctx, w, h, look, rng) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = i % 4 === 0 ? look.dark : i % 2 ? look.spots : '#f7f0c8';
      BodyArt.spot(ctx, w, h, (rng() - 0.5) * 150, (rng() - 0.5) * 360, i % 4 === 0 ? 2 + rng() * 3 : 4 + rng() * 9);
    }
  }

  /** Cloud bands: soft wavy stripes, and Jupiter's Great Red Spot or Neptune's dark one. */
  static bands(ctx, w, h, look, rng) {
    ctx.fillStyle = look.color;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = look.stripes;
    const n = look.kind === 'cloud' ? 5 : 9;
    for (let i = 0; i < n; i++) {
      const y = ((i + 0.5 + (rng() - 0.5) * 0.4) / n) * h, th = (h / n) * (0.25 + rng() * 0.35), amp = th * 0.3, ph = rng() * TAU;
      ctx.beginPath();
      ctx.moveTo(0, y);
      for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin((x / w) * TAU * 3 + ph) * amp);
      for (let x = w; x >= 0; x -= 8) ctx.lineTo(x, y + th + Math.sin((x / w) * TAU * 3 + ph + 1) * amp);
      ctx.closePath();
      ctx.fill();
    }
    if (look.spot) {
      ctx.fillStyle = look.spot;
      ctx.beginPath();
      ctx.ellipse(w * 0.62, h * (112 / 180), w * 0.05, h * 0.045, 0, 0, TAU);
      ctx.fill();
    }
  }
}
