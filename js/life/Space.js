import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, LAYER_FX, frame, frameFwd, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/InstanceEntity.js';
import { ObjectEntity } from '../core/ObjectEntity.js';
import { Trails } from './Trails.js';

const NO_SHADOW = { cast: false, receive: false };
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _p2 = new THREE.Vector3();
const _up = new THREE.Vector3(), _f = new THREE.Vector3(), _v = new THREE.Vector3();

/** Moon, satellites, a space station and a rocket that launches from its coastal pad. */
export class Space {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    this.buildMoon();
    this.buildSatellites();
    this.buildStation();
    this.buildRocket();
  }

  /** Tilted orbit plane: spin the returned group's Y to orbit around the planet centre. */
  orbitGroup(rx, rz) {
    const tilt = new THREE.Group(), spin = new THREE.Group();
    tilt.rotation.set(rx, 0, rz);
    tilt.add(spin);
    this.planet.root.add(tilt);
    return spin;
  }

  buildMoon() {
    const rng = this.planet.rng;
    this.moonOrbit = this.orbitGroup(0.4, 0.25);
    const moon = addMesh(this.moonOrbit, new THREE.SphereGeometry(1.6, 32, 24), toon('#efeaff'), 0.05, NO_SHADOW);
    moon.position.set(28, 0, 0);
    const craters = Array.from({ length: 8 }, () => { // merged: one draw call instead of eight
      const d = rng.dir(), cr = rng.range(0.18, 0.42);
      return new THREE.SphereGeometry(1, 16, 8).applyMatrix4(frame(_m, _p.copy(d).multiplyScalar(1.6 - cr * 0.15), d, rng.dir(), cr, cr * 0.22, cr));
    });
    moon.add(new THREE.Mesh(mergeGeometries(craters), toon('#c6badf')));
    this.entities.push(new ObjectEntity(moon, 'moon', 'The Moon'));
  }

  buildSatellites() {
    const p = this.planet, rng = p.rng;
    this.sats = [0, 1, 2].map(() => {
      const n = rng.dir(), [u, v] = tangentBasis(n);
      return { u, v, a: rng.range(0, TAU), w: rng.range(0.12, 0.2), r: R + rng.range(6, 7.5) };
    });
    this.satBody = addInstanced(p.root, mergeGeometries([
      new THREE.BoxGeometry(0.12, 0.12, 0.16),
      new THREE.CylinderGeometry(0.01, 0.01, 0.12, 6).translate(0, 0.12, 0),
    ]), toon('#ffd23f'), 3, 0.008, NO_SHADOW);
    const panels = addInstanced(p.root, mergeGeometries([-1, 1].map((s) => new THREE.BoxGeometry(0.3, 0.01, 0.12).translate(s * 0.22, 0, 0))),
      toon('#3f6fff', { flatShading: true }), 3, 0.008, NO_SHADOW);
    shareMatrices(this.satBody, panels);
    this.sats.forEach((_, i) => this.entities.push(new InstanceEntity(this.satBody, i, 'satellite', `PopSat-${i + 1}`)));
  }

  buildStation() {
    this.stationOrbit = this.orbitGroup(-0.5, 0.6);
    const st = (this.station = new THREE.Group());
    st.position.set(R + 9.5, 0, 0);
    this.stationOrbit.add(st);
    const white = toon('#f4f1ff');
    addMesh(st, new THREE.CylinderGeometry(0.16, 0.16, 0.8, 14).rotateX(Math.PI / 2), white, 0.02, NO_SHADOW);
    addMesh(st, new THREE.SphereGeometry(0.15, 12, 10).translate(0, 0, 0.42), white, 0.015, NO_SHADOW);
    addMesh(st, new THREE.BoxGeometry(2.0, 0.05, 0.05), toon('#a39bbd'), 0.01, NO_SHADOW);
    addMesh(st, mergeGeometries([-0.95, -0.6, 0.6, 0.95].map((x) => new THREE.BoxGeometry(0.3, 0.012, 0.5).translate(x, 0, 0))),
      toon('#3f6fff', { flatShading: true }), 0.012, NO_SHADOW);
    addMesh(st, new THREE.TorusGeometry(0.42, 0.045, 8, 32), toon('#ff4d6d'), 0.015, NO_SHADOW);
    this.entities.push(new ObjectEntity(st, 'station', 'Pop Station'));
  }

  buildRocket() {
    const p = this.planet, site = p.padSite;
    if (!site) return;
    const base = p.surfR(site.d) - 0.02;
    this.site = { d: site.d, fwd: site.fwd, base };

    const pad = new THREE.Group();
    pad.matrixAutoUpdate = false;
    frame(pad.matrix, _p.copy(site.d).multiplyScalar(base), site.d, site.fwd);
    pad.matrixWorldNeedsUpdate = true;
    p.root.add(pad);
    addMesh(pad, new THREE.CylinderGeometry(0.24, 0.28, 0.08, 18).translate(0, 0.04, 0), toon('#a39bbd'), 0.01);
    addMesh(pad, mergeGeometries([
      new THREE.BoxGeometry(0.06, 0.78, 0.06).translate(0.18, 0.39, 0),
      new THREE.BoxGeometry(0.12, 0.025, 0.025).translate(0.12, 0.6, 0),
    ]), toon('#ff4d4d'), 0.008);

    const r = (this.rocket = new THREE.Group());
    addMesh(r, new THREE.CylinderGeometry(0.055, 0.06, 0.4, 14).translate(0, 0.28, 0), toon('#ffffff'), 0.008);
    addMesh(r, mergeGeometries([
      new THREE.ConeGeometry(0.055, 0.16, 14).translate(0, 0.56, 0),
      ...[0, 1, 2].map((k) => new THREE.BoxGeometry(0.012, 0.12, 0.08).translate(0.07, 0.12, 0).rotateY((k * TAU) / 3)),
    ]), toon('#ff4d6d'), 0.008);
    addMesh(r, new THREE.SphereGeometry(0.024, 10, 8).translate(0, 0.37, 0.05), toon('#2d2a5a'));
    this.flame = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.24, 10).rotateX(Math.PI).translate(0, -0.06, 0), new THREE.MeshBasicMaterial({ color: '#ffb21f' }));
    this.flame.layers.set(LAYER_FX);
    r.add(this.flame);
    p.root.add(r);

    this.smoke = new Trails(p.root, { max: 300, color: '#f4f1ff', life: 3, grow: 3.2, drag: 1.2 });
    this.rocketEntity = new ObjectEntity(r, 'rocket', 'Pop Rocket');
    this.rocketEntity.getFwd = (out) => out.set(0, 1, 0).applyQuaternion(r.quaternion);
    this.entities.push(this.rocketEntity);
    this.announced = false;
    this.resetRocket();
  }

  resetRocket() {
    const s = this.site;
    this.rocket.visible = true;
    this.rocket.position.copy(s.d).multiplyScalar(s.base + 0.08);
    this.rocket.quaternion.setFromRotationMatrix(frame(_m, _p.set(0, 0, 0), s.d, s.fwd));
    this.flame.visible = false;
    this.state = 'countdown';
    this.timer = this.planet.rng.range(35, 55);
    this.count = 4;
  }

  launch() {
    const app = this.planet.app;
    this.state = 'flight';
    this.t = 0;
    this.smokeT = 0;
    app.sfx?.pop(this.rocket.position.clone(), 'WHOOOSH!', '#ff8c42');
    if (app.camera.position.distanceTo(this.rocket.position) < 8 || app.rig?.entity === this.rocketEntity) app.achievements?.unlock('liftoff');
  }

  endFlight() {
    const app = this.planet.app;
    this.state = 'gone';
    this.timer = 20;
    this.rocket.visible = false;
    this.flame.visible = false;
    this.announced = false;
    if (app.rig?.entity === this.rocketEntity) app.rig.release();
  }

  updateRocket(dt) {
    if (!this.rocket) return;
    const app = this.planet.app, s = this.site;
    this.timer -= dt;
    if (this.state === 'countdown') {
      if (!this.announced && this.timer < 10) {
        this.announced = true;
        if (!app.game?.active) app.hud?.toast('🚀 Rocket launch in 10 seconds! Click the rocket to watch.');
      }
      const c = Math.ceil(this.timer);
      if (c >= 1 && c <= 3 && c < this.count) { this.count = c; app.sfx?.pop(this.rocket.position.clone(), `${c}!`, '#ffd23f'); }
      if (this.timer <= 0) this.launch();
    } else if (this.state === 'flight') {
      this.t += dt;
      const h = 0.22 * this.t * this.t;   // accelerate up…
      const side = 0.012 * h * h;         // …and pitch over (gravity turn)
      this.rocket.position.copy(s.d).multiplyScalar(s.base + 0.08 + h).addScaledVector(s.fwd, side);
      _up.copy(s.d).addScaledVector(s.fwd, 0.024 * h).normalize();
      this.rocket.quaternion.setFromRotationMatrix(frame(_m, _p.set(0, 0, 0), _up, s.fwd));
      this.flame.visible = true;
      this.flame.scale.set(1, 0.8 + Math.random() * 0.6, 1);
      if ((this.smokeT -= dt) <= 0) {
        this.smokeT = 0.03;
        _p.set(0, -0.1, 0).applyQuaternion(this.rocket.quaternion).add(this.rocket.position);
        _v.copy(_up).multiplyScalar(-0.5).add(_p2.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.25));
        this.smoke.emit(_p, 0.05 + Math.min(this.t, 4) * 0.03, _v);
        if (this.t < 2.5) { // billowing ground cloud around the pad
          this.smoke.emit(_p2.copy(s.d).multiplyScalar(s.base + 0.1), 0.09, _v.copy(s.fwd).applyAxisAngle(s.d, Math.random() * TAU).multiplyScalar(0.7));
        }
      }
      if (this.t > 15) this.endFlight();
    } else if (this.timer <= 0) {
      this.resetRocket();
    }
    this.smoke.update(dt);
  }

  update(dt) {
    this.moonOrbit.rotation.y += dt * 0.035;
    this.stationOrbit.rotation.y += dt * 0.08;
    this.station.rotation.x += dt * 0.1;
    this.sats.forEach((s, i) => {
      s.a += s.w * dt;
      _p.copy(s.u).multiplyScalar(Math.cos(s.a)).addScaledVector(s.v, Math.sin(s.a)).multiplyScalar(s.r);
      _f.copy(s.v).multiplyScalar(Math.cos(s.a)).addScaledVector(s.u, -Math.sin(s.a));
      this.satBody.setMatrixAt(i, frameFwd(_m, _p, _up.copy(_p).normalize(), _f));
    });
    this.satBody.instanceMatrix.needsUpdate = true;
    this.updateRocket(dt);
  }
}
