import * as THREE from 'three';
import { R, mod, TAU, clamp } from '../core/Geo.js';
import { LANE } from '../world/Roads.js';
import { Car } from './vehicles/Car.js';
import { RIVAL } from './Rival.js';

const SPEED = 0.99;   // units/s on the highway, a whisker under a stock car's top speed
const LOOK = 0.45;    // how far ahead (units) Rex looks for traffic
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _v = new THREE.Vector3();

/**
 * Rival Rex in a car, for the race: he keeps to the highway, keeps left, pulls out to overtake traffic (when the
 * other lane is clear), and runs red lights. He eases off when he's far ahead and pushes on when he's far behind,
 * so it stays a race. `dist` is how far round he's got (units).
 */
export class RoadRival {
  constructor(planet, road, a, dir, { tag, toScreen }) {
    Object.assign(this, { planet, road, a, dir, tag, toScreen, dist: 0, v: 0, lat: -dir * LANE, wantLat: dir * LANE, running: false });
    this.car = new Car(planet, planet.roads.dir(road, a, new THREE.Vector3()), new THREE.Vector3(1, 0, 0), { speed: 1, turn: 1, drain: 0, regen: 0 },
      { body: RIVAL.skin.body, trim: RIVAL.skin.trim });
    this.place(0);
    tag.classList.remove('hidden');
  }

  get pos() { return this.car.pos; }

  /** Traffic in lane `lat` within LOOK ahead of Rex (or coming the other way in it), if any. */
  blocked(lat) {
    for (const c of this.planet.traffic?.cars || []) {
      if (c.road !== this.road || c.taken || Math.abs(c.lane * LANE - lat) > LANE) continue;
      const ahead = mod((c.a - this.a) * this.dir, TAU) * R;
      if (ahead < LOOK) return c;
    }
    return null;
  }

  /** One step: `lead` is how far ahead of the player he is (units). */
  update(dt, lead) {
    if (!this.running) { this.place(dt); return; }
    const keepLeft = this.dir * LANE, overtake = -keepLeft, other = this.wantLat === keepLeft ? overtake : keepLeft;
    if (this.blocked(this.wantLat) && !this.blocked(other)) this.wantLat = other; // pull out round traffic (or back in)
    else if (this.wantLat === overtake && !this.blocked(keepLeft)) this.wantLat = keepLeft; // back into his own lane
    const stuck = this.blocked(this.wantLat);
    const target = (stuck ? Math.abs(stuck.v) * R * 0.95 : SPEED) * clamp(1 - lead * 0.04, 0.85, 1.15);
    this.v += clamp(target - this.v, -1.5 * dt, 0.8 * dt);
    this.lat += clamp(this.wantLat - this.lat, -0.25 * dt, 0.25 * dt);
    const rad = this.planet.roads.radius(this.road, this.a);
    this.a += (this.dir * this.v * dt) / rad;
    this.dist += this.v * dt;
    this.place(dt);
  }

  /** Put the car where he is on the road, facing along it. */
  place(dt) {
    const roads = this.planet.roads, car = this.car;
    roads.point(this.road, this.a, this.lat, _p);
    car.alt = _p.length();
    car.up.copy(_p).normalize();
    roads.tangent(this.road, this.a, _f).multiplyScalar(this.dir);
    car.fwd.copy(_f).addScaledVector(car.up, -_f.dot(car.up)).normalize();
    car.spin += (this.v * dt) / 0.024;
    for (const w of car.wheels) w.rotation.x = car.spin;
    car.sync();
    this.placeTag();
  }

  placeTag() {
    const s = this.toScreen(_v.copy(this.car.up).multiplyScalar(this.car.alt + 0.18));
    this.tag.classList.toggle('hidden', !s);
    if (!s) return;
    this.tag.style.left = `${s.x}px`;
    this.tag.style.top = `${s.y}px`;
  }

  dispose() {
    this.car.dispose();
    this.tag.classList.add('hidden');
  }
}
