import * as THREE from 'three';
import { R, TAU, LAYER_FX, ease, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';
import { ObjectEntity } from '../core/Entity.js';

const ARRIVE = 3, HOVER = 8, LEAVE = 2.5, HOVER_ALT = 1.5;
const LIGHTS = ['#ff4d4d', '#ffd23f', '#3bff7a', '#3fa7ff', '#ff5fa2', '#ff8c42', '#8f5cff', '#ffffff'];
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _m = new THREE.Matrix4(), _c = new THREE.Color();

/**
 * Every couple of minutes a flying saucer drops out of space, hovers over the countryside with its tractor
 * beam on, then zips away. Click it before it leaves; in Sky Courier, fly through it for a bonus.
 */
export class Ufo {
  constructor(planet) {
    this.planet = planet;
    this.state = 'away';
    this.timer = 25 + Math.random() * 25;
    const g = (this.group = new THREE.Group());
    g.visible = false;
    planet.root.add(g);
    const body = (this.body = new THREE.Group());
    g.add(body);
    addMesh(body, new THREE.SphereGeometry(0.32, 24, 12).scale(1, 0.26, 1), toon('#c9c2dd'), 0.01, { receive: false });
    addMesh(body, new THREE.SphereGeometry(0.14, 16, 8, 0, TAU, 0, Math.PI / 2).translate(0, 0.05, 0),
      toon('#9fe8ff', { emissive: '#2a8fb0', emissiveIntensity: 0.6 }), 0.006, { receive: false });
    this.lights = addInstanced(body, new THREE.SphereGeometry(0.034, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }), LIGHTS.length, 0.004, { cast: false });
    LIGHTS.forEach((_, i) => { // a ring of running lights around the rim, just below the widest point
      const a = (i / LIGHTS.length) * TAU;
      this.lights.setMatrixAt(i, _m.makeTranslation(Math.cos(a) * 0.3, -0.035, Math.sin(a) * 0.3));
    });
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1, 24, 1, true).translate(0, -0.5, 0),
      new THREE.MeshBasicMaterial({ color: '#7dffb0', transparent: true, opacity: 0.28, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam.layers.set(LAYER_FX);
    g.add(this.beam);
    this.entity = new ObjectEntity(g, 'ufo', 'U.F.O.');
    this.entities = [this.entity];
    this.from = new THREE.Vector3();
    this.at = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.fwd = new THREE.Vector3(0, 0, 1);
  }

  get hovering() { return this.state === 'hover'; }

  /** Somewhere over dry land; during a Sky Courier run, somewhere near the player so it can be caught. */
  pickSpot() {
    const p = this.planet, player = p.app.game?.active ? p.app.game.player : null;
    for (let tries = 0; tries < 200; tries++) {
      const d = new THREE.Vector3().randomDirection();
      if (player) {
        const [u, v] = tangentBasis(player.up), a = Math.random() * TAU, r = 0.25 + Math.random() * 0.35;
        d.copy(player.up).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
      }
      if (p.heightAt(d) > 0.05 || (player && tries > 100)) return d;
    }
    return new THREE.Vector3().randomDirection();
  }

  arrive() {
    const p = this.planet, app = p.app, d = this.pickSpot();
    this.up.copy(d);
    this.fwd.copy(tangentBasis(d)[0]);
    this.ground = p.groundR(d);
    this.at.copy(d).multiplyScalar(this.ground + HOVER_ALT);
    this.from.copy(d).applyAxisAngle(this.fwd, 0.6).multiplyScalar(R + 12); // swoops in from space
    this.state = 'arrive';
    this.t = 0;
    this.caught = false;
    this.group.visible = true;
    if (app.game?.active) app.hud?.toast('🛸 A UFO is coming down nearby! Fly through it for a bonus.');
    else app.hud?.toast('🛸 Something strange is in the sky… Click it before it leaves!');
  }

  leave() {
    const app = this.planet.app;
    this.state = 'away';
    this.timer = this.returnTime ?? 80 + Math.random() * 60;
    this.group.visible = false;
    if (app.rig?.entity === this.entity) app.rig.release();
  }

  update(dt, t) {
    const app = this.planet.app;
    if (this.state === 'away') {
      if ((this.timer -= dt) <= 0) this.arrive();
      return;
    }
    this.t += dt;
    const g = this.group;
    if (this.state === 'arrive') {
      g.position.lerpVectors(this.from, this.at, ease(Math.min(1, this.t / ARRIVE)));
      if (this.t >= ARRIVE) {
        this.state = 'hover';
        this.t = 0;
        app.sfx?.pop(this.at.clone().addScaledVector(this.up, 0.4), 'BWEE-OOO!', '#7dffb0', 'ufo');
      }
    } else if (this.state === 'hover') {
      g.position.copy(this.at).addScaledVector(this.up, Math.sin(t * 2.3) * 0.06);
      if (this.t >= (this.hoverTime ?? HOVER)) { this.state = 'leave'; this.t = 0; this.from.copy(g.position); }
    } else if (this.state === 'leave') {
      const k = this.t / LEAVE;
      g.position.copy(this.from).addScaledVector(this.up, k * k * 14).addScaledVector(this.fwd, k * k * 6);
      if (this.t >= LEAVE) { this.leave(); return; }
    }
    frame(_m, _p.set(0, 0, 0), this.up, this.fwd);
    g.quaternion.setFromRotationMatrix(_m);
    this.body.rotation.y = t * 2.5;                 // the saucer spins…
    this.body.rotation.z = Math.sin(t * 1.7) * 0.08; // …and wobbles
    this.beam.visible = this.state === 'hover';
    this.beam.scale.set(1, Math.max(0.1, g.position.length() - this.ground), 1);
    const blink = Math.floor(t * 6);
    LIGHTS.forEach((_, i) => this.lights.setColorAt(i, _c.set(LIGHTS[(i + blink) % LIGHTS.length])));
    this.lights.instanceColor.needsUpdate = true;
  }

  /** Sky Courier: true the first time the player flies through the hovering saucer. */
  catchBy(pos) {
    if (this.state !== 'hover' || this.caught || _q.copy(this.group.position).distanceTo(pos) > 0.8) return false;
    this.caught = true;
    return true;
  }
}
