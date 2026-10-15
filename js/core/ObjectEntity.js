import { Entity } from './Entity.js';

/** A regular Object3D: the rocket, the station, the moon, the UFO. */
export class ObjectEntity extends Entity {
  constructor(object, kind, name) {
    super(kind, name, true);
    this.object = object;
  }

  getPos(out) { return this.object.getWorldPosition(out); }
  getFwd(out) { return this.object.getWorldDirection(out); }
}
