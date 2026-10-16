import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frame, canvasTexture } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/InstanceEntity.js';
import { nightGlowMaterial } from '../world/Glow.js';

const COLS = ['#ff4d6d', '#ffd23f', '#3fa7ff', '#8f5cff', '#2ee59d', '#ff8c42'];
const NAMES = ['Lofty Lou', 'Puffball', 'Big Bertha', 'Cloud Hopper', 'Up-Up', 'Breezy'];
const AIRSHIPS = ['Sky Whale', 'Cloud Nine', 'Big Puff', 'Drifter', 'Lazy Susan', 'Zeppo', 'Hum-Hum', 'Floaty McFloat'];
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Striped hot-air balloons drifting over the land, climbing over hills and skylines; or, where the theme says
 * `balloons: 'blimp'` (Venus), airships cruising over the clouds, nose first.
 */
export class Balloons {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.list = [];
    const blimp = (this.blimp = planet.theme.balloons === 'blimp');
    for (let tries = 0; this.list.length < (planet.theme.air ? 0 : blimp ? 8 : 6) && tries < 4000; tries++) { // (balloons need air)
      const d = rng.dir();
      if ((!blimp && planet.heightAt(d) < 0.1) || this.list.some((b) => b.d0.angleTo(d) < 0.5)) continue;
      this.list.push({
        d0: d, d: d.clone(), axis: new THREE.Vector3().crossVectors(d, rng.dir()).normalize(),
        drift: rng.range(-0.012, 0.012) * (blimp ? 2.5 : 1), fwd: rng.dir(), lift: rng.range(1.0, 1.5),
        alt: planet.groundR(d) + 1.2, ph: rng.range(0, TAU),
      });
    }
    const n = this.list.length;
    const stripes = canvasTexture(64, 4, (g) => {
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#c8c8d8'; g.fillRect(i * 8, 0, 8, 4); }
    });
    const env = blimp ? new THREE.SphereGeometry(0.17, 20, 12).scale(0.8, 0.75, 1.9).translate(0, 0.3, 0)
      : new THREE.SphereGeometry(0.17, 16, 12).scale(1, 1.15, 1).translate(0, 0.32, 0);
    this.env = addInstanced(root, env, toon('#ffffff', { map: stripes }), n, 0.008);
    const basket = addInstanced(root, blimp ? mergeGeometries([ // a cabin underneath and fins at the tail
      new THREE.BoxGeometry(0.06, 0.04, 0.12).translate(0, 0.14, 0.02),
      new THREE.BoxGeometry(0.008, 0.11, 0.09).translate(0, 0.3, -0.3),
      new THREE.BoxGeometry(0.17, 0.008, 0.09).translate(0, 0.3, -0.3),
    ]) : mergeGeometries([
      new THREE.BoxGeometry(0.07, 0.06, 0.07).translate(0, 0.03, 0),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, z]) => new THREE.CylinderGeometry(0.004, 0.004, 0.09, 4).translate(x * 0.03, 0.105, z * 0.03)),
    ]), toon(blimp ? '#4b4566' : '#a86b3c'), n, 0.004);
    const flame = addInstanced(root, blimp ? new THREE.SphereGeometry(0.012, 8, 6).translate(0, 0.13, 0.09) : new THREE.ConeGeometry(0.016, 0.04, 8).translate(0, 0.1, 0),
      nightGlowMaterial('#ff9a3c', blimp ? '#ff3b3b' : '#ffd23f'), n, 0, { cast: false });
    shareMatrices(this.env, basket, flame);
    this.list.forEach((_, i) => this.env.setColorAt(i, _c.set(COLS[i % COLS.length])));
    this.entities = this.list.map((_, i) => new InstanceEntity(this.env, i, 'balloon', blimp ? `${AIRSHIPS[i % AIRSHIPS.length]} the airship` : NAMES[i % NAMES.length]));
  }

  update(dt, t) {
    const p = this.planet;
    this.list.forEach((b, i) => {
      b.d.copy(b.d0).applyAxisAngle(b.axis, b.drift * t);
      const target = Math.max(R + 1.6, p.groundR(b.d) + b.lift);
      b.alt += (target - b.alt) * Math.min(1, dt * 0.5);
      _p.copy(b.d).multiplyScalar(b.alt + Math.sin(t * 0.7 + b.ph) * 0.12);
      const fwd = this.blimp ? _f.crossVectors(b.axis, b.d).multiplyScalar(Math.sign(b.drift) || 1) : b.fwd; // (an airship flies nose first)
      this.env.setMatrixAt(i, frame(_m, _p, b.d, fwd, 1.6));
    });
    this.env.instanceMatrix.needsUpdate = true;
  }
}
