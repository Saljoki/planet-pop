import * as THREE from 'three';
import { TAU, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced } from '../render/Outline.js';
import { CITY_A } from './Cities.js';

const AROUND = 5, COLORS = ['#ffffff', '#ff9fb1', '#9fd8ff', '#ffd57a', '#d4b8ff', '#a8f0cf'];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
const _c = new THREE.Color(), _quat = new THREE.Quaternion(), _s = new THREE.Vector3();

/**
 * Venus's towns float on rafts in the clouds (planet.world.floating): a ring of big balloons round the edge of each
 * town's raft, and the spaceport's, holds it up on tethers, bobbing gently.
 */
export class Rafts {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    this.list = [];
    if (!planet.world?.floating) return;
    const rafts = [...planet.cities.sites.map((s) => ({ c: s.c, a: CITY_A * 1.12, n: AROUND })),
      ...(planet.padSite ? [{ c: planet.padSite.d, a: 0.075, n: 3 }] : [])];
    for (const raft of rafts) {
      const [u, v] = tangentBasis(raft.c);
      for (let k = 0; k < raft.n; k++) {
        const ang = (k / raft.n) * TAU + 0.3, d = raft.c.clone().addScaledVector(u, Math.cos(ang) * Math.tan(raft.a)).addScaledVector(v, Math.sin(ang) * Math.tan(raft.a)).normalize();
        const foot = planet.meshR(d);
        this.list.push({ d, foot, top: foot + 1.9 + (k % 2) * 0.3, size: raft.n === AROUND ? 0.26 : 0.2, ph: k * 1.7 + raft.c.x * 9 });
      }
    }
    const n = this.list.length, root = planet.root;
    this.env = addInstanced(root, new THREE.SphereGeometry(1, 18, 12).scale(1, 1.1, 1), toon('#ffffff'), n, 0.012, { cast: false });
    this.rope = addInstanced(root, new THREE.CylinderGeometry(0.006, 0.006, 1, 5).translate(0, 0.5, 0), toon('#4b4566'), n, 0, { cast: false });
    this.list.forEach((b, i) => this.env.setColorAt(i, _c.set(COLORS[i % COLORS.length])));
    this.update(0, 0);
  }

  update(dt, t) {
    if (!this.list.length) return;
    this.list.forEach((b, i) => {
      const top = b.top + Math.sin(t * 0.6 + b.ph) * 0.06;
      _p.copy(b.d).multiplyScalar(top);
      _m.compose(_p, _quat.setFromUnitVectors(_y, b.d), _s.setScalar(b.size));
      this.env.setMatrixAt(i, _m);
      _q.copy(b.d).multiplyScalar(b.foot);
      frame(_m, _q, b.d, tangentBasis(b.d)[0], 1, top - b.size * 0.9 - b.foot, 1);
      this.rope.setMatrixAt(i, _m);
    });
    this.env.instanceMatrix.needsUpdate = true;
    this.rope.instanceMatrix.needsUpdate = true;
  }
}
