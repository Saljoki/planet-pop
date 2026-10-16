import * as THREE from 'three';
import { TAU, clamp, mod, tangentBasis } from '../core/Geo.js';

/** How far back to start from each kind of thing, and how close the camera may get to it. */
const FRAME = { landmark: 2.6, car: 1.0, train: 1.3, boat: 1.2, plane: 1.7, balloon: 1.6, bird: 0.9, rocket: 2.2, satellite: 1.4, station: 3.2, moon: 6.5, storm: 5, city: 4.2, spot: 3,
  airport: 3.2, harbour: 2.2, person: 0.45, volcano: 4.2, ufo: 1.6, tram: 0.75, whale: 1.3, helicopter: 1.2 };
const MIN_DIST = { moon: 2.3, station: 0.9, storm: 1.5, city: 1, person: 0.12 };
const FROM_ABOVE = ['city', 'spot', 'airport', 'harbour', 'volcano', 'landmark']; // places look best from higher up
const MIN_PITCH = 0.04, MAX_PITCH = 1.45, MAX_DIST = 14;
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Quaternion();

/**
 * Following one thing on the planet: the camera sits `dist` away from it at (yaw, pitch) in its local frame (`up`
 * away from the planet, `fwd` its "forward"), and the frame travels with it around the globe.
 */
export class FollowView {
  constructor(rig) {
    this.rig = rig;
    this.target = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.yaw = Math.PI;
    this.pitch = 0.5;
    this.dist = 3;
    this.minDist = 0.3;
  }

  /** Start on a new thing: from behind it, at a distance that suits its size. */
  frame(e) {
    e.getPos(this.target);
    this.up.copy(this.target).normalize();
    e.getFwd(_e);
    this.fwd.copy(_e).addScaledVector(this.up, -_e.dot(this.up));
    if (this.fwd.lengthSq() < 1e-4) this.fwd.copy(tangentBasis(this.up)[0]);
    this.fwd.normalize();
    this.yaw = Math.PI;
    this.pitch = FROM_ABOVE.includes(e.kind) ? 0.75 : e.kind === 'moon' ? 0.3 : 0.45;
    this.dist = FRAME[e.kind] ?? 2;
    this.minDist = MIN_DIST[e.kind] ?? 0.3;
  }

  /** Move the frame with the thing, carrying the "forward" reference around the globe. */
  track(e) {
    e.getPos(_v);
    _w.copy(_v).normalize();
    _q.setFromUnitVectors(this.up, _w);
    this.fwd.applyQuaternion(_q);
    this.up.copy(_w);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    this.target.copy(_v);
  }

  /** Each frame: keep up with it, and drift back behind moving things when the user lets go. */
  update(dt, e, idle) {
    this.track(e);
    if (!e.moving || idle <= 1.5) return;
    e.getFwd(_e);
    _e.addScaledVector(this.up, -_e.dot(this.up));
    if (_e.lengthSq() <= 0.04) return;
    _e.normalize();
    _n.crossVectors(this.up, this.fwd);
    const want = Math.atan2(-_e.dot(_n), -_e.dot(this.fwd));
    this.yaw += (mod(want - this.yaw + Math.PI, TAU) - Math.PI) * Math.min(1, dt * 1.2);
  }

  dragVelocity(dx, dy) { return [-dx * 0.006, dy * 0.005]; }

  spin(yaw, pitch) {
    this.yaw += yaw;
    this.pitch = clamp(this.pitch + pitch, MIN_PITCH, MAX_PITCH);
  }

  zoomBy(f) { this.dist = clamp(this.dist * f, this.minDist, MAX_DIST); }

  /** Double-tap: closer. */
  zoomIn() { this.zoomBy(0.55); }

  twistBy(a) { this.yaw += a; }

  tiltBy(dy) { this.pitch = clamp(this.pitch + dy * 0.004, MIN_PITCH, MAX_PITCH); }

  /** Where the camera goes, never inside the ground or a mountain. */
  pose(out) {
    const cp = Math.cos(this.pitch);
    _n.crossVectors(this.up, this.fwd);
    out.pos.copy(this.fwd).multiplyScalar(Math.cos(this.yaw) * cp)
      .addScaledVector(_n, Math.sin(this.yaw) * cp)
      .addScaledVector(this.up, Math.sin(this.pitch))
      .multiplyScalar(this.dist).add(this.target);
    if (this.rig.app.planet) {
      const len = out.pos.length(), d = _w.copy(out.pos).divideScalar(len), floor = this.rig.floorAt(d) + 0.12;
      if (len < floor) out.pos.copy(d).multiplyScalar(floor);
    }
    out.look.copy(this.target);
    out.up.copy(this.up);
    return out;
  }
}
