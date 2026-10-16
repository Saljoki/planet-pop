import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, mod, clamp, frame, frameFwd, tangentBasis, smallCircle, canvasTexture, ribbonGeometry } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/InstanceEntity.js';
import { Trails } from '../life/Trails.js';
import { CITY_A } from './Cities.js';

const N = 640, W = 0.11, SPEED = 0.55, GAP = 0.19;
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _up = new THREE.Vector3(), _f = new THREE.Vector3();
const _chim = new THREE.Vector3(), _vel = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/** A loop railway with a tunnel through its own mountain and a smoking steam train. */
export class Railway {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    this.mountain = null;
    this.tunnel = null;
    this.exitTime = -10;
    this.ok = this.chooseRoute();
  }

  get justExited() { return this.planet.time - this.exitTime < 0.6; }

  chooseRoute() {
    const p = this.planet, rng = p.rng, d = new THREE.Vector3();
    for (let tries = 0; tries < 400; tries++) {
      const c = rng.dir(), A = rng.range(0.2, 0.32), [u, v] = tangentBasis(c);
      let water = 0, bad = false;
      for (let k = 0; k < 48 && !bad; k++) {
        smallCircle(d, c, u, v, A, (k / 48) * TAU);
        if (p.heightAt(d) < 0.04) water++;
        if (water > 5 || p.cities.sites.some((s) => s.c.angleTo(d) < CITY_A + 0.1) || p.offLimits(d, 0.03)) bad = true;
      }
      if (bad) continue;
      Object.assign(this, { c, u, v, A });
      this.trace();
      this.pickTunnel();
      return true;
    }
    return false;
  }

  trace() {
    const p = this.planet, raw = new Float32Array(N), d = new THREE.Vector3();
    this.rad = new Float32Array(N);
    this.water = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      smallCircle(d, this.c, this.u, this.v, this.A, (i / N) * TAU);
      const h = p.heightAt(d);
      this.water[i] = h < 0.03 ? 1 : 0;
      raw[i] = Math.max(R + h + 0.048, R + 0.16);
    }
    for (let i = 0; i < N; i++) {
      let s = 0;
      for (let k = -4; k <= 4; k++) s += raw[(i + k + N) % N];
      this.rad[i] = Math.max(s / 9, raw[i]);
    }
  }

  /** The highest stretch of track away from roads and cities gets a mountain built over it. */
  pickTunnel() {
    const p = this.planet, d = new THREE.Vector3(), s = 0.72;
    let best = null, bestH = -Infinity;
    for (let i = 0; i < N; i += 8) {
      if (this.water[i]) continue;
      const phi = (i / N) * TAU;
      smallCircle(d, this.c, this.u, this.v, this.A, phi);
      if (p.roads.near(d, (s + 0.35) / R)) continue;
      if (p.cities.sites.some((o) => o.c.angleTo(d) < CITY_A + (s + 0.2) / R)) continue;
      const h = p.heightAt(d);
      if (h > bestH) { bestH = h; best = { phi, i, d: d.clone() }; }
    }
    if (!best) return;
    const base = p.surfR(best.d) - 0.3, hgt = Math.min(1.35, R + 2.2 - base);
    const rt = this.rad[best.i], rc = s * (1 - (rt - base) / hgt);
    this.mountain = { d: best.d, s, base, hgt };
    this.tunnel = { phi: best.phi, half: (rc / rt / Math.sin(this.A)) * 0.96 };
  }

  near(d, margin) {
    if (!this.ok) return false;
    return Math.abs(Math.acos(clamp(d.dot(this.c), -1, 1)) - this.A) < margin;
  }
  radius(phi) {
    const f = mod((phi / TAU) * N, N), i = Math.floor(f), t = f - i;
    return this.rad[i] * (1 - t) + this.rad[(i + 1) % N] * t;
  }
  point(phi, out) { return smallCircle(out, this.c, this.u, this.v, this.A, phi).multiplyScalar(this.radius(phi)); }
  tangentAt(phi, out) { return out.copy(this.v).multiplyScalar(Math.cos(phi)).addScaledVector(this.u, -Math.sin(phi)); }
  inTunnel(phi) {
    return !!this.tunnel && Math.abs(mod(phi - this.tunnel.phi + Math.PI, TAU) - Math.PI) < this.tunnel.half;
  }

  build() {
    if (!this.ok) return;
    this.buildTrack();
    this.buildPillars();
    this.buildPortals();
    this.buildTrain();
  }

  buildTrack() {
    const p = this.planet, d = new THREE.Vector3(), t = new THREE.Vector3(), s = new THREE.Vector3();
    const q = new THREE.Vector3(), prev = new THREE.Vector3();
    const pos = [], nor = [], uv = [], idx = [];
    let len = 0;
    for (let i = 0; i <= N; i++) {
      const phi = (i / N) * TAU;
      smallCircle(d, this.c, this.u, this.v, this.A, phi);
      s.crossVectors(d, this.tangentAt(phi, t));
      q.copy(d).multiplyScalar(this.rad[i % N]);
      if (i) len += q.distanceTo(prev);
      prev.copy(q);
      for (const k of [1, -1]) {
        pos.push(q.x + (s.x * k * W) / 2, q.y + (s.y * k * W) / 2, q.z + (s.z * k * W) / 2);
        nor.push(d.x, d.y, d.z);
        uv.push(k > 0 ? 0 : 1, len / 0.25);
      }
      if (i < N) { const b = i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
    }
    const tex = canvasTexture(32, 64, (g) => {
      g.fillStyle = '#8f86a8'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#7a4e2e'; g.fillRect(2, 6, 28, 9); g.fillRect(2, 38, 28, 9);
      g.fillStyle = '#1b1530'; g.fillRect(6, 0, 5, 64); g.fillRect(21, 0, 5, 64);
      g.fillStyle = '#e4e1f0'; g.fillRect(7, 0, 3, 64); g.fillRect(22, 0, 3, 64);
    });
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = p.app.renderer.capabilities.getMaxAnisotropy();
    addMesh(p.root, ribbonGeometry(pos, nor, uv, idx), toon('#ffffff', { map: tex, side: THREE.DoubleSide }), 0, { cast: false });
  }

  buildPillars() {
    const list = [];
    for (let i = 0; i < N; i += 10) if (this.water[i]) list.push(i);
    const mesh = addInstanced(this.planet.root, new THREE.CylinderGeometry(0.03, 0.04, 1, 8).translate(0, 0.5, 0), toon('#f2eefc'), list.length, 0.008);
    const d = new THREE.Vector3(), fwd = new THREE.Vector3();
    list.forEach((i, k) => {
      const phi = (i / N) * TAU, base = R - 0.3;
      smallCircle(d, this.c, this.u, this.v, this.A, phi);
      mesh.setMatrixAt(k, frame(_m, _p.copy(d).multiplyScalar(base), d, this.tangentAt(phi, fwd), 1, this.rad[i] - base - 0.01, 1));
    });
  }

  buildPortals() {
    if (!this.tunnel) return;
    const p = this.planet, mats = [];
    for (const sgn of [1, -1]) {
      const phi = this.tunnel.phi + sgn * (this.tunnel.half + 0.02 / (R * Math.sin(this.A)));
      const pos = this.point(phi, new THREE.Vector3()), up = pos.clone().normalize();
      mats.push(frame(new THREE.Matrix4(), pos.addScaledVector(up, -0.01), up, this.tangentAt(phi, new THREE.Vector3())));
    }
    const arch = addInstanced(p.root, new THREE.TorusGeometry(0.09, 0.024, 6, 14, Math.PI), toon('#a39bbd', { flatShading: true }), 2, 0.008);
    const hole = addInstanced(p.root, new THREE.CircleGeometry(0.09, 14, 0, Math.PI),
      new THREE.MeshBasicMaterial({ color: '#120c26', side: THREE.DoubleSide }), 2, 0, { cast: false });
    shareMatrices(arch, hole);
    mats.forEach((m, i) => arch.setMatrixAt(i, m));
  }

  buildTrain() {
    const p = this.planet, root = p.root;
    const body = new THREE.BoxGeometry(0.072, 0.06, 0.16).translate(0, 0.05, 0);
    const wheels = mergeGeometries([-1, 1].flatMap((sx) => [-1, 1].map((sz) =>
      new THREE.CylinderGeometry(0.02, 0.02, 0.014, 10).rotateZ(Math.PI / 2).translate(sx * 0.03, 0.02, sz * 0.05))));
    const loco = mergeGeometries([
      new THREE.BoxGeometry(0.068, 0.045, 0.06).translate(0, 0.1, -0.045),     // cab
      new THREE.CylinderGeometry(0.014, 0.019, 0.05, 8).translate(0, 0.1, 0.05), // chimney
    ]);
    this.cars = addInstanced(root, body, toon('#ffffff'), 4, 0.006);
    const wheelMesh = addInstanced(root, wheels, toon('#2a2540'), 4);
    shareMatrices(this.cars, wheelMesh);
    this.loco = addInstanced(root, loco, toon('#2a2540'), 1, 0.005);
    ['#ff4d4d', '#3fa7ff', '#ffd23f', '#2ee59d'].forEach((col, i) => this.cars.setColorAt(i, _c.set(col)));
    this.smoke = new Trails(root, { max: 160, color: '#f4f1ff', life: 2.2, grow: 2.5 });
    this.entities = [new InstanceEntity(this.cars, 0, 'train', 'Choo-Choo Express')];
    const sinA = Math.sin(this.A);
    this.phi = p.rng.range(0, TAU);
    this.w = SPEED / (R * sinA);
    this.gap = GAP / (R * sinA);
    this.smokeT = 0;
    this.inside = false;
  }

  update(dt) {
    if (!this.cars) return;
    this.phi += this.w * dt;
    for (let k = 0; k < 4; k++) {
      const phi = this.phi - k * this.gap;
      this.point(phi, _p);
      this.point(phi + 0.004, _p2);
      frameFwd(_m, _p, _up.copy(_p).normalize(), _f.subVectors(_p2, _p));
      this.cars.setMatrixAt(k, _m);
      if (k === 0) { this.loco.setMatrixAt(0, _m); _chim.set(0, 0.13, 0.05).applyMatrix4(_m); }
    }
    this.cars.instanceMatrix.needsUpdate = this.loco.instanceMatrix.needsUpdate = true;

    const inside = this.inTunnel(this.phi);
    if (this.inside && !inside) this.exitTime = this.planet.time;
    this.inside = inside;
    if ((this.smokeT -= dt) <= 0 && !inside) {
      this.smokeT = 0.1;
      this.smoke.emit(_chim, 0.03, _vel.copy(_chim).normalize().multiplyScalar(0.25));
    }
    this.smoke.update(dt);
  }
}
