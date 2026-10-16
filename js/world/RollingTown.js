import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, mod, frame } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';
import { ObjectEntity } from '../core/ObjectEntity.js';
import { nightGlowMaterial } from './Glow.js';

const CARS = 3, GAP = 0.68;   // platforms in the train, and how far apart (units along the rails)
const AHEAD = 0.22;           // radians past the dawn line, on the night side
const PYLONS = 120;
const _m = new THREE.Matrix4(), _d = new THREE.Vector3(), _t = new THREE.Vector3(), _p = new THREE.Vector3();

/**
 * A town on rails (Mercury's Terminus, from planet.world.rolling): a train of platforms carrying domes and houses that
 * rolls round the planet at walking pace, staying just ahead of the sunrise, on the night side of the dawn line where
 * it's neither scorching nor freezing. The rails run round the planet's spin axis (the sky's) on pylons, above
 * everything; towns and new mountains keep off their band (Planet.band).
 */
export class RollingTown {
  constructor(planet) {
    this.planet = planet;
    this.entities = [];
    const spec = planet.world?.rolling;
    if (!spec) return;
    const sky = planet.app.sky;
    this.axis = planet.band.axis;
    [this.su, this.sv] = [sky.su.clone(), sky.sv.clone()];
    let top = R + 0.6;
    for (let i = 0; i < 720; i++) top = Math.max(top, planet.surfR(this.at((i / 720) * TAU, _d)));
    this.rail = top + 0.35; // (clear of the highest ground on the way round)
    this.buildRails();
    this.cars = Array.from({ length: CARS }, (_, i) => this.buildCar(i));
    this.phi = this.target();
    const e = new ObjectEntity(this.cars[1], 'rolling', spec.name);
    e.note = spec.note;
    e.getFwd = (out) => this.tangent(this.phi, out);
    this.entities.push(e);
    this.place();
  }

  /** The point on the rails' line at angle phi round the axis (the sky's angle: the Sun is overhead at sky.angle). */
  at(phi, out) { return out.copy(this.su).multiplyScalar(Math.cos(phi)).addScaledVector(this.sv, Math.sin(phi)); }

  /** Which way along the rails increasing phi goes. */
  tangent(phi, out) { return out.copy(this.sv).multiplyScalar(Math.cos(phi)).addScaledVector(this.su, -Math.sin(phi)); }

  /** Where the town wants to be: just past the dawn line, wherever the Sun has got to. */
  target() {
    const sky = this.planet.app.sky, way = Math.sign(sky.dayLength) || 1;
    return sky.angle + way * (Math.PI / 2 + AHEAD);
  }

  buildRails() {
    const root = this.planet.root, metal = toon('#c9c2d8');
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.axis);
    for (const off of [-0.07, 0.07]) {
      const r = Math.sqrt(this.rail * this.rail - off * off);
      const rail = addMesh(root, new THREE.TorusGeometry(r, 0.012, 6, 720), metal, 0.004, { cast: false });
      rail.quaternion.copy(q);
      rail.position.copy(this.axis).multiplyScalar(off);
    }
    const pylon = addInstanced(root, new THREE.BoxGeometry(0.03, 1, 0.12).translate(0, 0.5, 0), toon('#8a8299'), PYLONS, 0.004);
    for (let i = 0; i < PYLONS; i++) {
      const phi = (i / PYLONS) * TAU, d = this.at(phi, _d), base = this.planet.surfR(d) - 0.05;
      frame(_m, _p.copy(d).multiplyScalar(base), d, this.tangent(phi, _t), 1, this.rail - base, 1);
      pylon.setMatrixAt(i, _m);
    }
  }

  /** One platform: a deck on wheels with a glass dome, houses, solar panels and lit windows. */
  buildCar(i) {
    const g = new THREE.Group(), deck = toon('#e2def4');
    addMesh(g, new THREE.BoxGeometry(0.34, 0.05, 0.6).translate(0, 0.03, 0), deck, 0.008);
    addMesh(g, mergeGeometries([-0.2, 0.2].flatMap((z) => [-0.1, 0.1].map((x) =>
      new THREE.BoxGeometry(0.04, 0.03, 0.08).translate(x, -0.005, z)))), toon('#2a2540'), 0.004); // the wheels on the rails
    if (i === 1) addMesh(g, new THREE.SphereGeometry(0.15, 18, 9, 0, TAU, 0, Math.PI / 2).translate(0, 0.055, 0), toon('#cfeaff'), 0.008); // the dome
    const houses = [[-0.09, -0.18, 0.1], [0.09, -0.16, 0.14], [-0.08, 0.17, 0.12], [0.1, 0.2, 0.08]];
    if (i !== 1) houses.push([0, 0, 0.18]);
    const colors = ['#ff9fb1', '#ffd57a', '#9fd8ff', '#d4b8ff', '#a8f0cf'];
    houses.forEach(([x, z, h], k) => addMesh(g, new THREE.BoxGeometry(0.09, h, 0.09).translate(x, 0.055 + h / 2, z), toon(colors[(k + i) % colors.length]), 0.005));
    addMesh(g, new THREE.BoxGeometry(0.3, 0.008, 0.1).translate(0, 0.12, i === 1 ? 0.24 : -0.25), toon('#3f6fff', { flatShading: true }), 0.003);
    addMesh(g, mergeGeometries(houses.map(([x, z, h]) => new THREE.BoxGeometry(0.03, 0.02, 0.092).translate(x, 0.055 + h * 0.6, z))),
      nightGlowMaterial('#f2eefc', '#ffd86b'), 0, { cast: false });
    this.planet.root.add(g);
    return g;
  }

  place() {
    this.cars.forEach((g, i) => {
      const phi = this.phi - ((i - 1) * GAP) / this.rail, d = this.at(phi, _d);
      frame(_m, _p.copy(d).multiplyScalar(this.rail + 0.012), d, this.tangent(phi, _t));
      g.matrixAutoUpdate = false;
      g.matrix.copy(_m);
      g.matrixWorldNeedsUpdate = true;
    });
  }

  update(dt) {
    if (!this.cars) return;
    const want = this.target(), gap = mod(want - this.phi + Math.PI, TAU) - Math.PI;
    this.phi += gap * Math.min(1, dt * 0.6); // (glides to keep up when time runs faster)
    this.place();
  }
}
