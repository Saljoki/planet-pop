import * as THREE from 'three';
import { R, TAU, clamp, frameFwd, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';

const FLOCKS = 3, PER = 14;
const NAMES = ['Seagull Squad', 'The Honkers', 'Feather Gang'];
const _sep = new THREE.Vector3(), _ali = new THREE.Vector3(), _coh = new THREE.Vector3(), _acc = new THREE.Vector3();
const _d = new THREE.Vector3(), _up = new THREE.Vector3(), _m = new THREE.Matrix4(), _w = new THREE.Matrix4(), _rot = new THREE.Matrix4();

/** Boid flocks wandering the globe, hugging the terrain with flapping wings. */
export class Birds {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng, root = planet.root;
    this.flocks = [];
    this.birds = [];
    for (let f = 0; f < FLOCKS; f++) {
      const c = rng.dir(), axis = new THREE.Vector3().crossVectors(c, rng.dir()).normalize();
      const flock = { target: c.clone(), axis, turn: rng.range(-0.3, 0.3), speed: rng.range(0.05, 0.065), name: NAMES[f] };
      this.flocks.push(flock);
      const [u, v] = tangentBasis(c), heading = new THREE.Vector3().crossVectors(axis, c);
      for (let k = 0; k < PER; k++) {
        const d = c.clone().addScaledVector(u, rng.range(-0.04, 0.04)).addScaledVector(v, rng.range(-0.04, 0.04)).normalize();
        this.birds.push({ flock, pos: d.multiplyScalar(planet.groundR(d) + 1.3), vel: heading.clone().multiplyScalar(0.6), flap: rng.range(0, TAU), rate: rng.range(9, 12) });
      }
    }
    const n = this.birds.length, wing = toon('#f4f1ff', { flatShading: true });
    this.body = addInstanced(root, new THREE.SphereGeometry(0.022, 8, 6).scale(0.8, 0.7, 2.2), toon('#ffffff'), n, 0.004);
    this.wingR = addInstanced(root, new THREE.BoxGeometry(0.11, 0.006, 0.045).translate(0.055, 0, 0), wing, n, 0.003);
    this.wingL = addInstanced(root, new THREE.BoxGeometry(0.11, 0.006, 0.045).translate(-0.055, 0, 0), wing, n, 0.003);
    this.entities = this.birds.map((b, i) => new InstanceEntity(this.body, i, 'bird', b.flock.name));
  }

  update(dt) {
    for (const f of this.flocks) {
      f.target.applyAxisAngle(f.axis, f.speed * dt);
      f.axis.applyAxisAngle(f.target, f.turn * dt * 0.2).normalize(); // slow meander
    }
    if (dt > 0) for (const b of this.birds) this.steer(b, dt);
    this.writeMatrices();
  }

  steer(b, dt) {
    const f = b.flock;
    _sep.set(0, 0, 0); _ali.set(0, 0, 0); _coh.set(0, 0, 0);
    let cnt = 0;
    for (const o of this.birds) {
      if (o === b || o.flock !== f) continue;
      _d.subVectors(o.pos, b.pos);
      const dist = _d.length();
      if (dist > 0.9) continue;
      cnt++;
      _ali.add(o.vel);
      _coh.add(o.pos);
      if (dist < 0.22) _sep.addScaledVector(_d, -1 / Math.max(dist * dist, 0.01));
    }
    _acc.set(0, 0, 0);
    if (cnt) {
      _acc.add(_ali.divideScalar(cnt).sub(b.vel).multiplyScalar(1.2));
      _acc.add(_coh.divideScalar(cnt).sub(b.pos).multiplyScalar(0.6));
    }
    _acc.addScaledVector(_sep, 0.05);
    _acc.addScaledVector(_d.copy(f.target).multiplyScalar(b.pos.length()).sub(b.pos), 0.5); // follow the flock's goal
    b.vel.addScaledVector(_acc, dt);

    _up.copy(b.pos).normalize();
    b.vel.addScaledVector(_up, -b.vel.dot(_up)); // stay tangent
    const sp = b.vel.length() || 1;
    b.vel.multiplyScalar(clamp(sp, 0.45, 0.85) / sp);
    b.pos.addScaledVector(b.vel, dt);

    const want = Math.max(R + 1.3, this.planet.groundR(_up) + 0.6);
    const r = b.pos.length();
    b.pos.multiplyScalar((r + (want - r) * Math.min(1, dt * 1.5)) / r);
    b.flap += b.rate * dt;
  }

  writeMatrices() {
    this.birds.forEach((b, i) => {
      frameFwd(_m, b.pos, _up.copy(b.pos).normalize(), b.vel);
      this.body.setMatrixAt(i, _m);
      const flap = Math.sin(b.flap) * 0.6;
      this.wingR.setMatrixAt(i, _w.multiplyMatrices(_m, _rot.makeRotationZ(flap)));
      this.wingL.setMatrixAt(i, _w.multiplyMatrices(_m, _rot.makeRotationZ(-flap)));
    });
    for (const m of [this.body, this.wingL, this.wingR]) m.instanceMatrix.needsUpdate = true;
  }
}
