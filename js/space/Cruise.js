import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_FX, clamp } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { mulberry32 } from '../core/Noise.js';
import { CruiseHud } from '../ui/CruiseHud.js';

const MAX = 80;                  // fuel stars and rocks, each
const BELT = [148, 182];         // the asteroid belt's reach from the Sun, on the map
const KEYS = { ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0], ArrowUp: [0, 1], KeyW: [0, 1], ArrowDown: [0, -1], KeyS: [0, -1] };
const Y = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const _look = new THREE.Vector3(), _e = new THREE.Euler();

/**
 * A trip's cruise across the system map: the ship flies the straight route from one world to the next on its own;
 * the player steers it across the route (a lane, ±1 each way, `L` map units wide) to catch fuel stars and miss rocks
 * (most of them in the asteroid belt), and boosts with the fuel. While it's on, CameraRig hands drags here (the
 * dragVelocity/spin/zoomBy… surface of a camera view), and it flies the map's camera behind the ship.
 */
export class Cruise {
  constructor(app, map) {
    this.app = app;
    this.map = map;
    this.active = false;
    this.group = new THREE.Group();
    this.group.visible = false;
    map.scene.scene.add(this.group);
    this.buildShip();
    this.starMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#ffd23f' }), MAX);
    this.rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), toon('#9a8a7c', { flatShading: true }), MAX);
    for (const m of [this.starMesh, this.rockMesh]) { m.frustumCulled = false; this.group.add(m); }
    this.hud = new CruiseHud(this, app.hud.touch);
    this.held = {};
    addEventListener('keydown', (e) => this.key(e, true));
    addEventListener('keyup', (e) => this.key(e, false));
  }

  /** A little rocket, nose along +y. */
  buildShip() {
    const g = (this.ship = new THREE.Group()), pink = toon('#ff4d6d');
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 1, 16), toon('#ffffff')));
    g.add(new THREE.Mesh(mergeGeometries([
      new THREE.ConeGeometry(0.17, 0.45, 16).translate(0, 0.72, 0),
      ...[0, 1, 2].map((k) => new THREE.BoxGeometry(0.04, 0.34, 0.26).translate(0.22, -0.38, 0).rotateY((k * Math.PI * 2) / 3)),
    ]), pink));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8).translate(0, 0.2, 0.16), toon('#2d2a5a')));
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.6, 12).rotateX(Math.PI).translate(0, -0.78, 0), new THREE.MeshBasicMaterial({ color: '#ffb21f' }));
    this.flame.layers.set(LAYER_FX);
    g.add(this.flame);
    this.group.add(g);
  }

  /** From body `from` to body `to` (the map's bodies, where they are now); onArrive() once the ship gets there. */
  begin(from, to, onArrive) {
    const a = from.pos.clone(), b = to.pos.clone();
    this.from = from;
    this.to = to;
    this.onArrive = onArrive;
    this.D = b.clone().sub(a).normalize();
    this.U = new THREE.Vector3().crossVectors(this.D, Y);
    if (this.U.lengthSq() < 1e-4) this.U.set(1, 0, 0);
    this.U.normalize();
    this.V = new THREE.Vector3().crossVectors(this.U, this.D).normalize();
    this.S = a.addScaledVector(this.D, from.size * from.scale * 1.6);
    this.b0 = b;                                   // (the Moon shifts as Earth's drawn size changes: the route bends to follow)
    this.len = b.distanceTo(this.S);
    this.L = clamp(this.len * 0.07, 0.45, 9);
    this.time = clamp(8 + this.len / 9, 12, 34);  // seconds at cruising speed
    this.speed = this.len / this.time;
    Object.assign(this, { s: 0, x: 0, y: 0, vx: 0, vy: 0, fuel: 0.5, stars: 0, rocks: 0, slow: 0, shake: 0, t: 0, arrived: false, boosting: false, held: {} });
    this.lay();
    this.map.view.camera.clearViewOffset();
    this.group.visible = true;
    this.active = true;
    this.hud.begin(from, to);
    this.update(0);
  }

  end() {
    this.active = false;
    this.boosting = false;
    this.group.visible = false;
    this.hud.hide();
  }

  /** Stars spread evenly along the way; rocks anywhere, but mostly where the route crosses the asteroid belt. */
  lay(seed = Date.now()) {
    const rng = mulberry32(seed & 0x7fffffff), items = (this.items = []), len = this.len;
    const nStars = Math.min(MAX, Math.round(this.time * 0.9)), nRocks = Math.min(MAX, Math.round(this.time * 0.8));
    for (let i = 0; i < nStars; i++) {
      items.push({ star: true, s: len * (0.08 + (0.84 * (i + rng() * 0.6)) / nStars), x: (rng() * 2 - 1) * 0.8, y: (rng() * 2 - 1) * 0.6, size: 0.13 });
    }
    for (let tries = 0, n = 0; n < nRocks && tries < nRocks * 12; tries++) {
      const s = len * (0.1 + 0.8 * rng()), r = this.at(s, 0, 0, _p).length(), inBelt = r > BELT[0] && r < BELT[1];
      if (rng() > (inBelt ? 1 : 0.3)) continue;
      items.push({ star: false, s, x: (rng() * 2 - 1) * 0.95, y: (rng() * 2 - 1) * 0.8, size: 0.1 + rng() * 0.14, spin: rng() * 6 });
      n++;
    }
  }

  /** A point on the route: s along it, (x, y) across it in lane widths. */
  at(s, x, y, out) {
    out.copy(this.S).addScaledVector(this.D, s).addScaledVector(this.U, x * this.L).addScaledVector(this.V, y * this.L);
    return this.to ? out.addScaledVector(_s.subVectors(this.to.pos, this.b0), s / this.len) : out;
  }

  key(e, down) {
    if (!this.active || e.target?.tagName === 'INPUT') return;
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') { this.boosting = down; e.preventDefault(); return; }
    if (!KEYS[e.code]) return;
    e.preventDefault();
    this.held[e.code] = down;
  }

  // While cruising, CameraRig hands its gestures here: a drag moves the ship across the route.
  dragVelocity(dx, dy) {
    this.x = clamp(this.x + (dx * 2.6) / innerWidth, -1, 1);
    this.y = clamp(this.y - (dy * 2.6) / innerHeight, -1, 1);
    this.vx = clamp(dx * 0.05, -2, 2);
    return [0, 0];
  }
  spin() {}
  zoomBy() {}
  twistBy() {}
  tiltBy() {}

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    let kx = 0, ky = 0;
    for (const [code, on] of Object.entries(this.held)) if (on) { kx += KEYS[code][0]; ky += KEYS[code][1]; }
    const k = Math.min(1, dt * 8);
    this.vx += (kx * 1.7 - this.vx) * k;
    this.vy += (ky * 1.7 - this.vy) * k;
    this.x = clamp(this.x + this.vx * dt, -1, 1);
    this.y = clamp(this.y + this.vy * dt, -1, 1);

    const boost = this.boosting && this.fuel > 0 && !this.arrived;
    if (boost) this.fuel = Math.max(0, this.fuel - dt * 0.25);
    this.slow = Math.max(0, this.slow - dt);
    this.s += (this.arrived ? 0 : this.speed * (boost ? 2 : 1) * (this.slow > 0 ? 0.35 : 1)) * dt;

    for (const it of this.items) {
      if (it.hit) continue;
      const r = it.size + 0.12;
      if (Math.abs(it.s - this.s) / this.L < r && Math.hypot(it.x - this.x, it.y - this.y) < r) { it.hit = true; this.hit(it); }
    }
    const stop = this.len - this.to.size * this.to.scale * 2.4;
    if (!this.arrived && this.s >= stop) {
      this.arrived = true;
      this.s = stop;
      this.onArrive?.();
    }
    this.place(boost);
    this.aim(dt);
    this.hud.update();
  }

  /** A star: fuel and a ding. A rock: knocked back to a crawl for a moment. */
  hit(it) {
    const app = this.app;
    if (it.star) {
      this.stars++;
      this.fuel = Math.min(1, this.fuel + 0.3);
      app.sfx.pop(null, '+⭐', '#ffd23f', 'ding');
      app.haptics?.buzz('tap');
    } else {
      this.rocks++;
      this.slow = 0.9;
      this.shake = 0.5;
      app.sfx.pop(null, 'BONK!', '#ff4d4d', 'crash');
      app.haptics?.buzz('crash');
    }
  }

  /** The ship (leaning into its turns) and the stars and rocks still out there. */
  place(boost) {
    const L = this.L;
    this.at(this.s, this.x, this.y, this.ship.position);
    _q.setFromUnitVectors(Y, this.D);
    this.ship.quaternion.copy(_q).multiply(_q2.setFromAxisAngle(Y, -this.vx * 0.35));
    this.ship.scale.setScalar(L * 0.45);
    this.flame.scale.set(1, (boost ? 1.8 : 1) * (0.8 + Math.random() * 0.4), 1);
    let ns = 0, nr = 0;
    for (const it of this.items) {
      if (it.hit) continue;
      const mesh = it.star ? this.starMesh : this.rockMesh;
      _e.set(this.t * (it.star ? 2 : 0.4) + (it.spin ?? 0), this.t * (it.star ? 0 : 0.3), 0);
      _m.compose(this.at(it.s, it.x, it.y, _p), _q.setFromEuler(_e), _s.setScalar(it.size * L));
      mesh.setMatrixAt(it.star ? ns++ : nr++, _m);
    }
    this.starMesh.count = ns;
    this.rockMesh.count = nr;
    this.starMesh.instanceMatrix.needsUpdate = this.rockMesh.instanceMatrix.needsUpdate = true;
  }

  /** The camera: behind and above the ship; near the end it turns to the world ahead. */
  aim(dt) {
    const cam = this.map.view.camera, L = this.L;
    const w = clamp((this.s - (this.len - 10 * L)) / (8 * L), 0, 1);
    this.at(this.s, this.x * 0.6, this.y * 0.6, cam.position).addScaledVector(this.D, -3.2 * L).addScaledVector(this.V, 1.9 * L);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      cam.position.addScaledVector(_p.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5), this.shake * L * 0.3);
    }
    this.at(this.s + 4 * L, this.x * 0.3, this.y * 0.3, _look).lerp(this.to.pos, w);
    cam.up.copy(this.V);
    cam.lookAt(_look);
    const near = clamp(L * 0.05, 0.02, 2);
    if (cam.near !== near || cam.aspect !== innerWidth / innerHeight) {
      cam.near = near;
      cam.aspect = innerWidth / innerHeight;
      cam.updateProjectionMatrix();
    }
  }
}
