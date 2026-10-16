import * as THREE from 'three';
import { R, smoothstep, tangentBasis } from '../core/Geo.js';
import { Heightfield } from '../core/Noise.js';
import { WorldShape } from '../core/WorldShape.js';
import { worldOf } from '../space/Worlds.js';
import { Random } from '../core/Random.js';
import { Terrain } from './Terrain.js';
import { Roads } from './Roads.js';
import { Cities, CITY_A } from './Cities.js';
import { Railway } from './Railway.js';
import { Nature } from './Nature.js';
import { ForestFloor } from './ForestFloor.js';
import { Airports } from './Airports.js';
import { Harbours } from './Harbours.js';
import { Volcano } from './Volcano.js';
import { Seasons } from './Seasons.js';
import { themeOf } from './Themes.js';
import { Traffic } from '../life/Traffic.js';
import { Boats } from '../life/Boats.js';
import { Balloons } from '../life/Balloons.js';
import { Planes } from '../life/Planes.js';
import { Birds } from '../life/Birds.js';
import { Space } from '../life/Space.js';
import { People } from '../life/People.js';
import { Trams } from '../life/Trams.js';
import { Whales } from '../life/Whales.js';
import { Helicopters } from '../life/Helicopters.js';
import { Ufo } from '../life/Ufo.js';
import { Aurora } from '../sky/Aurora.js';
import { Fireworks } from '../sky/Fireworks.js';
import { Meteors } from '../sky/Meteors.js';
import { Rainbows } from '../sky/Rainbows.js';
import { Weather } from '../sky/Weather.js';

const _v = new THREE.Vector3();
const yieldFrame = () => new Promise((r) => setTimeout(r, 0));

/** One generated world: terrain, infrastructure, nature and everything living on it. */
export class Planet {
  constructor(app, params) {
    this.app = app;
    this.world = worldOf(params.world); // a real world (Earth, the Moon, Mars), always the same; else a made-up one
    this.params = { ...params, ...(this.world && { seed: this.world.seed, theme: this.world.theme, cities: this.world.cities }) };
    const p = this.params;
    this.theme = themeOf(p.theme);
    this.rng = new Random(p.seed);
    this.sea = this.world ? 0 : Heightfield.seaLevelFor(p.seed, p.land);
    this.hf = new Heightfield(p.seed, this.sea, [], this.world && new WorldShape(this.world.shape, p.seed));
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

  /**
   * Keep a part of the world as `this[name]`: from then on it's updated every frame (update(dt, t)), disposed with the
   * planet (dispose()), and its `entities` can be clicked, followed and found. Adding a new feature to the world is
   * one of these in the right phase of build().
   */
  add(name, module) {
    if (name) this[name] = module;
    this.modules.push(module);
    return module;
  }

  async build() {
    // 1. Lay out the land. Each of these claims its spots, so nothing later gets built on top of them.
    this.add('roads', new Roads(this));
    this.add('cities', new Cities(this));
    this.add('railway', new Railway(this));
    this.padSite = this.findPadSite();
    this.add('airports', new Airports(this));
    this.add('harbours', new Harbours(this));
    this.add('trams', new Trams(this));          // tram lines are picked before the towns, so buildings leave room
    if (this.hf.flats.length) this.roads.retrace(); // highways follow the levelled ground

    // 2. The terrain mesh builds in a worker; meanwhile everything that only needs the heightfield goes up.
    this.add('terrain', new Terrain(this));
    const terrainReady = this.terrain.build();
    this.roads.build();
    this.railway.build();
    await yieldFrame();
    this.volcanoes = Array.from({ length: this.theme.volcanoes }, (_, i) => new Volcano(this, i)).filter((v) => v.cone);
    this.volcanoes.forEach((v) => this.add(null, v));
    this.volcano = this.volcanoes[0] || new Volcano(this, 0); // (an empty one if no site was found)
    this.add('nature', new Nature(this));
    for (const v of this.volcanoes) this.nature.mountains.push(v.cone); // solid for planes, bombs and the camera
    this.cities.build();
    await yieldFrame();
    this.add('traffic', new Traffic(this));
    this.add('balloons', new Balloons(this));
    this.add('birds', new Birds(this));
    this.add('space', new Space(this));
    this.add('weather', new Weather(this));
    this.add('aurora', new Aurora(this));
    this.add('ufo', new Ufo(this));
    this.add('helicopters', new Helicopters(this));
    this.add('fireworks', new Fireworks(this));
    this.add('meteors', new Meteors(this));
    this.add('rainbows', new Rainbows(this));
    this.add('seasons', new Seasons(this));

    // 3. Things that sit on the exact rendered ground wait for the terrain mesh.
    await terrainReady;
    this.add('forestFloor', new ForestFloor(this));
    this.cities.buildStreets();
    this.airports.build();
    this.harbours.build();
    this.add('boats', new Boats(this));
    this.add('planes', new Planes(this));
    this.trams.build();
    this.add('whales', new Whales(this));
    this.add('people', new People(this));

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
