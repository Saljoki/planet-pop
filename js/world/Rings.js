import * as THREE from 'three';
import { TAU } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';

/** Saturn's rings, from the inner edge out (as shares of the way to the outer edge): colour, and how see-through. */
const SATURN = [
  [0, 0.32, '#c4b48f', 0.25],    // the C ring: thin and dusky, so a ship can see through it (it's the part within reach)
  [0.32, 0.6, '#f0ddae', 1],     // the B ring: the brightest
  [0.65, 0.86, '#dcc796', 1],    // the A ring, past the Cassini division…
  [0.875, 0.93, '#dcc796', 1],   // …and the Encke gap
  [0.97, 1, '#f6ead0', 0.85],    // the F ring
];
/** Uranus's: a few narrow dark rings. */
const FAINT = [[0, 0.08, '#8aa3b5', 0.6], [0.42, 0.5, '#8aa3b5', 0.6], [0.88, 1, '#a9c4d4', 0.75]];
const ICE = 220;            // chunks of ice where a ship can reach (Saturn)
const HIT = 0.2;            // how close to a chunk counts as hitting it
const SPIN = 0.015;         // radians a second the ice goes round (the ring drawing just looks the same)
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _s = new THREE.Vector3();
const Z = new THREE.Vector3(0, 0, 1);

/**
 * A giant's rings (planet.world.rings: inner and outer radius, faint for Uranus's thin dark ones), round its equator,
 * square to the sky's spin axis. Saturn's inner edge comes down within a ship's reach, and there the ring is chunks of
 * ice going round: iceAt(pos) says whether something there has hit one (FlightHazards). Saturn's are a landmark
 * ("The rings", in Find) and cast their shadow on the clouds.
 */
export class Rings {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    this.ice = [];
    const spec = planet.world?.rings;
    if (!spec) return;
    this.axis = planet.app.sky.axis.clone();
    this.inner = spec.inner;
    this.outer = spec.outer;
    this.group = new THREE.Group();
    this.group.quaternion.setFromUnitVectors(Z, this.axis);
    planet.root.add(this.group);
    const span = spec.outer - spec.inner;
    for (const [a, b, color, see] of spec.faint ? FAINT : SATURN) {
      const glow = { emissive: color, emissiveIntensity: 0.5 }; // (the Sun only grazes them, but rings shine)
      const mat = toon(color, see < 1 ? { ...glow, transparent: true, opacity: see, depthWrite: false } : glow);
      mat.side = THREE.DoubleSide;
      addMesh(this.group, new THREE.RingGeometry(spec.inner + a * span, spec.inner + b * span, 240, 1), mat, 0, { cast: see >= 1, receive: true });
    }
    if (spec.faint) return;
    this.buildIce(planet);
    const out = new THREE.Vector3().crossVectors(this.axis, new THREE.Vector3(0.3, 0.1, 1)).normalize();
    const e = new PointEntity(out.clone().multiplyScalar(this.inner + 1.2), 'landmark', 'The rings', new THREE.Vector3().crossVectors(this.axis, out));
    e.note = 'Billions of chunks of ice, from specks of dust to the size of a house, in a sheet often only 10 m thick';
    this.entities.push(e);
  }

  /** Chunks of ice from the inner edge out to as high as a ship can climb, in a thin sheet, slowly going round. */
  buildIce(planet) {
    const rng = planet.rng, top = this.inner + 2.4;
    this.iceGroup = new THREE.Group();
    this.group.add(this.iceGroup);
    for (let i = 0; i < ICE; i++) {
      const a = rng.range(0, TAU), r = rng.range(this.inner + 0.05, top);
      this.ice.push({ p: new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, rng.range(-0.05, 0.05)), s: rng.range(0.06, 0.15) });
    }
    const ice = toon('#eaf6ff', { flatShading: true, emissive: '#9fd8ff', emissiveIntensity: 0.35 });
    const mesh = addInstanced(this.iceGroup, new THREE.IcosahedronGeometry(1, 0), ice, ICE, 0.006, { cast: false });
    this.ice.forEach((c, i) => mesh.setMatrixAt(i, _m.compose(c.p, _q.setFromAxisAngle(_p.set(1, 0.3, 0.5).normalize(), i), _s.setScalar(c.s))));
    mesh.instanceMatrix.needsUpdate = true;
    this.angle = 0;
  }

  /** Whether `pos` (planet space) has run into a chunk of ice. */
  iceAt(pos) {
    if (!this.ice.length) return false;
    const h = pos.dot(this.axis);
    if (Math.abs(h) > HIT + 0.05) return false; // (nowhere near the ring's sheet)
    const r = Math.sqrt(pos.lengthSq() - h * h);
    if (r < this.inner - HIT || r > this.inner + 2.4 + HIT) return false;
    _p.copy(pos).applyQuaternion(_q.copy(this.group.quaternion).invert()).applyAxisAngle(Z, -this.angle); // into the ice's own frame
    return this.ice.some((c) => c.p.distanceToSquared(_p) < (HIT + c.s) ** 2);
  }

  update(dt) {
    if (!this.iceGroup) return;
    this.angle = (this.angle + dt * SPIN) % TAU;
    this.iceGroup.rotation.z = this.angle;
  }
}
