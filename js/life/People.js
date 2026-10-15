import * as THREE from 'three';
import { R, frame } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced, shareMatrices } from '../render/Outline.js';
import { InstanceEntity } from '../core/Entity.js';
import { ROAD_W } from '../world/Roads.js';
import { CITY_A, GRID } from '../world/Cities.js';

const SHIRTS = ['#ff4d4d', '#3fa7ff', '#ffd23f', '#2ee59d', '#ff8c42', '#8f5cff', '#ff5fa2', '#f4f1ff'];
const SKIN = ['#ffe0c4', '#f2c08f', '#d29a6a', '#9c6644', '#6e452c'];
const NAMES = ['Bob', 'Dot', 'Ziggy', 'Pip', 'Lulu', 'Mo', 'Tess', 'Gus', 'Wanda', 'Ida', 'Benny', 'Coco', 'Otto', 'Mabel', 'Nico', 'Rosa'];
const PER_CITY = 26, SAMPLES = 10, BOB = 0.004;
const _p = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _f = new THREE.Vector3(), _m = new THREE.Matrix4();

/** Pedestrians strolling the lanes between city blocks, stopping now and then. Click one to tag along. */
export class People {
  constructor(planet) {
    this.planet = planet;
    const rng = planet.rng;
    this.people = [];
    for (const city of planet.cities.sites) {
      const nodes = this.streets(city).filter((n) => n.nb.length);
      for (let k = 0; k < Math.min(PER_CITY, Math.floor(nodes.length / 2)); k++) {
        const from = rng.pick(nodes);
        this.people.push({ from, to: rng.pick(from.nb), prev: null, t: rng.next(), speed: rng.range(0.06, 0.1), pause: 0, step: rng.range(0, 6) });
      }
    }
    const n = this.people.length;
    this.body = addInstanced(planet.root, new THREE.CapsuleGeometry(0.01, 0.016, 3, 8).translate(0, 0.018, 0), toon('#ffffff'), n, 0.003, { detail: 5 });
    const head = addInstanced(planet.root, new THREE.SphereGeometry(0.0095, 10, 8).translate(0, 0.046, 0), toon('#ffffff'), n, 0.003, { detail: 5 });
    shareMatrices(this.body, head);
    this.people.forEach((_, i) => {
      this.body.setColorAt(i, new THREE.Color(rng.pick(SHIRTS)));
      head.setColorAt(i, new THREE.Color(rng.pick(SKIN)));
    });
    this.entities = this.people.map((_, i) => Object.assign(new InstanceEntity(this.body, i, 'person', NAMES[i % NAMES.length]), { near: 5 }));
    this.update(0);
  }

  /**
   * Street graph for a city: lattice points halfway between the building plots (so they're never inside a block),
   * on dry land and off the highway and railway. Each edge stores the exact ground radius at a few points.
   */
  streets(city) {
    const p = this.planet, W = CITY_A * R, n = Math.ceil(W / GRID), grid = new Map();
    for (let i = -n - 1; i <= n; i++) {
      for (let j = -n - 1; j <= n; j++) {
        const x = (i + 0.5) * GRID, z = (j + 0.5) * GRID;
        if (Math.hypot(x, z) / W > 0.88) continue;
        const d = city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, z / R).normalize();
        if (p.heightAt(d) < 0.03 || p.roads.near(d, (ROAD_W / 2 + 0.03) / R) || p.railway.near(d, 0.02) || p.isReserved(d)) continue;
        grid.set(`${i},${j}`, { d, x, z, nb: [], edges: new Map() });
      }
    }
    for (const [key, a] of grid) {
      const [i, j] = key.split(',').map(Number);
      for (const k of [`${i + 1},${j}`, `${i},${j + 1}`]) {
        const b = grid.get(k);
        if (!b || p.trams?.onTrack(city, a.x, a.z, b.x, b.z)) continue; // cross the tram tracks, don't stroll along them
        const radii = Array.from({ length: SAMPLES + 1 }, (_, s) => p.meshR(_p.lerpVectors(a.d, b.d, s / SAMPLES).normalize()));
        if (radii.some((r) => r < R + 0.02)) continue; // a pond or the sea between two blocks
        a.nb.push(b);
        b.nb.push(a);
        a.edges.set(b, radii);
        b.edges.set(a, [...radii].reverse());
      }
    }
    return [...grid.values()];
  }

  /** At a corner: keep walking, rarely turning back, sometimes stopping to look around. */
  arrive(w) {
    const rng = Math.random, options = w.to.nb.filter((nb) => nb !== w.from);
    w.prev = w.from;
    w.from = w.to;
    w.to = options.length ? options[Math.floor(rng() * options.length)] : w.prev;
    w.t = 0;
    if (rng() < 0.15) w.pause = 1 + rng() * 2.5;
  }

  update(dt) {
    this.people.forEach((w, i) => {
      if (w.pause > 0) w.pause -= dt;
      else {
        w.t += (w.speed * dt) / (w.from.d.angleTo(w.to.d) * R || 1);
        w.step += dt * 11;
        if (w.t >= 1) this.arrive(w);
      }
      const radii = w.from.edges.get(w.to), f = w.t * SAMPLES, s = Math.min(SAMPLES - 1, Math.floor(f));
      const r = radii[s] + (radii[s + 1] - radii[s]) * (f - s);
      _p.lerpVectors(w.from.d, w.to.d, w.t).normalize();
      _a.copy(_p).multiplyScalar(r + (w.pause > 0 ? 0 : Math.abs(Math.sin(w.step)) * BOB));
      _f.subVectors(_b.copy(w.to.d), w.from.d);
      this.body.setMatrixAt(i, frame(_m, _a, _p, _f));
    });
    this.body.instanceMatrix.needsUpdate = true;
  }
}
