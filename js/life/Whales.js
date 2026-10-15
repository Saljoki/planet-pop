import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, ease, frameFwd, tangentBasis, smallCircle } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { Trails } from './Trails.js';

const NAMES = ['Humphrey', 'Big Blue', 'Barnacle Bill', 'Splashy', 'Moby'];
const COLORS = ['#4f6db8', '#5b5f97', '#3d7ea6', '#6a5acd'];
const COUNT = 4, SPEED = 0.12, BREACH_CHANCE = 0.35;
const DEEP = -0.17, TOP = -0.028, JUMP = 0.34;                  // body centre below sea level: hidden, back awash, top of a leap
const TIME = { swim: [8, 14], rise: [1.2, 1.2], blow: [4.5, 6], breach: [1.8, 1.8], dive: [1.6, 1.6] };
const _p = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3(), _q = new THREE.Vector3();
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Whales cruising the deep sea. Every so often one surfaces to blow a spout, sometimes leaps clear of the water
 * and lands with a splash, then dives with its tail in the air. No whales in a sea of lava.
 */
export class Whales {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng;
    this.list = [];
    const count = planet.theme.sea.boats ? COUNT : 0;
    for (let tries = 0; this.list.length < count && tries < 4000; tries++) {
      const c = rng.dir();
      if (planet.heightAt(c) > -0.45 || this.list.some((w) => w.c.angleTo(c) < 0.5)) continue;
      if (planet.boats?.boats.some((b) => b.c.angleTo(c) < 0.15)) continue;
      const [u, v] = tangentBasis(c), A = rng.range(0.06, 0.1);
      let ok = true;
      for (let k = 0; k < 16 && ok; k++) ok = planet.heightAt(smallCircle(_p, c, u, v, A, (k / 16) * TAU)) < -0.3;
      if (!ok) continue;
      const w = (SPEED / (R * Math.sin(A))) * (rng.chance(0.5) ? 1 : -1);
      this.list.push({ c, u, v, A, w, phi: rng.range(0, TAU), state: 'swim', t: 0, dur: rng.range(1, 10), y: DEEP, pitch: 0, roll: 0, spoutT: 0 });
    }
    const n = this.list.length, root = planet.root;
    this.body = addInstanced(root, new THREE.SphereGeometry(1, 18, 12).scale(0.066, 0.056, 0.13), toon('#ffffff'), n, 0.008);
    const belly = addInstanced(root, new THREE.SphereGeometry(1, 16, 10).scale(0.058, 0.04, 0.118).translate(0, -0.022, 0.008), toon('#dfe8ff'), n, 0, { detail: 9 });
    const fins = addInstanced(root, mergeGeometries([
      new THREE.CylinderGeometry(0.03, 0.012, 0.09, 10).rotateX(Math.PI / 2).translate(0, 0.006, -0.15), // tail stock
      ...[-1, 1].map((s) => new THREE.BoxGeometry(0.075, 0.008, 0.036).rotateY(-s * 0.45).translate(s * 0.033, 0.008, -0.198)), // flukes
      ...[-1, 1].map((s) => new THREE.BoxGeometry(0.055, 0.006, 0.026).rotateZ(s * 0.45).rotateY(s * 0.3).translate(s * 0.07, -0.028, 0.035)), // flippers
    ]), toon('#ffffff'), n, 0.006);
    const eyes = addInstanced(root, mergeGeometries([-1, 1].map((s) => new THREE.SphereGeometry(0.009, 8, 6).translate(s * 0.052, 0.008, 0.08))),
      toon('#1d1a33'), n, 0, { cast: false, detail: 6 });
    shareMatrices(this.body, belly, fins, eyes);
    this.list.forEach((_, i) => {
      _c.set(COLORS[i % COLORS.length]);
      this.body.setColorAt(i, _c);
      fins.setColorAt(i, _c);
    });
    this.spray = new Trails(root, { max: 160, color: '#ffffff', life: 1.3, grow: 2.6, drag: 1.6 });
    this.entities = this.list.map((w, i) => Object.assign(new InstanceEntity(this.body, i, 'whale', NAMES[i % NAMES.length]), {
      hidden: () => w.y < -0.07, // deep under water: can't be clicked
    }));
    this.update(0);
  }

  /** True while whale `i` is in the air. */
  breaching(i) { return this.list[i]?.state === 'breach'; }

  /** For the tour: come up now, blow briefly, then leap. */
  showOff(i) {
    const w = this.list[i];
    if (!w) return;
    w.force = true;
    if (w.state === 'swim' || w.state === 'dive') Object.assign(w, { state: 'rise', t: 0, dur: TIME.rise[0] });
  }

  next(w) {
    const after = { swim: 'rise', rise: 'blow', blow: w.force || Math.random() < BREACH_CHANCE ? 'breach' : 'dive', breach: 'dive', dive: 'swim' };
    w.state = after[w.state];
    w.t = 0;
    const [a, b] = TIME[w.state];
    w.dur = a + Math.random() * (b - a);
    if (w.force && w.state === 'blow') w.dur = 3;
    if (w.state === 'breach') w.force = false;
    if (w.state === 'breach') this.say(w, 'WHOOSH!', '#9fe8ff', false);
  }

  update(dt) {
    this.list.forEach((w, i) => {
      if ((w.t += dt) >= w.dur) {
        if (w.state === 'breach') this.splash(w);
        this.next(w);
      }
      const k = Math.min(w.t / w.dur, 1);
      switch (w.state) {
        case 'swim': w.y = DEEP; w.pitch = 0; w.roll = 0; break;
        case 'rise': w.y = DEEP + (TOP - DEEP) * ease(k); w.pitch = 0.3 * Math.sin(k * Math.PI); break;
        case 'blow': w.y = TOP + Math.sin(w.t * 2.4) * 0.006; w.pitch = 0; break;
        case 'breach': // a leap: nose up out of the water, a half twist at the top, nose down back in
          w.y = TOP + JUMP * 4 * k * (1 - k);
          w.pitch = 1.1 * (1 - 2 * k) * Math.min(1, 6 * k, 6 * (1 - k));
          w.roll = Math.sin(k * Math.PI) * 1.2;
          break;
        case 'dive': w.y = TOP + (DEEP - TOP) * ease(k); w.pitch = -0.75 * Math.sin(Math.min(k * 1.3, 1) * Math.PI * 0.5); w.roll = 0; break;
      }
      w.phi += w.w * dt * (w.state === 'blow' ? 0.5 : 1);
      smallCircle(_p, w.c, w.u, w.v, w.A, w.phi);
      _up.copy(_p);
      _f.copy(w.u).multiplyScalar(-Math.sin(w.phi)).addScaledVector(w.v, Math.cos(w.phi)).multiplyScalar(Math.sign(w.w));
      _q.copy(_f).multiplyScalar(Math.cos(w.pitch)).addScaledVector(_up, Math.sin(w.pitch)); // nose up or down
      _p.multiplyScalar(R + w.y);
      frameFwd(_m, _p, _up, _q);
      if (w.roll) _m.multiply(_r.makeRotationZ(w.roll));
      this.body.setMatrixAt(i, _m);
      if (w.state === 'blow' && (w.spoutT -= dt) <= 0) {
        w.spoutT = 1.5;
        for (let s = 0; s < 6; s++) {
          this.spray.emit(_q.set(0, 0.05, 0.06).applyMatrix4(_m), 0.022 + s * 0.004, _f.copy(_up).multiplyScalar(0.55 + s * 0.12));
        }
        if (Math.random() < 0.5) this.say(w, 'PFFFT!', '#9fe8ff', true);
      }
    });
    this.body.instanceMatrix.needsUpdate = true;
    this.spray.update(dt);
  }

  /** Back into the sea: a ring of spray, a SPLOOSH, and a trophy for anyone watching up close. */
  splash(w) {
    smallCircle(_p, w.c, w.u, w.v, w.A, w.phi);
    const [u, v] = tangentBasis(_p);
    _q.copy(_p).multiplyScalar(R + 0.02);
    for (let s = 0; s < 14; s++) {
      const a = (s / 14) * TAU;
      _f.copy(u).multiplyScalar(Math.cos(a) * 0.35).addScaledVector(v, Math.sin(a) * 0.35).addScaledVector(_p, 0.6);
      this.spray.emit(_q, 0.035, _f);
    }
    if (this.say(w, 'SPLOOSH!', '#3fa7ff', false)) this.planet.app.achievements?.unlock('whalewatcher');
  }

  /** A speech bubble over the whale if the camera is close enough; returns whether it was. */
  say(w, text, color, quiet) {
    const app = this.planet.app;
    smallCircle(_p, w.c, w.u, w.v, w.A, w.phi).multiplyScalar(R + 0.25);
    if (app.camera.position.distanceTo(_p) > (quiet ? 3.5 : 5)) return false;
    app.sfx?.pop(_p.clone(), text, color);
    return true;
  }
}
