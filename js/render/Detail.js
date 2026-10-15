import { R } from '../core/Geo.js';

/**
 * Hides things too small to see from where the camera is. Objects opt in with `userData.detail`: the highest camera
 * altitude (above sea level) at which they're still worth drawing. From orbit that drops dozens of draw calls:
 * thin ink outlines, people, car lights, lamp posts… each one smaller than a pixel up there.
 */
export class Detail {
  constructor() {
    this.items = [];
    this.alt = -1;
  }

  /** Gather everything under `root` that has a detail altitude (call after a planet is built). */
  collect(root) {
    this.items = [];
    root.traverse((o) => { if (o.userData.detail) this.items.push(o); });
    this.alt = -1;
  }

  update(camera) {
    const alt = camera.position.length() - R;
    if (Math.abs(alt - this.alt) < 0.05) return;
    this.alt = alt;
    for (const o of this.items) o.visible = alt < o.userData.detail;
  }
}
