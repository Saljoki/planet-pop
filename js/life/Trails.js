import * as THREE from 'three';
import { toon } from '../render/Toon.js';
import { addInstanced } from '../render/Outline.js';

const _m = new THREE.Matrix4();

/** Pooled comic puffs: train smoke, contrails, boat wakes, rocket exhaust. */
export class Trails {
  constructor(parent, { max = 200, color = '#ffffff', life = 2, grow = 2, drag = 0.8 } = {}) {
    Object.assign(this, { max, life, grow, drag });
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(Infinity);
    this.size = new Float32Array(max);
    this.next = 0;
    this.mesh = addInstanced(parent, new THREE.IcosahedronGeometry(1, 1), toon(color, { flatShading: true }), max, 0, { cast: false });
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
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear() { this.age.fill(Infinity); this.mesh.count = 0; }
}
