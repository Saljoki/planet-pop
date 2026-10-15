import * as THREE from 'three';

const MOVING = new Set(['car', 'plane', 'boat', 'balloon', 'bird', 'train', 'rocket', 'satellite', 'station', 'moon', 'person', 'ufo']);
const _m = new THREE.Matrix4();

/** Anything the camera can focus on or follow. */
class Entity {
  constructor(kind, name) {
    this.kind = kind;
    this.name = name;
    this.moving = MOVING.has(kind);
  }
}

/** One instance of an InstancedMesh (cars, planes, boats…). */
export class InstanceEntity extends Entity {
  constructor(mesh, id, kind, name) { super(kind, name); this.mesh = mesh; this.id = id; }
  getPos(out) { this.mesh.getMatrixAt(this.id, _m); return out.setFromMatrixPosition(_m); }
  getFwd(out) { this.mesh.getMatrixAt(this.id, _m); return out.setFromMatrixColumn(_m, 2).normalize(); }
}

/** A regular Object3D (rocket, station, moon). */
export class ObjectEntity extends Entity {
  constructor(object, kind, name) { super(kind, name); this.object = object; }
  getPos(out) { return this.object.getWorldPosition(out); }
  getFwd(out) { return this.object.getWorldDirection(out); }
}

/** A fixed spot (a city, a clicked patch of ground). */
export class PointEntity extends Entity {
  constructor(pos, kind, name, fwd) { super(kind, name); this.pos = pos.clone(); this.fwd = fwd.clone(); }
  getPos(out) { return out.copy(this.pos); }
  getFwd(out) { return out.copy(this.fwd); }
}
