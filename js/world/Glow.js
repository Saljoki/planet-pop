import * as THREE from 'three';
import { shared } from '../render/Toon.js';

/** Unlit material that turns from a day colour into a glowing night colour depending on the sun. */
export function nightGlowMaterial(day, night) {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: shared.uSun, uDay: { value: new THREE.Color(day) }, uNight: { value: new THREE.Color(night) } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 p = vec4(position, 1.0);
        #ifdef USE_INSTANCING
          p = instanceMatrix * p;
        #endif
        vec4 w = modelMatrix * p; vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSun; uniform vec3 uDay; uniform vec3 uNight; varying vec3 vW;
      void main() {
        float n = smoothstep(0.12, -0.2, dot(normalize(vW), uSun));
        gl_FragColor = vec4(mix(uDay, uNight, n), 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
