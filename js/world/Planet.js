import * as THREE from 'three';
import { R, smoothstep, tangentBasis } from '../core/Geo.js';
import { Heightfield } from '../core/Noise.js';
import { Random } from '../core/Random.js';
import { Terrain } from './Terrain.js';
import { Roads } from './Roads.js';
import { Cities, CITY_A } from './Cities.js';
import { Railway } from './Railway.js';
import { Nature } from './Nature.js';
import { Airports } from './Airports.js';
import { Harbours } from './Harbours.js';
import { Volcano } from './Volcano.js';
import { Traffic } from '../life/Traffic.js';
import { Boats } from '../life/Boats.js';
import { Balloons } from '../life/Balloons.js';
import { Planes } from '../life/Planes.js';
import { Birds } from '../life/Birds.js';
import { Space } from '../life/Space.js';
import { People } from '../life/People.js';
import { Ufo } from '../life/Ufo.js';
import { Aurora } from '../sky/Aurora.js';
import { Weather } from '../sky/Weather.js';

const _v = new THREE.Vector3();
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

/** One generated world: terrain, infrastructure, nature and everything living on it. */
export class Planet {
  constructor(app, params) {
    this.app = app;
    this.params = { ...params };
    this.rng = new Random(params.seed);
    this.sea = Heightfield.seaLevelFor(params.seed, params.land);
    this.hf = new Heightfield(params.seed, this.sea);
    this.root = new THREE.Group();
    this.reserved = [];
    this.keepClear = []; // spots mountains must avoid (airport approaches)
    this.modules = [];
    this.time = 0;
  }

  heightAt(d) { return this.hf.height(d.x, d.y, d.z); }
  surfR(d) { return R + Math.max(this.heightAt(d), -0.8); }
  /** Radius of the rendered terrain mesh (exact for small objects); the heightfield until the terrain is built. */
  meshR(d) { return this.terrain?.surface?.radiusAt(d) ?? this.surfR(d); }
  reserve(d, ang) { this.reserved.push({ d: d.clone(), ang }); }
  /** Level the ground to `level` within `rIn` radians of d, blending back to natural terrain by `rOut`. */
  flatten(d, rIn, rOut, level) { this.hf.flats.push({ x: d.x, y: d.y, z: d.z, cosIn: Math.cos(rIn), cosOut: Math.cos(rOut), level }); }
  isReserved(d, pad = 0) { return this.reserved.some((r) => r.d.angleTo(d) < r.ang + pad); }
  nightAt(pos) { return smoothstep(0.15, -0.25, _v.copy(pos).normalize().dot(this.app.sky.sunDir)); }

  /** Radius of the highest solid thing at direction d: terrain, sea, mountain cones, city skyline. */
  groundR(d) {
    let r = Math.max(this.surfR(d), R + 0.05);
    for (const m of this.nature?.mountains || []) {
      const t = 1 - (m.d.angleTo(d) * R) / m.s;
      if (t > 0) r = Math.max(r, m.base + m.hgt * t);
    }
    if (this.cities?.inCity(d)) r = Math.max(r, this.surfR(d) + 1.6);
    return r;
  }

  get entities() { return this.modules.flatMap((m) => m.entities || []); }

  async build() {
    this.roads = new Roads(this);
    this.cities = new Cities(this);
    this.railway = new Railway(this);
    this.padSite = this.findPadSite();
    this.airports = new Airports(this);  // sites are claimed now, so nothing else gets built on them
    this.harbours = new Harbours(this);
    if (this.hf.flats.length) this.roads.retrace(); // highways follow the levelled ground
    this.terrain = new Terrain(this);
    const terrainReady = this.terrain.build(); // worker runs while everything else is placed
    this.roads.build();
    this.railway.build();
    await yieldFrame();
    this.volcano = new Volcano(this);
    this.nature = new Nature(this);
    if (this.volcano.cone) this.nature.mountains.push(this.volcano.cone); // solid for planes, bombs and the camera
    this.cities.build();
    await yieldFrame();
    this.traffic = new Traffic(this);
    this.balloons = new Balloons(this);
    this.birds = new Birds(this);
    this.space = new Space(this);
    this.weather = new Weather(this);
    this.aurora = new Aurora(this);
    this.ufo = new Ufo(this);
    await terrainReady;
    // these sit on the exact rendered ground, so they wait for the terrain mesh
    this.airports.build();
    this.harbours.build();
    this.boats = new Boats(this);
    this.planes = new Planes(this);
    this.people = new People(this);
    this.modules = [this.roads, this.cities, this.nature, this.railway, this.airports, this.harbours, this.volcano, this.traffic,
      this.boats, this.balloons, this.planes, this.birds, this.people, this.space, this.weather, this.aurora, this.ufo];
    this.update(0, this.app.simTime);
    this.app.scene.add(this.root);
  }

  /** Coastal, flat-ish land away from everything else: home of the rocket pad. */
  findPadSite() {
    const d = new THREE.Vector3();
    let site = null;
    for (let tries = 0; tries < 3000; tries++) {
      const c = this.rng.dir(), h = this.heightAt(c);
      if (h < 0.06 || h > 0.4) continue;
      if (this.roads.near(c, 0.05) || this.railway.near(c, 0.05)) continue;
      if (this.cities.sites.some((s) => s.c.angleTo(c) < CITY_A + 0.1)) continue;
      if (this.railway.mountain && this.railway.mountain.d.angleTo(c) < 0.15) continue;
      const [u, v] = tangentBasis(c);
      let coast = false;
      for (let k = 0; k < 8 && !coast; k++) {
        const a = (k / 8) * Math.PI * 2;
        d.copy(c).addScaledVector(u, Math.cos(a) * 0.1).addScaledVector(v, Math.sin(a) * 0.1).normalize();
        coast = this.heightAt(d) < 0;
      }
      const candidate = { d: c, fwd: u };
      site ||= candidate;
      if (coast) { site = candidate; break; }
    }
    if (site) this.reserve(site.d, 0.06);
    return site;
  }

  update(dt, t) {
    this.time += dt;
    for (const m of this.modules) m.update?.(dt, t);
  }

  dispose() {
    this.root.removeFromParent();
    for (const m of this.modules) m.dispose?.();
    const geos = new Set(), mats = new Set(), texs = new Set();
    this.root.traverse((o) => {
      if (o.isInstancedMesh) o.dispose();
      if (o.geometry && !o.isSprite) geos.add(o.geometry); // sprites share one global geometry
      for (const m of [].concat(o.material || [])) {
        mats.add(m);
        for (const v of [...Object.values(m), ...Object.values(m.userData || {})]) if (v?.isTexture) texs.add(v);
        for (const u of Object.values(m.uniforms || {})) if (u.value?.isTexture) texs.add(u.value);
      }
    });
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
    texs.forEach((t) => t.dispose());
  }
}
