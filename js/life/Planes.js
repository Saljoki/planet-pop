import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frameFwd, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { nightGlowMaterial } from '../world/Glow.js';
import { Trails } from './Trails.js';

const COLS = ['#ff4d6d', '#3fa7ff', '#ffd23f', '#8f5cff'];
const NAMES = ['Sky Bus', 'Captain Zoom', 'Jetty', 'Air Pop'];
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _up = new THREE.Vector3(), _f = new THREE.Vector3();
const _fn = new THREE.Vector3(), _q = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Airliners banking around the planet with contrails and red/green nav lights at night. */
export class Planes {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.list = COLS.map(() => {
      const n = rng.dir(), [u, v] = tangentBasis(n);
      return { u, v, a: rng.range(0, TAU), w: rng.range(0.1, 0.15), alt: R + rng.range(3.8, 4.4), ph: rng.range(0, TAU), trailT: 0 };
    });
    const n = this.list.length;
    this.body = addInstanced(root, new THREE.CapsuleGeometry(0.06, 0.34, 4, 10).rotateX(Math.PI / 2), toon('#ffffff'), n, 0.012);
    const accents = addInstanced(root, mergeGeometries([
      new THREE.BoxGeometry(0.66, 0.024, 0.13).translate(0, -0.01, 0.03),   // wings
      new THREE.BoxGeometry(0.024, 0.14, 0.1).translate(0, 0.09, -0.2),     // fin
      new THREE.BoxGeometry(0.25, 0.02, 0.07).translate(0, 0.02, -0.21),    // stabiliser
    ]), toon('#ffffff'), n, 0.01);
    const windows = addInstanced(root, new THREE.BoxGeometry(0.075, 0.035, 0.07).translate(0, 0.045, 0.17), toon('#2d2a5a'), n);
    const port = addInstanced(root, new THREE.SphereGeometry(0.018, 8, 6).translate(0.33, -0.01, 0.03), nightGlowMaterial('#9a4a5a', '#ff3b3b'), n, 0, { cast: false });
    const starboard = addInstanced(root, new THREE.SphereGeometry(0.018, 8, 6).translate(-0.33, -0.01, 0.03), nightGlowMaterial('#3f7a5a', '#3bff7a'), n, 0, { cast: false });
    shareMatrices(this.body, accents, windows, port, starboard);
    COLS.forEach((c, i) => accents.setColorAt(i, _c.set(c)));
    this.trail = new Trails(root, { max: 420, color: '#ffffff', life: 2.6, grow: 2.2, drag: 0.3 });
    this.entities = this.list.map((_, i) => new InstanceEntity(this.body, i, 'plane', NAMES[i]));
  }

  pos(pl, a, t, out) {
    out.copy(pl.u).multiplyScalar(Math.cos(a)).addScaledVector(pl.v, Math.sin(a));
    return out.multiplyScalar(pl.alt + Math.sin(t * 0.6 + pl.ph + a * 2) * 0.2);
  }

  update(dt, t) {
    this.list.forEach((pl, i) => {
      pl.a += pl.w * dt;
      this.pos(pl, pl.a, t, _p);
      this.pos(pl, pl.a + 0.01, t, _p2);
      _f.subVectors(_p2, _p);
      _fn.copy(_f).normalize();
      _up.copy(_p).normalize().applyAxisAngle(_fn, Math.sin(t * 0.8 + pl.ph) * 0.3); // banking
      frameFwd(_m, _p, _up, _f);
      this.body.setMatrixAt(i, _m);
      if ((pl.trailT -= dt) <= 0) { pl.trailT = 0.05; this.trail.emit(_q.set(0, 0.02, -0.27).applyMatrix4(_m), 0.035); }
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.trail.update(dt);
  }
}
