import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, mod, clamp, frameFwd } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { LANE } from '../world/Roads.js';
import { nightGlowMaterial } from '../world/Glow.js';

export const MAX_PER_LANE = 10;
const COLORS = ['#ff4d4d', '#ffd23f', '#3fa7ff', '#ff8c42', '#8f5cff', '#2ee59d', '#ff5fa2', '#ffffff'];
const NAMES = ['Zippy', 'Vroomer', 'Beep-Beep', 'Turbo', 'Putt-Putt', 'Honkers', 'Skiddy', 'Rusty', 'Speedy', 'Bumper'];
const MIN_GAP = 0.026, ACCEL = 0.05, BRAKE = 0.16, LOOK = 0.14; // radians, rad/s²
const _p = new THREE.Vector3(), _p2 = new THREE.Vector3(), _up = new THREE.Vector3(), _f = new THREE.Vector3();
const _m = new THREE.Matrix4(), _c = new THREE.Color();

/** Cars that keep their distance, queue at red lights and switch their lights on at night. */
export class Traffic {
  constructor(planet) {
    this.planet = planet;
    const root = planet.root, cap = planet.roads.list.length * 2 * MAX_PER_LANE;
    const lamps = (z) => mergeGeometries([-1, 1].map((sx) => new THREE.BoxGeometry(0.018, 0.012, 0.006).translate(sx * 0.026, 0.045, z)));
    this.body = addInstanced(root, new THREE.BoxGeometry(0.08, 0.036, 0.17).translate(0, 0.04, 0), toon('#ffffff'), cap, 0.006);
    const cab = addInstanced(root, new THREE.BoxGeometry(0.066, 0.032, 0.085).translate(0, 0.074, -0.012), toon('#cfeaff'), cap, 0.005, { detail: 7 });
    const wheels = addInstanced(root, mergeGeometries([[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) =>
      new THREE.CylinderGeometry(0.021, 0.021, 0.018, 10).rotateZ(Math.PI / 2).translate(sx * 0.038, 0.021, sz * 0.052))), toon('#2a2540'), cap, 0, { detail: 7 });
    const heads = addInstanced(root, lamps(0.086), nightGlowMaterial('#f2eefc', '#fff6b0'), cap, 0, { cast: false, detail: 7 });
    const tails = addInstanced(root, lamps(-0.086), nightGlowMaterial('#a83a4e', '#ff3b3b'), cap, 0, { cast: false, detail: 7 });
    shareMatrices(this.body, cab, wheels, heads, tails);
    this.parts = [this.body, cab, wheels, heads, tails];
    this.body.setColorAt(0, _c.set(COLORS[0])); // creates the colour buffer up front
    this.rebuild(planet.params.traffic);
  }

  rebuild(perLane) {
    const p = this.planet, rng = p.rng, rig = p.app.rig;
    if (rig && this.entities?.includes(rig.entity)) rig.release();
    const n = clamp(Math.round(perLane), 0, MAX_PER_LANE);
    this.cars = [];
    for (const road of p.roads.list) {
      for (const lane of [1, -1]) {
        const group = [], vmax = rng.range(0.06, 0.085), off = rng.range(0, TAU);
        for (let j = 0; j < n; j++) {
          group.push({ road, lane, a: off - lane * (j / n) * TAU + rng.range(-0.05, 0.05), v: vmax * 0.5, vmax: vmax * rng.range(0.9, 1.1), waiting: false, leader: null });
        }
        group.forEach((c, j) => (c.leader = n > 1 ? group[(j - 1 + n) % n] : null));
        this.cars.push(...group);
      }
    }
    this.cars.forEach((_, i) => this.body.setColorAt(i, _c.set(COLORS[i % COLORS.length])));
    this.body.instanceColor.needsUpdate = true;
    for (const m of this.parts) {
      m.count = this.cars.length;
      if (m.userData.outline) m.userData.outline.count = this.cars.length;
    }
    this.entities = this.cars.map((_, i) => new InstanceEntity(this.body, i, 'car', `${NAMES[i % NAMES.length]} the car`));
    this.update(0);
  }

  isWaiting(id) { return !!this.cars[id]?.waiting; }

  update(dt) {
    const roads = this.planet.roads;
    for (const c of this.cars) {
      const dir = c.lane;
      let room = c.leader ? mod((c.leader.a - c.a) * dir, TAU) - MIN_GAP : Infinity;
      const red = roads.redAhead(c.road, c.a, dir, LOOK);
      if (red >= 0) room = Math.min(room, red);
      const target = clamp(room * 1.4, 0, c.vmax);
      c.v += clamp(target - c.v, -BRAKE * dt, ACCEL * dt);
      if (room <= 0) c.v = 0;
      c.a += c.v * dir * dt;
      c.waiting = red >= 0 && red < 0.06 && c.v < 0.01;
    }
    this.cars.forEach((c, i) => {
      const lat = c.lane * LANE;
      roads.point(c.road, c.a, lat, _p);
      roads.point(c.road, c.a + c.lane * 0.004, lat, _p2);
      this.body.setMatrixAt(i, frameFwd(_m, _p, _up.copy(_p).normalize(), _f.subVectors(_p2, _p)));
    });
    this.body.instanceMatrix.needsUpdate = true;
  }
}
