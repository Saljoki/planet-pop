import * as THREE from 'three';
import { R, TAU, frameFwd, tangentBasis, smallCircle } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { Trails } from './Trails.js';

const HULLS = ['#ff4d4d', '#3fa7ff', '#ffd23f', '#2ee59d'];
const NAMES = ['S.S. Splash', 'Wave Rider', 'Captain Bob', 'Bubbles', 'Salty Biscuit', 'Seaweed Express', 'Tug Life'];
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _up = new THREE.Vector3(), _f = new THREE.Vector3();
const _vel = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Little steamers circling the sea, leaving foamy wakes and smoke puffs. */
export class Boats {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.boats = [];
    for (let tries = 0; this.boats.length < 7 && tries < 5000; tries++) {
      const c = rng.dir();
      if (planet.heightAt(c) > -0.25 || this.boats.some((b) => b.c.angleTo(c) < 0.35)) continue;
      const [u, v] = tangentBasis(c), A = rng.range(0.05, 0.08);
      let ok = true;
      for (let k = 0; k < 16 && ok; k++) ok = planet.heightAt(smallCircle(_p, c, u, v, A, (k / 16) * TAU)) < -0.1;
      if (ok) this.boats.push({ c, u, v, A, phi: rng.range(0, TAU), w: rng.range(0.18, 0.3) * (rng.chance(0.5) ? 1 : -1), wakeT: 0, smokeT: 0 });
    }
    const n = this.boats.length;
    this.hull = addInstanced(root, new THREE.BoxGeometry(0.085, 0.045, 0.18), toon('#ffffff'), n, 0.006);
    const cabin = addInstanced(root, new THREE.BoxGeometry(0.06, 0.045, 0.065).translate(0, 0.045, -0.02), toon('#ffffff'), n, 0.005);
    const funnel = addInstanced(root, new THREE.CylinderGeometry(0.013, 0.013, 0.045, 8).translate(0, 0.09, -0.03), toon('#ff8c42'), n);
    shareMatrices(this.hull, cabin, funnel);
    this.boats.forEach((_, i) => this.hull.setColorAt(i, _c.set(HULLS[i % HULLS.length])));
    this.wake = new Trails(root, { max: 220, color: '#ffffff', life: 1.6, grow: 2.4, drag: 2 });
    this.smoke = new Trails(root, { max: 120, color: '#c9c2dd', life: 1.8, grow: 2.2 });
    this.entities = this.boats.map((_, i) => new InstanceEntity(this.hull, i, 'boat', NAMES[i % NAMES.length]));
  }

  update(dt, t) {
    this.boats.forEach((b, i) => {
      b.phi += b.w * dt;
      const cp = Math.cos(b.phi), sp = Math.sin(b.phi);
      smallCircle(_p, b.c, b.u, b.v, b.A, b.phi);
      _f.copy(b.u).multiplyScalar(-sp).addScaledVector(b.v, cp).multiplyScalar(Math.sign(b.w));
      _up.copy(_p).applyAxisAngle(_f, Math.sin(t * 2.2 + i) * 0.08); // rocking
      frameFwd(_m, _p.multiplyScalar(R), _up, _f);
      this.hull.setMatrixAt(i, _m);
      if ((b.wakeT -= dt) <= 0) { b.wakeT = 0.12; this.wake.emit(_q.set(0, 0, -0.1).applyMatrix4(_m), 0.03); }
      if ((b.smokeT -= dt) <= 0) {
        b.smokeT = 0.25;
        this.smoke.emit(_q.set(0, 0.12, -0.03).applyMatrix4(_m), 0.02, _vel.copy(_p).normalize().multiplyScalar(0.15));
      }
    });
    this.hull.instanceMatrix.needsUpdate = true;
    this.wake.update(dt);
    this.smoke.update(dt);
  }
}
