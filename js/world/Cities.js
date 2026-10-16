import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis, canvasTexture, ribbonGeometry } from '../core/Geo.js';
import { toon, WPOS_DECL, WPOS_VERT } from '../render/Toon.js';
import { addMesh, addInstanced, cutaway } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';
import { ROAD_W, ROAD_N } from './Roads.js';

export const CITY_A = 0.14; // angular radius of a city
export const GRID = 0.3; // building plot spacing
export const STREET_W = 0.2; // the main streets: two, crossing in the middle of every town (a car is 0.09 wide)
export const STREET_LIFT = 0.01; // how far the street surface sits above the ground
const NAMES = ['Pop City', 'Zapville', 'Boomtown', 'Kablam Bay', 'Whamford', 'Bonkton', 'Fizzburg', 'Splatport',
  'Zing Harbor', 'Kapow Falls', 'Biffington', 'Swooshire', 'Blammo Springs', 'Crunchfield', 'Plinkton', 'Thwackmore'];
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Color();

/** Windows sized per building, randomly lit at night. */
function wallMaterial() {
  const tex = canvasTexture(64, 64, (g) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64);
    g.fillStyle = '#1b1530'; g.fillRect(13, 11, 38, 40);
    g.fillStyle = '#4a4f9e'; g.fillRect(17, 15, 30, 32);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(17, 33); g.lineTo(35, 15); g.lineTo(43, 15); g.lineTo(17, 41); g.closePath(); g.fill();
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return toon('#ffffff', { map: tex }, (sh) => {
    sh.vertexShader = 'varying float vRand;\n' + WPOS_DECL + sh.vertexShader
      .replace('#include <uv_vertex>', `#include <uv_vertex>
        #ifdef USE_INSTANCING
          vMapUv = uv * max(vec2(1.0), floor(vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz)) * 11.0 + 0.5));
          vRand = fract(sin(dot(instanceMatrix[3].xyz, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        #endif`)
      .replace('#include <project_vertex>', WPOS_VERT);
    sh.fragmentShader = 'uniform vec3 uSun;\nvarying float vRand;\n' + WPOS_DECL + sh.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float night = smoothstep(0.12, -0.22, dot(normalize(vWPos), uSun));
        float glass = 1.0 - step(0.3, dot(sampledDiffuseColor.rgb, vec3(0.3333)));
        float lit = step(0.38, fract(sin(dot(floor(vMapUv), vec2(12.9898, 78.233)) + vRand * 91.7) * 43758.5453));
        totalEmissiveRadiance += vec3(1.0, 0.78, 0.32) * glass * lit * night * 1.3;`);
  }, 'wall');
}

export class Cities {
  constructor(planet) {
    this.planet = planet;
    this.cosR = Math.cos(CITY_A * 1.08);
    this.sites = [];
    this.choose(planet.params.cities);
    const names = [...NAMES];
    for (let i = names.length - 1; i > 0; i--) { const j = planet.rng.int(0, i); [names[i], names[j]] = [names[j], names[i]]; }
    this.sites.forEach((s, i) => {
      s.name = names[i % names.length];
      s.pos = s.c.clone().multiplyScalar(planet.surfR(s.c) + 0.05);
    });
    this.entities = this.sites.map((s) => new PointEntity(s.pos.clone().addScaledVector(s.c, 0.4), 'city', s.name, s.u));
  }

  /** Prefer sites on the highways, then fill up with inland cities. */
  choose(count) {
    const p = this.planet, rng = p.rng;
    const okLand = (d) => { const h = p.heightAt(d); return h > 0.05 && h < 0.75; };
    const ring = (c, a, u, v) => {
      const t = Math.tan(a);
      for (let k = 0; k < 12; k++) {
        const ang = (k / 12) * TAU;
        _d.copy(c).addScaledVector(u, Math.cos(ang) * t).addScaledVector(v, Math.sin(ang) * t).normalize();
        if (!okLand(_d)) return false;
      }
      return true;
    };
    const fits = (c, u, v) => okLand(c) && this.sites.every((o) => o.c.angleTo(c) >= 0.75) && !p.offLimits(c, CITY_A)
      && ring(c, CITY_A * 0.55, u, v) && ring(c, CITY_A, u, v);
    for (const road of p.roads.list) {
      let placed = 0;
      const off = rng.int(0, ROAD_N - 1);
      for (let s = 0; s < ROAD_N && placed < 2 && this.sites.length < count; s += 5) {
        const c = p.roads.dir(road, (((s + off) % ROAD_N) / ROAD_N) * TAU, new THREE.Vector3());
        const u = new THREE.Vector3().crossVectors(road.n, c);
        if (fits(c, u, road.n)) { this.sites.push({ c, u, v: road.n.clone() }); placed++; }
      }
    }
    for (let tries = 0; this.sites.length < count && tries < 4000; tries++) {
      const c = rng.dir();
      if (p.roads.near(c, 0.2)) continue;
      const [u, v] = tangentBasis(c);
      if (fits(c, u, v)) this.sites.push({ c, u, v });
    }
  }

  inCity(d) { return this.sites.some((s) => s.c.dot(d) > this.cosR); }

  /** Whether plot (gx, gz) is on one of the town's main streets (left empty: they cross at the middle). */
  static onStreet(gx, gz) { return gx === 0 || gz === 0; }

  /** Whether direction d is on a town's main street (the street surface, a little wider than its paint). */
  streetAt(d) {
    const city = this.cityAt(d);
    if (!city?.streets) return false;
    const k = R / d.dot(city.c), x = d.dot(city.u) * k, z = d.dot(city.v) * k;
    return Math.min(Math.abs(x), Math.abs(z)) < STREET_W / 2 + 0.02 && Math.hypot(x, z) < CITY_A * R * 1.08;
  }

  /** The town around direction d, if any. */
  cityAt(d) { return this.sites.find((s) => s.c.dot(d) > this.cosR) || null; }

  /**
   * The building at direction d (grown by `pad` all round), if any. A building's footprint is a box on its town's grid:
   * `hx` along the town's u, `hz` along its v.
   */
  buildingAt(d, pad = 0) {
    const city = this.cityAt(d);
    if (!city?.blocks) return null;
    const k = R / d.dot(city.c), x = d.dot(city.u) * k, z = d.dot(city.v) * k; // undo the plots' projection onto the globe
    const gx = Math.round(x / GRID), gz = Math.round(z / GRID);
    for (let i = gx - 1; i <= gx + 1; i++) {
      for (let j = gz - 1; j <= gz + 1; j++) {
        const b = city.blocks.get(`${i},${j}`);
        if (b && Math.abs(x - b.x) < b.hx + pad && Math.abs(z - b.z) < b.hz + pad) return b;
      }
    }
    return null;
  }

  build() {
    const p = this.planet, rng = p.rng, W = CITY_A * R, data = [];
    for (const city of this.sites) {
      const n = Math.ceil(W / GRID);
      for (let gx = -n; gx <= n; gx++) {
        for (let gz = -n; gz <= n; gz++) {
          const x = gx * GRID + rng.range(-0.03, 0.03), z = gz * GRID + rng.range(-0.03, 0.03);
          const q = Math.hypot(x, z) / W;
          if (q > 1 || rng.chance(0.1)) continue;
          const d = city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, z / R).normalize();
          if (p.heightAt(d) < 0.03 || p.roads.near(d, (ROAD_W / 2 + 0.14) / R) || p.railway.near(d, 0.03) || p.isReserved(d)) continue;
          const h = 0.16 + Math.pow(1 - q, 1.6) * rng.range(0.35, 0.85) + (q < 0.45 && rng.chance(0.15) ? rng.range(0.3, 0.5) : 0);
          const b = { d, u: city.u, h, w: GRID * rng.range(0.55, 0.78), dp: GRID * rng.range(0.55, 0.78), city, gx, gz, x, z };
          const room = p.trams?.room(city, x, z); // leave the tram tracks clear
          if (room) {
            if (room.max < 0.1) continue;
            b[room.key] = Math.min(b[room.key], room.max);
          }
          b.street = Cities.onStreet(gx, gz); // (worked out after the dice are thrown, so the rest of the planet stays the same)
          data.push(b);
        }
      }
    }
    // each town's footprints on its grid (x along u, z along v), so cars can bump into them
    for (const city of this.sites) city.blocks = new Map();
    for (const b of data) if (!b.street) b.city.blocks.set(`${b.gx},${b.gz}`, { x: b.x, z: b.z, hx: b.dp / 2, hz: b.w / 2, h: b.h });
    const wall = wallMaterial(), roof = toon('#efeaff');
    const mesh = (this.buildings = addInstanced(p.root, new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0),
      [wall, wall, roof, roof, wall, wall], data.length, 0.012));
    cutaway(mesh);
    data.forEach((b, i) => {
      const s = b.street ? 0 : 1; // (no building on a main street)
      mesh.setMatrixAt(i, frame(_m, _p.copy(b.d).multiplyScalar(p.surfR(b.d) - 0.07), b.d, b.u, b.w * s, (b.h + 0.07) * s, b.dp * s));
      mesh.setColorAt(i, _c.set(rng.pick(p.theme.buildings)));
    });

    // warm light-pollution glow seen from orbit at night
    const glowTex = canvasTexture(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.4, 'rgba(255,255,255,0.45)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, 128, 128);
    });
    this.glows = this.sites.map((s) => {
      const spr = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: '#ffc861', blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0,
      }));
      spr.position.copy(s.c).multiplyScalar(p.surfR(s.c) + 0.8);
      spr.scale.setScalar(W * 2.4);
      spr.layers.set(LAYER_FX);
      p.root.add(spr);
      return spr;
    });
  }

  /**
   * The main streets, laid on the finished terrain (Planet.build, once the mesh is ready): two through every town,
   * crossing in the middle, from one edge to the other. Where a highway crosses, the highway goes on top.
   */
  buildStreets() {
    const p = this.planet, W = CITY_A * R * 1.06, STEP = 0.05;
    const tex = canvasTexture(32, 64, (g) => {
      g.fillStyle = '#57516e'; g.fillRect(0, 0, 32, 64);
      g.fillStyle = '#d9d2ea'; g.fillRect(0, 0, 2, 64); g.fillRect(30, 0, 2, 64); // kerbs
      g.fillStyle = '#ffffff'; g.fillRect(15, 8, 2, 30); // the dashed middle line
    });
    tex.wrapT = THREE.RepeatWrapping;
    tex.anisotropy = p.app.renderer.capabilities.getMaxAnisotropy();
    const mat = toon('#ffffff', { map: tex, side: THREE.DoubleSide });
    const pos = [], nor = [], uv = [], idx = [], at = (city, x, z) => city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, z / R).normalize();
    for (const city of this.sites) {
      for (const along of ['x', 'z']) {
        let run = 0; // points in the current stretch
        for (let s = -W; s <= W + 1e-6; s += STEP) {
          const d = along === 'x' ? at(city, s, 0) : at(city, 0, s);
          const clear = p.heightAt(d) > 0.02 && !p.roads.near(d, (ROAD_W / 2 + 0.03) / R);
          if (!clear) { run = 0; continue; }
          for (const side of [-1, 1]) {
            const e = along === 'x' ? at(city, s, (side * STREET_W) / 2) : at(city, (side * STREET_W) / 2, s);
            _p.copy(e).multiplyScalar(p.meshR(e) + STREET_LIFT);
            pos.push(_p.x, _p.y, _p.z);
            nor.push(e.x, e.y, e.z);
            uv.push(side < 0 ? 0 : 1, s / 0.45);
          }
          const b = pos.length / 3 - 2;
          if (run++) idx.push(b - 2, b - 1, b + 1, b - 2, b + 1, b);
        }
      }
      city.streets = true;
    }
    if (idx.length) this.streetMesh = addMesh(p.root, ribbonGeometry(pos, nor, uv, idx), mat, 0, { cast: false });
  }

  update() {
    this.glows?.forEach((g, i) => (g.material.opacity = 0.7 * this.planet.nightAt(this.sites[i].pos)));
  }
}
