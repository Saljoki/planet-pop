import * as THREE from 'three';
import { clamp } from '../../core/Geo.js';
import { Trails } from '../../life/Trails.js';

/** How much a full tank of health each kind of knock takes (before armour). */
export const HARM = { crash: 0.25, lightning: 0.15, lava: 0.5 };

const BASE_STATS = { speed: 1, turn: 1, drain: 0.35, regen: 0.08, armour: 1 };
const _s = new THREE.Vector3(), _v = new THREE.Vector3();

/**
 * Something the player drives: the plane, a car, a boat. It sits on the globe at `up` (a unit vector) facing `fwd`
 * (a tangent), `pos` is where it is in the world, and `group` is its model. Subclasses move it in update(dt) from
 * `input`; everything they share is here: health and wrecking, the boost tank, shaking, damage smoke.
 */
export class Vehicle {
  constructor(planet, stats = BASE_STATS) {
    this.planet = planet;
    this.stats = stats;
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.pos = new THREE.Vector3();
    this.group = new THREE.Group();
    this.health = 1;      // 0 = wrecked
    this.wrecked = false;
    this.boost = 1;       // the boost tank, 0..1
    this.shake = 0;       // camera shake, 0..1
    this.invuln = 0;      // seconds of grace after a knock
    this.crashed = false; // true for the one frame it hit something
    this.engine = 1;      // < 1 while volcanic ash chokes the engine
    this.turbulence = 0;  // 0..1 inside a thundercloud
    this.locked = false;  // true while it mustn't move (a race countdown)
    this.t = 0;
    // keys and buttons are on/off; a thumbstick or tilting the phone adds steer (-1 left … 1 right) and climb (-1 … 1)
    this.input = { left: false, right: false, up: false, down: false, boost: false, steer: 0, climb: 0 };
    this.controls = { invertY: false, sensitivity: 1 }; // the player's options (Rex drives with the defaults)
    planet.root.add(this.group);
    this.smoke = new Trails(planet.root, { max: 70, color: '#8a8399', life: 1.4, grow: 2.2, drag: 0.5, near: 0.5 });
    this.smokeT = 0;
  }

  /** 'plane', 'car' or 'boat'. */
  get kind() { return 'vehicle'; }

  /** The chase camera: how far behind and above to sit, and how far ahead to look (world units). */
  get chase() { return { back: 1.6, up: 0.6, ahead: 1.2 }; }

  /** Whether tilting the phone forward and back drives it (the plane climbs and dives; a car leaves that to the stick). */
  get tiltClimbs() { return true; }

  /** Speed over the ground right now, world units per second (for the speedometer). */
  get speed() { return 0; }

  /** Show what it's carrying (a parcel's colour), if it carries anything. */
  setCargo() {}

  /** Take a knock: `amount` of a full health bar, softened by armour. Returns true if that wrecked it. */
  damage(amount) {
    if (this.wrecked) return false;
    this.health = Math.max(0, this.health - amount * (this.stats.armour ?? 1));
    this.wrecked = this.health <= 0;
    this.shake = 1;
    return this.wrecked;
  }

  /** Slow harm that doesn't shake anything (Mercury's sunshine). Returns true if that wrecked it. */
  wear(amount) {
    if (this.wrecked) return false;
    this.health = Math.max(0, this.health - amount * (this.stats.armour ?? 1));
    this.wrecked = this.health <= 0;
    return this.wrecked;
  }

  repair(amount) {
    if (!this.wrecked) this.health = Math.min(1, this.health + amount);
  }

  /** Put it down somewhere fresh, as good as new (after a wreck, in the free modes). */
  respawn(at, heading) {
    Object.assign(this, { health: 1, wrecked: false, boost: 1, shake: 0, invuln: 2 });
    this.place(at, heading);
    this.group.visible = true;
  }

  /** Move it to direction `at`, facing along `heading` (both get flattened onto the globe). */
  place(at, heading) {
    this.up.copy(at).normalize();
    this.fwd.copy(heading).addScaledVector(this.up, -heading.dot(this.up));
    if (this.fwd.lengthSq() < 1e-8) this.fwd.set(1, 0, 0).addScaledVector(this.up, -this.up.x);
    this.fwd.normalize();
  }

  /** Burn or refill the boost tank; returns whether it's boosting this frame. */
  boostStep(dt) {
    const st = this.stats, boosting = this.input.boost && this.boost > 0.02;
    this.boost = clamp(this.boost + (boosting ? -st.drain : st.regen) * dt, 0, 1);
    return boosting;
  }

  /** Steering from keys, stick and tilt: -1 right … 1 left. */
  turnInput() {
    const inp = this.input;
    return clamp((inp.left ? 1 : 0) - (inp.right ? 1 : 0) - (+inp.steer || 0), -1, 1);
  }

  /** The more damaged it is, the more it smokes, from `at` (a point in the world). */
  smokeStep(dt, at) {
    if (this.health < 0.6 && (this.smokeT -= dt) <= 0) {
      this.smokeT = 0.05 + this.health * 0.25;
      this.smoke.emit(at, 0.016 + (0.6 - this.health) * 0.03, _v.copy(this.up).multiplyScalar(0.4).addScaledVector(this.fwd, 0.05));
    }
    this.smoke.update(dt);
  }

  /** A burst of smoke where it was wrecked. */
  explode() {
    for (let i = 0; i < 18; i++) {
      _s.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.6).addScaledVector(this.up, 0.35);
      this.smoke.emit(this.pos, 0.07 + Math.random() * 0.05, _s);
    }
    this.group.visible = false;
  }

  update() {}

  dispose() {
    for (const root of [this.group, this.smoke.mesh, ...this.extraMeshes()]) {
      root.removeFromParent();
      root.traverse((o) => {
        o.geometry?.dispose();
        [].concat(o.material || []).forEach((m) => m.dispose());
        if (o.isInstancedMesh) o.dispose();
      });
    }
  }

  /** Anything else it added to the world (trails), for dispose(). */
  extraMeshes() { return []; }
}
