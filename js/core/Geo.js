import * as THREE from 'three';

export const R = 10;            // sea-level radius
export const TAU = Math.PI * 2;
export const LAYER_FX = 1;      // ink hulls, glows, particles: skipped by the edge-detection normal pass

export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const mod = (x, m) => ((x % m) + m) % m;
export const smoothstep = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
export const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3();

/** Matrix for an object standing on the surface: `up` exact, `fwd` flattened onto the ground. */
export function frame(out, pos, up, fwd, sx = 1, sy = sx, sz = sx) {
  _y.copy(up).normalize();
  _z.copy(fwd);
  _z.addScaledVector(_y, -_z.dot(_y)).normalize();
  _x.crossVectors(_y, _z);
  out.makeBasis(_x.multiplyScalar(sx), _y.multiplyScalar(sy), _z.multiplyScalar(sz));
  return out.setPosition(pos);
}

/** Matrix for a moving object: `fwd` exact (so it pitches with slopes), `upHint` adjusted. */
export function frameFwd(out, pos, upHint, fwd) {
  _z.copy(fwd).normalize();
  _x.crossVectors(upHint, _z).normalize();
  _y.crossVectors(_z, _x);
  out.makeBasis(_x, _y, _z);
  return out.setPosition(pos);
}

export function tangentBasis(n) {
  const a = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(a, n).normalize();
  return [u, new THREE.Vector3().crossVectors(n, u)];
}

/** Point on the small circle of angular radius A around the unit centre c. */
export function smallCircle(out, c, u, v, A, phi) {
  const s = Math.sin(A);
  return out.copy(c).multiplyScalar(Math.cos(A)).addScaledVector(u, Math.cos(phi) * s).addScaledVector(v, Math.sin(phi) * s);
}

/** Distance along a unit ray to the first hit with an origin-centred sphere, or -1. */
export function raySphere(o, d, r) {
  const b = o.dot(d), c = o.lengthSq() - r * r, h = b * b - c;
  return h < 0 ? -1 : -b - Math.sqrt(h);
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function ribbonGeometry(pos, nor, uv, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}
