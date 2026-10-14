import * as THREE from 'three';
import { R, TAU, LAYER_FX, canvasTexture, tangentBasis } from '../core/Geo.js';
import { Random } from '../core/Random.js';
import { shared } from '../render/Toon.js';

/** Persistent sky: sun on a day/night cycle, shadows, banded atmosphere, stars. */
export class Sky {
  constructor(scene) {
    this.dayLength = 150;            // seconds per full day at 1x
    this.sunDir = shared.uSun.value; // same vector every shader reads
    this.axis = new THREE.Vector3(0.25, 1, 0.1).normalize();
    [this.su, this.sv] = tangentBasis(this.axis);
    const morning = new THREE.Vector3(-0.55, 0.3, 0.8).normalize(); // first view starts in daylight
    this.angle = Math.atan2(morning.dot(this.sv), morning.dot(this.su));

    scene.add(new THREE.AmbientLight('#6b70c9', 0.9));
    const light = (this.light = new THREE.DirectionalLight('#fff2dc', 2.8));
    light.castShadow = true;
    Object.assign(light.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 130 });
    light.shadow.camera.updateProjectionMatrix();
    light.shadow.mapSize.set(2048, 2048);
    light.shadow.bias = -0.0004;
    light.shadow.normalBias = 0.02;
    scene.add(light, light.target);

    this.sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), depthWrite: false }));
    this.sun.scale.setScalar(80);
    this.sun.layers.set(LAYER_FX);
    scene.add(this.sun, makeHalo(), ...makeStars());
    this.update(0);
  }

  update(dt) {
    this.angle += (dt / this.dayLength) * TAU;
    this.sunDir.copy(this.su).multiplyScalar(Math.cos(this.angle)).addScaledVector(this.sv, Math.sin(this.angle));
    this.light.position.copy(this.sunDir).multiplyScalar(60);
    this.sun.position.copy(this.sunDir).multiplyScalar(450);
  }

  /**
   * Shadow box around what the camera sees: the whole planet from orbit, a few units across near the ground,
   * so close-up shadows get far more texels and fewer objects are drawn into the shadow map.
   * The box snaps to whole shadow texels so edges don't shimmer as the camera moves.
   */
  fitShadow(camera) {
    const light = this.light, cam = camera.getWorldPosition(_c), alt = cam.length() - R;
    let half = SHADOW_SIZES[SHADOW_SIZES.length - 1];
    _focus.set(0, 0, 0);
    if (alt < 9) {
      half = SHADOW_SIZES.find((s) => s >= alt * 1.6 + 2.5) ?? half;
      const up = _up.copy(cam).normalize();
      camera.getWorldDirection(_d).addScaledVector(up, -_d.dot(up)); // view direction along the ground
      _focus.copy(up).multiplyScalar(R);
      if (_d.lengthSq() > 1e-6) _focus.addScaledVector(_d.normalize(), half * 0.5); // reach ahead of the camera
      const [x, y] = tangentBasis(this.sunDir), texel = (2 * half) / light.shadow.mapSize.x;
      const fx = Math.round(_focus.dot(x) / texel) * texel, fy = Math.round(_focus.dot(y) / texel) * texel;
      const fz = _focus.dot(this.sunDir);
      _focus.set(0, 0, 0).addScaledVector(x, fx).addScaledVector(y, fy).addScaledVector(this.sunDir, fz);
    }
    light.target.position.copy(_focus);
    light.position.copy(_focus).addScaledVector(this.sunDir, 60);
    const sc = light.shadow.camera;
    if (sc.right !== half) {
      Object.assign(sc, { left: -half, right: half, top: half, bottom: -half });
      sc.updateProjectionMatrix();
    }
  }
}

const SHADOW_SIZES = [3, 4.5, 6.5, 9, 12, 16];
const _c = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(), _focus = new THREE.Vector3();

function sunTexture() {
  return canvasTexture(256, 256, (g) => {
    g.translate(128, 128);
    g.lineJoin = 'round';
    g.lineWidth = 7;
    g.strokeStyle = '#1b1530';
    g.fillStyle = '#ffb21f';
    g.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, r = i % 2 ? 84 : 122; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.arc(0, 0, 68, 0, TAU); g.fillStyle = '#ffe45c'; g.fill(); g.stroke();
    g.beginPath(); g.arc(-22, -24, 16, 0, TAU); g.fillStyle = '#fff6c2'; g.fill();
  });
}

function makeHalo() {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: shared.uSun, uDay: { value: new THREE.Color('#9fdcff') }, uNight: { value: new THREE.Color('#5a4fc9') } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vP; varying vec3 vW;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vec4 mv = viewMatrix * w; vP = mv.xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uDay; uniform vec3 uNight;
      varying vec3 vN; varying vec3 vP; varying vec3 vW;
      void main() {
        float d = -dot(normalize(vN), normalize(-vP));
        float a = clamp(d / 0.66, 0.0, 1.0);
        a = (step(0.2, a) + step(0.5, a) + step(0.8, a)) / 3.0;       // banded comic glow
        float day = smoothstep(-0.35, 0.35, dot(normalize(vW), uSun));
        gl_FragColor = vec4(mix(uNight, uDay, day), a * mix(0.14, 0.42, day));
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.32, 64, 48), mat);
  halo.layers.set(LAYER_FX);
  return halo;
}

function makeStars() {
  const rng = new Random(4242);
  const tex = canvasTexture(64, 64, (g) => {
    g.fillStyle = '#ffffff';
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4 - Math.PI / 2, r = i % 2 ? 8 : 31; g.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    g.closePath(); g.fill();
  });
  return [[650, 5, '#ffffff'], [90, 13, '#fff3a6']].map(([n, size, color]) => {
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) rng.dir().multiplyScalar(rng.range(500, 900)).toArray(arr, i * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex, size, color, sizeAttenuation: false, transparent: true, alphaTest: 0.2, depthWrite: false }));
    pts.layers.set(LAYER_FX);
    return pts;
  });
}
