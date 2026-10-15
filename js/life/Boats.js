import * as THREE from 'three';
import { R, TAU, frameFwd, tangentBasis, smallCircle } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { Trails } from './Trails.js';

const HULLS = ['#ff4d4d', '#3fa7ff', '#ffd23f', '#2ee59d'];
const NAMES = ['S.S. Splash', 'Wave Rider', 'Captain Bob', 'Bubbles', 'Salty Biscuit', 'Seaweed Express', 'Tug Life'];
const BOATS = 7, DOCK_WAIT = 4;
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _up = new THREE.Vector3(), _f = new THREE.Vector3();
const _vel = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Little steamers leaving foamy wakes and smoke puffs. Ferries loop out from a harbour and tie up at
 * its pier head for a few seconds every lap; the rest circle the open sea.
 */
export class Boats {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.boats = (planet.harbours?.list || []).map((h) => ({
      ...h.loop, harbour: h, phi: rng.range(0.6, TAU - 0.6), w: rng.range(0.3, 0.4), wait: 0, wakeT: 0, smokeT: 0,
    }));
    const fleet = planet.theme.sea.boats ? BOATS : 0;
    for (let tries = 0; this.boats.length < fleet && tries < 5000; tries++) {
      const c = rng.dir();
      if (planet.heightAt(c) > -0.25 || this.boats.some((b) => b.c.angleTo(c) < 0.35)) continue;
      const [u, v] = tangentBasis(c), A = rng.range(0.05, 0.08);
      let ok = true;
      for (let k = 0; k < 16 && ok; k++) ok = planet.heightAt(smallCircle(_p, c, u, v, A, (k / 16) * TAU)) < -0.1;
      if (ok) this.boats.push({ c, u, v, A, phi: rng.range(0, TAU), w: rng.range(0.18, 0.3) * (rng.chance(0.5) ? 1 : -1), wait: 0, wakeT: 0, smokeT: 0 });
    }
    const n = this.boats.length;
    this.hull = addInstanced(root, new THREE.BoxGeometry(0.085, 0.045, 0.18), toon('#ffffff'), n, 0.006);
    const cabin = addInstanced(root, new THREE.BoxGeometry(0.06, 0.045, 0.065).translate(0, 0.045, -0.02), toon('#ffffff'), n, 0.005, { detail: 8 });
    const funnel = addInstanced(root, new THREE.CylinderGeometry(0.013, 0.013, 0.045, 8).translate(0, 0.09, -0.03), toon('#ff8c42'), n, 0, { detail: 8 });
    shareMatrices(this.hull, cabin, funnel);
    this.boats.forEach((_, i) => this.hull.setColorAt(i, _c.set(HULLS[i % HULLS.length])));
    this.wake = new Trails(root, { max: 220, color: '#ffffff', life: 1.6, grow: 2.4, drag: 2 });
    this.smoke = new Trails(root, { max: 120, color: '#c9c2dd', life: 1.8, grow: 2.2 });
    this.entities = this.boats.map((b, i) => new InstanceEntity(this.hull, i, 'boat', b.harbour ? `${b.harbour.city.name} Ferry` : NAMES[i % NAMES.length]));
  }

  /** True while a ferry is tied up at its pier. */
  isDocked(id) { return this.boats[id]?.wait > 0; }

  update(dt, t) {
    this.boats.forEach((b, i) => {
      const moving = b.wait <= 0;
      if (!moving) {
        if ((b.wait -= dt) <= 0) this.depart(b);
      } else {
        const before = b.phi;
        b.phi += b.w * dt;
        if (b.harbour && Math.floor(b.phi / TAU) > Math.floor(before / TAU)) { b.phi = Math.round(b.phi / TAU) * TAU; b.wait = DOCK_WAIT; }
      }
      const cp = Math.cos(b.phi), sp = Math.sin(b.phi);
      smallCircle(_p, b.c, b.u, b.v, b.A, b.phi);
      _f.copy(b.u).multiplyScalar(-sp).addScaledVector(b.v, cp).multiplyScalar(Math.sign(b.w));
      _up.copy(_p).applyAxisAngle(_f, Math.sin(t * 2.2 + i) * (moving ? 0.08 : 0.04)); // rocking
      frameFwd(_m, _p.multiplyScalar(R), _up, _f);
      this.hull.setMatrixAt(i, _m);
      if (!moving) return; // engines off at the pier
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

  /** Casting off: a toot if the camera is close enough to hear it. */
  depart(b) {
    const app = this.planet.app;
    smallCircle(_q, b.c, b.u, b.v, b.A, b.phi).multiplyScalar(R + 0.2);
    if (app.camera.position.distanceTo(_q) < 5) app.sfx?.pop(_q.clone(), 'TOOT TOOT!', '#2ee59d');
  }
}
