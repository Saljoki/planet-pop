import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU, LAYER_FX, ease, frame, frameFwd } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { nightGlowMaterial } from '../world/Glow.js';

const NAMES = ['Whirly', 'Chopper Chuck', 'Buzz'];
const COLORS = ['#ff4d4d', '#3fa7ff', '#ffd23f'];
const COUNT = 2, SPEED = 0.9, CLEAR = 0.5, HOVER = [5, 8];
const _p = new THREE.Vector3(), _d = new THREE.Vector3(), _f = new THREE.Vector3(), _up = new THREE.Vector3(), _q = new THREE.Vector3();
const _m = new THREE.Matrix4(), _r = new THREE.Matrix4(), _c = new THREE.Color();

/** Spherical interpolation between unit vectors a and b (angle th apart). */
function slerp(out, a, b, th, k) {
  if (th < 1e-5) return out.copy(a);
  const s = Math.sin(th);
  return out.copy(a).multiplyScalar(Math.sin((1 - k) * th) / s).addScaledVector(b, Math.sin(k * th) / s);
}

/**
 * Sightseeing helicopters hopping from town to town: they hover over each one for a few seconds,
 * rotors whirring, and sweep a searchlight over the streets at night.
 */
export class Helicopters {
  constructor(planet) {
    this.planet = planet;
    const sites = planet.cities.sites, rng = planet.rng, root = planet.root;
    this.list = sites.length ? Array.from({ length: COUNT }, (_, i) => {
      const at = sites[(i * 2) % sites.length];
      return { at, from: at.c.clone(), to: at.c.clone(), th: 0, t: 0, dur: 0, state: 'hover', wait: rng.range(1, HOVER[1]),
        r: this.hoverR(at), fwd: at.u.clone(), spin: rng.range(0, TAU), bob: rng.range(0, TAU) };
    }) : [];
    const n = this.list.length;
    this.body = addInstanced(root, mergeGeometries([
      new THREE.SphereGeometry(1, 16, 12).scale(0.056, 0.05, 0.075),
      new THREE.CylinderGeometry(0.014, 0.008, 0.14, 8).rotateX(Math.PI / 2).translate(0, 0.015, -0.13), // tail boom
      new THREE.BoxGeometry(0.006, 0.042, 0.026).translate(0, 0.036, -0.195),                         // fin
    ]), toon('#ffffff'), n, 0.007);
    const glass = addInstanced(root, new THREE.SphereGeometry(0.044, 12, 8, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2).translate(0, 0.012, 0.03),
      toon('#9fe8ff', { emissive: '#2a8fb0', emissiveIntensity: 0.4 }), n, 0, { detail: 9 });
    const gear = addInstanced(root, mergeGeometries([
      ...[-1, 1].map((s) => new THREE.BoxGeometry(0.006, 0.006, 0.13).translate(s * 0.036, -0.066, 0)),            // skids
      ...[-1, 1].flatMap((s) => [-1, 1].map((z) => new THREE.BoxGeometry(0.004, 0.024, 0.004).translate(s * 0.032, -0.054, z * 0.03))),
      new THREE.CylinderGeometry(0.006, 0.006, 0.03, 6).translate(0, 0.06, 0),                                       // rotor mast
    ]), toon('#2a2540'), n, 0, { detail: 8 });
    const beacon = addInstanced(root, new THREE.SphereGeometry(0.008, 6, 4).translate(0, 0.06, -0.2), nightGlowMaterial('#9a4a5a', '#ff3b3b'), n, 0, { cast: false, detail: 9 });
    shareMatrices(this.body, glass, gear, beacon);
    this.list.forEach((_, i) => this.body.setColorAt(i, _c.set(COLORS[i % COLORS.length])));
    // the rotors spin on their own matrices
    this.rotor = addInstanced(root, mergeGeometries([new THREE.BoxGeometry(0.27, 0.004, 0.016), new THREE.BoxGeometry(0.016, 0.004, 0.27)]),
      toon('#3a3555'), n, 0.004, { cast: false });
    this.tail = addInstanced(root, mergeGeometries([new THREE.BoxGeometry(0.004, 0.06, 0.01), new THREE.BoxGeometry(0.004, 0.01, 0.06)]),
      toon('#3a3555'), n, 0, { cast: false, detail: 8 });
    this.light = addInstanced(root, new THREE.ConeGeometry(0.3, 1, 20, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      n, 0, { cast: false, receive: false });
    this.light.layers.set(LAYER_FX);
    this.light.setColorAt(0, _c.set('#000000'));
    this.entities = this.list.map((_, i) => new InstanceEntity(this.body, i, 'helicopter', NAMES[i % NAMES.length]));
    this.update(0);
  }

  /** Hovering height over a town: clear of its tallest towers. */
  hoverR(city) { return this.planet.groundR(city.c) + CLEAR; }

  /** Off to one of the two nearest other towns (or the same one again on a one-town planet). */
  depart(h) {
    const sites = this.planet.cities.sites.filter((s) => s !== h.at).sort((a, b) => a.c.angleTo(h.at.c) - b.c.angleTo(h.at.c));
    const next = sites.length ? sites[Math.floor(Math.random() * Math.min(2, sites.length))] : h.at;
    h.from.copy(h.at.c);
    h.to.copy(next.c);
    h.th = h.from.angleTo(h.to);
    h.next = next;
    h.state = 'fly';
    h.t = 0;
    h.dur = Math.max(4, (h.th * h.r) / SPEED);
    h.rFrom = h.r;
    h.rTo = this.hoverR(next);
    h.cruise = Math.max(h.rFrom, h.rTo);
    const d = new THREE.Vector3(); // (not _d: update() is still using it)
    for (let k = 1; k < 24; k++) h.cruise = Math.max(h.cruise, this.planet.groundR(slerp(d, h.from, h.to, h.th, k / 24)) + CLEAR);
  }

  arrive(h) {
    h.at = h.next;
    h.state = 'hover';
    h.wait = HOVER[0] + Math.random() * (HOVER[1] - HOVER[0]);
    const app = this.planet.app;
    _p.copy(h.at.c).multiplyScalar(h.r);
    if (app.camera.position.distanceTo(_p) < 4) app.sfx?.pop(_p.clone(), 'WHUP WHUP!', '#3fa7ff');
  }

  update(dt) {
    const p = this.planet;
    this.list.forEach((h, i) => {
      let tilt = 0;
      if (h.state === 'hover') {
        _d.copy(h.at.c);
        h.r = this.hoverR(h.at) + Math.sin((h.bob += dt * 1.3)) * 0.03;
        h.fwd.applyAxisAngle(_d, dt * 0.35); // slowly turning on the spot to take in the view
        if ((h.wait -= dt) <= 0) this.depart(h);
      } else {
        h.t += dt;
        const k = Math.min(h.t / h.dur, 1), e = ease(k);
        slerp(_d, h.from, h.to, h.th, e);
        const lift = Math.min(1, k * 5, (1 - k) * 5); // climb out, cruise, descend into the next town
        h.r = Math.max((h.rFrom + (h.rTo - h.rFrom) * e) * (1 - lift) + h.cruise * lift, p.groundR(_d) + 0.3);
        _f.copy(h.to).addScaledVector(_d, -h.to.dot(_d));
        if (_f.lengthSq() > 1e-8) h.fwd.lerp(_f.normalize(), Math.min(1, dt * 3)); // turn smoothly onto the heading
        tilt = 0.22 * Math.sin(k * Math.PI);                                         // nose down while going fast
        if (k >= 1) this.arrive(h);
      }
      _up.copy(_d);
      h.fwd.addScaledVector(_up, -h.fwd.dot(_up)).normalize();
      _q.copy(h.fwd).multiplyScalar(Math.cos(tilt)).addScaledVector(_up, -Math.sin(tilt));
      _p.copy(_d).multiplyScalar(h.r);
      frameFwd(_m, _p, _up, _q);
      this.body.setMatrixAt(i, _m);
      h.spin += dt * 22;
      this.rotor.setMatrixAt(i, _r.makeRotationY(h.spin).setPosition(0, 0.076, 0).premultiply(_m));
      this.tail.setMatrixAt(i, _r.makeRotationX(h.spin * 1.4).setPosition(0.012, 0.036, -0.2).premultiply(_m));
      // searchlight straight down to the ground, only at night
      const night = p.nightAt(_p), drop = h.r - p.surfR(_d) - 0.05;
      if (night > 0.05 && drop > 0.1) {
        this.light.setMatrixAt(i, frame(_m, _q.copy(_d).multiplyScalar(h.r - 0.06), _d, h.fwd, 1, drop, 1));
        this.light.setColorAt(i, _c.setRGB(1, 0.95, 0.75).multiplyScalar(night));
      } else this.light.setMatrixAt(i, _m.makeScale(0, 0, 0));
    });
    for (const m of [this.body, this.rotor, this.tail, this.light]) m.instanceMatrix.needsUpdate = true;
    if (this.light.instanceColor) this.light.instanceColor.needsUpdate = true;
  }
}
