import * as THREE from 'three';
import { R, LAYER_FX, tangentBasis } from '../core/Geo.js';
import { addInstanced } from '../render/Outline.js';

const MAX = 24, SHOWER = 10, FLIGHT = 1.1;
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _x = new THREE.Vector3(), _y = new THREE.Vector3();
const _m = new THREE.Matrix4(), _c = new THREE.Color();

/** A thin bar with its head at the origin and a tapered tail along -z that fades to nothing. */
function streakGeometry() {
  const g = new THREE.BoxGeometry(0.08, 0.08, 1, 1, 1, 6).translate(0, 0, -0.5), pos = g.attributes.position, col = [];
  for (let i = 0; i < pos.count; i++) {
    const t = -pos.getZ(i); // 0 at the head, 1 at the tail
    pos.setXY(i, pos.getX(i) * (1 - 0.8 * t), pos.getY(i) * (1 - 0.8 * t));
    const k = (1 - t) ** 2;
    col.push(k, k, k);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

/** Every couple of minutes a meteor shower streaks across the night side: glowing trails that burn out on the way down. */
export class Meteors {
  constructor(planet) {
    this.planet = planet;
    this.timer = 40 + Math.random() * 40;
    this.shower = 0;
    this.spawnT = 0;
    this.list = Array.from({ length: MAX }, () => ({ live: false, p: new THREE.Vector3(), v: new THREE.Vector3(), t: 0, len: 1 }));
    this.mesh = addInstanced(planet.root, streakGeometry(),
      new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), MAX, 0, { cast: false, receive: false });
    this.mesh.layers.set(LAYER_FX);
    this.mesh.setColorAt(0, _c.set('#ffffff'));
    this.update(0);
  }

  get active() { return this.shower > 0; }

  start() {
    const app = this.planet.app;
    this.shower = SHOWER;
    if (this.planet.nightAt(app.camera.position) > 0.5) { // the camera is on the night side: it gets the show
      if (!app.game?.active) app.hud?.toast('🌠 Meteor shower! Make a wish.');
      app.achievements?.unlock('shootingstar');
    }
  }

  /** Where the camera is looking when it's night there, otherwise somewhere on the night side. */
  spawn() {
    const m = this.list.find((x) => !x.live);
    if (!m) return;
    const app = this.planet.app, sun = app.sky.sunDir;
    const aim = app.camera.getWorldDirection(_d).multiplyScalar(12).add(app.camera.position).normalize();
    const near = this.planet.nightAt(aim) > 0.5;
    let d = null;
    for (let tries = 0; tries < 30 && !d; tries++) {
      _p.randomDirection();
      if (near) _p.multiplyScalar(0.35).add(aim).normalize();
      if (_p.dot(sun) < -0.15) d = _p.clone();
    }
    if (!d) return;
    const [u, v] = tangentBasis(d), a = Math.random() * Math.PI * 2;
    const across = u.multiplyScalar(Math.cos(a)).addScaledVector(v, Math.sin(a));
    m.live = true;
    m.t = 0;
    m.len = 1.2 + Math.random() * 1.4;
    m.p.copy(d).multiplyScalar(R + 9 + Math.random() * 3); // just above the clouds, so they streak across a low view too
    m.v.copy(across).multiplyScalar(6 + Math.random() * 3).addScaledVector(d, -(3 + Math.random() * 2));
    if (app.camera.position.distanceTo(m.p) < 14 && Math.random() < 0.3) app.sfx?.play('whoosh');
  }

  update(dt) {
    if (this.shower > 0) {
      this.shower -= dt;
      if ((this.spawnT -= dt) <= 0) { this.spawnT = 0.25 + Math.random() * 0.6; this.spawn(); }
    } else if ((this.timer -= dt) <= 0) {
      this.timer = 90 + Math.random() * 60;
      this.start();
    }
    this.list.forEach((m, i) => {
      if (m.live && (m.t += dt) > FLIGHT) m.live = false;
      if (!m.live) { this.mesh.setMatrixAt(i, _m.makeScale(0, 0, 0)); return; }
      m.p.addScaledVector(m.v, dt);
      const k = Math.sin((m.t / FLIGHT) * Math.PI); // flares up, then burns out
      _d.copy(m.v).normalize();
      _x.crossVectors(_y.copy(m.p).normalize(), _d).normalize();
      _y.crossVectors(_d, _x);
      _m.makeBasis(_x.multiplyScalar(1 + k), _y.multiplyScalar(1 + k), _d.multiplyScalar(m.len * k)).setPosition(m.p);
      this.mesh.setMatrixAt(i, _m);
      this.mesh.setColorAt(i, _c.setRGB(1, 0.9 + 0.1 * k, 0.6 + 0.4 * k).multiplyScalar(k));
    });
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }
}
