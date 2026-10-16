import * as THREE from 'three';
import { frame, tangentBasis } from '../core/Geo.js';
import { fromLatLon } from '../core/WorldShape.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';

const _m = new THREE.Matrix4(), _p = new THREE.Vector3();

/**
 * The named places of a real world (Mount Everest, Tranquility Base, Olympus Mons…): each gets a little flag on the
 * ground and can be found, followed and read about (its note says what's real about it). Tranquility Base also gets
 * the lander Apollo 11 left behind. Built on the finished terrain.
 */
export class Landmarks {
  constructor(planet) {
    this.planet = planet;
    this.list = (planet.world?.landmarks || []).map((l) => ({ ...l, d: new THREE.Vector3(...fromLatLon(l.lat, l.lon)) }));
    this.entities = this.list.map((l) => {
      const e = new PointEntity(_p.copy(l.d).multiplyScalar(planet.meshR(l.d) + 0.05), 'landmark', l.name, tangentBasis(l.d)[0]);
      e.note = l.note;
      return e;
    });
    if (!this.list.length) return;
    const pole = addInstanced(planet.root, new THREE.CylinderGeometry(0.004, 0.004, 0.16, 6).translate(0, 0.08, 0), toon('#f4f1ff'), this.list.length, 0.003);
    const flag = addInstanced(planet.root, new THREE.BoxGeometry(0.002, 0.045, 0.07).translate(0, 0.135, 0.036), toon('#ff5fa2'), this.list.length, 0.003);
    this.list.forEach((l, i) => {
      frame(_m, _p.copy(l.d).multiplyScalar(planet.meshR(l.d)), l.d, tangentBasis(l.d)[0]);
      pole.setMatrixAt(i, _m);
      flag.setMatrixAt(i, _m);
      if (l.model === 'lander') this.buildLander(l);
    });
  }

  /** The Apollo lunar module's descent stage: a gold box on four legs (the top half flew home). */
  buildLander(l) {
    const p = this.planet, g = new THREE.Group(), gold = toon('#ffcf33'), grey = toon('#c6c2da');
    addMesh(g, new THREE.BoxGeometry(0.09, 0.05, 0.09).translate(0, 0.07, 0), gold, 0.006);
    for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      addMesh(g, new THREE.CylinderGeometry(0.004, 0.004, 0.09, 5).rotateZ(x * 0.5).rotateX(-z * 0.5).translate(x * 0.06, 0.04, z * 0.06), grey, 0.003);
    }
    const d = l.d.clone().addScaledVector(tangentBasis(l.d)[1], 0.012).normalize();
    frame(_m, _p.copy(d).multiplyScalar(p.meshR(d)), d, tangentBasis(d)[0]);
    g.applyMatrix4(_m);
    p.root.add(g);
  }

  /** What's real about a landmark, for its info card. */
  noteOf(e) { return e.note ?? ''; }
}
