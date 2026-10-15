import { Entity } from './Entity.js';

/** A fixed spot: a town, an airport, a clicked patch of ground. */
export class PointEntity extends Entity {
  constructor(pos, kind, name, fwd) {
    super(kind, name, false);
    this.pos = pos.clone();
    this.fwd = fwd.clone();
  }

  getPos(out) { return out.copy(this.pos); }
  getFwd(out) { return out.copy(this.fwd); }
}
