import * as THREE from 'three';
import { R, TAU, LAYER_FX, tangentBasis } from '../core/Geo.js';
import { shared } from '../render/Toon.js';

const SEGMENTS = 180, CURTAINS = 2, BOTTOM = R + 1.5, TOP = R + 3.7;
const _c = new THREE.Vector3();

/**
 * Glowing curtains of light circling both poles. The sun always circles the equator, so half of each ring
 * is in darkness at any time: that half shimmers, in comic-style banded green and pink.
 */
export class Aurora {
  constructor(planet) {
    this.planet = planet;
    this.poles = [1, -1].map((s) => planet.app.sky.axis.clone().multiplyScalar(s));
    const rng = planet.rng, pos = [], uv = [], out = [], idx = [];
    const t = planet.theme; // (an aurora needs an atmosphere to glow in, or a magnetic field of its own: Ganymede's)
    this.lit = t.aurora === true || (!t.air && t.aurora !== false) ? this.poles : [];
    for (const pole of this.lit) {
      const [u, v] = tangentBasis(pole);
      for (let c = 0; c < CURTAINS; c++) {
        const ph = rng.range(0, TAU), base = pos.length / 3;
        for (let i = 0; i <= SEGMENTS; i++) {
          const th = (i / SEGMENTS) * TAU;
          const A = 0.36 + c * 0.05 + 0.05 * Math.sin(3 * th + ph) + 0.025 * Math.sin(8 * th + ph * 1.7);
          const o = u.clone().multiplyScalar(Math.cos(th)).addScaledVector(v, Math.sin(th));
          const d = pole.clone().multiplyScalar(Math.cos(A)).addScaledVector(o, Math.sin(A));
          for (const [r, y] of [[BOTTOM + c * 0.25, 0], [TOP - c * 0.3, 1]]) {
            pos.push(d.x * r, d.y * r, d.z * r);
            out.push(o.x, o.y, o.z);
            uv.push((i / SEGMENTS) * (6 + c * 2), y);
          }
          if (i < SEGMENTS) { const b = base + i * 2; idx.push(b, b + 1, b + 3, b, b + 3, b + 2); }
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setAttribute('aOut', new THREE.Float32BufferAttribute(out, 3));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, auroraMaterial());
    this.mesh.layers.set(LAYER_FX);
    this.mesh.frustumCulled = false;
    planet.root.add(this.mesh);
  }

  /** Trophy when the camera is near a pole on its night side. */
  update() {
    const app = this.planet.app, cam = app.camera.position;
    if (cam.length() > R + 9 || this.planet.nightAt(cam) < 0.5) return;
    _c.copy(cam).normalize();
    if (this.lit.some((p) => p.angleTo(_c) < 0.75)) app.achievements?.unlock('aurora');
  }
}

function auroraMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: shared.uSun, uTime: shared.uTime },
    vertexShader: /* glsl */ `
      uniform float uTime;
      attribute vec3 aOut;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        vUv = uv;
        vec3 p = position + aOut * sin(uTime * 0.5 + uv.x * 5.0) * 0.12 * (0.3 + uv.y); // the curtain sways
        vec4 w = modelMatrix * vec4(p, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uSun;
      varying vec2 vUv; varying vec3 vW;
      void main() {
        float x = vUv.x, y = vUv.y;
        float rays = 0.55 + 0.45 * sin(x * 70.0 + sin(x * 9.0 + uTime * 0.7) * 3.0 + uTime * 0.35);
        rays *= 0.55 + 0.45 * sin(x * 13.0 - uTime * 0.45);
        float shape = smoothstep(0.0, 0.14, y) * (1.0 - smoothstep(0.4, 1.0, y));
        float night = smoothstep(0.05, -0.3, dot(normalize(vW), uSun));
        float a = floor(rays * shape * night * 4.0 + 0.35) / 4.0; // comic bands instead of a smooth glow
        vec3 col = mix(vec3(0.25, 1.0, 0.55), vec3(1.0, 0.35, 0.85), smoothstep(0.3, 0.85, y));
        gl_FragColor = vec4(col, a * 0.75);
        #include <colorspace_fragment>
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
}
