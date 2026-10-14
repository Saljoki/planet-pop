import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';
import { PlayerPlane, SPEED } from './PlayerPlane.js';
import { rollCargo } from './Cargo.js';

const START_TIME = 90, DELIVERY_BONUS = 20, RING_BONUS = 5, CRASH_PENALTY = 8, RINGS = 7;
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down', Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
};
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
const randomDir = () => {
  const z = Math.random() * 2 - 1, a = Math.random() * TAU, s = Math.sqrt(1 - z * z);
  return new THREE.Vector3(s * Math.cos(a), z, s * Math.sin(a));
};

/**
 * Sky Courier: carry parcels from city to city before the clock runs out.
 * Fast deliveries build a combo, blue rings add time and refill boost, crashing costs time.
 */
export class CourierGame {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.player = null;
    this.onKeyDown = (e) => this.key(e, true);
    this.onKeyUp = (e) => this.key(e, false);
    this.buildDom();
  }

  buildDom() {
    const el = (this.el = document.createElement('div'));
    el.id = 'game';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="gStats"><div class="badge" id="gScore"></div><div class="badge" id="gTime"></div><div class="badge" id="gCombo"></div></div>
      <svg id="gArrow" viewBox="0 0 70 70"><polygon points="35,5 61,58 35,45 9,58" fill="#ff5fa2" stroke="#1b1530" stroke-width="5" stroke-linejoin="round"/></svg>
      <div id="gGoal" class="badge"></div>
      <div id="gBoost" class="badge"><div></div></div>
      <div id="gHelp" class="badge">←/→ steer · ↑/↓ climb · Space boost · P pause · Esc quit</div>
      <div id="gPad">
        <span></span><button data-k="up">▲</button><button data-k="boost" class="boost">BOOST</button>
        <button data-k="left">◀</button><button data-k="down">▼</button><button data-k="right">▶</button>
      </div>
      <div id="gOver" class="overlay hidden"><div class="panel">
        <h2>⏰ Time's up!</h2><p id="gResult"></p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
          <button id="gAgain" class="big">✈️ Fly again</button><button id="gExit">🌍 Back to planet</button>
        </div>
      </div></div>`;
    document.getElementById('ui').append(el);
    const $ = (id) => el.querySelector('#' + id);
    this.dom = {
      score: $('gScore'), time: $('gTime'), combo: $('gCombo'), arrow: $('gArrow'), goal: $('gGoal'),
      boost: $('gBoost').firstElementChild, over: $('gOver'), result: $('gResult'), pad: $('gPad'), help: $('gHelp'),
    };
    const touch = matchMedia('(pointer: coarse)').matches;
    this.dom.pad.classList.toggle('hidden', !touch);
    this.dom.help.classList.toggle('hidden', touch);
    this.dom.pad.querySelectorAll('button').forEach((b) => {
      const set = (on) => (e) => { e.preventDefault(); if (this.player && !this.over) this.player.input[b.dataset.k] = on; };
      b.addEventListener('pointerdown', set(true));
      for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
    });
    $('gAgain').addEventListener('click', () => { this.stop(); this.start(); });
    $('gExit').addEventListener('click', () => this.stop());
  }

  start() {
    const app = this.app, p = app.planet;
    if (this.active || !p || app.building) return;
    const sites = p.cities.sites;
    if (sites.length < 2) { app.hud.toast('📦 Sky Courier needs at least 2 cities. Try a new planet!'); return; }
    if (app.paused) app.togglePause();
    Object.assign(this, { active: true, over: false, planet: p, score: 0, combo: 1, time: START_TIME, deliveries: 0, anim: 0 });
    this.from = sites[Math.floor(Math.random() * sites.length)];
    this.pickDest(true);
    const heading = _t.copy(this.dest.c).addScaledVector(this.from.c, -this.dest.c.dot(this.from.c));
    if (heading.lengthSq() < 1e-6) heading.copy(this.from.u);
    this.player = new PlayerPlane(p, this.from.c, heading);
    this.player.setCargo(this.cargo);
    this.buildProps();
    app.rig.setGame(this.player);
    app.hud.setGameMode(true);
    this.el.classList.remove('hidden');
    this.dom.over.classList.add('hidden');
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    app.sfx.play('start');
    app.hud.toast('📦 Deliver parcels between cities! Swoop low through the pink beacon.');
    this.updateHud();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.player.dispose();
    this.player = null;
    this.props.removeFromParent();
    this.props.traverse((o) => { o.geometry?.dispose(); [].concat(o.material || []).forEach((m) => m.dispose()); });
    this.props = this.beacon = this.rings = null;
    this.el.classList.add('hidden');
    this.dom.over.classList.add('hidden');
    this.app.hud.setGameMode(false);
    this.app.rig.release();
  }

  key(e, down) {
    if (e.code === 'Escape' && down) { this.stop(); return; }
    const k = KEYMAP[e.code];
    if (!k || !this.player || this.over) return;
    e.preventDefault();
    this.player.input[k] = down;
  }

  /** Next destination and a fresh parcel for it. */
  pickDest(first = false) {
    const others = this.planet.cities.sites.filter((s) => s !== this.from);
    this.dest = others[Math.floor(Math.random() * others.length)];
    this.cargo = rollCargo(first);
    this.broken = false;
    this.par = ((this.from.c.angleTo(this.dest.c) * (R + 2)) / SPEED * 1.25 + 6) * this.cargo.par; // beat this for a combo
    this.elapsed = 0;
    this.player?.setCargo(this.cargo);
    if (this.beacon) this.placeBeacon();
    if (!first) this.app.hud.toast(`${this.cargo.icon} New ${this.cargo.name.toLowerCase()} for ${this.dest.name}: ${this.cargo.tip}`);
  }

  buildProps() {
    this.props = new THREE.Group();
    this.planet.root.add(this.props);
    this.beacon = new THREE.Group();
    this.props.add(this.beacon);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 5, 24, 1, true).translate(0, 2.5, 0),
      new THREE.MeshBasicMaterial({ color: '#ff5fa2', transparent: true, opacity: 0.25, depthWrite: false, side: THREE.DoubleSide }));
    beam.layers.set(LAYER_FX);
    this.beacon.add(beam);
    this.beaconRing = addMesh(this.beacon, new THREE.TorusGeometry(0.75, 0.07, 8, 32).rotateX(Math.PI / 2), toon('#ff5fa2'), 0.01, { cast: false });
    this.beaconRing.position.y = 2.4;
    this.placeBeacon();
    const geo = new THREE.TorusGeometry(0.42, 0.06, 8, 28), mat = toon('#3fa7ff');
    this.rings = Array.from({ length: RINGS }, () => {
      const ring = addMesh(this.props, geo, mat, 0.01, { cast: false });
      this.placeRing(ring, true);
      return ring;
    });
  }

  placeBeacon() {
    const c = this.dest.c;
    frame(_m, _v.copy(c).multiplyScalar(this.planet.surfR(c)), c, this.dest.u);
    this.beacon.position.setFromMatrixPosition(_m);
    this.beacon.quaternion.setFromRotationMatrix(_m);
  }

  /** Rings respawn along the current route so they're worth chasing. */
  placeRing(ring, anywhere = false) {
    const pl = this.player;
    let d, fwd;
    if (anywhere || !pl) {
      d = randomDir();
      fwd = tangentBasis(d)[0].applyAxisAngle(d, Math.random() * TAU);
    } else {
      d = pl.up.clone().lerp(this.dest.c, 0.25 + Math.random() * 0.5).normalize();
      const [u, v] = tangentBasis(d);
      d.addScaledVector(u, (Math.random() - 0.5) * 0.24).addScaledVector(v, (Math.random() - 0.5) * 0.24).normalize();
      fwd = this.dest.c.clone().addScaledVector(d, -this.dest.c.dot(d));
      if (fwd.lengthSq() < 1e-6) fwd = u;
    }
    const alt = Math.max(R + 1.8 + Math.random() * 1.4, this.planet.groundR(d) + 0.9);
    frame(_m, d.clone().multiplyScalar(alt), d, fwd);
    ring.position.setFromMatrixPosition(_m);
    ring.quaternion.setFromRotationMatrix(_m);
  }

  update(dt) {
    if (!this.active || this.over || dt <= 0) return;
    const pl = this.player, app = this.app;
    this.time -= dt;
    this.elapsed += dt;
    this.anim += dt;
    pl.update(dt);

    if (pl.crashed) {
      this.time -= CRASH_PENALTY;
      this.combo = 1;
      if (this.cargo.fragile && !this.broken) {
        this.broken = true;
        app.sfx.pop(pl.pos.clone(), 'SMASH!', '#9fd8ff', 'crash');
      } else {
        app.sfx.pop(pl.pos.clone(), 'BONK!', '#ff4d4d');
      }
    }
    for (const ring of this.rings) {
      if (ring.position.distanceTo(pl.pos) > 0.55) continue;
      this.time += RING_BONUS;
      this.score += 50;
      pl.boost = 1;
      app.sfx.pop(ring.position.clone(), `+${RING_BONUS}s!`, '#3fa7ff', 'ring');
      this.placeRing(ring);
    }
    if (pl.up.angleTo(this.dest.c) < 0.07 && pl.alt < this.planet.surfR(this.dest.c) + 3.2) this.deliver();

    const pulse = 1 + Math.sin(this.anim * 4) * 0.08;
    this.beaconRing.scale.set(pulse, 1, pulse);
    this.updateHud();
    if (this.time <= 0) this.gameOver();
  }

  deliver() {
    const app = this.app, cargo = this.cargo;
    this.time += DELIVERY_BONUS;
    if (this.broken) { // the fragile parcel arrived in pieces: no pay, no combo
      this.combo = 1;
      app.sfx.pop(this.player.pos.clone(), 'OOPS!', '#9fd8ff', 'crash');
      app.hud.toast(`🥚 The fragile parcel arrived broken. No pay this time.`);
    } else {
      const fast = this.elapsed <= this.par;
      this.combo = fast ? Math.min(5, this.combo + 1) : 1;
      const pts = Math.round((100 * this.combo + Math.max(0, (this.par - this.elapsed) * 10)) * cargo.pay);
      this.score += pts;
      this.deliveries++;
      app.sfx.pop(this.player.pos.clone(), fast && this.combo > 1 ? `+${pts}! x${this.combo}` : `+${pts}!`, '#2ee59d', 'deliver');
      app.achievements.unlock('courier');
      if (this.combo >= 4) app.achievements.unlock('combo');
    }
    this.from = this.dest;
    this.pickDest();
  }

  gameOver() {
    this.over = true;
    this.time = 0;
    let best = 0;
    try { best = +localStorage.getItem('planetpop.best') || 0; } catch { /* storage unavailable */ }
    const record = this.score > best;
    if (record) try { localStorage.setItem('planetpop.best', String(this.score)); } catch { /* storage unavailable */ }
    if (this.score >= 1500) this.app.achievements.unlock('ace');
    for (const k in this.player.input) this.player.input[k] = false;
    this.dom.result.innerHTML = `Score <b>${this.score}</b> · ${this.deliveries} deliveries<br>${record ? '🎉 New best!' : `Best: ${best}`}`;
    this.dom.over.classList.remove('hidden');
    this.app.sfx.play('gameover');
    this.updateHud();
  }

  updateHud() {
    const d = this.dom, pl = this.player, c = this.dest.c;
    d.score.textContent = `⭐ ${this.score}`;
    d.time.textContent = `⏱ ${Math.max(0, Math.ceil(this.time))}`;
    d.time.classList.toggle('low', this.time <= 10);
    d.combo.textContent = `🔥 x${this.combo}`;
    d.boost.style.width = `${Math.round(pl.boost * 100)}%`;
    _t.copy(c).addScaledVector(pl.up, -c.dot(pl.up));          // direction to target along the ground
    _s.crossVectors(pl.up, pl.fwd);                             // plane's left
    d.arrow.style.transform = `rotate(${-Math.atan2(_t.dot(_s), _t.dot(pl.fwd))}rad)`;
    const km = Math.round(pl.up.angleTo(c) * R * 100);
    const comboLeft = Math.max(0, Math.ceil(this.par - this.elapsed));
    const what = `${this.cargo.icon} ${this.cargo.name}${this.broken ? ' (broken!)' : ''}`;
    d.goal.textContent = km < 90
      ? `${what}: swoop down over ${this.dest.name}!`
      : `${what} → ${this.dest.name} · ${km} km · combo ${comboLeft}s`;
  }
}
