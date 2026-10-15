import * as THREE from 'three';
import { clamp } from '../../core/Geo.js';
import { Vehicle } from './Vehicle.js';
import { Ground } from './Ground.js';

const SLIDE = [0.4, -0.4, 0.8, -0.8, 1.2, -1.2]; // directions to try (radians off straight ahead) when something's in the way
const HURT = 0.45;   // hitting a wall faster than this (units/s) does damage
const _axis = new THREE.Vector3(), _up = new THREE.Vector3(), _fwd = new THREE.Vector3(), _dir = new THREE.Vector3();
const _probe = new THREE.Vector3();

/**
 * A vehicle that keeps to the surface: a car on land, a boat on water. It speeds up and slows down along `fwd`,
 * turns more the faster it goes, slides along walls and gets hurt hitting them hard. Subclasses say how fast it
 * goes where (limits), what stops it (blocked) and how high it sits (surfaceR).
 */
export class GroundVehicle extends Vehicle {
  constructor(planet, at, heading, stats) {
    super(planet, stats);
    this.ground = new Ground(planet);
    this.place(at, heading);
    this.v = 0;          // speed along fwd (units/s); negative when reversing
    this.alt = this.surfaceR(this.up);
    this.impact = 0;     // how hard the last crash was, as damage (the game applies it)
    this.hitWhat = null; // what it last bumped into ('building', 'water', 'land'…)
    this.scraping = 0;   // > 0 while sliding along a wall
  }

  get tiltClimbs() { return false; }

  get speed() { return this.v; }

  /** Half the vehicle's length: walls are checked at its nose as well as its middle. */
  get nose() { return 0.1; }

  /** { max, accel, brake, coast, reverse, turn } where it is now (units/s, units/s², rad/s at full speed). */
  limits() { throw new Error('a ground vehicle must say how it handles'); }

  /** Why it can't be at direction d (a reason) or null. */
  blocked() { return null; }

  /** The radius it rests at, at direction d. */
  surfaceR() { return 0; }

  /** Gas (+1) or brake / reverse (-1), from keys, a controller or the thumbstick. */
  throttle() {
    const inp = this.input;
    return clamp((inp.up ? 1 : 0) - (inp.down ? 1 : 0) + (+inp.climb || 0), -1, 1);
  }

  respawn(at, heading) {
    super.respawn(at, heading);
    this.v = 0;
    this.alt = this.surfaceR(this.up);
  }

  /** Speed up, slow down and turn for one frame, then move. */
  drive(dt) {
    const L = this.limits(), th = this.locked ? 0 : this.throttle(), st = this.stats;
    const boosting = this.boostStep(dt) && th > 0;
    const max = L.max * st.speed * this.engine * (boosting ? L.boost : 1);
    if (th !== 0 && Math.sign(th) !== Math.sign(this.v) && Math.abs(this.v) > 0.02) { // braking
      this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), L.brake * dt);
    } else if (th > 0) {
      this.v += clamp(max - this.v, -L.brake * dt, L.accel * th * (boosting ? 1.6 : 1) * dt);
    } else if (th < 0) {
      this.v += clamp(-L.reverse - this.v, -L.accel * -th * dt, L.brake * dt);
    } else {
      this.v -= Math.sign(this.v) * Math.min(Math.abs(this.v), L.coast * dt);
    }
    if (this.v > max) this.v = Math.max(max, this.v - L.brake * dt); // off the road (or out of boost): ease down to the new top speed
    const grip = clamp(Math.abs(this.v) / 0.3, 0, 1) * Math.sign(this.v); // no turning on the spot; reversing turns the other way
    this.fwd.applyAxisAngle(this.up, this.turnInput() * L.turn * st.turn * (this.controls.sensitivity ?? 1) * grip * dt);
    this.move(this.v * dt);
    return boosting;
  }

  /**
   * Try to go `dist` along fwd (backwards if negative): straight on if clear, else slide along whatever's in the way.
   * Glancing off a wall just scrapes; hitting it square on at speed is a crash.
   */
  move(dist) {
    this.crashed = false;
    this.impact = 0;
    this.scraping = Math.max(0, this.scraping - 0.1);
    if (Math.abs(dist) < 1e-7) return;
    if (this.tryStep(dist, 0)) return;
    const off = SLIDE.find((a) => this.tryStep(dist * Math.cos(a), a));
    const square = off === undefined ? 1 : Math.sin(Math.abs(off)); // 1 = straight into it
    const hit = Math.abs(this.v) * square;
    if (hit > HURT && this.invuln <= 0) {
      this.crashed = true;
      this.impact = (hit - HURT) * 0.35 + (this.hitWhat === 'lava' ? 0.2 : 0);
      this.invuln = 0.6;
      this.shake = Math.min(1, hit);
    }
    if (off === undefined) { this.v = -this.v * 0.3; return; } // nowhere to go: bounce back
    this.fwd.applyAxisAngle(this.up, off * 0.25 * Math.sign(dist)); // turn a little along the wall
    this.v *= 1 - square * 0.5;
    this.scraping = 1;
  }

  /** Move `dist` in the direction `off` radians from fwd, if that spot (and the nose there) is clear. */
  tryStep(dist, off) {
    _dir.copy(this.fwd);
    if (off) _dir.applyAxisAngle(this.up, off);
    _axis.crossVectors(this.up, _dir).normalize();
    const ang = dist / this.alt;
    _up.copy(this.up).applyAxisAngle(_axis, ang).normalize();
    _probe.copy(_up).applyAxisAngle(_axis, (Math.sign(dist) * this.nose) / this.alt);
    const why = this.blocked(_up) || this.blocked(_probe);
    if (why) { this.hitWhat = why; return false; }
    _fwd.copy(this.fwd).applyAxisAngle(_axis, ang);
    this.up.copy(_up);
    this.fwd.copy(_fwd).addScaledVector(this.up, -_fwd.dot(this.up)).normalize();
    return true;
  }
}
