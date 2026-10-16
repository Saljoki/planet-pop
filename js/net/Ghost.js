import * as THREE from 'three';
import { Plane } from '../game/vehicles/Plane.js';
import { Car } from '../game/vehicles/Car.js';
import { Boat } from '../game/vehicles/Boat.js';

const DELAY = 0.15;  // seconds behind the latest news: drawn smoothly between the last two updates
const SNAP = 0.25;   // a jump bigger than this (radians round the planet: a fresh start, a respawn) isn't glided over
const KEEP = 10;     // updates kept
const STATS = { speed: 1, turn: 1, drain: 0, regen: 0, armour: 1 };
const _u = new THREE.Vector3(), _f = new THREE.Vector3(), _p = new THREE.Vector3();

/**
 * A friend in the room: their name, which planet they're on, and (while they drive or fly something) a copy of their
 * vehicle on our planet, glided smoothly between the updates they send, with their name tag over it.
 */
export class Ghost {
  constructor(id, ui) {
    this.id = id;
    this.name = '';
    this.planet = null;  // { seed, land, cities, theme } and key, from their 'hi'
    this.key = '';
    this.states = [];
    this.kind = null;    // what they're in right now (null: looking round the planet)
    this.model = null;   // the Vehicle we draw for them
    this.modelKey = '';
    this.seen = 0;
    this.tag = document.createElement('div');
    this.tag.className = 'tag friend hidden';
    ui?.append(this.tag);
  }

  /** Their 'hi': who they are and where. Returns what changed: 'new', 'planet', or ''. */
  hello(info, now) {
    const was = { name: this.name, key: this.key };
    Object.assign(this, { name: info.name, planet: info.planet, key: info.key, seen: now });
    this.tag.textContent = info.name;
    return !was.name ? 'new' : was.key !== info.key ? 'planet' : '';
  }

  /** A position update ('st'). */
  push(state, now) {
    this.seen = now;
    this.kind = state.kind;
    if (!state.kind) { this.states.length = 0; return; }
    this.states.push({ ...state, t: now });
    if (this.states.length > KEEP) this.states.shift();
  }

  /** What they're up to, for the room list. */
  get doing() {
    if (!this.kind) return '🌍 looking round';
    if (this.kind === 'plane') return '✈️ flying';
    if (this.kind === 'boat') return '⛵ sailing';
    return { van: '🚐 driving a van', taxi: '🚕 driving a taxi' }[this.states.at(-1)?.carKind] ?? '🚗 driving';
  }

  /** Each frame: their vehicle where they were DELAY seconds ago (if they're on `planet` and driving something). */
  update(now, planet, here, dt) {
    const last = this.states.at(-1), want = here && last ? `${last.kind}:${last.carKind}:${last.body}:${last.trim}` : '';
    if (want !== this.modelKey || this.model?.planet !== planet) this.rebuild(want && planet, last);
    if (!this.model) return;
    const s = this.pose(now - DELAY), m = this.model;
    m.place(s.up, s.fwd);
    m.alt = s.alt;
    if (m.kind === 'plane') Object.assign(m, { roll: s.roll, pitchV: s.pitch });
    else if (m.kind === 'car') Object.assign(m, { roll: s.roll, pitch: s.pitch, shake: 0 });
    else Object.assign(m, { lean: s.roll, t: m.t + dt, v: 0.5 });
    m.sync();
    m.group.visible = !s.hidden;
    if (m.prop) m.prop.rotation.z += dt * 40;
  }

  /** Where they were at time t: between the two updates either side of it. */
  pose(t) {
    const list = this.states;
    let i = list.length - 1;
    while (i > 0 && list[i - 1].t > t) i--;
    const b = list[i], a = list[i - 1];
    if (!a || t >= b.t) return b;
    if (t <= a.t || a.up.angleTo(b.up) > SNAP) return t <= a.t ? a : b;
    const k = (t - a.t) / (b.t - a.t);
    return {
      ...b,
      up: _u.copy(a.up).lerp(b.up, k).normalize(), fwd: _f.copy(a.fwd).lerp(b.fwd, k),
      alt: a.alt + (b.alt - a.alt) * k, roll: a.roll + (b.roll - a.roll) * k, pitch: a.pitch + (b.pitch - a.pitch) * k,
      hidden: b.hidden,
    };
  }

  /** A model of what they're in (or none). */
  rebuild(planet, s) {
    this.model?.dispose();
    this.model = null;
    this.modelKey = '';
    if (!planet || !s) return;
    const paint = { body: s.body, trim: s.trim };
    this.model = s.kind === 'plane' ? new Plane(planet, s.up, s.fwd, STATS, paint)
      : s.kind === 'boat' ? new Boat(planet, s.up, s.fwd, STATS, paint)
        : new Car(planet, s.up, s.fwd, STATS, { kind: s.carKind, ...paint });
    this.modelKey = `${s.kind}:${s.carKind}:${s.body}:${s.trim}`;
  }

  /** After the camera has moved: their name over their vehicle. */
  placeTag(toScreen) {
    const m = this.model, show = m?.group.visible && toScreen(_p.copy(m.up).multiplyScalar(m.alt + (m.kind === 'plane' ? 0.2 : 0.13)));
    this.tag.classList.toggle('hidden', !show);
    if (!show) return;
    this.tag.style.left = `${show.x}px`;
    this.tag.style.top = `${show.y}px`;
  }

  dispose() {
    this.model?.dispose();
    this.model = null;
    this.tag.remove();
  }
}
