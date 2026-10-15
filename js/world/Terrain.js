import * as THREE from 'three';
import { R } from '../core/Geo.js';
import { toon, WPOS_DECL, WPOS_VERT, WINTER_GLSL } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';
import { SurfaceIndex } from './SurfaceIndex.js';

const DETAIL = 56;

/** Runs the heavy terrain build in a worker; falls back to the main thread if workers are unavailable. */
function compute(job) {
  return new Promise((resolve, reject) => {
    let worker;
    const fallback = async (err) => {
      console.warn('Terrain worker unavailable, building on the main thread.', err);
      worker?.terminate();
      try {
        const { computeTerrain } = await import('./TerrainCompute.js');
        resolve(computeTerrain(job));
      } catch (e) { reject(e); }
    };
    try {
      worker = new Worker(new URL('./terrain.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = (e) => { worker.terminate(); resolve(e.data); };
      worker.onerror = (e) => { e.preventDefault(); fallback(e.message || e); };
      worker.postMessage(job);
    } catch (err) { fallback(err); }
  });
}

export class Terrain {
  constructor(planet) { this.planet = planet; }

  async build() {
    const p = this.planet, ico = new THREE.IcosahedronGeometry(1, DETAIL);
    const out = await compute({
      seed: p.params.seed, sea: p.sea, flats: p.hf.flats, pal: p.theme.pal, radius: R,
      unit: ico.attributes.position.array,
      cities: p.cities.sites.map((s) => [s.c.x, s.c.y, s.c.z]),
      cityCos: p.cities.cosR,
    });
    ico.dispose();
    this.buildLand(out);
    this.buildOcean(out);
  }

  buildLand(o) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(o.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(o.col, 3));
    g.computeVertexNormals();
    this.surface = new SurfaceIndex(o.pos); // exact ground height for small things (people, piers, runways)
    const hull = new THREE.BufferGeometry();
    hull.setAttribute('position', new THREE.BufferAttribute(o.opos, 3));
    hull.setAttribute('normal', new THREE.BufferAttribute(o.onrm, 3));
    hull.setIndex(new THREE.BufferAttribute(o.index, 1));
    const land = toon('#ffffff', { vertexColors: true, flatShading: true }, (sh) => { // seasonal snow creeping down from the poles
      sh.vertexShader = WPOS_DECL + sh.vertexShader.replace('#include <project_vertex>', WPOS_VERT);
      sh.fragmentShader = WPOS_DECL + WINTER_GLSL + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        vec3 sd = normalize(vWPos);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.97, 1.0), winterCover(sd, length(vWPos) - ${R.toFixed(1)}, 0.5, 0.04));`);
    }, 'land');
    this.land = addMesh(this.planet.root, g, land, 0.06, { outlineGeometry: hull });
  }

  /** Swelling toon ocean with lighter shallows and comic foam lines rolling toward the shore. */
  buildOcean(o) {
    const tex = new THREE.DataTexture(o.hmap, o.hmapW, o.hmapH, THREE.RedFormat);
    tex.wrapS = THREE.RepeatWrapping;
    tex.minFilter = tex.magFilter = THREE.LinearFilter;
    tex.needsUpdate = true;
    this.heightTex = tex; // (the mini-map draws the land and sea from it too)
    const sea = this.planet.theme.sea;
    const glow = sea.glow ? { emissive: sea.glow, emissiveIntensity: 0.55 } : {}; // a lava sea glows in the dark
    const mat = toon(sea.color, glow, (sh) => {
      sh.uniforms.uHeight = { value: tex };
      sh.uniforms.uShallow = { value: new THREE.Color(sea.shallow) };
      sh.uniforms.uFoam = { value: new THREE.Color(sea.foam || '#ffffff') };
      sh.vertexShader = 'uniform float uTime;\n' + WPOS_DECL + sh.vertexShader
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float swell = sin(dot(position, vec3(1.7, 1.1, 1.3)) + uTime * 1.3) + sin(dot(position, vec3(-1.2, 1.9, 0.7)) * 1.6 - uTime);
          transformed += normal * swell * 0.017;`)
        .replace('#include <project_vertex>', WPOS_VERT);
      sh.fragmentShader = 'uniform sampler2D uHeight;\nuniform vec3 uShallow;\nuniform vec3 uFoam;\nuniform float uTime;\n' + WPOS_DECL + WINTER_GLSL + sh.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>
          vec3 od = normalize(vWPos);
          vec2 huv = vec2(atan(od.z, od.x) / 6.2831853 + 0.5, asin(clamp(od.y, -1.0, 1.0)) / 3.1415927 + 0.5);
          float hgt = texture2D(uHeight, huv).r * 1.5 - 1.0;
          diffuseColor.rgb = mix(diffuseColor.rgb, uShallow, smoothstep(-0.5, -0.04, hgt) * 0.75);
          float foam = step(0.8, sin(hgt * 38.0 - uTime * 2.2)) * smoothstep(-0.32, -0.12, hgt);
          diffuseColor.rgb = mix(diffuseColor.rgb, uFoam, max(foam, step(-0.05, hgt)));
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.95, 1.0), winterCover(od, 0.0, 0.27, 0.012)); // winter sea ice`);
    }, 'ocean');
    mat.userData.tex = tex;
    addMesh(this.planet.root, new THREE.SphereGeometry(R, 160, 110), mat, 0.06, { cast: false });
  }
}
