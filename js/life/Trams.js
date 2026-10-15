import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, frameFwd, ribbonGeometry } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/InstanceEntity.js';
import { nightGlowMaterial } from '../world/Glow.js';
import { ROAD_W } from '../world/Roads.js';
import { CITY_A, GRID } from '../world/Cities.js';

const COLORS = ['#ffd23f', '#ff4d4d', '#2ee59d', '#3fa7ff', '#ff8c42', '#ff5fa2'];
const MIN_NODES = 4, CLEAR = 0.05, SAMPLES = 12;              // street corners on a line, building gap, ground samples per block
const CAR = 0.12, GAP = 0.014, SPEED = 0.16, ACCEL = 0.08, DWELL = 2.5;
const HALF = CAR + GAP / 2;                                     // half the length of a two-car tram
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4();

/** A point in a city's plot grid: `x` along city.u, `z` along city.v. */
const local = (city, x, z) => city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, z / R).normalize();

/**
 * A tram line in each town: two-car trams shuttle up and down the longest straight street, stopping at the corners
 * and ringing their bell. Lines are chosen before the town is built, so buildings leave room for the tracks.
 */
export class Trams {
  constructor(planet) {
    this.planet = planet;
    this.lines = planet.cities.sites.map((city) => this.choose(city)).filter(Boolean);
    this.entities = [];
  }

  /** The longest straight run of street corners in a town, on dry land and clear of highways, rails and airports. */
  choose(city) {
    const p = this.planet, W = CITY_A * R, n = Math.ceil(W / GRID);
    const ok = (x, z) => {
      if (Math.hypot(x, z) / W > 0.8) return false;
      const d = local(city, x, z);
      return p.heightAt(d) > 0.05 && !p.roads.near(d, (ROAD_W / 2 + 0.05) / R) && !p.railway.near(d, 0.025) && !p.isReserved(d);
    };
    let best = null;
    for (const axis of ['x', 'z']) {
      for (let j = -n - 1; j <= n; j++) {
        const at = (j + 0.5) * GRID, pt = (s) => (axis === 'x' ? ok(s, at) : ok(at, s));
        let run = [];
        const consider = () => {
          if (run.length < MIN_NODES) return;
          const better = !best || run.length > best.nodes || (run.length === best.nodes && Math.abs(at) < Math.abs(best.at));
          if (better) best = { city, axis, at, from: run[0], to: run.at(-1), nodes: run.length };
        };
        for (let i = -n - 1; i <= n; i++) {
          const s = (i + 0.5) * GRID;
          if (pt(s) && (!run.length || pt(s - GRID / 2))) { run.push(s); continue; }
          consider();
          run = pt(s) ? [s] : [];
        }
        consider();
      }
    }
    return best;
  }

  /** Cities.build asks: how big may a building on plot (x, z) be across the track? { key: 'w' | 'dp', max } or null. */
  room(city, x, z) {
    const l = this.lines.find((t) => t.city === city);
    if (!l) return null;
    const [s, off] = l.axis === 'x' ? [x, z] : [z, x];
    if (s < l.from - GRID * 0.6 || s > l.to + GRID * 0.6) return null;
    return { key: l.axis === 'x' ? 'w' : 'dp', max: 2 * (Math.abs(off - l.at) - CLEAR) };
  }

  /** People.streets asks: does the street from (x1, z1) to (x2, z2) run along the track? (People cross it, they don't walk on it.) */
  onTrack(city, x1, z1, x2, z2) {
    const l = this.lines.find((t) => t.city === city), e = 1e-6;
    if (!l) return false;
    const [s1, o1, s2, o2] = l.axis === 'x' ? [x1, z1, x2, z2] : [z1, x1, z2, x2];
    return Math.abs(o1 - l.at) < e && Math.abs(o2 - l.at) < e && Math.min(s1, s2) > l.from - e && Math.max(s1, s2) < l.to + e;
  }

  /** Direction of the point `s` along line `l` and `off` to its side. */
  point(l, s, off = 0) { return l.axis === 'x' ? local(l.city, l.from + s, l.at + off) : local(l.city, l.at + off, l.from + s); }

  /** Lays the tracks on the finished terrain and puts a tram on each line. */
  build() {
    const p = this.planet, rng = p.rng, step = GRID / SAMPLES;
    const pos = [], nor = [], uv = [], col = [], idx = [];
    for (const l of this.lines) {
      l.len = l.to - l.from;
      l.count = Math.round(l.len / step);
      l.r = Array.from({ length: l.count + 1 }, (_, k) => p.meshR(this.point(l, k * step)));
      // track bed and two rails, each a ribbon hugging the ground across its width too
      for (const [off, w, lift, shade] of [[0, 0.07, 0.004, 0.36], [-0.018, 0.008, 0.008, 0.9], [0.018, 0.008, 0.008, 0.9]]) {
        const base = pos.length / 3;
        for (let k = 0; k <= l.count; k++) {
          for (const side of [-1, 1]) {
            const d = this.point(l, k * step, off + (side * w) / 2);
            _p.copy(d).multiplyScalar(p.meshR(d) + lift);
            pos.push(_p.x, _p.y, _p.z);
            nor.push(d.x, d.y, d.z);
            uv.push(side < 0 ? 0 : 1, k / l.count);
            col.push(shade, shade * 0.97, shade * 1.08);
          }
          const [a, b, c, d] = [base + 2 * k - 2, base + 2 * k - 1, base + 2 * k, base + 2 * k + 1];
          if (k) idx.push(...(l.axis === 'x' ? [a, c, b, b, c, d] : [a, b, c, b, d, c])); // faces up whichever way the line runs
        }
      }
      // stops at every other corner, always including both ends
      const corners = Math.round(l.len / GRID);
      l.stops = [...new Set([...Array.from({ length: corners + 1 }, (_, k) => k * GRID).filter((_, k) => k % 2 === 0), l.len])]
        .map((s) => Math.min(Math.max(s, HALF), l.len - HALF));
    }
    if (!this.lines.length) return;
    const geo = ribbonGeometry(pos, nor, uv, idx);
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); // dark bed, pale steel rails
    this.track = addMesh(p.root, geo, toon('#ffffff', { vertexColors: true }), 0, { cast: false, detail: 6 });

    const n = this.lines.length * 2;
    this.body = addInstanced(p.root, new THREE.BoxGeometry(0.05, 0.042, CAR).translate(0, 0.031, 0), toon('#ffffff'), n, 0.005, { detail: 9 });
    const roof = addInstanced(p.root, mergeGeometries([
      new THREE.BoxGeometry(0.036, 0.01, CAR - 0.012).translate(0, 0.057, 0),
      new THREE.BoxGeometry(0.004, 0.026, 0.004).translate(0, 0.075, 0.01),   // pantograph arm
      new THREE.BoxGeometry(0.03, 0.004, 0.006).translate(0, 0.088, 0.01),    // and its shoe
    ]), toon('#f4f1ff'), n, 0.004, { detail: 9 });
    const windows = addInstanced(p.root, new THREE.BoxGeometry(0.052, 0.016, CAR - 0.02).translate(0, 0.038, 0),
      nightGlowMaterial('#2d2a5a', '#ffe9a0'), n, 0, { cast: false, detail: 7 });
    const wheels = addInstanced(p.root, new THREE.BoxGeometry(0.044, 0.012, CAR - 0.03).translate(0, 0.008, 0), toon('#2a2540'), n, 0, { detail: 7 });
    shareMatrices(this.body, roof, windows, wheels);
    this.trams = this.lines.map((l, i) => {
      const col = new THREE.Color(COLORS[i % COLORS.length]);
      this.body.setColorAt(2 * i, col);
      this.body.setColorAt(2 * i + 1, col);
      const stop = rng.int(0, l.stops.length - 1);
      return { line: l, s: l.stops[stop], stop, dir: stop === l.stops.length - 1 ? -1 : 1, v: 0, wait: rng.range(0, DWELL) };
    });
    this.entities = this.trams.map((t, i) => Object.assign(new InstanceEntity(this.body, 2 * i, 'tram', `${t.line.city.name} Tram`), { near: 6 }));
    this.update(0);
  }

  /** True while tram `i` waits at either end of its line. */
  atEnd(i) {
    const t = this.trams?.[i];
    return !!t && t.wait > 0 && (t.stop === 0 || t.stop === t.line.stops.length - 1);
  }

  /** Ground point (radius included) at `s` along a line. */
  ground(l, s, out) {
    const f = Math.min(Math.max(s / (l.len / l.count), 0), l.count), k = Math.min(l.count - 1, Math.floor(f));
    return out.copy(this.point(l, s)).multiplyScalar(l.r[k] + (l.r[k + 1] - l.r[k]) * (f - k));
  }

  update(dt) {
    if (!this.trams) return;
    this.trams.forEach((t, i) => {
      const l = t.line;
      if (t.wait > 0) {
        if ((t.wait -= dt) <= 0) this.depart(t);
      } else {
        const target = l.stops[t.stop], left = Math.abs(target - t.s);
        t.v = Math.min(t.v + ACCEL * dt, SPEED, Math.sqrt(2 * ACCEL * left)); // brakes smoothly into the stop
        t.s += Math.sign(target - t.s) * Math.min(t.v * dt, left);
        if (Math.abs(target - t.s) < 1e-4) { t.s = target; t.v = 0; t.wait = DWELL; }
      }
      for (const [k, off] of [[0, CAR / 2 + GAP / 2], [1, -CAR / 2 - GAP / 2]]) {
        const s = t.s + off;
        this.ground(l, s, _p);
        _f.subVectors(this.ground(l, s + 0.04, _a), this.ground(l, s - 0.04, _b)); // pitches with the street
        this.body.setMatrixAt(2 * i + k, frameFwd(_m, _p, _a.copy(_p).normalize(), _f));
      }
    });
    this.body.instanceMatrix.needsUpdate = true;
  }

  /** Next stop: reverse at the ends of the line. Ding ding if the camera is close. */
  depart(t) {
    const last = t.line.stops.length - 1;
    if (t.stop + t.dir < 0 || t.stop + t.dir > last) t.dir = -t.dir;
    t.stop += t.dir;
    const app = this.planet.app;
    this.ground(t.line, t.s, _p);
    if (app.camera.position.distanceTo(_p) < 3) app.sfx?.pop(_p.clone().addScaledVector(_p.clone().normalize(), 0.12), 'DING DING!', '#ffd23f');
  }
}
