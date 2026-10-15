import * as THREE from 'three';
import { R, raySphere, tangentBasis } from '../core/Geo.js';
import { PointEntity } from '../core/PointEntity.js';

const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _e = new THREE.Vector3();

/** What's under a point on the screen: the nearest thing on the planet, or the ground itself. */
export class Picker {
  constructor(app) {
    this.app = app;
    this.camera = app.camera;
  }

  /** True when the planet is between the camera and p. */
  occluded(p) {
    const cam = this.camera.position;
    _e.subVectors(p, cam);
    const dist = _e.length();
    _e.divideScalar(dist);
    const t = raySphere(cam, _e, R);
    return t > 0 && t < dist - 0.3;
  }

  /** Nearest entity to a screen point (screen-space, so tiny cars are still easy to hit). */
  entityAt(x, y, radius = 28) {
    let best = null, bestD = radius;
    for (const e of this.app.planet.entities) {
      if ((e.object && !e.object.visible) || e.hidden?.()) continue;
      e.getPos(_v);
      if (e.near && _v.distanceTo(this.camera.position) > e.near) continue; // tiny things (people) only up close
      if (this.occluded(_v)) continue;
      _w.copy(_v).project(this.camera);
      if (_w.z > 1 || _w.z < -1) continue;
      const d = Math.hypot(((_w.x + 1) / 2) * innerWidth - x, ((1 - _w.y) / 2) * innerHeight - y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  /** The spot on the ground under a screen point, as a 'spot' entity (or null if that's sky). */
  groundAt(x, y) {
    const cam = this.camera.position, p = this.app.planet;
    _v.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1, 0.5).unproject(this.camera).sub(cam).normalize();
    let t = raySphere(cam, _v, R + 0.2);
    if (t < 0) { // low down, looking over the hills: walk along the ray until it meets the ground
      for (let s = 0.05; s < 25; s *= 1.04) {
        _w.copy(cam).addScaledVector(_v, s);
        if (_w.length() < p.surfR(_e.copy(_w).normalize()) + 0.05) { t = s; break; }
      }
    }
    if (t < 0) { // skimming just over the horizon: take the spot where the ray passes closest to the planet
      const closest = -cam.dot(_v);
      if (closest <= 0 || cam.clone().addScaledVector(_v, closest).length() > R + 3) return null;
      t = closest;
    }
    const d = _w.copy(cam).addScaledVector(_v, t).normalize();
    return new PointEntity(d.clone().multiplyScalar(p.surfR(d) + 0.1), 'spot', 'Somewhere nice', tangentBasis(d)[0]);
  }
}
