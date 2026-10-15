import * as THREE from 'three';
import { R, frameFwd } from '../../core/Geo.js';
import { toon } from '../../render/Toon.js';
import { addMesh } from '../../render/Outline.js';
import { Trails } from '../../life/Trails.js';
import { GroundVehicle } from './GroundVehicle.js';

const HANDLING = { max: 0.8, accel: 0.45, brake: 0.9, coast: 0.22, reverse: 0.25, turn: 1.4, boost: 1.5 };
const _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _v = new THREE.Vector3();

/** A little steamer you steer: open water only (the shore is a wall), rocking on the waves with a foamy wake. */
export class Boat extends GroundVehicle {
  constructor(planet, at, heading, stats, { body = '#3fa7ff', trim = '#ffffff' } = {}) {
    super(planet, at, heading, stats);
    this.lean = 0;
    const g = this.group;
    addMesh(g, new THREE.BoxGeometry(0.1, 0.05, 0.2).translate(0, 0.012, -0.01), toon(body), 0.008);
    addMesh(g, new THREE.CylinderGeometry(0.05, 0.05, 0.05, 3).rotateY(Math.PI / 2).scale(1, 1, 0.9).translate(0, 0.012, 0.1), toon(body), 0.006); // the bow
    addMesh(g, new THREE.BoxGeometry(0.07, 0.05, 0.075).translate(0, 0.062, -0.03), toon(trim), 0.006);
    addMesh(g, new THREE.BoxGeometry(0.074, 0.012, 0.08).translate(0, 0.092, -0.03), toon('#ff4d4d'), 0.004);
    addMesh(g, new THREE.CylinderGeometry(0.015, 0.015, 0.05, 10).translate(0, 0.11, -0.05), toon('#ff8c42'), 0.004);
    this.wake = new Trails(planet.root, { max: 160, color: '#ffffff', life: 1.6, grow: 2.6, drag: 2, near: 0.25 });
    this.puffs = new Trails(planet.root, { max: 60, color: '#c9c2dd', life: 1.6, grow: 2.2, near: 0.25 });
    this.wakeT = 0;
    this.puffT = 0;
    this.sync();
  }

  get kind() { return 'boat'; }

  get nose() { return 0.11; }

  get chase() { return { back: 0.75, up: 0.3, ahead: 0.6 }; }

  limits() { return HANDLING; }

  blocked(d) { return this.ground.boatBlock(d); }

  surfaceR() { return R + 0.004; }

  update(dt) {
    this.t += dt;
    this.drive(dt);
    if (this.crashed) this.impact *= 0.6; // running aground is softer than hitting a wall
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.lean += (-this.turnInput() * Math.min(1, Math.abs(this.v) / 0.5) * 0.12 - this.lean) * Math.min(1, dt * 3);
    this.sync();
    const fast = Math.abs(this.v) > 0.08;
    if (fast && (this.wakeT -= dt) <= 0) {
      this.wakeT = 0.07;
      this.wake.emit(_p.set((Math.random() - 0.5) * 0.06, 0, -0.11 * Math.sign(this.v)).applyMatrix4(_m), 0.025);
    }
    if ((this.puffT -= dt) <= 0) {
      this.puffT = fast ? 0.2 : 0.45;
      this.puffs.emit(_p.set(0, 0.14, -0.05).applyMatrix4(_m), 0.018, _v.copy(this.up).multiplyScalar(0.15));
    }
    this.wake.update(dt);
    this.puffs.update(dt);
    this.smokeStep(dt, _p.set(0, 0.08, 0).applyMatrix4(_m));
  }

  sync() {
    this.alt = this.surfaceR();
    this.pos.copy(this.up).multiplyScalar(this.alt);
    const t = this.t, rock = Math.sin(t * 2.2) * 0.06 + this.lean, pitch = Math.sin(t * 1.7) * 0.04 + Math.max(0, this.v) * 0.06;
    _f.copy(this.fwd).multiplyScalar(Math.cos(pitch)).addScaledVector(this.up, Math.sin(pitch));
    _u.copy(this.up).applyAxisAngle(this.fwd, rock);
    frameFwd(_m, this.pos, _u, _f);
    this.group.position.copy(this.pos);
    this.group.quaternion.setFromRotationMatrix(_m);
  }

  extraMeshes() { return [this.wake.mesh, this.puffs.mesh]; }
}
