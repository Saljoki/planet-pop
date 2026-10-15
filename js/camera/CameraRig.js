import * as THREE from 'three';
import { R, ease } from '../core/Geo.js';
import { Gestures } from './Gestures.js';
import { Picker } from './Picker.js';
import { OrbitView } from './OrbitView.js';
import { FollowView } from './FollowView.js';
import { ChaseView } from './ChaseView.js';

const _w = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

/**
 * Moves the camera, in one of four modes: 'orbit' (around the planet, OrbitView), 'local' (following one thing,
 * FollowView), 'game' (the Sky Courier chase cam, ChaseView) and 'fly' (an animated swoop from one to another).
 * Owns pointer input on the canvas (through Gestures) and hands it to the current view. Never lets the camera
 * go underground.
 */
export class CameraRig {
  constructor(app) {
    this.app = app;
    this.camera = app.camera;
    this.el = app.renderer.domElement;
    this.mode = 'orbit';
    this.entity = null;   // what's being followed (or flown to)
    this.followTime = 0;  // how long it has been followed
    this.idle = 0;        // seconds since the last touch
    this.queued = null;   // an orbit view to glide to once back in orbit
    this.look = new THREE.Vector3();
    this.pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() };
    this.vel = { yaw: 0, pitch: 0 }; // spin left over from a flick
    this.picker = new Picker(app);
    this.orbit = new OrbitView(this);
    this.local = new FollowView(this);
    this.chase = new ChaseView(this);
    this.bindInput();
  }

  /** The view that takes drags, pinches and twists right now (none while flying or in a run). */
  get view() { return this.mode === 'orbit' ? this.orbit : this.mode === 'local' ? this.local : null; }

  /* ---------------- input ---------------- */

  bindInput() {
    this.gestures = new Gestures(this.el, {
      input: () => { this.idle = 0; this.vel.yaw = this.vel.pitch = 0; this.orbit.tween = null; this.app.onUserInput?.(); },
      drag: (dx, dy) => this.drag(dx, dy),
      zoom: (f) => this.zoom(f),
      twist: (a) => this.twist(a),
      tilt: (dy) => this.tilt(dy),
      tap: (x, y) => this.click(x, y),
      doubleTap: (x, y) => this.zoomAt(x, y),
      hold: (x, y) => this.holdAt(x, y),
      hover: (x, y) => this.hover(x, y),
      leave: () => this.app.hud.hideLabel(),
    });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && (this.mode === 'local' || (this.mode === 'fly' && this.entity))) this.release();
    });
  }

  drag(dx, dy) {
    this.idle = 0;
    const view = this.view;
    if (!view) return;
    [this.vel.yaw, this.vel.pitch] = view.dragVelocity(dx, dy);
    this.applyVel(1);
  }

  applyVel(k) {
    const { yaw, pitch } = this.vel;
    if (Math.abs(yaw) + Math.abs(pitch) < 1e-6) return;
    this.view?.spin(yaw * k, pitch * k);
  }

  zoom(f) { this.view?.zoomBy(f); }

  twist(a) {
    this.idle = 0;
    this.view?.twistBy(a);
  }

  tilt(dy) {
    this.idle = 0;
    this.view?.tiltBy(dy);
  }

  /** True when the orbit view has been turned or tilted (the compass button resets it). */
  get turned() { return this.mode === 'orbit' && this.orbit.turned; }

  /** Smoothly turn the orbit view back to north-up and looking straight down. */
  resetView() { this.orbit.tweenTo({ heading: 0, tilt: 0 }); }

  /** Double-tap: swoop in on that spot (or closer to whatever is being followed). */
  zoomAt(x, y) {
    if (this.app.game.active || !this.app.planet) return;
    if (this.mode === 'local') this.local.zoomIn();
    else if (this.mode === 'orbit') this.orbit.swoop(this.picker.groundAt(x, y));
  }

  /** Press and hold: an info card about whatever is under the finger. */
  holdAt(x, y) {
    if (this.app.game.active || !this.app.planet) return;
    const e = this.picker.entityAt(x, y, 40);
    if (e) this.app.hud.info?.show(e);
  }

  /** Tap or click: follow whatever is there, or fly down to that spot. */
  click(x, y) {
    if (this.app.game.active || !this.app.planet) return;
    const e = this.picker.entityAt(x, y) || this.picker.groundAt(x, y);
    if (e) this.focus(e);
  }

  /** Mouse over something: its name next to the pointer. */
  hover(x, y) {
    const now = performance.now(), hud = this.app.hud;
    if (now - (this.lastHover || 0) < 90) return;
    this.lastHover = now;
    const e = this.app.planet && !this.app.game.active ? this.picker.entityAt(x, y, 22) : null;
    this.el.style.cursor = e ? 'pointer' : '';
    if (!e) { hud.hideLabel(); return; }
    e.getPos(_w).project(this.camera);
    hud.showLabel(e.name, ((_w.x + 1) / 2) * innerWidth, ((1 - _w.y) / 2) * innerHeight);
  }

  /* ---------------- modes ---------------- */

  /** Fly to something and follow it. */
  focus(e) {
    if (this.app.game.active) return;
    this.queued = this.orbit.tween = null;
    this.entity = e;
    this.followTime = 0;
    this.local.frame(e);
    this.app.hud.setFollow(e);
    this.startFly((pose) => { this.local.track(this.entity); return this.local.pose(pose); }, () => {
      this.mode = 'local';
      this.app.onFocus(e);
    });
  }

  /** Back out to the orbit view (instant: jump there, further out). */
  release(instant = false) {
    this.entity = null;
    this.chase.player = null;
    this.followTime = 0;
    this.app.hud.setFollow(null);
    this.orbit.fromCamera(instant ? 24 : 12);
    this.vel.yaw = this.vel.pitch = 0;
    if (instant) { this.mode = 'orbit'; this.queued = null; return; }
    this.startFly((pose) => this.orbit.pose(pose), () => {
      this.mode = 'orbit';
      if (this.queued) { this.orbit.tweenTo(this.queued); this.queued = null; }
    }, 1.3);
  }

  /** Glide to an orbit view ({ yaw, pitch, alt, heading, tilt }), first flying back out if following something. */
  orbitTo(view) {
    if (this.mode === 'orbit') { this.orbit.tweenTo({ ...view }); return; }
    this.queued = { ...view };
    this.release();
  }

  /** Sky Courier: swoop down behind the player's plane. */
  setGame(player) {
    this.entity = null;
    this.chase.player = player;
    this.app.hud.setFollow(null);
    this.startFly((pose) => this.chase.pose(pose), () => (this.mode = 'game'), 1.2);
  }

  /** Terrain + mountains (no city skyline) under a unit direction. */
  floorAt(d) {
    const p = this.app.planet;
    let r = Math.max(p.surfR(d), R + 0.03);
    for (const m of p.nature?.mountains || []) {
      const t = 1 - (m.d.angleTo(d) * R) / m.s;
      if (t > 0) r = Math.max(r, m.base + m.hgt * t);
    }
    return r;
  }

  apply(pose) {
    this.camera.position.copy(pose.pos);
    this.camera.up.copy(pose.up);
    this.look.copy(pose.look);
    this.camera.lookAt(this.look);
  }

  /** Swoop to wherever target(pose) says (it's asked every frame, so it can move), then call onDone. */
  startFly(target, onDone, dur = 1.5) {
    this.flight = { t: 0, dur, pos: this.camera.position.clone(), look: this.look.clone(), up: this.camera.up.clone(), target, onDone };
    this.mode = 'fly';
  }

  /** Arcs over the planet instead of cutting through it; keeps tracking a moving target. */
  updateFly(dt) {
    const f = this.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    const e = ease(f.t), end = f.target(this.pose);
    const r0 = f.pos.length(), r1 = end.pos.length();
    _a.copy(f.pos).divideScalar(r0);
    _b.copy(end.pos).divideScalar(r1);
    const ang = _a.angleTo(_b);
    _q.setFromUnitVectors(_a, _b);
    _a.applyQuaternion(_q2.identity().slerp(_q, e));
    this.camera.position.copy(_a).multiplyScalar(r0 + (r1 - r0) * e + Math.sin(Math.PI * e) * Math.min(ang * R * 0.35, 12));
    this.look.lerpVectors(f.look, end.look, e);
    this.camera.up.lerpVectors(f.up, end.up, e);
    if (this.camera.up.lengthSq() < 1e-6) this.camera.up.copy(end.up);
    this.camera.up.normalize();
    this.camera.lookAt(this.look);
    if (f.t >= 1) f.onDone();
  }

  update(dt) {
    const still = this.gestures.count === 0;
    this.idle += dt;
    if (still) {
      const damp = Math.exp(-dt * 5);
      this.vel.yaw *= damp;
      this.vel.pitch *= damp;
      this.applyVel(dt * 60); // inertia after a flick
    }
    switch (this.mode) {
      case 'fly': this.updateFly(dt); break;
      case 'local':
        if (!this.entity) { this.release(); break; }
        this.local.update(dt, this.entity, this.idle);
        this.followTime += dt;
        this.apply(this.local.pose(this.pose));
        break;
      case 'game':
        if (this.chase.player) this.chase.update(dt);
        else this.release(true);
        break;
      default: this.orbit.update(dt, this.idle > 6 && still); // gentle auto-rotate when left alone
    }
  }
}
