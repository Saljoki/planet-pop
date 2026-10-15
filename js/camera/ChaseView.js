import * as THREE from 'three';

const _w = new THREE.Vector3(), _e = new THREE.Vector3();

/** Sky Courier's chase cam: behind and above the player's plane, shaking when it's hit. */
export class ChaseView {
  constructor(rig) {
    this.rig = rig;
    this.player = null;
  }

  /** Where the camera wants to be. */
  pose(out) {
    const pl = this.player, k = Math.min(2, Math.max(1, 1.1 / this.rig.camera.aspect)); // pull back on portrait screens
    out.pos.copy(pl.pos).addScaledVector(pl.fwd, -1.6 * k).addScaledVector(pl.up, 0.6 * k);
    out.look.copy(pl.pos).addScaledVector(pl.fwd, 1.2);
    out.up.copy(pl.up);
    return out;
  }

  /** Each frame: ease toward the pose, staying out of the hills. */
  update(dt) {
    const rig = this.rig, cam = rig.camera, pose = this.pose(rig.pose), k = 1 - Math.exp(-dt * 6);
    cam.position.lerp(pose.pos, k);
    const r = cam.position.length(), floor = rig.floorAt(_w.copy(cam.position).divideScalar(r)) + 0.15;
    if (r < floor) cam.position.multiplyScalar(floor / r);
    cam.up.lerp(pose.up, k).normalize();
    rig.look.lerp(pose.look, Math.min(1, k * 1.5));
    cam.lookAt(rig.look);
    const shake = this.player.shake;
    if (shake > 0) cam.position.add(_e.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(shake * 0.05));
  }
}
