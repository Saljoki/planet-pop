import * as THREE from 'three';
import { mulberry32 } from './Noise.js';

/** Seeded RNG so every planet seed rebuilds the exact same world. */
export class Random {
  constructor(seed) { this.next = mulberry32(seed); }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.next() * arr.length)]; }
  chance(p) { return this.next() < p; }
  dir() {
    const z = this.range(-1, 1), t = this.range(0, Math.PI * 2), s = Math.sqrt(1 - z * z);
    return new THREE.Vector3(s * Math.cos(t), z, s * Math.sin(t));
  }
}
