import * as THREE from 'three';
import { LAYER_FX } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addInstanced } from '../render/Outline.js';

const _m = new THREE.Matrix4();
const NEAR = 0.9; // puffs closer than this to the camera vanish instead of filling the screen

/** Toon puffs that disappear when the camera is right next to them (following a smoking train, chasing your own contrail). */
function puffMaterial(color, near) {
  return toon(color, { flatShading: true }, (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <clipping_planes_fragment>',
      `#include <clipping_planes_fragment>\n  if (vViewPosition.z < ${near.toFixed(2)}) discard;`);
  }, `puff${near.toFixed(2)}`);
}

/**
 * Pooled comic puffs: train smoke, contrails, boat wakes, rocket exhaust. `near`: puffs closer than this to the camera
 * vanish (smaller for things the camera chases closely, like a smoking car).
 */
export class Trails {
  constructor(parent, { max = 200, color = '#ffffff', life = 2, grow = 2, drag = 0.8, near = NEAR } = {}) {
    Object.assign(this, { max, life, grow, drag });
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(Infinity);
    this.size = new Float32Array(max);
    this.next = 0;
    // Puffs carry their own ink outline and stay out of the edge-detection pass, so a puff that vanishes
    // next to the camera doesn't leave its silhouette behind.
    this.mesh = addInstanced(parent, new THREE.IcosahedronGeometry(1, 1), puffMaterial(color, near), max, 0.008, { cast: false, near });
    this.mesh.layers.set(LAYER_FX);
    this.mesh.count = 0;
  }

  emit(p, size, vel) {
    const i = this.next, j = i * 3, k = size * 0.35;
    this.next = (i + 1) % this.max;
    this.pos[j] = p.x + (Math.random() - 0.5) * k;
    this.pos[j + 1] = p.y + (Math.random() - 0.5) * k;
    this.pos[j + 2] = p.z + (Math.random() - 0.5) * k;
    if (vel) { this.vel[j] = vel.x; this.vel[j + 1] = vel.y; this.vel[j + 2] = vel.z; }
    else this.vel.fill(0, j, j + 3);
    this.age[i] = 0;
    this.size[i] = size * (0.8 + Math.random() * 0.4);
  }

  update(dt) {
    const damp = Math.exp(-dt * this.drag);
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life) continue;
      this.age[i] += dt;
      const t = this.age[i] / this.life;
      if (t >= 1) continue;
      const j = i * 3;
      for (let a = 0; a < 3; a++) { this.pos[j + a] += this.vel[j + a] * dt; this.vel[j + a] *= damp; }
      const s = this.size[i] * (1 + (this.grow - 1) * t) * Math.min(1, (1 - t) * 4);
      _m.makeScale(s, s, s).setPosition(this.pos[j], this.pos[j + 1], this.pos[j + 2]);
      this.mesh.setMatrixAt(n++, _m);
    }
    this.mesh.count = n;
    if (this.mesh.userData.outline) this.mesh.userData.outline.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() {
    this.age.fill(Infinity);
    this.mesh.count = 0;
    if (this.mesh.userData.outline) this.mesh.userData.outline.count = 0;
  }
}
