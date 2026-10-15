import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { R, TAU, frame, smallCircle } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';
import { nightGlowMaterial } from './Glow.js';
import { CITY_A } from './Cities.js';

const MAX = 3, PIER = 0.5, BERTH = 0.07, LOOP = 0.06, DECK = R + 0.05, PILES = 4;
const _m = new THREE.Matrix4(), _l = new THREE.Matrix4(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _o = new THREE.Vector3();

/** Piers with a lighthouse at coastal cities. Each has a berth at the pier head where a ferry docks every lap. */
export class Harbours {
  constructor(planet) {
    this.planet = planet;
    this.list = [];
    this.entities = [];
    if (!planet.theme.sea.boats) return; // nobody builds piers into a lava sea
    for (const city of planet.cities.sites) {
      if (this.list.length >= MAX) break;
      const h = this.find(city);
      if (!h) continue;
      this.list.push(h);
      planet.reserve(h.shore, 0.03); // no buildings or trees on the pier's root and the lighthouse
    }
  }

  /** Walk outward from the city centre in several directions until we hit the sea. */
  find(city) {
    const p = this.planet;
    for (let k = 0; k < 24; k++) {
      const th = (k / 24) * TAU + 0.1;
      const radial = city.u.clone().multiplyScalar(Math.cos(th)).addScaledVector(city.v, Math.sin(th));
      const at = (s, out = new THREE.Vector3()) => out.copy(city.c).multiplyScalar(Math.cos(s)).addScaledVector(radial, Math.sin(s)).normalize();
      let shoreA = null;
      for (let s = CITY_A * 0.5; s < CITY_A + 0.35; s += 0.004) {
        if (p.heightAt(at(s, _d)) < 0) { shoreA = s - 0.004; break; }
      }
      if (shoreA === null || shoreA < CITY_A * 0.7) continue; // must be on the coast, not a pond in town
      const tipA = shoreA + PIER / R, dockA = tipA + BERTH / R, centreA = dockA + LOOP;
      const ok = (d, depth, margin = 0.025) => p.heightAt(d) < depth && !p.roads.near(d, margin) && !p.railway.near(d, 0.02) && !p.isReserved(d, 0.01);
      let good = ok(at(tipA, _d), -0.03);
      for (let s = shoreA + 0.01; good && s < tipA; s += 0.01) good = ok(at(s, _d), 0.06);
      if (!good) continue;
      const centre = at(centreA), out = new THREE.Vector3().copy(radial).multiplyScalar(Math.cos(centreA)).addScaledVector(city.c, -Math.sin(centreA));
      const u = out.clone().negate(), v = new THREE.Vector3().crossVectors(centre, u); // phi = 0 is the berth
      for (let j = 0; good && j < 16; j++) good = ok(smallCircle(_d, centre, u, v, LOOP, (j / 16) * TAU), j < 2 || j > 14 ? -0.02 : -0.1);
      if (!good || p.cities.sites.some((s) => s !== city && s.c.angleTo(centre) < CITY_A + LOOP + 0.05)) continue;
      const shore = at(shoreA), tip = at(tipA);
      const lateral = new THREE.Vector3().crossVectors(shore, out).normalize();
      return {
        city, shore, tip, out, lateral, name: `${city.name} Harbour`,
        light: shore.clone().addScaledVector(lateral, 0.012).addScaledVector(out, -0.004).normalize(),
        loop: { c: centre, u, v, A: LOOP },
      };
    }
    return null;
  }

  build() {
    const p = this.planet, n = this.list.length;
    if (!n) return;
    const root = p.root;
    const deck = addInstanced(root, new THREE.BoxGeometry(0.1, 0.03, 1).translate(0, -0.015, 0.5), toon('#c98a4b'), n, 0.006);
    const piles = addInstanced(root, new THREE.CylinderGeometry(0.012, 0.012, 1, 6).translate(0, -0.5, 0), toon('#8a5a3c'), n * PILES * 2, 0.004, { detail: 7 });
    const tower = addInstanced(root, mergeGeometries([
      new THREE.CylinderGeometry(0.032, 0.048, 0.34, 12).translate(0, 0.17, 0),
      new THREE.CylinderGeometry(0.05, 0.05, 0.015, 12).translate(0, 0.34, 0),
    ]), toon('#f4f1ff'), n, 0.006);
    const stripes = addInstanced(root, mergeGeometries([0.06, 0.2].map((y) => new THREE.CylinderGeometry(0.042, 0.045, 0.05, 12).translate(0, y, 0))),
      toon('#ff4d4d'), n, 0.004);
    const lamp = addInstanced(root, new THREE.CylinderGeometry(0.026, 0.026, 0.05, 10).translate(0, 0.37, 0), nightGlowMaterial('#cfeaff', '#fff2b0'), n, 0.004, { cast: false });
    const cap = addInstanced(root, new THREE.ConeGeometry(0.04, 0.06, 10).translate(0, 0.42, 0), toon('#ff4d4d'), n, 0.004);
    shareMatrices(tower, stripes, lamp, cap);

    this.list.forEach((h, i) => {
      const len = h.shore.angleTo(h.tip) * DECK + 0.06;
      frame(_m, _p.copy(h.shore).multiplyScalar(DECK), h.shore, h.out);
      deck.setMatrixAt(i, _l.copy(_m).multiply(_m.clone().makeScale(1, 1, len)));
      for (let k = 0; k < PILES * 2; k++) { // pairs of piles down into the water
        const z = ((Math.floor(k / 2) + 1) / PILES) * (len - 0.05), x = (k % 2 ? 1 : -1) * 0.04;
        _o.set(x, -0.03, z).applyMatrix4(_m);
        piles.setMatrixAt(i * PILES * 2 + k, frame(_l, _o, _d.copy(_o).normalize(), h.out, 1, 0.4, 1));
      }
      tower.setMatrixAt(i, frame(_l, _p.copy(h.light).multiplyScalar(p.meshR(h.light) - 0.02), h.light, h.out));
      this.entities.push(new PointEntity(_p.copy(h.tip).multiplyScalar(DECK + 0.15), 'harbour', h.name, h.out));
    });
  }
}
