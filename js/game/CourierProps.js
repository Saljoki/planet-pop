import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';

const RINGS = 7;
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();
const randomDir = () => {
  const z = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a));
};

/**
 * The things a run puts on the planet: the pink beacon over the destination and the blue rings. Built fresh for each
 * run and thrown away after. Runs decide where things go (see Run.placeRing); this knows how to put them there.
 */
export class CourierProps {
  constructor(planet) {
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
    this.rings = Array.from({ length: RINGS }, () => {
      const ring = addMesh(this.group, geo, mat, 0.01, { cast: false });
      this.scatter(ring);
      return ring;
    });
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

  /** The beacon's ring pulses. */
  update(dt) {
    this.anim += dt;
    const pulse = 1 + Math.sin(this.anim * 4) * 0.08;
    this.beaconRing.scale.set(pulse, 1, pulse);
  }

  dispose() {
    this.group.removeFromParent();
    this.group.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
  }
}
