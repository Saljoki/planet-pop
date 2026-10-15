import * as THREE from 'three';
import { LAYER_FX, canvasTexture } from '../core/Geo.js';

const _c = new THREE.Color();

/** A soft round dot, so each point draws as a glowing spark rather than a square. */
function dotTexture() {
  return canvasTexture(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.8)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  });
}

/**
 * Pooled glowing points that fall toward the planet and fade out: firework bursts, rocket sparks.
 * One draw call for all of them; additive blending makes overlapping sparks glow brighter.
 */
export class Sparks {
  constructor(parent, max = 1500, size = 0.07) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.rgb = new Float32Array(max * 3);
    this.age = new Float32Array(max).fill(Infinity);
    this.life = new Float32Array(max).fill(1);
    this.next = 0;
    this.live = 0;
    const g = (this.geometry = new THREE.BufferGeometry());
    this.outPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.outCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.outPos);
    g.setAttribute('color', this.outCol);
    g.setDrawRange(0, 0);
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size, map: dotTexture(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    this.points.frustumCulled = false;
    this.points.layers.set(LAYER_FX);
    parent.add(this.points);
  }

  emit(p, v, color, life) {
    const i = this.next, j = i * 3;
    this.next = (i + 1) % this.max;
    p.toArray(this.pos, j);
    v.toArray(this.vel, j);
    _c.set(color).toArray(this.rgb, j);
    this.age[i] = 0;
    this.life[i] = life;
  }

  /** gravity pulls toward the planet's centre; drag slows the burst so it hangs in the air for a moment. */
  update(dt, gravity = 0.55, drag = 1.1) {
    const damp = Math.exp(-dt * drag), P = this.outPos.array, C = this.outCol.array;
    let n = 0;
    for (let i = 0; i < this.max; i++) {
      if (this.age[i] >= this.life[i]) continue;
      const t = (this.age[i] += dt) / this.life[i];
      if (t >= 1) continue;
      const j = i * 3, x = this.pos[j], y = this.pos[j + 1], z = this.pos[j + 2], r = Math.hypot(x, y, z) || 1;
      this.vel[j] = this.vel[j] * damp - (x / r) * gravity * dt;
      this.vel[j + 1] = this.vel[j + 1] * damp - (y / r) * gravity * dt;
      this.vel[j + 2] = this.vel[j + 2] * damp - (z / r) * gravity * dt;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const fade = Math.pow(1 - t, 1.5) * (t > 0.6 ? 0.6 + 0.4 * Math.sin(this.age[i] * 40 + i) : 1); // twinkles as it dies
      P[n * 3] = this.pos[j]; P[n * 3 + 1] = this.pos[j + 1]; P[n * 3 + 2] = this.pos[j + 2];
      C[n * 4] = this.rgb[j]; C[n * 4 + 1] = this.rgb[j + 1]; C[n * 4 + 2] = this.rgb[j + 2]; C[n * 4 + 3] = fade;
      n++;
    }
    this.live = n;
    this.geometry.setDrawRange(0, n);
    this.outPos.needsUpdate = this.outCol.needsUpdate = true;
  }
}
