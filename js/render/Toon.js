import * as THREE from 'three';

/** Uniforms shared by every custom shader (one object, so updates reach all materials). */
export const shared = {
  uSun: { value: new THREE.Vector3(0, 0, 1) },
  uHalftone: { value: 6 },
  uTime: { value: 0 },
};

// Replaces three's toon gradient: 3 hard bands, with screen-space halftone dots in the shaded bands.
const HALFTONE = /* glsl */ `
uniform float uHalftone;
float halftone(float radius) {
  vec2 p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / uHalftone);
  return step(radius, length(fract(p) - 0.5));
}
vec3 getGradientIrradiance(vec3 normal, vec3 lightDirection) {
  float d = dot(normal, lightDirection);
  if (d > 0.3) return vec3(1.0);
  if (d > -0.15) return vec3(0.6 * mix(0.5, 1.0, halftone(0.24)));
  return vec3(0.18 * mix(0.1, 1.0, halftone(0.38)));
}
`;

/** Snippets for shaders that need the world position (night glow etc.). */
export const WPOS_DECL = 'varying vec3 vWPos;\n';
export const WPOS_VERT = /* glsl */ `#include <project_vertex>
  vec4 wPos4 = vec4(transformed, 1.0);
  #ifdef USE_INSTANCING
    wPos4 = instanceMatrix * wPos4;
  #endif
  vWPos = (modelMatrix * wPos4).xyz;`;

/**
 * Toon material with halftone shading. `hook(shader)` can patch it further;
 * every distinct hook needs its own `key` so three compiles a separate program.
 */
export function toon(color, extra = {}, hook = null, key = '') {
  const { flatShading, ...rest } = extra;
  const mat = new THREE.MeshToonMaterial({ color, ...rest });
  if (flatShading) mat.flatShading = true; // not a constructor option on toon materials, but the renderer honours it
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, shared);
    sh.fragmentShader = sh.fragmentShader.replace('#include <gradientmap_pars_fragment>', HALFTONE);
    if (hook) hook(sh);
  };
  mat.customProgramCacheKey = () => 'toon:' + key;
  return mat;
}
