import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frame, smoothstep, canvasTexture } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';
import { nightGlowMaterial } from './Glow.js';
import { CITY_A } from './Cities.js';
import { ROAD_W } from './Roads.js';

export const RUNWAY_L = 2.0, RUNWAY_W = 0.42;
export const HALF = RUNWAY_L / 2 / R;  // runway half-length, radians
export const LIFT = HALF * 0.85;       // lift-off / touchdown point, radians from the runway centre
export const CLIMB = 0.7;              // radians of ground track spent climbing to cruise (and descending from it)
export const CRUISE = R + 4.1;
const MAX = 2, APRON = 0.5, SLAB_W = RUNWAY_W + APRON, MAX_SLOPE = 0.6;
const FLAT_LAT = (APRON - 0.03) / 2 / R, FLAT_IN = 0.12, FLAT_OUT = 0.19; // levelled disc around runway and apron
const DISTS = [CITY_A + 0.1, CITY_A + 0.18, CITY_A + 0.27], HEADINGS = [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4];
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _p = new THREE.Vector3(), _d = new THREE.Vector3();

/** 0 on the runway, 1 at cruise: how far up a circuit flight is at angle `a` (0..TAU) around its great circle. */
export function climbFrac(a) {
  return Math.min(smoothstep(LIFT, LIFT + CLIMB, a), smoothstep(TAU - LIFT, TAU - LIFT - CLIMB, a));
}

/** Point on an airport's circuit: the great circle through the runway centre, along the runway. */
export function circuitDir(ap, a, out) {
  return out.copy(ap.c).multiplyScalar(Math.cos(a)).addScaledVector(ap.fwd, Math.sin(a));
}

/** Small airports just outside some cities: a runway on a levelled slab, apron, terminal and control tower. */
export class Airports {
  constructor(planet) {
    this.planet = planet;
    this.list = [];
    this.entities = [];
    for (const city of planet.cities.sites) {
      if (this.list.length >= MAX) break;
      const ap = this.find(city);
      if (!ap) continue;
      this.list.push(ap);
      planet.flatten(this.at(ap, 0, FLAT_LAT, new THREE.Vector3()), FLAT_IN, FLAT_OUT, Math.max(0.06, (ap.lo + ap.hi) / 2));
      planet.reserve(ap.c, HALF + 0.03);
      for (const s of [1, -1]) { // keep the approach and climb-out free of mountains
        for (let j = 1; j <= 8; j++) planet.keepClear.push({ d: circuitDir(ap, s * (HALF + j * 0.07), new THREE.Vector3()), ang: 0.05 });
      }
    }
  }

  /** Point on the airport's footprint: `a` radians along the runway, `lat` radians sideways (towards the apron). */
  at(ap, a, lat, out) { return circuitDir(ap, a, out).addScaledVector(ap.side, lat).normalize(); }

  /** The levellest spot a short drive from the city, trying a few distances, bearings and runway headings. */
  find(city) {
    let best = null;
    for (const dist of DISTS) {
      for (let k = 0; k < 16; k++) {
        const th = (k / 16) * TAU + 0.2;
        const radial = city.u.clone().multiplyScalar(Math.cos(th)).addScaledVector(city.v, Math.sin(th));
        const c = city.c.clone().multiplyScalar(Math.cos(dist)).addScaledVector(radial, Math.sin(dist)).normalize();
        const rim = new THREE.Vector3().crossVectors(city.c, radial).normalize(); // along the city's rim
        const out = new THREE.Vector3().crossVectors(rim, c).normalize();        // pointing away from the city
        for (const turn of HEADINGS) {
          const fwd = rim.clone().multiplyScalar(Math.cos(turn)).addScaledVector(out, Math.sin(turn));
          const side = new THREE.Vector3().crossVectors(c, fwd);
          if (side.dot(city.c) < 0) { fwd.negate(); side.negate(); } // apron and terminal face the city
          const ap = { city, c, fwd, side, name: `${city.name} Airport` };
          if (this.fits(ap) && (!best || ap.hi - ap.lo < best.hi - best.lo) && this.clearSkies(ap)) best = ap;
        }
      }
    }
    return best && best.hi - best.lo < MAX_SLOPE ? best : null;
  }

  /** Dry land, not too steep (it gets levelled), with nothing else on it. */
  fits(ap) {
    const p = this.planet, m = p.railway.mountain, flat = this.at(ap, 0, FLAT_LAT, _p);
    if (this.list.some((o) => o.c.angleTo(ap.c) < 0.6)) return false;
    // levelling must not reach the railway (already laid) or its mountain
    if (p.railway.near(flat, FLAT_OUT + 0.01) || (m && m.d.angleTo(flat) < FLAT_OUT + m.s / R)) return false;
    let lo = Infinity, hi = -Infinity;
    for (let i = -4; i <= 4; i++) {
      for (const lat of [-RUNWAY_W / 2 - 0.03, 0, RUNWAY_W / 2, RUNWAY_W / 2 + APRON]) {
        const d = this.at(ap, (i / 4) * HALF * 1.05, lat / R, _d), h = p.heightAt(d);
        if (h < 0.02 || h > 0.8) return false;
        if (p.roads.near(d, (ROAD_W / 2 + 0.08) / R) || p.railway.near(d, 0.03) || p.isReserved(d, 0.01)) return false;
        if (p.cities.sites.some((s) => s.c.angleTo(d) < CITY_A + 0.015)) return false;
        lo = Math.min(lo, h);
        hi = Math.max(hi, h);
      }
    }
    ap.lo = lo;
    ap.hi = hi;
    return hi - lo < MAX_SLOPE;
  }

  /** Planes climbing out and coming in to land must clear the terrain, the railway's mountain and city towers. */
  clearSkies(ap) {
    const p = this.planet, top = R + ap.hi + 0.03, m = p.railway.mountain;
    for (const s of [1, -1]) {
      for (let a = LIFT; a < LIFT + CLIMB; a += 0.035) {
        const d = circuitDir(ap, s * a, _d), alt = top + (CRUISE - top) * smoothstep(LIFT, LIFT + CLIMB, a);
        const floor = p.surfR(d) + (p.cities.inCity(d) ? 1.8 : 0.25);
        if (floor > alt) return false;
        if (m && m.d.angleTo(d) < m.s / R + 0.05 && m.base + m.hgt + 0.3 > alt) return false;
      }
    }
    return true;
  }

  /** Meshes go in once the terrain exists, so the slab can sit exactly on the rendered ground. */
  build() {
    const p = this.planet, n = this.list.length;
    if (!n) return;
    for (const ap of this.list) {
      let lo = Infinity, hi = -Infinity;
      for (let i = -6; i <= 6; i++) {
        for (const lat of [-RUNWAY_W / 2, 0, RUNWAY_W / 2, RUNWAY_W / 2 + APRON / 2, RUNWAY_W / 2 + APRON]) {
          const r = p.meshR(this.at(ap, (i / 6) * HALF, lat / R, _d));
          lo = Math.min(lo, r);
          hi = Math.max(hi, r);
        }
      }
      ap.top = hi + 0.015;
      ap.depth = ap.top - lo + 0.12; // the slab reaches down into the lowest ground under it
      ap.cruise = CRUISE;
      ap.matrix = frame(new THREE.Matrix4(), _p.copy(ap.c).multiplyScalar(ap.top), ap.c, ap.fwd);
      this.entities.push(new PointEntity(_p.copy(ap.c).multiplyScalar(ap.top + 0.2).addScaledVector(ap.side, 0.3), 'airport', ap.name, ap.fwd));
    }

    const root = p.root, side = toon('#b9b1d6');
    const slab = addInstanced(root, new THREE.BoxGeometry(SLAB_W, 1, RUNWAY_L).translate(SLAB_W / 2 - RUNWAY_W / 2, -0.5, 0),
      [side, side, toon('#ffffff', { map: runwayTexture() }), side, side, side], n, 0.012);
    const terminal = addInstanced(root, new THREE.BoxGeometry(0.18, 0.13, 0.62).translate(RUNWAY_W / 2 + 0.38, 0.065, -0.1), toon('#f4f1ff'), n, 0.008);
    const glass = addInstanced(root, new THREE.BoxGeometry(0.186, 0.04, 0.58).translate(RUNWAY_W / 2 + 0.38, 0.075, -0.1),
      nightGlowMaterial('#5aa9e6', '#ffd86b'), n, 0, { cast: false });
    const tower = addInstanced(root, mergeGeometries([
      new THREE.CylinderGeometry(0.022, 0.032, 0.42, 10).translate(0, 0.21, 0),
      new THREE.CylinderGeometry(0.064, 0.064, 0.016, 12).translate(0, 0.49, 0),
    ]).translate(RUNWAY_W / 2 + 0.36, 0, 0.42), toon('#ff8c42'), n, 0.006);
    const cab = addInstanced(root, new THREE.CylinderGeometry(0.058, 0.044, 0.06, 12).translate(RUNWAY_W / 2 + 0.36, 0.45, 0.42),
      nightGlowMaterial('#7fd0ff', '#fff2b0'), n, 0.005, { cast: false });
    this.beacon = addInstanced(root, new THREE.SphereGeometry(0.016, 8, 6).translate(RUNWAY_W / 2 + 0.36, 0.51, 0.42),
      new THREE.MeshBasicMaterial({ color: '#3bff7a' }), n, 0, { cast: false });
    shareMatrices(terminal, glass, tower, cab, this.beacon);

    const LIGHTS = 9, lights = addInstanced(root, new THREE.SphereGeometry(0.014, 8, 6), nightGlowMaterial('#d8d2ea', '#7fd0ff'), n * LIGHTS * 2, 0, { cast: false, detail: 8 });
    this.list.forEach((ap, i) => {
      slab.setMatrixAt(i, _m.copy(ap.matrix).multiply(_l.makeScale(1, ap.depth, 1)));
      terminal.setMatrixAt(i, ap.matrix);
      for (let k = 0; k < LIGHTS * 2; k++) {
        const x = (k % 2 ? 1 : -1) * (RUNWAY_W / 2 + 0.01), z = ((Math.floor(k / 2) / (LIGHTS - 1)) - 0.5) * (RUNWAY_L - 0.06);
        lights.setMatrixAt(i * LIGHTS * 2 + k, _m.copy(ap.matrix).multiply(_l.makeTranslation(x, 0.008, z)));
      }
    });
  }

  update(dt, t) {
    if (this.beacon) this.beacon.visible = Math.floor(t * 1.5) % 2 === 0; // the tower beacon blinks
  }
}

/** Asphalt with edge lines, a dashed centre line and piano-key thresholds; a lighter apron with a taxi line. */
function runwayTexture() {
  const px = 200, W = Math.round(SLAB_W * px), H = 512, rw = Math.round(RUNWAY_W * px);
  return canvasTexture(W, H, (g) => {
    g.fillStyle = '#4b4566'; g.fillRect(0, 0, rw, H);
    g.fillStyle = '#b9b1d6'; g.fillRect(rw, 0, W - rw, H);
    g.fillStyle = '#ffffff';
    g.fillRect(4, 0, 4, H); g.fillRect(rw - 8, 0, 4, H);
    for (let y = 70; y < H - 70; y += 34) g.fillRect(rw / 2 - 2, y, 4, 18);
    for (const y0 of [8, H - 44]) for (let x = 14; x < rw - 14; x += 10) g.fillRect(x, y0, 5, 36);
    g.fillStyle = '#ffd23f';
    g.fillRect(rw + (W - rw) * 0.35, 40, 4, H - 80);
  });
}
