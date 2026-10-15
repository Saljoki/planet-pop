import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { LAYER_FX } from '../core/Geo.js';

const INK = new THREE.Color('#1b1530');
/** Outlines this thin (world units) are under a pixel wide from orbit, so they're skipped above this altitude. */
const THIN = 0.012, THIN_ALT = 9;
const geoCache = new WeakMap();

/**
 * Inverted-hull ink: back faces pushed out along smooth normals.
 * Width is constant on screen, capped at `maxW` world units so tiny things don't become blobs.
 * Fragments closer than `near` are dropped so flying through a cloud doesn't black out the view.
 */
export function outlineMaterial(maxW, near = 0.12) {
  return new THREE.ShaderMaterial({
    uniforms: { thick: { value: 0.0022 }, maxW: { value: maxW }, near: { value: near }, ink: { value: INK } },
    vertexShader: /* glsl */ `
      uniform float thick; uniform float maxW; varying float vDepth;
      void main() {
        vec4 p = vec4(position, 1.0); vec3 n = normal;
        #ifdef USE_INSTANCING
          p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
        #endif
        vec4 mv = modelViewMatrix * p;
        mv.xyz += normalize(normalMatrix * n) * min(thick * -mv.z, maxW);
        vDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 ink; uniform float near; varying float vDepth;
      void main() { if (vDepth < near) discard; gl_FragColor = vec4(ink, 1.0); }`,
    side: THREE.BackSide,
  });
}

/** Position-only, vertex-merged copy with smooth normals (closed hull, no cracks at hard edges). */
export function outlineGeometry(geo) {
  if (!geoCache.has(geo)) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.getAttribute('position').clone());
    if (geo.index) g.setIndex(geo.index.clone());
    const merged = mergeVertices(g);
    merged.computeVertexNormals();
    geoCache.set(geo, merged);
  }
  return geoCache.get(geo);
}

/** opts: { cast, receive, near, outlineGeometry, detail (highest camera altitude it's drawn at, see Detail.js) } */
export function addMesh(parent, geo, mat, maxW = 0, opts = {}) {
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.detail) mesh.userData.detail = opts.detail;
  parent.add(mesh);
  if (maxW) {
    const o = new THREE.Mesh(opts.outlineGeometry || outlineGeometry(geo), outlineMaterial(maxW, opts.near));
    o.layers.set(LAYER_FX);
    if (maxW <= THIN) o.userData.detail = THIN_ALT;
    mesh.add(o);
  }
  return mesh;
}

export function addInstanced(parent, geo, mat, count, maxW = 0, opts = {}) {
  const cap = Math.max(count, 1);
  const mesh = new THREE.InstancedMesh(geo, mat, cap);
  mesh.count = count;
  mesh.frustumCulled = false;
  mesh.castShadow = opts.cast ?? true;
  mesh.receiveShadow = opts.receive ?? true;
  if (opts.detail) mesh.userData.detail = opts.detail;
  parent.add(mesh);
  if (maxW) {
    const o = new THREE.InstancedMesh(outlineGeometry(geo), outlineMaterial(maxW, opts.near), cap);
    o.instanceMatrix = mesh.instanceMatrix;
    o.count = count;
    o.frustumCulled = false;
    o.layers.set(LAYER_FX);
    const d = Math.min(opts.detail || Infinity, maxW <= THIN ? THIN_ALT : Infinity);
    if (d < Infinity) o.userData.detail = d;
    parent.add(o);
    mesh.userData.outline = o;
  }
  return mesh;
}

/** Make `others` (and their ink hulls) reuse src's instance matrices: one setMatrixAt drives them all. */
export function shareMatrices(src, ...others) {
  for (const m of others) {
    m.instanceMatrix = src.instanceMatrix;
    if (m.userData.outline) m.userData.outline.instanceMatrix = src.instanceMatrix;
  }
}
