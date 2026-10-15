import { smoothstep } from '../core/Geo.js';

const MOVED = 0.02; // the camera has to move this far (units) before anything is worked out again

/**
 * Instances (trees) that shrink away into their base as the camera gets further than `near` from them, and are gone
 * beyond `far`. Done on the instance matrices, so the picture, the ink lines, the shadows and the ink hulls all agree.
 * Set every instance's matrix first: they're read once, here, as the full-size ones.
 */
export class InstanceFade {
  constructor(meshes, near, far) {
    Object.assign(this, { near, far, eye: null });
    this.items = meshes.filter((m) => m.count).map((mesh) => ({
      mesh, base: mesh.instanceMatrix.array.slice(0, mesh.count * 16), k: new Float32Array(mesh.count).fill(1),
    }));
  }

  /** How much of an instance to draw at distance `dist` (1 = all of it). */
  scaleAt(dist) { return smoothstep(this.far, this.near, dist); }

  update(eye) {
    if (this.eye && this.eye.distanceToSquared(eye) < MOVED * MOVED) return;
    this.eye = (this.eye || eye.clone()).copy(eye);
    for (const it of this.items) {
      const { base, k } = it, arr = it.mesh.instanceMatrix.array;
      let changed = false;
      for (let i = 0, o = 0; i < k.length; i++, o += 16) {
        const s = this.scaleAt(Math.hypot(base[o + 12] - eye.x, base[o + 13] - eye.y, base[o + 14] - eye.z));
        if (s === k[i]) continue;
        k[i] = s;
        changed = true;
        for (let j = 0; j < 12; j++) if (j % 4 !== 3) arr[o + j] = base[o + j] * s; // shrink the axes, keep the base where it is
      }
      if (changed) it.mesh.instanceMatrix.needsUpdate = true;
    }
  }
}
