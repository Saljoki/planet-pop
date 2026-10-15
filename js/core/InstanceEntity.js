import * as THREE from 'three';
import { Entity } from './Entity.js';

const _m = new THREE.Matrix4();

/** One instance of an InstancedMesh: a car, a plane, a boat… */
export class InstanceEntity extends Entity {
  constructor(mesh, id, kind, name) {
    super(kind, name, true);
    this.mesh = mesh;
    this.id = id;
  }

  getPos(out) { this.mesh.getMatrixAt(this.id, _m); return out.setFromMatrixPosition(_m); }
  getFwd(out) { this.mesh.getMatrixAt(this.id, _m); return out.setFromMatrixColumn(_m, 2).normalize(); }
}
