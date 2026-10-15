import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, mod, frame, tangentBasis, canvasTexture, ribbonGeometry } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced, shareMatrices } from '../render/Outline.js';
import { nightGlowMaterial } from './Glow.js';

export const ROAD_W = 0.22, ROAD_N = 900, LANE = 0.055;
const STOP = (ROAD_W / 2 + 0.07) / R; // stop line, angular distance before a crossing
const CYCLE = 14, GREEN = 6;          // signal timing in seconds
const BASE = [[0.25, 1, 0.15], [1, 0.2, -0.45], [-0.4, 0.35, 1]];
const LAMP = {
  redOn: new THREE.Color('#ff3b3b'), redOff: new THREE.Color('#4a1a22'),
  greenOn: new THREE.Color('#3bff7a'), greenOff: new THREE.Color('#173a26'),
};
const _d = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Three great-circle highways with bridges, street lamps and signalled crossings. */
export class Roads {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    const rng = planet.rng;
    const q = new THREE.Quaternion().setFromAxisAngle(rng.dir(), rng.range(0, TAU));
    this.list = BASE.map((b, idx) => this.trace(new THREE.Vector3(...b).normalize().applyQuaternion(q), idx));
    this.crossings = [];
    for (let i = 0; i < this.list.length; i++) {
      for (let j = i + 1; j < this.list.length; j++) {
        const a = this.list[i], b = this.list[j];
        const x = new THREE.Vector3().crossVectors(a.n, b.n).normalize();
        for (const s of [1, -1]) {
          const d = x.clone().multiplyScalar(s);
          this.crossings.push({
            d, offset: rng.range(0, CYCLE), state: -2,
            legs: [{ road: a, a: this.angleOn(a, d) }, { road: b, a: this.angleOn(b, d) }],
          });
        }
      }
    }
  }

  trace(n, idx) {
    const [u, v] = tangentBasis(n), p = this.planet;
    const raw = new Float32Array(ROAD_N), rad = new Float32Array(ROAD_N), water = new Uint8Array(ROAD_N);
    for (let i = 0; i < ROAD_N; i++) {
      const a = (i / ROAD_N) * TAU;
      _d.copy(u).multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
      const h = p.heightAt(_d);
      water[i] = h < 0.03 ? 1 : 0;
      raw[i] = Math.max(R + h + 0.06, R + 0.18); // follow the land, become a bridge over water
    }
    for (let i = 0; i < ROAD_N; i++) {
      let s = 0;
      for (let k = -5; k <= 5; k++) s += raw[(i + k + ROAD_N) % ROAD_N];
      rad[i] = Math.max(s / 11, raw[i]) + idx * 0.006; // offset avoids z-fighting at crossings
    }
    return { n, u, v, rad, water, idx };
  }

  /** Re-measure the road heights after the terrain changed (airports level the ground). */
  retrace() { for (const road of this.list) Object.assign(road, this.trace(road.n, road.idx)); }

  angleOn(road, d) { return mod(Math.atan2(d.dot(road.v), d.dot(road.u)), TAU); }
  dir(road, a, out) { return out.copy(road.u).multiplyScalar(Math.cos(a)).addScaledVector(road.v, Math.sin(a)); }
  tangent(road, a, out) { return out.copy(road.v).multiplyScalar(Math.cos(a)).addScaledVector(road.u, -Math.sin(a)); }
  radius(road, a) {
    const f = mod((a / TAU) * ROAD_N, ROAD_N), i = Math.floor(f), t = f - i;
    return road.rad[i] * (1 - t) + road.rad[(i + 1) % ROAD_N] * t;
  }
  point(road, a, lateral, out) {
    this.dir(road, a, out);
    return out.multiplyScalar(this.radius(road, a)).addScaledVector(road.n, lateral);
  }
  near(d, margin) { return this.list.some((r) => Math.abs(d.dot(r.n)) < margin); }

  /** 0 = leg 0 green, 1 = leg 1 green, -1 = all red */
  phase(c, t) {
    const x = mod(t + c.offset, CYCLE);
    return x < GREEN ? 0 : x < CYCLE / 2 ? -1 : x < CYCLE / 2 + GREEN ? 1 : -1;
  }

  /** Angular distance to the next red stop line ahead of a car, or -1 when none within `look`. */
  redAhead(road, a, dir, look) {
    let best = -1;
    for (const c of this.crossings) {
      c.legs.forEach((leg, k) => {
        if (leg.road !== road || c.state === k) return;
        const dist = mod((leg.a - dir * STOP - a) * dir, TAU);
        if (dist < look && (best < 0 || dist < best)) best = dist;
      });
    }
    return best;
  }

  build() {
    const p = this.planet;
    const tex = canvasTexture(64, 128, (g) => {
      g.fillStyle = '#4b4566'; g.fillRect(0, 0, 64, 128);
      g.fillStyle = '#ffffff'; g.fillRect(5, 0, 4, 128); g.fillRect(55, 0, 4, 128);
      g.fillStyle = '#ffd23f'; g.fillRect(29, 12, 6, 52);
    });
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = p.app.renderer.capabilities.getMaxAnisotropy();
    const mat = toon('#ffffff', { map: tex, side: THREE.DoubleSide });
    for (const road of this.list) {
      const pos = [], nor = [], uv = [], idx = [], prev = new THREE.Vector3();
      let len = 0;
      for (let i = 0; i <= ROAD_N; i++) {
        this.dir(road, (i / ROAD_N) * TAU, _d);
        _p.copy(_d).multiplyScalar(road.rad[i % ROAD_N]);
        if (i) len += _p.distanceTo(prev);
        prev.copy(_p);
        for (const s of [1, -1]) {
          const w = (s * ROAD_W) / 2;
          pos.push(_p.x + road.n.x * w, _p.y + road.n.y * w, _p.z + road.n.z * w);
          nor.push(_d.x, _d.y, _d.z);
          uv.push(s > 0 ? 0 : 1, len / 0.9);
        }
        if (i < ROAD_N) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
      }
      addMesh(p.root, ribbonGeometry(pos, nor, uv, idx), mat, 0, { cast: false });
    }
    this.buildPillars();
    this.buildLamps();
    this.buildSignals();
  }

  buildPillars() {
    const list = [];
    for (const road of this.list) for (let i = 0; i < ROAD_N; i += 10) if (road.water[i]) list.push({ road, i });
    const mesh = addInstanced(this.planet.root, new THREE.CylinderGeometry(0.04, 0.05, 1, 8).translate(0, 0.5, 0), toon('#f2eefc'), list.length, 0.008);
    list.forEach(({ road, i }, k) => {
      const base = R - 0.3;
      this.dir(road, (i / ROAD_N) * TAU, _d);
      mesh.setMatrixAt(k, frame(_m, _p.copy(_d).multiplyScalar(base), _d, road.n, 1, road.rad[i] - base - 0.01, 1));
    });
  }

  buildLamps() {
    const list = [];
    let side = 1;
    for (const road of this.list) {
      for (let i = 9; i < ROAD_N; i += 18) {
        if (road.water[i]) continue;
        side = -side;
        const pos = this.point(road, (i / ROAD_N) * TAU, side * (ROAD_W / 2 + 0.04), new THREE.Vector3());
        list.push({ pos, fwd: road.n.clone().multiplyScalar(-side) });
      }
    }
    const root = this.planet.root;
    const post = addInstanced(root, new THREE.CylinderGeometry(0.006, 0.009, 0.22, 5).translate(0, 0.11, 0), toon('#3a3555'), list.length, 0.004, { detail: 8 });
    const head = addInstanced(root, new THREE.SphereGeometry(0.02, 8, 6).translate(0, 0.225, 0), nightGlowMaterial('#d8d2ea', '#ffd86b'), list.length, 0.004, { detail: 8 });
    shareMatrices(post, head);
    list.forEach((l, k) => post.setMatrixAt(k, frame(_m, l.pos, _d.copy(l.pos).normalize(), l.fwd)));
  }

  buildSignals() {
    const root = this.planet.root, n = this.crossings.length * 2;
    const pole = addInstanced(root, mergeGeometries([
      new THREE.CylinderGeometry(0.009, 0.009, 0.26, 6).translate(0, 0.13, 0),
      new THREE.BoxGeometry(0.04, 0.09, 0.034).translate(0, 0.29, 0),
    ]), toon('#2a2540'), n, 0.005, { detail: 7 });
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    this.redLamps = addInstanced(root, new THREE.SphereGeometry(0.021, 10, 8).translate(0, 0.31, 0), lampMat, n, 0, { cast: false, detail: 7 });
    this.greenLamps = addInstanced(root, new THREE.SphereGeometry(0.021, 10, 8).translate(0, 0.268, 0), lampMat, n, 0, { cast: false, detail: 7 });
    shareMatrices(pole, this.redLamps, this.greenLamps);
    this.crossings.forEach((c, ci) => c.legs.forEach((leg, k) => {
      const a = leg.a - STOP * 1.4, id = ci * 2 + k;
      this.point(leg.road, a, ROAD_W / 2 + 0.05, _p);
      pole.setMatrixAt(id, frame(_m, _p, _d.copy(_p).normalize(), this.tangent(leg.road, a, _t)));
      this.redLamps.setColorAt(id, LAMP.redOn);
      this.greenLamps.setColorAt(id, LAMP.greenOff);
    }));
  }

  update(dt, t) {
    if (!this.redLamps) return;
    let dirty = false;
    this.crossings.forEach((c, ci) => {
      const s = this.phase(c, t);
      if (s === c.state) return;
      c.state = s;
      dirty = true;
      c.legs.forEach((_, k) => {
        this.redLamps.setColorAt(ci * 2 + k, s === k ? LAMP.redOff : LAMP.redOn);
        this.greenLamps.setColorAt(ci * 2 + k, s === k ? LAMP.greenOn : LAMP.greenOff);
      });
    });
    if (dirty) this.redLamps.instanceColor.needsUpdate = this.greenLamps.instanceColor.needsUpdate = true;
  }
}
