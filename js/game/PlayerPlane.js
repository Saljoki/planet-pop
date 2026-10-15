import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, clamp, frameFwd } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';
import { Trails } from '../life/Trails.js';

export const SPEED = 1.7;
const BOOST = 3.0, TURN = 1.6, CLIMB = 1.4, MIN_ALT = R + 0.4, MAX_ALT = R + 5.5;
const _a = new THREE.Vector3(), _f = new THREE.Vector3(), _u = new THREE.Vector3(), _m = new THREE.Matrix4();
const BASE_STATS = { speed: 1, turn: 1, drain: 0.35, regen: 0.08 };
const BASE_SKIN = { body: '#ffd23f', trim: '#ff4d4d' };

/** The player's courier plane: flies great circles around the globe at a chosen altitude. */
export class PlayerPlane {
  constructor(planet, startDir, heading, stats = BASE_STATS, skin = BASE_SKIN) {
    this.planet = planet;
    this.stats = stats;
    this.up = startDir.clone().normalize();
    this.fwd = heading.clone().addScaledVector(this.up, -heading.dot(this.up)).normalize();
    this.alt = planet.groundR(this.up) + 1.6;
    this.pos = new THREE.Vector3();
    this.boost = 1;
    this.roll = 0;
    this.pitchV = 0;
    this.shake = 0;
    this.invuln = 0;
    this.crashed = false;
    this.cargoSpeed = 1;
    this.cargoClimb = 1;
    this.turbulence = 0; // 0..1, set by the game while flying through a thundercloud
    this.engine = 1;     // < 1 while volcanic ash chokes the engine
    this.t = 0;
    // keys and buttons are on/off; a thumbstick or tilting the phone adds steer (-1 left … 1 right) and climb (-1 … 1)
    this.input = { left: false, right: false, up: false, down: false, boost: false, steer: 0, climb: 0 };

    const g = (this.group = new THREE.Group());
    addMesh(g, new THREE.CapsuleGeometry(0.08, 0.4, 4, 12).rotateX(Math.PI / 2), toon(skin.body), 0.012);
    addMesh(g, mergeGeometries([
      new THREE.BoxGeometry(0.9, 0.03, 0.17).translate(0, -0.02, 0.04),
      new THREE.BoxGeometry(0.03, 0.17, 0.12).translate(0, 0.11, -0.25),
      new THREE.BoxGeometry(0.32, 0.025, 0.09).translate(0, 0.03, -0.26),
    ]), toon(skin.trim), 0.01);
    addMesh(g, new THREE.SphereGeometry(0.06, 12, 8).scale(1, 0.8, 1.4).translate(0, 0.065, 0.06), toon('#2d2a5a'), 0.006);
    this.crateMat = toon('#c98a4b');
    addMesh(g, new THREE.BoxGeometry(0.09, 0.07, 0.09).translate(0, 0.11, -0.08), this.crateMat, 0.006); // the parcel
    this.prop = addMesh(g, new THREE.BoxGeometry(0.34, 0.03, 0.012), toon('#2a2540'), 0.004);
    this.prop.position.z = 0.29;
    planet.root.add(g);
    this.trail = new Trails(planet.root, { max: 200, color: '#fff4c2', life: 1.6, grow: 2, drag: 0.4 });
    this.trailT = 0;
    this.sync();
  }

  /** Heavy cargo slows the plane down; the crate on top takes the cargo's colour. */
  setCargo(cargo) {
    this.cargoSpeed = cargo.speed ?? 1;
    this.cargoClimb = cargo.climb ?? 1;
    this.crateMat.color.set(cargo.color);
  }

  /** Autopilot (the rival uses it): turn toward `target`, cruise above the ground, dive near the target. */
  steerToward(target, cruise = 1.4) {
    const inp = this.input, p = this.planet;
    _a.copy(target).addScaledVector(this.up, -target.dot(this.up));
    _f.crossVectors(this.up, this.fwd);
    const ang = Math.atan2(_a.dot(_f), _a.dot(this.fwd));
    inp.left = ang > 0.05;
    inp.right = ang < -0.05;
    const want = this.up.angleTo(target) < 0.25 ? p.surfR(target) + 2.3 : p.groundR(this.up) + cruise;
    inp.up = this.alt < want - 0.1;
    inp.down = this.alt > want + 0.1;
  }

  update(dt) {
    const inp = this.input;
    const turn = clamp((inp.left ? 1 : 0) - (inp.right ? 1 : 0) - (+inp.steer || 0), -1, 1);
    const climb = clamp((inp.up ? 1 : 0) - (inp.down ? 1 : 0) + (+inp.climb || 0), -1, 1);
    const st = this.stats;
    const boosting = inp.boost && this.boost > 0.02;
    this.boost = clamp(this.boost + (boosting ? -st.drain : st.regen) * dt, 0, 1);

    this.fwd.applyAxisAngle(this.up, turn * TURN * st.turn * dt);             // steer
    this.t += dt;
    if (this.turbulence > 0) { // storm buffeting: the nose wanders and the plane bobs
      const k = this.turbulence, t = this.t;
      this.fwd.applyAxisAngle(this.up, (Math.sin(t * 7.3) + Math.sin(t * 12.1) * 0.6) * 0.9 * k * dt);
      this.alt += (Math.sin(t * 5.1) + Math.sin(t * 9.7) * 0.5) * 0.7 * k * dt;
      this.shake = Math.max(this.shake, 0.3 * k);
    }
    const axis = _a.crossVectors(this.up, this.fwd).normalize();
    const ang = ((boosting ? BOOST : SPEED) * st.speed * this.cargoSpeed * this.engine * dt) / this.alt; // fly along a great circle
    this.up.applyAxisAngle(axis, ang).normalize();
    this.fwd.applyAxisAngle(axis, ang);
    this.fwd.addScaledVector(this.up, -this.fwd.dot(this.up)).normalize();
    this.alt = clamp(this.alt + climb * CLIMB * this.cargoClimb * dt, MIN_ALT, MAX_ALT);

    this.roll += (-turn * 0.6 - this.roll) * Math.min(1, dt * 5); // bank into the turn: left wing down turning left
    this.pitchV += (climb * 0.35 - this.pitchV) * Math.min(1, dt * 5);
    this.invuln = Math.max(0, this.invuln - dt);
    this.shake = Math.max(0, this.shake - dt * 2);

    this.crashed = false;
    const ground = this.planet.groundR(this.up);
    if (this.alt < ground + 0.12) {
      if (this.invuln <= 0) { this.crashed = true; this.invuln = 1.5; this.shake = 1; this.alt = ground + 0.9; }
      else this.alt = ground + 0.12;
    }

    this.prop.rotation.z += dt * 40;
    this.sync();
    if ((this.trailT -= dt) <= 0) {
      this.trailT = boosting ? 0.03 : 0.07;
      this.trail.emit(_u.set(0, 0.02, -0.32).applyMatrix4(_m), boosting ? 0.05 : 0.03);
    }
    this.trail.update(dt);
  }

  sync() {
    this.pos.copy(this.up).multiplyScalar(this.alt);
    _f.copy(this.fwd).multiplyScalar(Math.cos(this.pitchV)).addScaledVector(this.up, Math.sin(this.pitchV));
    _u.copy(this.up).applyAxisAngle(this.fwd, this.roll);
    frameFwd(_m, this.pos, _u, _f);
    this.group.position.copy(this.pos);
    this.group.quaternion.setFromRotationMatrix(_m);
  }

  dispose() {
    const objs = [this.group, this.trail.mesh];
    for (const root of objs) {
      root.removeFromParent();
      root.traverse((o) => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach((m) => m.dispose());
        if (o.isInstancedMesh) o.dispose();
      });
    }
  }
}
