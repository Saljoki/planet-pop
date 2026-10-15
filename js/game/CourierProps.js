import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';

const RINGS = 7;
const PAD = { pickup: '#2ee59d', dropoff: '#ff5fa2' };
const GATE = 0.17; // half the width of a race checkpoint arch
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const randomDir = () => {
  const z = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a));
};

/**
 * The things a run puts on the planet: the pink beacon over the destination, the blue rings, and on the road a pad
 * to pull in at (with someone waiting there for a taxi) and race checkpoint arches. Built fresh for each run and
 * thrown away after. Runs decide where things go (see Run.placeRing); this knows how to put them there.
 */
export class CourierProps {
  /** rings: how many blue rings (none for the road, where they'd be out of reach). */
  constructor(planet, rings = RINGS) {
    this.planet = planet;
    this.anim = 0;
    this.group = new THREE.Group();
    planet.root.add(this.group);
    this.beacon = new THREE.Group();
    this.beacon.visible = false; // until a run gives it somewhere to be
    this.group.add(this.beacon);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 5, 24, 1, true).translate(0, 2.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    beam.layers.set(LAYER_FX);
    this.beacon.add(beam);
    this.beaconRing = addMesh(this.beacon, new THREE.TorusGeometry(0.75, 0.07, 8, 32).rotateX(Math.PI / 2), toon('#ff5fa2'), 0.01, { cast: false });
    this.beaconRing.position.y = 2.4;
    const geo = new THREE.TorusGeometry(0.42, 0.06, 8, 28), mat = toon('#3fa7ff');
    this.rings = Array.from({ length: rings }, () => {
      const ring = addMesh(this.group, geo, mat, 0.01, { cast: false });
      this.scatter(ring);
      return ring;
    });
    this.buildPad();
    this.gates = [];
  }

  /** A glowing ring on the ground with a beam over it, and someone standing on it (a taxi fare). */
  buildPad() {
    const pad = (this.pad = new THREE.Group());
    pad.visible = false;
    this.group.add(pad);
    this.padMat = new THREE.MeshBasicMaterial({ color: PAD.pickup, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.4, 16, 1, true).translate(0, 0.7, 0), this.padMat);
    beam.layers.set(LAYER_FX);
    pad.add(beam);
    this.padRingMat = toon(PAD.pickup);
    this.padRing = addMesh(pad, new THREE.TorusGeometry(0.13, 0.016, 6, 28).rotateX(Math.PI / 2).translate(0, 0.012, 0), this.padRingMat, 0.004, { cast: false });
    const person = (this.person = new THREE.Group());
    addMesh(person, new THREE.CapsuleGeometry(0.016, 0.026, 3, 8).translate(0, 0.03, 0), (this.shirt = toon('#ff8c42')), 0.004);
    addMesh(person, new THREE.SphereGeometry(0.015, 10, 8).translate(0, 0.072, 0), toon('#f2c08f'), 0.004);
    this.arm = addMesh(person, new THREE.CapsuleGeometry(0.006, 0.03, 3, 6).translate(0, 0.018, 0), this.shirt, 0.003);
    this.arm.position.set(0.02, 0.05, 0);
    pad.add(person);
  }

  /**
   * Show the pad at direction `at` (sitting at radius r): 'pickup' (green, with `shirt`'s person waiting) or
   * 'dropoff' (pink, nobody).
   */
  placePad(at, r, kind = 'pickup', shirt = '#ff8c42') {
    frame(_m, _v.copy(at).multiplyScalar(r), at, tangentBasis(at)[0]);
    this.pad.position.setFromMatrixPosition(_m);
    this.pad.quaternion.setFromRotationMatrix(_m);
    this.padMat.color.set(PAD[kind]);
    this.padRingMat.color.set(PAD[kind]);
    this.person.visible = kind === 'pickup';
    this.shirt.color.set(shirt);
    this.pad.visible = true;
  }

  hidePad() { this.pad.visible = false; }

  /** Race checkpoints: an arch across the road at each { at (unit vector), r (road height), fwd (along the road) }. */
  setGates(list) {
    const geo = new THREE.TorusGeometry(GATE, 0.02, 8, 24, Math.PI);
    this.gates = list.map((g, i) => {
      const mat = toon(i === list.length - 1 ? '#ff5fa2' : '#ffffff');
      const arch = addMesh(this.group, geo, mat, 0.006, { cast: false });
      frame(_m, _v.copy(g.at).multiplyScalar(g.r), g.at, g.fwd);
      arch.position.setFromMatrixPosition(_m);
      arch.quaternion.setFromRotationMatrix(_m);
      arch.userData.mat = mat;
      return arch;
    });
  }

  /** Gates before `next` are passed (hidden); the next one glows yellow (the finish stays pink). */
  markGates(next) {
    this.gates.forEach((g, i) => {
      g.visible = i >= next;
      if (i < this.gates.length - 1) g.userData.mat.color.set(i === next ? '#ffd23f' : '#ffffff');
    });
    this.nextGate = this.gates[next] || null;
  }

  /** The beacon stands over a city: { c: unit vector, u: its "north" }. */
  placeBeacon(site) {
    const c = site.c;
    frame(_m, _v.copy(c).multiplyScalar(this.planet.surfR(c)), c, site.u);
    this.beacon.position.setFromMatrixPosition(_m);
    this.beacon.quaternion.setFromRotationMatrix(_m);
    this.beacon.visible = true;
  }

  /** Anywhere on the planet, facing any way. */
  scatter(ring) {
    const d = randomDir();
    this.put(ring, d, tangentBasis(d)[0].applyAxisAngle(d, Math.random() * TAU));
  }

  /** Somewhere along the way from `from` to `to` (unit vectors), facing `to`. */
  alongRoute(ring, from, to) {
    const d = from.clone().lerp(to, 0.25 + Math.random() * 0.5).normalize();
    const [u, v] = tangentBasis(d);
    d.addScaledVector(u, (Math.random() - 0.5) * 0.24).addScaledVector(v, (Math.random() - 0.5) * 0.24).normalize();
    let fwd = to.clone().addScaledVector(d, -to.dot(d));
    if (fwd.lengthSq() < 1e-6) fwd = u;
    this.put(ring, d, fwd);
  }

  /** A little way ahead of a plane, facing the way it's flying. */
  ahead(ring, plane) {
    const [u] = tangentBasis(plane.up);
    const d = plane.up.clone().addScaledVector(plane.fwd, 0.15 + Math.random() * 0.25).addScaledVector(u, (Math.random() - 0.5) * 0.2).normalize();
    this.put(ring, d, plane.fwd);
  }

  /** At direction d, a random height above sea level but always clear of the ground, facing fwd. */
  put(ring, d, fwd) {
    const alt = Math.max(R + 1.8 + Math.random() * 1.4, this.planet.groundR(d) + 0.9);
    frame(_m, d.clone().multiplyScalar(alt), d, fwd);
    ring.position.setFromMatrixPosition(_m);
    ring.quaternion.setFromRotationMatrix(_m);
  }

  /** The beacon's ring and the pad pulse, the next race gate throbs, and whoever's waiting for a taxi waves. */
  update(dt) {
    this.anim += dt;
    const pulse = 1 + Math.sin(this.anim * 4) * 0.08;
    this.beaconRing.scale.set(pulse, 1, pulse);
    this.padRing.scale.set(pulse, 1, pulse);
    this.arm.rotation.z = -2.4 + Math.sin(this.anim * 9) * 0.5;
    if (this.nextGate) this.nextGate.scale.setScalar(1 + Math.sin(this.anim * 6) * 0.06);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
  }
}
