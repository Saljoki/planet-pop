import * as THREE from 'three';
import { LAYER_FX } from '../core/Geo.js';

/** Edge-detection ink pass: depth Laplacian + normal creases, composited over the colour render. */
export class PostFX {
  constructor(renderer) {
    this.renderer = renderer;
    this.enabled = true;
    this.colorRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4, type: THREE.HalfFloatType });
    this.normalRT = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) });
    this.normalMat = new THREE.MeshNormalMaterial({ flatShading: true });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.colorRT.texture },
        tNormal: { value: this.normalRT.texture },
        tDepth: { value: this.normalRT.depthTexture },
        uRes: { value: new THREE.Vector2(1, 1) },
        uNear: { value: 0.05 },
        uFar: { value: 2000 },
        uInk: { value: new THREE.Color('#1b1530') },
      },
      vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D tColor; uniform sampler2D tNormal; uniform sampler2D tDepth;
        uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform vec3 uInk;
        varying vec2 vUv;
        float lin(vec2 uv) {
          float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
          return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear));
        }
        float crease(vec4 a, vec4 b) {
          if (a.a < 0.5 || b.a < 0.5) return abs(a.a - b.a);
          return 1.0 - dot(normalize(a.xyz * 2.0 - 1.0), normalize(b.xyz * 2.0 - 1.0));
        }
        void main() {
          vec2 ox = vec2(1.0 / uRes.x, 0.0), oy = vec2(0.0, 1.0 / uRes.y);
          vec4 col = texture2D(tColor, vUv);
          vec4 n0 = texture2D(tNormal, vUv);
          float ne = max(max(crease(n0, texture2D(tNormal, vUv + ox)), crease(n0, texture2D(tNormal, vUv - ox))),
                         max(crease(n0, texture2D(tNormal, vUv + oy)), crease(n0, texture2D(tNormal, vUv - oy))));
          float d0 = lin(vUv);
          float lap = (abs(lin(vUv + ox) + lin(vUv - ox) - 2.0 * d0) + abs(lin(vUv + oy) + lin(vUv - oy) - 2.0 * d0)) / d0;
          float edge = max(smoothstep(0.02, 0.06, lap), smoothstep(0.3, 0.5, ne)) * step(0.5, n0.a);
          col.rgb = mix(col.rgb, uInk, edge);
          col.a = max(col.a, edge);
          gl_FragColor = col;
          #include <colorspace_fragment>
        }`,
      depthTest: false,
      depthWrite: false,
      blending: THREE.NoBlending,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  setSize(w, h) {
    this.colorRT.setSize(w, h);
    this.normalRT.setSize(w, h);
    this.mat.uniforms.uRes.value.set(w, h);
  }

  render(scene, camera) {
    const r = this.renderer;
    if (!this.enabled) { r.setRenderTarget(null); r.render(scene, camera); return; }
    r.setRenderTarget(this.colorRT);
    r.render(scene, camera);

    const mask = camera.layers.mask;
    camera.layers.disable(LAYER_FX);           // no hulls / glows / particles in the normal pass
    scene.overrideMaterial = this.normalMat;
    r.setRenderTarget(this.normalRT);
    r.render(scene, camera);
    scene.overrideMaterial = null;
    camera.layers.mask = mask;

    this.mat.uniforms.uNear.value = camera.near;
    this.mat.uniforms.uFar.value = camera.far;
    r.setRenderTarget(null);
    r.render(this.quad, this.quadCam);
  }
}
