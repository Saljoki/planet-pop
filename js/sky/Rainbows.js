import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_FX, frame, smoothstep } from '../core/Geo.js';

const BANDS = ['#8f5cff', '#3fa7ff', '#2ee59d', '#ffd23f', '#ff9a3c', '#ff4d4d']; // violet inside, red outside
const RADIUS = 1.25, WIDTH = 0.065, CYCLE = 70, SHOWN = 26;
const _c = new THREE.Vector3(), _h = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();

/** A rainbow arch beside each rain cloud now and then, on the side away from the sun, while it's daytime there. */
export class Rainbows {
  constructor(planet) {
    this.planet = planet;
    this.list = [];
    if (!['rain', 'sprinkles'].includes(planet.theme.precip.kind)) return; // no rainbows from snow or ash
    const geo = mergeGeometries(BANDS.map((col, i) => {
      const g = new THREE.TorusGeometry(RADIUS + i * WIDTH, WIDTH * 0.55, 5, 48, Math.PI);
      const c = new THREE.Color(col), n = g.attributes.position.count;
      g.setAttribute('color', new THREE.Float32BufferAttribute(Array.from({ length: n * 3 }, (_, k) => c.toArray()[k % 3]), 3));
      return g;
    }));
    for (const storm of planet.weather.storms) {
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      mesh.layers.set(LAYER_FX);
      mesh.matrixAutoUpdate = false;
      mesh.visible = false;
      planet.root.add(mesh);
      this.list.push({ storm, mesh, t: Math.random() * CYCLE });
    }
  }

  /** How strong rainbow `i` is right now (0..1). */
  strength(i) { return this.list[i]?.mesh.visible ? this.list[i].mesh.material.opacity / 0.8 : 0; }

  update(dt) {
    const p = this.planet, app = p.app, sun = app.sky.sunDir;
    for (const r of this.list) {
      r.t = (r.t + dt) % CYCLE;
      const env = smoothstep(0, 3, r.t) * smoothstep(SHOWN, SHOWN - 3, r.t); // fades in and out within its slot
      const c = p.weather.stormCenter(r.storm, _c), up = c.normalize(), day = smoothstep(0.1, 0.35, up.dot(sun));
      const k = env * day;
      r.mesh.visible = k > 0.01;
      if (!r.mesh.visible) continue;
      r.mesh.material.opacity = 0.8 * k;
      const away = _h.copy(sun).addScaledVector(up, -sun.dot(up)).normalize().negate(); // along the ground, away from the sun
      const base = _p.copy(up).addScaledVector(away, 0.1).normalize();
      frame(_m, base.clone().multiplyScalar(p.surfR(base) - 0.05), base, away.negate()); // the arch faces the sun
      r.mesh.matrix.copy(_m);
      r.mesh.matrixWorldNeedsUpdate = true;
      if (k > 0.5 && app.camera.position.distanceTo(_p.setFromMatrixPosition(_m)) < 6) app.achievements?.unlock('rainbow');
    }
  }
}
