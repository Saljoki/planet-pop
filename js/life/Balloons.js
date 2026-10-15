import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frame, canvasTexture } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/InstanceEntity.js';
import { nightGlowMaterial } from '../world/Glow.js';

const COLS = ['#ff4d6d', '#ffd23f', '#3fa7ff', '#8f5cff', '#2ee59d', '#ff8c42'];
const NAMES = ['Lofty Lou', 'Puffball', 'Big Bertha', 'Cloud Hopper', 'Up-Up', 'Breezy'];
const _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Striped hot-air balloons drifting over the land, climbing over hills and skylines. */
export class Balloons {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.list = [];
    for (let tries = 0; this.list.length < 6 && tries < 4000; tries++) {
      const d = rng.dir();
      if (planet.heightAt(d) < 0.1 || this.list.some((b) => b.d0.angleTo(d) < 0.5)) continue;
      this.list.push({
        d0: d, d: d.clone(), axis: new THREE.Vector3().crossVectors(d, rng.dir()).normalize(),
        drift: rng.range(-0.012, 0.012), fwd: rng.dir(), lift: rng.range(1.0, 1.5),
        alt: planet.groundR(d) + 1.2, ph: rng.range(0, TAU),
      });
    }
    const n = this.list.length;
    const stripes = canvasTexture(64, 4, (g) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c8c8d8'; g.fillRect(i * 8, 0, 8, 4); }
    });
    this.env = addInstanced(root, new THREE.SphereGeometry(0.17, 16, 12).scale(1, 1.15, 1).translate(0, 0.32, 0), toon('#ffffff', { map: stripes }), n, 0.008);
    const basket = addInstanced(root, mergeGeometries([
      new THREE.BoxGeometry(0.07, 0.06, 0.07).translate(0, 0.03, 0),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4).translate(x * 0.03, 0.105, z * 0.03)),
    ]), toon('#a86b3c'), n, 0.004);
    const flame = addInstanced(root, new THREE.ConeGeometry(0.016, 0.04, 8).translate(0, 0.1, 0), nightGlowMaterial('#ff9a3c', '#ffd23f'), n, 0, { cast: false });
    shareMatrices(this.env, basket, flame);
    this.list.forEach((_, i) => this.env.setColorAt(i, _c.set(COLS[i % COLS.length])));
    this.entities = this.list.map((_, i) => new InstanceEntity(this.env, i, 'balloon', NAMES[i % NAMES.length]));
  }

  update(dt, t) {
    const p = this.planet;
    this.list.forEach((b, i) => {
      b.d.copy(b.d0).applyAxisAngle(b.axis, b.drift * t);
      const target = Math.max(R + 1.6, p.groundR(b.d) + b.lift);
      b.alt += (target - b.alt) * Math.min(1, dt * 0.5);
      _p.copy(b.d).multiplyScalar(b.alt + Math.sin(t * 0.7 + b.ph) * 0.12);
      this.env.setMatrixAt(i, frame(_m, _p, b.d, b.fwd, 1.6));
    });
    this.env.instanceMatrix.needsUpdate = true;
  }
}
