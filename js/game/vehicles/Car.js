import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, clamp, mod, frameFwd } from '../../core/Geo.js';
import { toon } from '../../render/Toon.js';
import { addMesh } from '../../render/Outline.js';
import { Trails } from '../../life/Trails.js';
import { LANE, ROAD_W } from '../../world/Roads.js';
import { nightGlowMaterial } from '../../world/Glow.js';
import { GroundVehicle } from './GroundVehicle.js';

/** Handling on each surface: top speed and acceleration (units/s, /s²), turn rate (rad/s at full grip). */
const HANDLING = {
  road: { max: 1.05, accel: 0.9, turn: 2.3 },
  grass: { max: 0.72, accel: 0.7, turn: 2.0 },
  sand: { max: 0.6, accel: 0.6, turn: 1.9 },
  snow: { max: 0.78, accel: 0.55, turn: 1.5 },
};
const COMMON = { brake: 2.4, coast: 0.45, reverse: 0.35, boost: 1.6 };
const G = 4;          // gravity, units/s²: cresting a hill at speed lifts the wheels for a moment
const LAND_HURT = 1.6; // landing faster than this (units/s down) is a crash
const WHEEL = 0.024;
const KINDS = { // body and trim colours unless given
  car: { body: '#ff4d4d', trim: '#ffffff' },
  van: { body: '#ffffff', trim: '#ff5fa2' },
  taxi: { body: '#ffd23f', trim: '#1b1530' },
};
const _m = new THREE.Matrix4(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();

/**
 * A car you drive: quickest on the highways, slower on grass, sand and snow, and slower still uphill. It hops over
 * crests, leans with the ground, slides along walls, and bumps into traffic (which waits behind it and honks).
 * kind: 'car', 'van' (a parcel on the roof) or 'taxi'.
 */
export class Car extends GroundVehicle {
  constructor(planet, at, heading, stats, { kind = 'car', body, trim } = {}) {
    super(planet, at, heading, stats);
    this.carKind = kind;
    this.vy = 0;
    this.airborne = false;
    this.pitch = 0;
    this.roll = 0;
    this.spin = 0; // wheel rotation
    this.honkT = 0;
    this.build(kind, { ...KINDS[kind], ...(body && { body }), ...(trim && { trim }) });
    this.dust = new Trails(planet.root, { max: 80, color: planet.theme.pal.sand, life: 0.9, grow: 2.5, drag: 1.5, near: 0.25 });
    this.dustT = 0;
    this.sync();
  }

  get kind() { return 'car'; }

  get nose() { return 0.1; }

  /** Low behind the car in the open; higher in town, so the buildings don't get in the way. */
  get chase() {
    return this.planet.cities.cityAt(this.up) ? { back: 0.55, up: 0.42, ahead: 0.35 } : { back: 0.62, up: 0.24, ahead: 0.55 };
  }

  limits() {
    const base = HANDLING[this.ground.surface(this.up)];
    // uphill slows it down, downhill speeds it up a little
    _p.copy(this.up).addScaledVector(this.fwd, 0.06 / this.alt).normalize();
    const slope = ((this.ground.carR(_p) - this.alt) / 0.06) * Math.sign(this.v || 1);
    return { ...COMMON, ...base, max: base.max * clamp(1 - slope * 0.7, 0.45, 1.25) };
  }

  blocked(d) { return this.ground.carBlock(d); }

  surfaceR(d) { return this.ground.carR(d); }

  respawn(at, heading) {
    super.respawn(at, heading);
    this.vy = 0;
    this.airborne = false;
    this.sync();
  }

  /** Paint the parcel on a van's roof (and the car itself for a parcel's colour, nothing else). */
  setCargo(cargo) {
    if (cargo && this.crateMat) this.crateMat.color.set(cargo.color);
  }

  build(kind, { body, trim }) {
    const g = this.group, bodyMat = toon(body), trimMat = toon(trim), glass = toon('#cfeaff'), ink = toon('#2a2540');
    if (kind === 'van') {
      addMesh(g, new THREE.BoxGeometry(0.094, 0.07, 0.2).translate(0, 0.064, -0.012), bodyMat, 0.009);
      addMesh(g, new THREE.BoxGeometry(0.09, 0.04, 0.05).translate(0, 0.05, 0.11), bodyMat, 0.007);
      addMesh(g, new THREE.BoxGeometry(0.08, 0.026, 0.012).translate(0, 0.078, 0.09), glass, 0.004);
      addMesh(g, new THREE.BoxGeometry(0.096, 0.016, 0.16).translate(0, 0.06, -0.02), trimMat, 0.004); // stripe
      this.crateMat = toon('#c98a4b');
      addMesh(g, new THREE.BoxGeometry(0.06, 0.04, 0.07).translate(0, 0.12, -0.04), this.crateMat, 0.005); // the parcel
    } else {
      addMesh(g, new THREE.BoxGeometry(0.092, 0.042, 0.196).translate(0, 0.046, 0), bodyMat, 0.009);
      addMesh(g, new THREE.BoxGeometry(0.076, 0.036, 0.098).translate(0, 0.084, -0.014), glass, 0.006);
      addMesh(g, new THREE.BoxGeometry(0.094, 0.012, 0.2).translate(0, 0.03, 0), trimMat, 0.004);
      if (kind === 'taxi') {
        addMesh(g, new THREE.BoxGeometry(0.04, 0.018, 0.022).translate(0, 0.112, -0.012), nightGlowMaterial('#fff6cf', '#ffd23f'), 0.004);
      }
    }
    this.wheels = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => {
      const w = addMesh(g, new THREE.CylinderGeometry(WHEEL, WHEEL, 0.02, 12).rotateZ(Math.PI / 2), ink, 0.004);
      w.position.set(sx * 0.047, WHEEL, sz * 0.062);
      return w;
    });
    const lamps = (z) => mergeGeometries([-1, 1].map((sx) => new THREE.BoxGeometry(0.02, 0.014, 0.006).translate(sx * 0.03, 0.05, z)));
    addMesh(g, lamps(0.1 + (kind === 'van' ? 0.037 : 0)), nightGlowMaterial('#f2eefc', '#fff6b0'), 0, { cast: false });
    addMesh(g, lamps(-0.1 - (kind === 'van' ? 0.012 : 0)), nightGlowMaterial('#a83a4e', '#ff3b3b'), 0, { cast: false });
  }

  update(dt) {
    this.t += dt;
    this.drive(dt);
    const crashed = this.crashed, impact = this.impact; // (from hitting a wall while driving)
    this.fall(dt);
    if (crashed) Object.assign(this, { crashed: true, impact: Math.max(impact, this.impact) });
    this.bumpTraffic();
    this.invuln = Math.max(0, this.invuln - dt);
    this.honkT = Math.max(0, this.honkT - dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.lean(dt);
    this.spin += (this.v * dt) / WHEEL;
    for (const w of this.wheels) w.rotation.x = this.spin;
    this.sync();
    this.kickDust(dt);
    this.smokeStep(dt, _q.set(0, 0.07, 0.08).applyMatrix4(_m));
  }

  /** Follow the ground, or fly off a crest and come down again. */
  fall(dt) {
    const g = this.ground.carR(this.up), rise = clamp((g - this.alt) / dt, -2.5, 2.5);
    if (!this.airborne && this.alt > g + 0.002 && rise < this.vy - G * dt * 1.5) this.airborne = true; // the ground fell away
    if (this.airborne) {
      this.vy -= G * dt;
      this.alt += this.vy * dt;
      if (this.alt > g) return;
      if (this.vy < -LAND_HURT && this.invuln <= 0) Object.assign(this, { crashed: true, impact: (-this.vy - LAND_HURT) * 0.3, invuln: 0.6 });
      this.shake = Math.max(this.shake, Math.min(1, -this.vy * 0.4));
      this.airborne = false;
      this.vy = 0;
      this.alt = g;
      return;
    }
    this.vy = rise > Math.abs(this.v) * 0.8 + 0.05 ? 0 : rise; // climbing carries it up over a crest; a kerb doesn't launch it
    this.alt = g;
  }

  /** Tip the body to match the ground under its wheels. */
  lean(dt) {
    if (this.airborne) {
      this.pitch += (clamp(this.vy * 0.25, -0.5, 0.3) - this.pitch) * Math.min(1, dt * 3);
      return;
    }
    const at = (fx, sx) => {
      _p.copy(this.up).addScaledVector(this.fwd, fx / this.alt).addScaledVector(_f.crossVectors(this.up, this.fwd), sx / this.alt).normalize();
      return this.ground.carR(_p);
    };
    const pitch = Math.atan2(at(0.07, 0) - at(-0.07, 0), 0.14), roll = Math.atan2(at(0, 0.045) - at(0, -0.045), 0.09);
    const k = Math.min(1, dt * 10);
    this.pitch += (clamp(pitch, -0.6, 0.6) - this.pitch) * k;
    this.roll += (clamp(roll, -0.5, 0.5) - this.roll) * k;
  }

  /**
   * Traffic on the highway: tell it where the car is (they queue behind it and honk), and bump into any that are in
   * the way.
   */
  bumpTraffic() {
    const p = this.planet, traffic = p.traffic, roads = p.roads;
    if (!traffic) return;
    traffic.blocker = null;
    for (const road of roads.list) {
      const lat = this.up.dot(road.n) * this.alt;
      if (Math.abs(lat) > ROAD_W) continue;
      const a = roads.angleOn(road, this.up);
      traffic.blocker = { road, a, lat };
      for (const c of traffic.cars) {
        if (c.road !== road || c.taken) continue;
        const dx = (mod(c.a - a + Math.PI, TAU) - Math.PI) * this.alt, dz = lat - c.lane * LANE;
        if (dx * dx + dz * dz > 0.1 * 0.1) continue;
        const along = roads.tangent(road, a, _p).dot(this.fwd), ahead = Math.sign(dx * along) === Math.sign(this.v);
        if (!ahead) continue; // it's behind: it's the one that has to brake
        const theirs = c.v * c.lane * along * this.alt * Math.sign(this.v); // their speed in our direction of travel
        const closing = Math.abs(this.v) - theirs;
        if (closing > 0.45 && this.invuln <= 0) {
          Object.assign(this, { crashed: true, impact: (closing - 0.45) * 0.3, invuln: 0.6, shake: 1 });
          this.hitWhat = 'car';
        }
        this.v = Math.sign(this.v) * Math.min(Math.abs(this.v), Math.max(0, theirs) * 0.9); // stuck behind it until you steer round
        if (this.honkT <= 0) { this.honkT = 2.5; p.app.sfx?.pop(_p.copy(this.up).multiplyScalar(this.alt + 0.15), 'BEEP BEEP!', '#ffd23f'); }
        return;
      }
    }
  }

  /** Off the road, the wheels throw up dust. */
  kickDust(dt) {
    if (!this.airborne && Math.abs(this.v) > 0.3 && this.ground.surface(this.up) !== 'road' && (this.dustT -= dt) <= 0) {
      this.dustT = 0.06;
      this.dust.emit(_q.set((Math.random() - 0.5) * 0.08, 0.01, -0.09 * Math.sign(this.v)).applyMatrix4(_m), 0.02,
        _p.copy(this.up).multiplyScalar(0.12));
    }
    this.dust.update(dt);
  }

  sync() {
    this.pos.copy(this.up).multiplyScalar(this.alt);
    _f.copy(this.fwd).multiplyScalar(Math.cos(this.pitch)).addScaledVector(this.up, Math.sin(this.pitch));
    _u.copy(this.up).applyAxisAngle(this.fwd, this.roll); // (the high side up: roll > 0 when the left wheels are higher)
    if (this.shake > 0.2) _u.addScaledVector(this.fwd, (Math.random() - 0.5) * this.shake * 0.1).normalize();
    frameFwd(_m, this.pos, _u, _f);
    this.group.position.copy(this.pos);
    this.group.quaternion.setFromRotationMatrix(_m);
  }

  extraMeshes() { return [this.dust.mesh]; }

  dispose() {
    if (this.planet.traffic) this.planet.traffic.blocker = null; // (or the traffic would wait behind it forever)
    super.dispose();
  }
}
