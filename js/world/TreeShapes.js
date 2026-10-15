import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TAU } from '../core/Geo.js';

/**
 * Tree-like things for each theme, built standing on the origin, about 0.45 tall.
 * `trunk: true` means the shared brown (or theme-coloured) trunk is drawn under it.
 */
export const TREE_SHAPES = {
  pine: {
    trunk: true,
    geo: () => mergeGeometries([
      new THREE.ConeGeometry(0.13, 0.26, 7).translate(0, 0.27, 0),
      new THREE.ConeGeometry(0.095, 0.2, 7).translate(0, 0.42, 0),
    ]),
  },
  round: { trunk: true, geo: () => new THREE.IcosahedronGeometry(0.135, 1).translate(0, 0.3, 0) },
  crystal: { trunk: false, geo: () => new THREE.OctahedronGeometry(0.1, 0).scale(1, 2.4, 1).translate(0, 0.22, 0) },
  cactus: {
    trunk: false,
    geo: () => mergeGeometries([
      new THREE.CapsuleGeometry(0.045, 0.3, 3, 8).translate(0, 0.2, 0),
      new THREE.CylinderGeometry(0.022, 0.022, 0.07, 6).rotateZ(Math.PI / 2).translate(0.06, 0.16, 0),
      new THREE.CapsuleGeometry(0.024, 0.09, 3, 6).translate(0.09, 0.22, 0),
      new THREE.CylinderGeometry(0.02, 0.02, 0.06, 6).rotateZ(Math.PI / 2).translate(-0.055, 0.24, 0),
      new THREE.CapsuleGeometry(0.022, 0.07, 3, 6).translate(-0.085, 0.29, 0),
    ].map((g) => g.toNonIndexed())),
  },
  palm: {
    trunk: true,
    geo: () => mergeGeometries([0, 1, 2, 3, 4].map((k) =>
      new THREE.BoxGeometry(0.2, 0.012, 0.055).translate(0.1, 0, 0).rotateZ(-0.35).rotateY((k / 5) * TAU).translate(0, 0.24, 0))),
  },
  lollipop: { trunk: true, geo: () => new THREE.CylinderGeometry(0.12, 0.12, 0.04, 18).rotateX(Math.PI / 2).translate(0, 0.34, 0) },
  gumdrop: { trunk: false, geo: () => new THREE.SphereGeometry(0.12, 12, 8, 0, TAU, 0, Math.PI / 2).scale(1, 1.15, 1) },
  deadtree: {
    trunk: true,
    geo: () => mergeGeometries([
      new THREE.CylinderGeometry(0.01, 0.016, 0.2, 5).translate(0, 0.1, 0).rotateZ(0.6).translate(0, 0.2, 0),
      new THREE.CylinderGeometry(0.01, 0.016, 0.17, 5).translate(0, 0.085, 0).rotateZ(-0.7).translate(0, 0.17, 0),
      new THREE.CylinderGeometry(0.008, 0.012, 0.14, 5).translate(0, 0.07, 0).rotateX(0.5).translate(0, 0.22, 0),
    ]),
  },
};
