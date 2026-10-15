import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, LAYER_FX, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';

const DROPS = 110, FLAKES = 26;
const SPRINKLES = ['#ff5fa2', '#3fa7ff', '#ffd23f', '#2ee59d', '#ffffff'];
/** What falls from a storm cloud: size, fall speed (units/s) and shape, per theme. */
const PRECIP = {
  rain: { geo: () => new THREE.BoxGeometry(0.008, 0.16, 0.008), speed: [2.6, 3.4] },
  snow: { geo: () => new THREE.IcosahedronGeometry(0.022, 0), speed: [0.55, 0.85] },
  sprinkles: { geo: () => new THREE.CapsuleGeometry(0.008, 0.04, 2, 4), speed: [1.4, 1.9] },
  ash: { geo: () => new THREE.IcosahedronGeometry(0.018, 0), speed: [0.7, 1.1] },
};
const Y = new THREE.Vector3(0, 1, 0);
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

function puffCluster(rng, d, alt, s, out) {
  frame(_m, _p.copy(d).multiplyScalar(alt), d, rng.dir(), s, s * 0.75, s);
  const count = rng.int(4, 7);
  for (let k = 0; k < count; k++) {
    const x = (k / (count - 1) - 0.5) * 1.5, r = rng.range(0.3, 0.42) * (1 - Math.abs(x) * 0.45);
    out.push(new THREE.SphereGeometry(r, 16, 12)
      .translate(x, rng.range(0, 0.1) + (0.75 - Math.abs(x)) * 0.18, rng.range(-0.18, 0.18))
      .applyMatrix4(_m));
  }
}

/** Drifting clouds that cast shadows, thunderstorms with rain (or snow, ash, sprinkles) and lightning, snow over the peaks. */
export class Weather {
  constructor(planet) {
    this.planet = planet;
    this.group = new THREE.Group();
    planet.root.add(this.group);
    this.spin = new THREE.Vector3(0.1, 1, -0.15).normalize();
    this.buildClouds();
    this.buildRain();
    this.buildBolt();
    this.buildSnow();
    const g = this.group;
    this.entities = this.storms.map((s, i) => ({
      kind: 'storm', name: `Thunder Cloud ${i + 1}`, moving: true, storm: s,
      getPos: (out) => this.stormCenter(s, out),
      getFwd: (out) => out.copy(s.u).applyQuaternion(g.quaternion),
    }));
  }

  /** World position of a thundercloud's core (the clouds drift, so this changes over time). */
  stormCenter(s, out) { return this.group.localToWorld(out.copy(s.d).multiplyScalar(s.alt)); }

  /** The thundercloud whose core contains `pos`, if any. */
  stormAt(pos, radius = 1.15) {
    return this.storms.find((s) => this.stormCenter(s, _p).distanceTo(pos) < radius) || null;
  }

  buildClouds() {
    const rng = this.planet.rng, look = this.planet.theme, fair = [], dark = [];
    for (let i = 0; i < 22; i++) puffCluster(rng, rng.dir(), R + rng.range(2.4, 3.2), rng.range(0.8, 1.3), fair);
    this.storms = [];
    for (let i = 0; i < look.storms; i++) {
      const d = rng.dir(), alt = R + rng.range(2.5, 2.9), s = rng.range(1.4, 1.7);
      puffCluster(rng, d, alt, s, dark);
      const [u, v] = tangentBasis(d);
      this.storms.push({ d, u, v, alt, foot: (s * 0.55) / R, timer: rng.range(2, 8) });
    }
    const opts = { near: 1.0, receive: false }; // flying through a cloud doesn't black out the view
    const c = look.clouds;
    addMesh(this.group, mergeGeometries(fair), toon(c.fair, { emissive: c.fairGlow, emissiveIntensity: 0.3 }), 0.05, opts);
    addMesh(this.group, mergeGeometries(dark), toon(c.dark, { emissive: c.darkGlow, emissiveIntensity: 0.3 }), 0.05, opts);
  }

  buildRain() {
    const rng = this.planet.rng, precip = this.planet.theme.precip, kind = PRECIP[precip.kind];
    this.drops = [];
    for (const s of this.storms) {
      for (let k = 0; k < DROPS; k++) {
        const a = rng.range(0, TAU), rr = Math.sqrt(rng.next()) * s.foot;
        const dir = s.d.clone().addScaledVector(s.u, Math.cos(a) * rr).addScaledVector(s.v, Math.sin(a) * rr).normalize();
        this.drops.push({ s, dir, r: rng.range(R, s.alt), speed: rng.range(...kind.speed) });
      }
    }
    this.precip = precip.kind;
    this.rain = addInstanced(this.group, kind.geo(), new THREE.MeshBasicMaterial({ color: precip.color }),
      this.drops.length, 0, { cast: false, receive: false });
    if (precip.kind === 'sprinkles') this.drops.forEach((_, i) => this.rain.setColorAt(i, new THREE.Color(SPRINKLES[i % SPRINKLES.length])));
    this.rain.layers.set(LAYER_FX);
  }

  buildBolt() {
    const geo = new THREE.CylinderGeometry(0.028, 0.028, 1, 5), mat = new THREE.MeshBasicMaterial({ color: '#fff7a1' });
    this.bolt = new THREE.Group();
    this.bolt.visible = false;
    this.segs = Array.from({ length: 8 }, () => {
      const m = new THREE.Mesh(geo, mat);
      m.layers.set(LAYER_FX);
      this.bolt.add(m);
      return m;
    });
    this.planet.root.add(this.bolt);
    this.boltT = 0;
  }

  buildSnow() {
    const p = this.planet, rng = p.rng;
    const peaks = (p.theme.mountains.snow ? p.nature?.mountains || [] : [])
      .filter((m) => m.base + m.hgt > R + 1.4 && !m.volcano)
      .sort((a, b) => b.base + b.hgt - (a.base + a.hgt))
      .slice(0, 6);
    this.flakes = [];
    for (const m of peaks) {
      const [u, v] = tangentBasis(m.d), top = m.base + m.hgt;
      for (let k = 0; k < FLAKES; k++) {
        this.flakes.push({ m, u, v, top, a: rng.range(0, TAU), rad: rng.range(0.1, 0.65) * m.s,
          y: rng.range(top - m.hgt * 0.6, top + 0.5), speed: rng.range(0.12, 0.2), ph: rng.range(0, TAU) });
      }
    }
    this.snow = addInstanced(p.root, new THREE.IcosahedronGeometry(0.02, 0), toon('#ffffff', { flatShading: true }), this.flakes.length, 0, { cast: false });
  }

  /** Lightning from storm `s` down to the ground. With `aim`, the bolt passes exactly through that point. */
  strike(s, aim = null) {
    const p = this.planet, app = p.app;
    this.group.updateMatrixWorld(true);
    const topR = aim ? Math.max(s.alt + 0.15, aim.length() + 0.35) : s.alt - 0.3;
    const top = this.group.localToWorld(_a.copy(s.d).multiplyScalar(s.alt)).setLength(topR);
    const up = (aim || top).clone().normalize(), [u, v] = tangentBasis(up);
    const bottom = _b.copy(up).addScaledVector(u, (Math.random() - 0.5) * 0.06).addScaledVector(v, (Math.random() - 0.5) * 0.06).normalize();
    bottom.multiplyScalar(p.groundR(bottom));
    const pts = [];
    for (let k = 0; k <= 8; k++) {
      const q = !aim ? new THREE.Vector3().lerpVectors(top, bottom, k / 8)
        : k <= 4 ? new THREE.Vector3().lerpVectors(top, aim, k / 4)
        : new THREE.Vector3().lerpVectors(aim, bottom, (k - 4) / 4);
      if (k > 0 && k < 8 && !(aim && k === 4)) q.addScaledVector(u, (Math.random() - 0.5) * 0.24).addScaledVector(v, (Math.random() - 0.5) * 0.24);
      pts.push(q);
    }
    this.segs.forEach((m, k) => {
      _d.subVectors(pts[k + 1], pts[k]);
      const len = _d.length();
      m.position.copy(pts[k]).add(pts[k + 1]).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(Y, _d.normalize());
      m.scale.set(1, len, 1);
    });
    this.bolt.visible = true;
    this.boltT = 0.35;

    const cam = app.camera.position;
    if (_d.copy(cam).normalize().dot(up) > 0.3) {   // strike is on the side we're looking at
      app.hud?.flash?.();
      app.sfx?.pop(bottom.clone(), 'KRAKA-BOOM!', '#ffd23f');
    }
    if (cam.distanceTo(bottom) < 7) app.achievements?.unlock('stormchaser');
  }

  update(dt, t) {
    this.group.rotateOnWorldAxis(this.spin, dt * 0.012);

    this.drops.forEach((dp, i) => {
      dp.r -= dp.speed * dt;
      if (dp.r < R - 0.1) dp.r = dp.s.alt - 0.25;
      this.rain.setMatrixAt(i, frame(_m, _p.copy(dp.dir).multiplyScalar(dp.r), dp.dir, dp.s.u));
    });
    this.rain.instanceMatrix.needsUpdate = true;

    for (const s of this.storms) {
      if ((s.timer -= dt) <= 0) { s.timer = 4 + Math.random() * 6; this.strike(s); }
    }
    if (this.boltT > 0) {
      this.boltT -= dt;
      this.bolt.visible = this.boltT > 0 && Math.floor(this.boltT * 40) % 3 !== 0; // flicker
    }

    this.flakes.forEach((f, i) => {
      f.y -= f.speed * dt;
      if (f.y < f.top - f.m.hgt * 0.6) f.y = f.top + 0.5;
      const w = Math.sin(t * 1.5 + f.ph) * 0.05;
      _p.copy(f.m.d).multiplyScalar(f.y).addScaledVector(f.u, Math.cos(f.a) * f.rad + w).addScaledVector(f.v, Math.sin(f.a) * f.rad);
      this.snow.setMatrixAt(i, _m.makeTranslation(_p.x, _p.y, _p.z));
    });
    this.snow.instanceMatrix.needsUpdate = true;
  }
}
