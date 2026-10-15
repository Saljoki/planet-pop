import * as THREE from 'three';
import { R, TAU, clamp, mod, smoothstep, ease } from '../core/Geo.js';

const PITCH = 1.35, MIN_ALT = 0.4, MAX_ALT = 110;
const _w = new THREE.Vector3();

/**
 * The view from space: the camera circles the planet at (yaw, pitch), `alt` above sea level, looking at the middle.
 * `heading` turns the view (two-finger twist) and `tilt` looks toward the horizon (two-finger drag), on top of the
 * automatic tilt near the ground. `tween` glides to another view (double-tap zoom, the compass, Find, the tour).
 */
export class OrbitView {
  constructor(rig) {
    this.rig = rig;
    const p = rig.camera.position;
    this.yaw = Math.atan2(p.x, p.z);
    this.pitch = Math.asin(p.y / p.length());
    this.alt = p.length() - R;
    this.heading = 0;
    this.tilt = 0;
    this.tween = null;
  }

  /** A finger drag as spin speed: slower close to the ground, and the globe follows the finger when turned. */
  dragVelocity(dx, dy) {
    const s = 0.005 * clamp(this.alt / 14, 0.03, 1), h = this.heading;
    [dx, dy] = [dx * Math.cos(h) + dy * Math.sin(h), dy * Math.cos(h) - dx * Math.sin(h)];
    return [-dx * s, dy * s];
  }

  spin(yaw, pitch) {
    this.yaw += yaw;
    this.pitch = clamp(this.pitch + pitch, -PITCH, PITCH);
  }

  zoomBy(f) { this.alt = clamp(this.alt * f, MIN_ALT, MAX_ALT); }

  /** Two-finger twist: the view turns with the fingers. */
  twistBy(a) { this.heading = mod(this.heading + a + Math.PI, TAU) - Math.PI; }

  /** Two fingers dragged up tilt the view toward the horizon; down looks more straight down. */
  tiltBy(dy) { this.tilt = clamp(this.tilt - dy * 0.004, -1.2, 1.2); }

  /** Turned or tilted away from north-up, straight down (the compass button resets it). */
  get turned() { return Math.abs(this.heading) > 0.02 || Math.abs(this.tilt) > 0.02; }

  /** Double-tap: swoop in on a spot on the ground, or just closer if there isn't one. */
  swoop(spot) {
    if (!spot) { this.tweenTo({ alt: clamp(this.alt * 0.55, 0.6, MAX_ALT) }); return; }
    const d = spot.pos.clone().normalize();
    this.tweenTo({ yaw: Math.atan2(d.x, d.z), pitch: clamp(Math.asin(d.y), -PITCH, PITCH), alt: clamp(this.alt * 0.45, 0.6, MAX_ALT) });
  }

  /** Glide to { yaw, pitch, alt, heading, tilt } (any of them). */
  tweenTo(to) {
    const from = { yaw: this.yaw, pitch: this.pitch, alt: this.alt, heading: this.heading, tilt: this.tilt };
    for (const k of ['yaw', 'heading']) if (k in to) to[k] = from[k] + mod(to[k] - from[k] + Math.PI, TAU) - Math.PI; // the short way round
    this.tween = { from, to, t: 0, dur: 0.7 };
  }

  updateTween(dt) {
    const tw = this.tween;
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    const e = ease(tw.t);
    for (const k in tw.to) this[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
    if (tw.t >= 1) this.tween = null;
  }

  /** Carry on from wherever the camera is now (coming back out from following something), north-up again. */
  fromCamera(minAlt) {
    const pos = this.rig.camera.position, len = pos.length();
    this.yaw = Math.atan2(pos.x, pos.z);
    this.pitch = clamp(Math.asin(clamp(pos.y / len, -1, 1)), -PITCH, PITCH);
    this.alt = Math.max(len - R, minAlt);
    this.heading = this.tilt = 0; // the way the fly-out ends
  }

  /** Where the camera goes (before heading and tilt), never below the hills. */
  pose(out) {
    const cp = Math.cos(this.pitch), planet = this.rig.app.planet;
    out.pos.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp);
    const floor = planet ? planet.groundR(out.pos) + 0.5 : R + 0.6;
    if (R + this.alt < floor) this.alt = floor - R;
    out.pos.multiplyScalar(R + this.alt);
    out.look.set(0, 0, 0);
    out.up.set(0, 1, 0);
    return out;
  }

  /**
   * Total tilt: the automatic look toward the horizon near the ground, plus the user's two-finger tilt.
   * Tilting up stops before the middle of the screen leaves the planet; tilting down goes as far as straight down.
   */
  tiltNow() {
    const auto = this.autoTilt(), r = this.rig.camera.position.length();
    const top = Math.max(auto, Math.asin(Math.min(1, R / r)) - 0.22), total = clamp(auto + this.tilt, 0, top);
    if (!this.tween) this.tilt = total - auto; // no dead zone when the fingers come back
    return total;
  }

  /** Tilt toward the horizon when skimming low. */
  autoTilt() {
    const pos = this.rig.camera.position, planet = this.rig.app.planet;
    const g = planet ? planet.groundR(_w.copy(pos).normalize()) : R;
    return (1 - smoothstep(1.5, 12, pos.length() - g)) * 0.95;
  }

  /** drift: nobody has touched anything for a while, so turn the planet gently. */
  update(dt, drift) {
    const rig = this.rig, cam = rig.camera;
    if (this.tween) this.updateTween(dt);
    else if (drift) this.yaw += dt * 0.05;
    rig.apply(this.pose(rig.pose));
    cam.rotateZ(this.heading);
    cam.rotateX(this.tiltNow());
  }
}
