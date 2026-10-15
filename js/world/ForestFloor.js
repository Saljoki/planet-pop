import * as THREE from 'three';
import { TAU, smoothstep } from '../core/Geo.js';
import { TREE_FADE } from './Nature.js';

const W = 720, H = 360;   // the tree-density map: half-degree cells, longitude × latitude
const REACH = 0.07;       // how far (radians) round each tree its forest floor spreads
const THIN = 0.35, THICK = 1.5; // density (summed tree weights) where the floor starts showing, and where it's solid
const CLOSE = 0.3;        // how much of the floor colour shows up close, under the trees themselves

/**
 * The ground under forests: each face of the terrain gets a forest weight from how many trees stand round it, and the
 * land shader mixes in the theme's forest floor colour (`trees.floor`), a little under the trees and fully from far
 * away, where the trees themselves have shrunk away (Nature.treeFade). So from orbit a forest is a patch of forest
 * colour instead of hundreds of tiny trees, and up close it's the same forest as ever.
 */
export class ForestFloor {
  constructor(planet) {
    const land = planet.terrain.land, look = planet.theme.trees;
    this.planet = planet;
    this.view = { value: new THREE.Vector3() }; // where the camera is
    if (!land || !look.floor) return;
    const trees = planet.nature.treeGroups.flatMap((g) => g.list.map((t) => t.d));
    this.weights = weigh(land.geometry.getAttribute('position'), densityMap(trees));
    land.geometry.setAttribute('forest', new THREE.BufferAttribute(this.weights, 1));
    tint(land.material, new THREE.Color(look.floor), this.view);
  }

  update() { this.view.value.copy(this.planet.app.camera.position); }
}

/** Splat each tree into a longitude × latitude grid, with a soft round footprint. */
function densityMap(trees) {
  const grid = new Float32Array(W * H), cell = Math.PI / H;
  for (const d of trees) {
    const lat = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), lon = Math.atan2(d.z, d.x);
    const rows = Math.ceil(REACH / cell), cols = Math.min(W / 2, Math.ceil(REACH / (cell * Math.max(0.05, Math.cos(lat)))));
    const r0 = Math.floor((lat / Math.PI + 0.5) * H), c0 = Math.floor((lon / TAU + 0.5) * W);
    for (let r = Math.max(0, r0 - rows); r <= Math.min(H - 1, r0 + rows); r++) {
      const la = ((r + 0.5) / H - 0.5) * Math.PI, cl = Math.cos(la), sl = Math.sin(la);
      for (let c = c0 - cols; c <= c0 + cols; c++) {
        const lo = ((c + 0.5) / W - 0.5) * TAU;
        const a = Math.acos(Math.min(1, cl * Math.cos(lo) * d.x + sl * d.y + cl * Math.sin(lo) * d.z) / Math.max(1e-9, d.length()));
        if (a >= REACH) continue;
        const k = 1 - (a / REACH) ** 2;
        grid[r * W + (((c % W) + W) % W)] += k * k;
      }
    }
  }
  return grid;
}

/** One forest weight (0..1) per terrain vertex, the same for all three corners of a face so faces stay flat colours. */
function weigh(pos, grid) {
  const n = pos.count, out = new Float32Array(n), _v = new THREE.Vector3(), _f = new THREE.Vector3();
  for (let i = 0; i < n; i += 3) {
    _f.set(0, 0, 0);
    for (let j = 0; j < 3; j++) _f.add(_v.fromBufferAttribute(pos, i + j));
    _f.normalize();
    const w = smoothstep(THIN, THICK, sample(grid, _f));
    out[i] = out[i + 1] = out[i + 2] = w;
  }
  return out;
}

/** The density map at direction d, bilinear. */
function sample(grid, d) {
  const x = (Math.atan2(d.z, d.x) / TAU + 0.5) * W - 0.5, y = (Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) / Math.PI + 0.5) * H - 0.5;
  const x0 = Math.floor(x), y0 = Math.max(0, Math.min(H - 2, Math.floor(y))), fx = x - x0, fy = THREE.MathUtils.clamp(y - y0, 0, 1);
  const at = (r, c) => grid[r * W + (((c % W) + W) % W)];
  return (at(y0, x0) * (1 - fx) + at(y0, x0 + 1) * fx) * (1 - fy) + (at(y0 + 1, x0) * (1 - fx) + at(y0 + 1, x0 + 1) * fx) * fy;
}

/** Teach the land material the forest floor: `forest` weight per vertex, stronger with distance from the camera. */
function tint(mat, floor, view) {
  const before = mat.onBeforeCompile, key = mat.customProgramCacheKey();
  mat.onBeforeCompile = (sh, renderer) => {
    before.call(mat, sh, renderer);
    Object.assign(sh.uniforms, { uViewPos: view, uFloor: { value: floor } });
    sh.vertexShader = 'attribute float forest;\nvarying float vForest;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vForest = forest;');
    sh.fragmentShader = 'uniform vec3 uViewPos;\nuniform vec3 uFloor;\nvarying float vForest;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        float far = smoothstep(${TREE_FADE.near.toFixed(1)}, ${TREE_FADE.far.toFixed(1)}, distance(vWPos, uViewPos));
        diffuseColor.rgb = mix(diffuseColor.rgb, uFloor, vForest * mix(${CLOSE}, 1.0, far));`);
  };
  mat.customProgramCacheKey = () => `${key}:forest`;
}
