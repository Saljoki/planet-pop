/**
 * Anything the camera can focus on or follow. Subclasses say where it is (getPos) and which way it faces (getFwd);
 * `moving` things get the camera drifting back behind them. Optional extras other code looks for:
 * `near` (only pickable within this distance of the camera) and `hidden()` (can't be picked right now).
 */
export class Entity {
  constructor(kind, name, moving) {
    this.kind = kind;
    this.name = name;
    this.moving = moving;
  }
}
