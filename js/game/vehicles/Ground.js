import * as THREE from 'three';
import { R, TAU, tangentBasis } from '../../core/Geo.js';
import { ROAD_W, LANE } from '../../world/Roads.js';
import { CITY_A } from '../../world/Cities.js';

const SEA = 0.006;          // ground lower than this above sea level is water
const SHORE = -0.012;       // a boat needs at least this much water under it
const MOUNTAIN_WALL = 0.2;  // how far up a mountain (0 = its foot, 1 = the peak) a car can drive before it's a wall
const BUILDING_PAD = 0.035; // about half a car's width: how close to a wall its middle can get
const _d = new THREE.Vector3(), _a = new THREE.Vector3();

/** Points on a ring of angular radius `ang` around c, with the way round the ring at each. */
function* ring(c, ang, steps) {
  const [u, v] = tangentBasis(c), t = Math.tan(ang);
  for (let k = 0; k < steps; k++) {
    const a = (k / steps) * TAU, d = c.clone().addScaledVector(u, Math.cos(a) * t).addScaledVector(v, Math.sin(a) * t).normalize();
    yield { d, along: u.clone().multiplyScalar(-Math.sin(a)).addScaledVector(v, Math.cos(a)) };
  }
}

/**
 * What's under a car or a boat at direction d (a unit vector): the height to sit at, what the ground is made of,
 * and whether it can be there at all. Cars drive on roads (bridges too) and land; towns' buildings, steep
 * mountainsides and the sea (or a lava sea) are walls. Boats sail on water; the shore is their wall.
 */
export class Ground {
  constructor(planet) {
    this.planet = planet;
    this.lava = !!planet.theme.sea.glow;
  }

  /** The highway under d: { road, a } (a = how far along it), or null. */
  roadAt(d) {
    const roads = this.planet.roads;
    for (const road of roads.list) if (Math.abs(d.dot(road.n)) * R < ROAD_W / 2) return { road, a: roads.angleOn(road, d) };
    return null;
  }

  /** How high (as a radius) a car's wheels sit at d: the road deck, or the ground (a little way up a mountain's foot). */
  carR(d, road = this.roadAt(d)) {
    if (road) return this.planet.roads.radius(road.road, road.a);
    return Math.max(this.planet.meshR(d), this.mountain(d).r);
  }

  /** The mountain cone at d: its surface radius `r` there and how far up it `t` is (0 foot … 1 peak); zeros if none. */
  mountain(d) {
    let r = 0, t = 0;
    for (const m of this.planet.nature?.mountains || []) {
      const k = 1 - (m.d.angleTo(d) * R) / m.s;
      if (k > t) { t = k; r = m.base + m.hgt * k; }
    }
    return { r, t };
  }

  isWater(d) { return this.planet.meshR(d) < R + SEA; }

  /** What a car drives on at d: 'road', 'sand', 'snow' or 'grass' (each has its own top speed and grip). */
  surface(d, road = this.roadAt(d)) {
    if (road) return 'road';
    const p = this.planet;
    if (p.theme.id === 'desert') return 'sand';
    if (p.theme.id === 'ice' || p.seasons?.snowAt?.(d) > 0.5) return 'snow';
    return 'grass';
  }

  /** Why a car can't be at d: 'water', 'lava', 'mountain' or 'building'; null if it can. */
  carBlock(d) {
    if (this.roadAt(d)) return null; // roads (and their bridges) are always open
    if (this.isWater(d)) return this.lava ? 'lava' : 'water';
    if (this.mountain(d).t > MOUNTAIN_WALL) return 'mountain';
    if (this.planet.cities.buildingAt(d, BUILDING_PAD)) return 'building';
    return null;
  }

  /** Why a boat can't be at d: 'land', or null if there's water enough. */
  boatBlock(d) { return this.planet.meshR(d) > R + SHORE ? 'land' : null; }

  /** Whether a car fits at d facing `heading`, with a little clear road ahead and behind. */
  carFits(d, heading) {
    if (this.carBlock(d)) return false;
    for (const s of [-0.12, 0.12]) if (this.carBlock(_a.copy(d).addScaledVector(heading, s / R).normalize())) return false;
    return true;
  }

  /**
   * Somewhere to start a car at a town: in the left-hand lane of the highway through it if there is one (traffic
   * keeps left here), else just outside its buildings. Returns { at, heading } (unit vectors), or null if there's nowhere.
   */
  parking(site) {
    const road = this.roadAt(site.c);
    if (road) {
      const at = site.c.clone().addScaledVector(road.road.n, LANE / R).normalize();
      return { at, heading: this.planet.roads.tangent(road.road, road.a, new THREE.Vector3()) };
    }
    for (let ang = CITY_A * 1.05; ang < CITY_A * 2.5; ang += 0.015) {
      for (const p of ring(site.c, ang, 32)) if (this.carFits(p.d, p.along)) return { at: p.d, heading: p.along };
    }
    return null;
  }

  /** Open water near direction d for a boat, with room all round: { at, heading }, or null if there is none within reach. */
  openWater(d) {
    for (let ang = 0; ang < 0.9; ang += 0.02) {
      for (const p of ang ? ring(d, ang, 36) : [{ d: d.clone(), along: tangentBasis(d)[0] }]) {
        if (this.boatBlock(p.d)) continue;
        const [u, v] = tangentBasis(p.d);
        const clear = [0, 1, 2, 3].filter((k) => !this.boatBlock(_d.copy(p.d).addScaledVector(k % 2 ? v : u, (k < 2 ? 0.05 : -0.05)).normalize()));
        if (clear.length === 4) return { at: p.d, heading: p.along };
      }
    }
    return null;
  }
}
