import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { ROAD_W } from './Roads.js';
import { CITY_A } from './Cities.js';

const ROCK = ['#9d86d6', '#8a79c9', '#b39ae0'];
const PINE = ['#2f9e5a', '#23874d', '#3bb36a'];
const LEAFY = ['#55c95a', '#7fd65b', '#3daa4a'];
const AUTUMN = ['#ffb347', '#ff7a6b', '#ffd23f'];
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _p = new THREE.Vector3(), _c = new THREE.Color();

/** Mountain ranges with snow caps, forests and wind farms. */
export class Nature {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    this.mountains = planet.railway.mountain ? [planet.railway.mountain] : [];
    this.turbines = [];
    this.placeMountains();
    this.placeWindFarms();
    this.buildMountains();
    this.buildTrees();
    this.buildTurbines();
  }

  addMountain(d, s, hgt) {
    const p = this.planet;
    if (p.heightAt(d) < 0.15 || p.roads.near(d, (s + 0.3) / R) || p.railway.near(d, (s + 0.25) / R)) return false;
    if (p.cities.sites.some((o) => o.c.angleTo(d) < CITY_A + (s + 0.2) / R) || p.isReserved(d, s / R)) return false;
    if (this.mountains.some((m) => m.d.angleTo(d) < ((s + m.s) * 0.6) / R)) return false;
    const base = p.surfR(d) - 0.3;
    this.mountains.push({ d, s, base, hgt: Math.min(hgt + 0.1, R + 2.2 - base) });
    return true;
  }

  placeMountains() {
    const p = this.planet, rng = p.rng;
    for (let tries = 0, peaks = 0; peaks < 14 && tries < 8000; tries++) {
      const d = rng.dir();
      if (p.heightAt(d) < 0.42) continue;
      const s = rng.range(0.6, 0.9);
      if (!this.addMountain(d, s, s * rng.range(1.4, 1.8))) continue;
      peaks++;
      const [u, v] = tangentBasis(d);
      for (let k = 0; k < 3; k++) {
        const a = rng.range(0, TAU), off = rng.range(0.07, 0.1), s2 = s * rng.range(0.5, 0.75);
        this.addMountain(d.clone().addScaledVector(u, Math.cos(a) * off).addScaledVector(v, Math.sin(a) * off).normalize(), s2, s2 * rng.range(1.3, 1.7));
      }
    }
  }

  badSpot(d, pad) {
    const p = this.planet;
    return p.roads.near(d, 0.03 + pad) || p.railway.near(d, 0.025 + pad) || p.isReserved(d, pad)
      || p.cities.sites.some((o) => o.c.angleTo(d) < CITY_A + 0.05 + pad)
      || this.mountains.some((m) => m.d.angleTo(d) < m.s / R + 0.03 + pad);
  }

  placeWindFarms() {
    const p = this.planet, rng = p.rng;
    for (let farms = 0, tries = 0; farms < 3 && tries < 3000; tries++) {
      const c = rng.dir(), h = p.heightAt(c);
      if (h < 0.08 || h > 0.45 || this.badSpot(c, 0.1)) continue;
      const [u, v] = tangentBasis(c), wind = rng.dir(), before = this.turbines.length;
      for (let k = 0; k < 6; k++) {
        const d = c.clone().addScaledVector(u, ((k % 3) - 1) * 0.038).addScaledVector(v, (Math.floor(k / 3) - 0.5) * 0.045).normalize();
        const hh = p.heightAt(d);
        if (hh < 0.06 || hh > 0.6 || this.badSpot(d, 0.02)) continue;
        this.turbines.push({ d, wind, spin: rng.range(0, TAU), speed: rng.range(1.4, 2.4) });
      }
      if (this.turbines.length - before >= 3) { p.reserve(c, 0.1); farms++; }
      else this.turbines.length = before;
    }
  }

  buildMountains() {
    const p = this.planet, rng = p.rng, n = this.mountains.length;
    const body = addInstanced(p.root, new THREE.ConeGeometry(1, 1, 7, 1).translate(0, 0.5, 0), toon('#ffffff', { flatShading: true }), n, 0.04);
    const cap = addInstanced(p.root, new THREE.ConeGeometry(0.41, 0.39, 7, 1).translate(0, 0.815, 0), toon('#ffffff', { flatShading: true }), n, 0.03);
    shareMatrices(body, cap);
    this.mountains.forEach((m, i) => {
      body.setMatrixAt(i, frame(_m, _p.copy(m.d).multiplyScalar(m.base), m.d, rng.dir(), m.s, m.hgt, m.s));
      body.setColorAt(i, _c.set(rng.pick(ROCK)));
    });
  }

  buildTrees() {
    const p = this.planet, rng = p.rng, root = p.root, pines = [], rounds = [];
    const cosCity = Math.cos(CITY_A * 1.15);
    for (let tries = 0; pines.length + rounds.length < 900 && tries < 30000; tries++) {
      const d = rng.dir(), h = p.heightAt(d);
      if (h < 0.08 || h > 1.05) continue;
      if (p.hf.perlin(d.x * 4 + 9, d.y * 4 + 2, d.z * 4 + 5) < -0.05 && !rng.chance(0.12)) continue; // forest patches
      if (p.roads.near(d, (ROAD_W / 2 + 0.06) / R) || p.railway.near(d, 0.012) || p.isReserved(d)) continue;
      if (p.cities.sites.some((o) => o.c.dot(d) > cosCity)) continue;
      if (this.mountains.some((m) => m.d.angleTo(d) < (m.s * 0.95) / R)) continue;
      (h > 0.5 || rng.chance(0.3) ? pines : rounds).push({ d, s: rng.range(0.8, 1.35) });
    }
    const trunkGeo = new THREE.CylinderGeometry(0.022, 0.032, 0.2, 6).translate(0, 0.1, 0);
    const pineGeo = mergeGeometries([
      new THREE.ConeGeometry(0.13, 0.26, 7).translate(0, 0.27, 0),
      new THREE.ConeGeometry(0.095, 0.2, 7).translate(0, 0.42, 0),
    ]);
    const roundGeo = new THREE.IcosahedronGeometry(0.135, 1).translate(0, 0.3, 0);
    const trunks = addInstanced(root, trunkGeo, toon('#8a5a3c'), pines.length + rounds.length, 0.005);
    const pineMesh = addInstanced(root, pineGeo, toon('#ffffff', { flatShading: true }), pines.length, 0.01);
    const roundMesh = addInstanced(root, roundGeo, toon('#ffffff', { flatShading: true }), rounds.length, 0.01);
    const plant = (t, mesh, i, j, cols) => {
      frame(_m, _p.copy(t.d).multiplyScalar(p.surfR(t.d) - 0.05), t.d, rng.dir(), t.s, t.s * rng.range(0.9, 1.2), t.s);
      trunks.setMatrixAt(j, _m);
      mesh.setMatrixAt(i, _m);
      mesh.setColorAt(i, _c.set(rng.pick(cols)));
    };
    pines.forEach((t, i) => plant(t, pineMesh, i, i, PINE));
    rounds.forEach((t, i) => plant(t, roundMesh, i, pines.length + i, rng.chance(0.1) ? AUTUMN : LEAFY));
  }

  buildTurbines() {
    const n = this.turbines.length, p = this.planet;
    if (!n) return;
    const tower = mergeGeometries([
      new THREE.CylinderGeometry(0.011, 0.02, 0.6, 8).translate(0, 0.3, 0),
      new THREE.BoxGeometry(0.036, 0.036, 0.075).translate(0, 0.6, -0.01),
    ]);
    const blades = mergeGeometries([
      ...[0, 1, 2].map((k) => new THREE.BoxGeometry(0.024, 0.25, 0.006).translate(0, 0.13, 0).rotateZ((k * TAU) / 3)),
      new THREE.SphereGeometry(0.018, 10, 8),
    ]).translate(0, 0, 0.035);
    const towers = addInstanced(p.root, tower, toon('#f4f1ff'), n, 0.008);
    this.blades = addInstanced(p.root, blades, toon('#ffffff'), n, 0.006);
    this.turbines.forEach((t, i) => {
      frame(_m, _p.copy(t.d).multiplyScalar(p.surfR(t.d) - 0.04), t.d, t.wind, 1.35);
      towers.setMatrixAt(i, _m);
      t.hub = _m.clone().multiply(_r.makeTranslation(0, 0.6, 0));
    });
    this.update(0);
  }

  update(dt) {
    if (!this.blades) return;
    this.turbines.forEach((t, i) => {
      t.spin += t.speed * dt;
      this.blades.setMatrixAt(i, _m.multiplyMatrices(t.hub, _r.makeRotationZ(t.spin)));
    });
    this.blades.instanceMatrix.needsUpdate = true;
  }
}
