import * as THREE from 'three';
import { R } from '../core/Geo.js';
import { ROAD_W } from '../world/Roads.js';
import { CITY_A } from '../world/Cities.js';
import { HALF, RUNWAY_W } from '../world/Airports.js';

const MAX = { roads: 4, towns: 8, peaks: 64, airports: 2 };

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

const FRAG = /* glsl */ `
  uniform sampler2D uHeight; uniform sampler2D uForest;
  uniform vec3 uSea, uShallow, uSand, uG1, uG2, uG3, uRock, uCity, uFloor, uRoad, uInk;
  uniform vec3 uRoads[${MAX.roads}]; uniform int uRoadN; uniform float uRoadW;
  uniform vec4 uTowns[${MAX.towns}]; uniform int uTownN;
  uniform vec4 uPeaks[${MAX.peaks}]; uniform int uPeakN;
  uniform vec3 uAirC[${MAX.airports}]; uniform vec3 uAirF[${MAX.airports}]; uniform int uAirN; uniform vec2 uAirSize;
  uniform vec4 uRail; uniform vec3 uRailCol; uniform float uRailW; // the railway: a small circle round uRail.xyz, uRail.w (radians) out
  uniform vec3 uMask; // the map's circle on screen: centre (device pixels) and radius
  uniform float uInkW; // ink line width, in radians
  varying vec3 vDir;

  vec2 equirect(vec3 d) { return vec2(atan(d.z, d.x) / 6.2831853 + 0.5, asin(clamp(d.y, -1.0, 1.0)) / 3.1415927 + 0.5); }
  // a line of half-width w along x = 0, filled with fill and edged with ink
  vec3 line(vec3 c, float x, float w, vec3 fill) {
    if (x < w) c = fill;
    else if (x < w + uInkW) c = uInk;
    return c;
  }

  void main() {
    if (distance(gl_FragCoord.xy, uMask.xy) > uMask.z) discard;
    vec3 d = normalize(vDir);
    vec2 uv = equirect(d);
    float h = texture2D(uHeight, uv).r * 1.5 - 1.0;
    vec3 c = h < -0.2 ? uSea : h < 0.0 ? uShallow : h < 0.07 ? uSand : h < 0.22 ? uG1 : h < 0.4 ? uG2 : uG3;
    if (h > 0.0) c = mix(c, uFloor, texture2D(uForest, uv).r * 0.85);
    for (int i = 0; i < ${MAX.peaks}; i++) {
      if (i >= uPeakN) break;
      float a = acos(clamp(dot(d, uPeaks[i].xyz), -1.0, 1.0));
      if (a < uPeaks[i].w) c = a > uPeaks[i].w - uInkW ? uInk : mix(uRock, vec3(1.0), smoothstep(uPeaks[i].w * 0.45, 0.0, a) * 0.6);
    }
    for (int i = 0; i < ${MAX.towns}; i++) {
      if (i >= uTownN) break;
      float a = acos(clamp(dot(d, uTowns[i].xyz), -1.0, 1.0));
      if (a < uTowns[i].w) c = a > uTowns[i].w - uInkW ? uInk : uCity;
    }
    for (int i = 0; i < ${MAX.airports}; i++) {
      if (i >= uAirN) break;
      vec3 side = cross(uAirC[i], uAirF[i]);
      float along = abs(dot(d, uAirF[i])), across = abs(dot(d, side));
      if (dot(d, uAirC[i]) > 0.9 && along < uAirSize.x + uInkW && across < uAirSize.y + uInkW)
        c = along < uAirSize.x && across < uAirSize.y ? uRoad : uInk;
    }
    if (uRail.w > 0.0) c = line(c, abs(acos(clamp(dot(d, uRail.xyz), -1.0, 1.0)) - uRail.w), uRailW, uRailCol);
    for (int i = 0; i < ${MAX.roads}; i++) {
      if (i >= uRoadN) break;
      c = line(c, abs(dot(d, uRoads[i])), uRoadW, uRoad);
    }
    float coast = fwidth(h) * 1.2; // ink round the coast
    c = mix(uInk, c, 0.35 + 0.65 * smoothstep(0.0, coast, abs(h)));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

/**
 * A flat cartoon map of a planet, for the mini-map: a sphere drawn with land and sea from the terrain's height map,
 * forests, mountains, towns, airports, the railway and the highways, all worked out in its shader (so it's crisp at
 * any zoom and costs one draw call). The mini-map points an orthographic camera at it from above the player.
 */
export class MapGlobe {
  constructor(planet) {
    const pal = planet.theme.pal, col = (hex) => new THREE.Color(hex);
    const forest = planet.forestFloor?.map() ?? { data: new Uint8Array(1), w: 1, h: 1 };
    this.forestTex = new THREE.DataTexture(forest.data, forest.w, forest.h, THREE.RedFormat);
    this.forestTex.magFilter = this.forestTex.minFilter = THREE.LinearFilter;
    this.forestTex.wrapS = THREE.RepeatWrapping;
    this.forestTex.needsUpdate = true;
    const roads = planet.roads.list.slice(0, MAX.roads).map((r) => r.n.clone());
    const towns = planet.cities.sites.slice(0, MAX.towns).map((s) => new THREE.Vector4(s.c.x, s.c.y, s.c.z, CITY_A * 0.8));
    const peaks = planet.nature.mountains.slice(0, MAX.peaks).map((m) => new THREE.Vector4(m.d.x, m.d.y, m.d.z, (m.s * 0.8) / R));
    const airports = (planet.airports?.list || []).slice(0, MAX.airports);
    const rail = planet.railway?.ok ? planet.railway : null;
    const pad = (list, n, make) => [...list, ...Array.from({ length: n - list.length }, make)]; // (fixed-size arrays in the shader)
    this.mask = new THREE.Vector3();
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uHeight: { value: planet.terrain.heightTex }, uForest: { value: this.forestTex },
        uSea: { value: col(planet.theme.sea.color) }, uShallow: { value: col(planet.theme.sea.shallow) },
        uSand: { value: col(pal.sand) }, uG1: { value: col(pal.g1) }, uG2: { value: col(pal.g2) }, uG3: { value: col(pal.g3) },
        uRock: { value: col(planet.theme.mountains.colors[0]) }, uCity: { value: col(pal.city) },
        uFloor: { value: col(planet.theme.trees.floor || pal.g3) }, uRoad: { value: col('#4a4560') }, uInk: { value: col('#1b1530') },
        uRoads: { value: pad(roads, MAX.roads, () => new THREE.Vector3()) }, uRoadN: { value: roads.length }, uRoadW: { value: ROAD_W / 2 / R },
        uTowns: { value: pad(towns, MAX.towns, () => new THREE.Vector4()) }, uTownN: { value: towns.length },
        uPeaks: { value: pad(peaks, MAX.peaks, () => new THREE.Vector4()) }, uPeakN: { value: peaks.length },
        uAirC: { value: pad(airports.map((a) => a.c.clone()), MAX.airports, () => new THREE.Vector3()) },
        uAirF: { value: pad(airports.map((a) => a.fwd.clone()), MAX.airports, () => new THREE.Vector3()) },
        uAirN: { value: airports.length }, uAirSize: { value: new THREE.Vector2(HALF, RUNWAY_W / 2 / R) },
        uRail: { value: rail ? new THREE.Vector4(rail.c.x, rail.c.y, rail.c.z, rail.A) : new THREE.Vector4() },
        uRailCol: { value: col('#8a5a3c') }, uRailW: { value: 0.04 / R },
        uMask: { value: this.mask }, uInkW: { value: 0.03 / R },
      },
    });
    this.scene = new THREE.Scene();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 48), this.material);
    this.scene.add(this.mesh);
  }

  /** Keep the ink lines about 1.6 screen pixels wide, at a zoom where `perPx` radians fit in one pixel. */
  setInk(perPx) { this.material.uniforms.uInkW.value = perPx * 1.6; }

  dispose() {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.forestTex.dispose();
  }
}
