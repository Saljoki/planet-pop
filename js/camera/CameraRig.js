import * as THREE from 'three';
import { R, TAU, clamp, mod, smoothstep, ease, raySphere, tangentBasis } from '../core/Geo.js';
import { PointEntity } from '../core/Entity.js';

const FRAME = { car: 1.0, train: 1.3, boat: 1.2, plane: 1.7, balloon: 1.6, bird: 0.9, rocket: 2.2, satellite: 1.4, station: 3.2, moon: 6.5, storm: 5, city: 4.2, spot: 3,
  airport: 3.2, harbour: 2.2, person: 0.45, volcano: 4.2, ufo: 1.6 };
const MIN_DIST = { moon: 2.3, station: 0.9, storm: 1.5, city: 1, person: 0.12 };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3();
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();

/**
 * Modes: 'orbit' (around the planet), 'fly' (animated transition), 'local' (focus/follow an entity),
 * 'game' (chase cam). Owns pointer input on the canvas. Never lets the camera go underground.
 */
export class CameraRig {
  constructor(app) {
    this.app = app;
    this.camera = app.camera;
    this.el = app.renderer.domElement;
    this.mode = 'orbit';
    this.entity = null;
    this.player = null;
    this.followTime = 0;
    this.idle = 0;
    this.look = new THREE.Vector3();
    this.pose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3() };
    const p = this.camera.position;
    this.orbit = { yaw: Math.atan2(p.x, p.z), pitch: Math.asin(p.y / p.length()), alt: p.length() - R };
    this.local = { target: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), fwd: new THREE.Vector3(0, 0, 1), yaw: Math.PI, pitch: 0.5, dist: 3 };
    this.minDist = 0.3;
    this.vel = { yaw: 0, pitch: 0 };
    this.pointers = new Map();
    this.press = null;
    this.pinch = 0;
    this.bindInput();
  }

  /* ---------------- input ---------------- */

  bindInput() {
    const el = this.el;
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 1) this.press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false };
      this.pinch = this.pointers.size === 2 ? this.pinchDist() : 0;
      this.idle = 0;
      this.vel.yaw = this.vel.pitch = 0;
    });
    el.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) { this.hover(e.clientX, e.clientY); return; }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > 6) this.press.moved = true;
      if (this.pointers.size === 2) {
        const d = this.pinchDist();
        if (this.pinch) this.zoom(this.pinch / d);
        this.pinch = d;
        return;
      }
      this.drag(dx, dy);
    });
    const up = (e) => {
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.delete(e.pointerId);
      const p = this.press;
      if (e.type === 'pointerup' && p && !p.moved && this.pointers.size === 0 && performance.now() - p.t < 450) this.click(e.clientX, e.clientY);
      if (this.pointers.size === 0) this.press = null;
      this.pinch = this.pointers.size === 2 ? this.pinchDist() : 0;
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', () => this.app.hud.hideLabel());
    el.addEventListener('wheel', (e) => { e.preventDefault(); this.idle = 0; this.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    addEventListener('keydown', (e) => {
      if (e.code === 'Escape' && (this.mode === 'local' || (this.mode === 'fly' && this.entity))) this.release();
    });
  }

  pinchDist() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  }

  drag(dx, dy) {
    this.idle = 0;
    if (this.mode === 'orbit') {
      const s = 0.005 * clamp(this.orbit.alt / 14, 0.03, 1); // slower when close to the ground
      this.vel.yaw = -dx * s;
      this.vel.pitch = dy * s;
    } else if (this.mode === 'local') {
      this.vel.yaw = -dx * 0.006;
      this.vel.pitch = dy * 0.005;
    } else return;
    this.applyVel(1);
  }

  applyVel(k) {
    const { yaw, pitch } = this.vel;
    if (Math.abs(yaw) + Math.abs(pitch) < 1e-6) return;
    if (this.mode === 'orbit') {
      this.orbit.yaw += yaw * k;
      this.orbit.pitch = clamp(this.orbit.pitch + pitch * k, -1.35, 1.35);
    } else if (this.mode === 'local') {
      this.local.yaw += yaw * k;
      this.local.pitch = clamp(this.local.pitch + pitch * k, 0.04, 1.45);
    }
  }

  zoom(f) {
    if (this.mode === 'orbit') this.orbit.alt = clamp(this.orbit.alt * f, 0.4, 110);
    else if (this.mode === 'local') this.local.dist = clamp(this.local.dist * f, this.minDist, 14);
  }

  /* ---------------- picking ---------------- */

  occluded(p) {
    const cam = this.camera.position;
    _e.subVectors(p, cam);
    const dist = _e.length();
    _e.divideScalar(dist);
    const t = raySphere(cam, _e, R);
    return t > 0 && t < dist - 0.3;
  }

  /** Nearest entity to a screen point (screen-space, so tiny cars are still easy to hit). */
  pick(x, y, radius = 28) {
    let best = null, bestD = radius;
    for (const e of this.app.planet.entities) {
      if (e.object && !e.object.visible) continue;
      e.getPos(_v);
      if (e.near && _v.distanceTo(this.camera.position) > e.near) continue; // tiny things (people) only up close
      if (this.occluded(_v)) continue;
      _w.copy(_v).project(this.camera);
      if (_w.z > 1 || _w.z < -1) continue;
      const d = Math.hypot(((_w.x + 1) / 2) * innerWidth - x, ((1 - _w.y) / 2) * innerHeight - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  pickGround(x, y) {
    const cam = this.camera.position;
    _v.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(this.camera).sub(cam).normalize();
    const t = raySphere(cam, _v, R + 0.2);
    if (t < 0) return null;
    const d = _w.copy(cam).addScaledVector(_v, t).normalize();
    return new PointEntity(d.clone().multiplyScalar(this.app.planet.surfR(d) + 0.1), 'spot', 'Somewhere nice', tangentBasis(d)[0]);
  }

  click(x, y) {
    if (this.app.game.active || !this.app.planet) return;
    const e = this.pick(x, y) || this.pickGround(x, y);
    if (e) this.focus(e);
  }

  hover(x, y) {
    const now = performance.now(), hud = this.app.hud;
    if (now - (this.lastHover || 0) < 90) return;
    this.lastHover = now;
    const e = this.app.planet && !this.app.game.active ? this.pick(x, y, 22) : null;
    this.el.style.cursor = e ? 'pointer' : '';
    if (!e) { hud.hideLabel(); return; }
    e.getPos(_v).project(this.camera);
    hud.showLabel(e.name, ((_v.x + 1) / 2) * innerWidth, ((1 - _v.y) / 2) * innerHeight);
  }

  /* ---------------- modes ---------------- */

  focus(e) {
    if (this.app.game.active) return;
    const L = this.local;
    this.entity = e;
    this.followTime = 0;
    e.getPos(L.target);
    L.up.copy(L.target).normalize();
    e.getFwd(_e);
    L.fwd.copy(_e).addScaledVector(L.up, -_e.dot(L.up));
    if (L.fwd.lengthSq() < 1e-4) L.fwd.copy(tangentBasis(L.up)[0]);
    L.fwd.normalize();
    L.yaw = Math.PI; // start behind it
    L.pitch = ['city', 'spot', 'airport', 'harbour', 'volcano'].includes(e.kind) ? 0.75 : e.kind === 'moon' ? 0.3 : 0.45;
    L.dist = FRAME[e.kind] ?? 2;
    this.minDist = MIN_DIST[e.kind] ?? 0.3;
    this.app.hud.setFollow(e);
    this.startFly((pose) => { this.trackEntity(); return this.localPose(pose); }, () => {
      this.mode = 'local';
      this.app.onFocus(e);
      if (e.kind === 'moon') this.app.achievements.unlock('moonwalker');
    });
  }

  release(instant = false) {
    this.entity = null;
    this.player = null;
    this.followTime = 0;
    this.app.hud.setFollow(null);
    const pos = this.camera.position, len = pos.length();
    this.orbit.yaw = Math.atan2(pos.x, pos.z);
    this.orbit.pitch = clamp(Math.asin(clamp(pos.y / len, -1, 1)), -1.35, 1.35);
    this.orbit.alt = Math.max(len - R, instant ? 24 : 12);
    this.vel.yaw = this.vel.pitch = 0;
    if (instant) { this.mode = 'orbit'; return; }
    this.startFly((pose) => this.orbitPose(pose), () => (this.mode = 'orbit'), 1.3);
  }

  setGame(player) {
    this.entity = null;
    this.player = player;
    this.app.hud.setFollow(null);
    this.startFly((pose) => this.chasePose(pose), () => (this.mode = 'game'), 1.2);
  }

  /** Move the local frame with the entity, carrying the "forward" reference around the globe. */
  trackEntity() {
    const L = this.local;
    this.entity.getPos(_v);
    _w.copy(_v).normalize();
    _q.setFromUnitVectors(L.up, _w);
    L.fwd.applyQuaternion(_q);
    L.up.copy(_w);
    L.fwd.addScaledVector(L.up, -L.fwd.dot(L.up)).normalize();
    L.target.copy(_v);
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

  orbitPose(out) {
    const o = this.orbit, cp = Math.cos(o.pitch);
    out.pos.set(Math.sin(o.yaw) * cp, Math.sin(o.pitch), Math.cos(o.yaw) * cp);
    const floor = this.app.planet ? this.app.planet.groundR(out.pos) + 0.5 : R + 0.6;
    if (R + o.alt < floor) o.alt = floor - R;
    out.pos.multiplyScalar(R + o.alt);
    out.look.set(0, 0, 0);
    out.up.set(0, 1, 0);
    return out;
  }

  localPose(out) {
    const L = this.local, cp = Math.cos(L.pitch);
    _n.crossVectors(L.up, L.fwd);
    out.pos.copy(L.fwd).multiplyScalar(Math.cos(L.yaw) * cp)
      .addScaledVector(_n, Math.sin(L.yaw) * cp)
      .addScaledVector(L.up, Math.sin(L.pitch))
      .multiplyScalar(L.dist).add(L.target);
    if (this.app.planet) {
      const len = out.pos.length(), d = _w.copy(out.pos).divideScalar(len), floor = this.floorAt(d) + 0.12;
      if (len < floor) out.pos.copy(d).multiplyScalar(floor);
    }
    out.look.copy(L.target);
    out.up.copy(L.up);
    return out;
  }

  chasePose(out) {
    const pl = this.player, k = Math.min(2, Math.max(1, 1.1 / this.camera.aspect)); // pull back on portrait screens
    out.pos.copy(pl.pos).addScaledVector(pl.fwd, -1.6 * k).addScaledVector(pl.up, 0.6 * k);
    out.look.copy(pl.pos).addScaledVector(pl.fwd, 1.2);
    out.up.copy(pl.up);
    return out;
  }

  apply(pose) {
    this.camera.position.copy(pose.pos);
    this.camera.up.copy(pose.up);
    this.look.copy(pose.look);
    this.camera.lookAt(this.look);
  }

  /** Tilt toward the horizon when skimming low in orbit mode. */
  orbitTilt() {
    const pos = this.camera.position, g = this.app.planet ? this.app.planet.groundR(_w.copy(pos).normalize()) : R;
    return (1 - smoothstep(1.5, 12, pos.length() - g)) * 0.95;
  }

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

  updateLocal(dt) {
    const e = this.entity, L = this.local;
    if (!e) { this.release(); return; }
    this.trackEntity();
    if (e.moving && this.idle > 1.5) { // drift back behind moving things when the user lets go
      e.getFwd(_e);
      _e.addScaledVector(L.up, -_e.dot(L.up));
      if (_e.lengthSq() > 0.04) {
        _e.normalize();
        _n.crossVectors(L.up, L.fwd);
        const want = Math.atan2(-_e.dot(_n), -_e.dot(L.fwd));
        L.yaw += (mod(want - L.yaw + Math.PI, TAU) - Math.PI) * Math.min(1, dt * 1.2);
      }
    }
    this.followTime += dt;
    this.apply(this.localPose(this.pose));
  }

  updateGame(dt) {
    if (!this.player) { this.release(true); return; }
    const pose = this.chasePose(this.pose), k = 1 - Math.exp(-dt * 6), cam = this.camera;
    cam.position.lerp(pose.pos, k);
    const r = cam.position.length(), floor = this.floorAt(_w.copy(cam.position).divideScalar(r)) + 0.15;
    if (r < floor) cam.position.multiplyScalar(floor / r);
    cam.up.lerp(pose.up, k).normalize();
    this.look.lerp(pose.look, Math.min(1, k * 1.5));
    cam.lookAt(this.look);
    if (this.player.shake > 0) cam.position.add(_e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(this.player.shake * 0.05));
  }

  update(dt) {
    const still = this.pointers.size === 0;
    this.idle += dt;
    if (still) {
      const damp = Math.exp(-dt * 5);
      this.vel.yaw *= damp;
      this.vel.pitch *= damp;
      this.applyVel(dt * 60); // inertia after a flick
    }
    switch (this.mode) {
      case 'fly': this.updateFly(dt); break;
      case 'local': this.updateLocal(dt); break;
      case 'game': this.updateGame(dt); break;
      default:
        if (this.idle > 6 && still) this.orbit.yaw += dt * 0.05; // gentle auto-rotate
        this.apply(this.orbitPose(this.pose));
        this.camera.rotateX(this.orbitTilt());
    }
  }
}
