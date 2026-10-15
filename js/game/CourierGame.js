import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh } from '../render/Outline.js';
import { mulberry32 } from '../core/Noise.js';
import { PlayerPlane, SPEED } from './PlayerPlane.js';
import { rollCargo } from './Cargo.js';
import { Progress, BASE_STATS } from './Progress.js';
import { Hangar } from './Hangar.js';
import { Rival, RIVAL } from './Rival.js';
import { todayKey, dailySeed, dailyParams } from './Daily.js';
import { HALF } from '../world/Airports.js';

const DELIVERY_BONUS = 20, RING_BONUS = 5, RING_COINS = 5, CRASH_PENALTY = 8, LIGHTNING_PENALTY = 5, RINGS = 7;
const UFO_BONUS = 300, UFO_COINS = 30, REFUEL = 0.9, ASH_ENGINE = 0.55;
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
    this.progress = new Progress();
    this.rival = null;
    this.buildDom();
    this.hangar = new Hangar(app, this.progress, { onFly: () => this.start(), onDaily: () => this.startDaily() });
  }

  /** Today's challenge: build today's planet if needed, then fly the stock plane on the shared route. */
  async startDaily() {
    const app = this.app, want = dailyParams(), p = app.params;
    if (this.active) return;
    if (app.building) { app.hud.toast('🌍 The planet is still being built. Try again in a moment.'); return; }
    if (!app.planet || p.seed !== want.seed || p.land !== want.land || p.cities !== want.cities || p.theme !== want.theme) {
      Object.assign(app.params, want);
      app.hud.syncParams?.(app.params);
      app.hud.toast("📅 Building today's planet…");
      await app.newPlanet(want.seed, false, want.theme);
    }
    this.start({ daily: true });
  }

  openHangar() {
    if (this.active) return;
    this.hangar.show();
  }

  buildDom() {
    const el = (this.el = document.createElement('div'));
    el.id = 'game';
    el.className = 'hidden';
    el.innerHTML = `
      <div id="gStats"><div class="badge hidden" id="gDaily">📅<span class="wide"> Daily</span></div><div class="badge" id="gScore"></div><div class="badge" id="gTime"></div><div class="badge" id="gCombo"></div><div class="badge" id="gCoins"></div></div>
      <div id="gRival" class="tag hidden">😈 Rex</div>
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
          <button id="gAgain" class="big">✈️ Fly again</button><button id="gShare" class="hidden">🔗 Share result</button>
          <button id="gHangar">🛠️ Hangar</button><button id="gExit">🌍 Back to planet</button>
        </div>
      </div></div>`;
    document.getElementById('ui').append(el);
    const $ = (id) => el.querySelector('#' + id);
    this.dom = {
      daily: $('gDaily'), rival: $('gRival'), share: $('gShare'),
      score: $('gScore'), time: $('gTime'), combo: $('gCombo'), coins: $('gCoins'), arrow: $('gArrow'), goal: $('gGoal'),
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
    $('gAgain').addEventListener('click', () => { const daily = this.daily; this.stop(); this.start({ daily }); });
    $('gShare').addEventListener('click', () => this.shareDaily());
    $('gHangar').addEventListener('click', () => { this.stop(); this.openHangar(); });
    $('gExit').addEventListener('click', () => this.stop());
  }

  /** daily: stock plane and a route seeded by today's date, so every player gets the same run. */
  start({ daily = false } = {}) {
    const app = this.app, p = app.planet;
    if (this.active) return;
    if (!p || app.building) { app.hud.toast('🌍 The planet is still being built. Try again in a moment.'); return; }
    const sites = p.cities.sites;
    if (sites.length < 2) { app.hud.toast('📦 Sky Courier needs at least 2 cities. Try a new planet!'); return; }
    if (app.paused) app.togglePause();
    this.daily = daily;
    this.dailyDate = todayKey();
    this.rand = daily ? mulberry32(dailySeed(this.dailyDate) ^ 0x9e3779b9) : Math.random;
    this.stats = daily ? BASE_STATS : this.progress.stats;
    Object.assign(this, {
      active: true, over: false, planet: p, score: 0, combo: 1, time: this.stats.startTime, deliveries: 0, anim: 0, runCoins: 0,
      stormT: 1.2, warnedStorm: false, stolen: 0, rivalStreak: 0, refuelling: false, warnedAsh: false, ashT: 0,
    });
    this.from = sites[Math.floor(this.rand() * sites.length)];
    this.pickDest(true);
    const heading = _t.copy(this.dest.c).addScaledVector(this.from.c, -this.dest.c.dot(this.from.c));
    if (heading.lengthSq() < 1e-6) heading.copy(this.from.u);
    this.player = new PlayerPlane(p, this.from.c, heading, this.stats, this.progress.skinDef);
    this.player.setCargo(this.cargo);
    this.buildProps();
    app.renderer.compileAsync?.(this.props, app.camera, app.scene)?.catch(() => {}); // new props: compile now, not mid-flight
    app.rig.setGame(this.player);
    app.hud.setGameMode(true);
    this.el.classList.remove('hidden');
    this.dom.over.classList.add('hidden');
    this.dom.daily.classList.toggle('hidden', !daily);
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    app.sfx.play('start');
    app.hud.toast(daily
      ? '📅 Daily challenge: stock plane, same route as everyone today. Good luck!'
      : '📦 Deliver parcels between cities! Swoop low through the pink beacon.');
    if (p.airports?.list.length) app.hud.toast('✈️ Tip: skim low along an airport runway to refuel your boost.');
    this.updateHud();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.player.dispose();
    this.player = null;
    this.rival?.dispose();
    this.rival = null;
    this.dom.rival.classList.add('hidden');
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
    this.dest = others[Math.floor(this.rand() * others.length)];
    this.cargo = rollCargo(first, this.rand);
    this.broken = false;
    const here = this.player?.up ?? this.from.c; // after a steal the player isn't at `from`
    this.par = ((here.angleTo(this.dest.c) * (R + 2)) / SPEED * 1.25 + 6) * this.cargo.par; // beat this for a combo
    this.elapsed = 0;
    this.player?.setCargo(this.cargo);
    this.rival?.newLeg(this.from);
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
    this.updateStorm(dt);
    this.updateRunways(dt);
    this.updateAsh(dt);
    if (this.planet.ufo?.catchBy(pl.pos)) {
      this.score += UFO_BONUS;
      this.earn(UFO_COINS);
      app.sfx.pop(pl.pos.clone(), `BEAMED UP! +${UFO_BONUS}`, '#7dffb0', 'ufo');
      app.achievements.unlock('ufo');
    }
    for (const ring of this.rings) {
      if (ring.position.distanceTo(pl.pos) > this.stats.magnet) continue;
      this.time += RING_BONUS;
      this.score += 50;
      this.earn(RING_COINS);
      pl.boost = 1;
      app.sfx.pop(ring.position.clone(), `+${RING_BONUS}s!`, '#3fa7ff', 'ring');
      this.placeRing(ring);
    }
    const arrived = pl.up.angleTo(this.dest.c) < 0.07 && pl.alt < this.planet.surfR(this.dest.c) + 3.2;
    if (arrived) this.deliver();
    if (this.rival?.update(dt, this.dest, this.cargo) && !arrived) this.steal();

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
      this.earn(Math.round(pts / 10));
      app.sfx.pop(this.player.pos.clone(), fast && this.combo > 1 ? `+${pts}! x${this.combo}` : `+${pts}!`, '#2ee59d', 'deliver');
      app.achievements.unlock('courier');
      if (this.combo >= 4) app.achievements.unlock('combo');
    }
    if (this.rival && ++this.rivalStreak >= RIVAL.streak) app.achievements.unlock('outrun');
    this.from = this.dest;
    this.pickDest();
    if (!this.rival) this.spawnRival();
    this.rival.setLevel(this.deliveries);
  }

  /** Rex takes off right after your first delivery, from the same city, and races you from then on. */
  spawnRival() {
    const pl = this.player, side = _s.crossVectors(pl.up, pl.fwd).normalize();
    const start = _v.copy(this.from.c).addScaledVector(side, 0.05).normalize();
    const heading = _t.copy(this.dest.c).addScaledVector(start, -this.dest.c.dot(start));
    if (heading.lengthSq() < 1e-6) heading.copy(pl.fwd);
    this.rival = new Rival(this.planet, {
      from: this.from, start, heading, tag: this.dom.rival, toScreen: (p) => this.app.sfx.toScreen(p),
    });
    this.app.renderer.compileAsync?.(this.rival.plane.group, this.app.camera, this.app.scene)?.catch(() => {});
    this.app.hud.toast(`😈 ${RIVAL.name} is racing you for every parcel! Get there first or he steals the delivery.`);
  }

  /** Rex got to the city first: the parcel is gone, and so is the combo. */
  steal() {
    const app = this.app;
    this.stolen++;
    this.rivalStreak = 0;
    this.combo = 1;
    app.sfx.pop(this.rival.pos.clone(), 'STOLEN!', '#8f5cff', 'crash');
    app.hud.toast(`😈 ${RIVAL.name} delivered to ${this.dest.name} first. Grab the next one!`);
    this.rival.gloat(this.dest);
    this.from = this.dest;
    this.pickDest();
  }

  /** Inside a thundercloud the plane is buffeted, and every few seconds lightning may hit it. */
  updateStorm(dt) {
    const pl = this.player, app = this.app, weather = this.planet.weather, storm = weather.stormAt(pl.pos);
    pl.turbulence = storm ? 1 : 0;
    if (!storm) { this.stormT = 1.2; return; } // a short grace period after flying in
    if (!this.warnedStorm) {
      this.warnedStorm = true;
      app.hud.toast('⛈️ Thunderstorm! Get out before lightning strikes.');
    }
    if ((this.stormT -= dt) > 0) return;
    this.stormT = 2 + Math.random() * 1.5;
    const hit = pl.invuln <= 0 && Math.random() < 0.5;
    const aim = pl.pos.clone();
    if (!hit) { // a near miss crackles past the wing
      const [u, v] = tangentBasis(pl.up), a = Math.random() * TAU;
      aim.addScaledVector(u, Math.cos(a) * 0.8).addScaledVector(v, Math.sin(a) * 0.8);
    }
    weather.strike(storm, aim);
    if (!hit) return;
    this.time -= LIGHTNING_PENALTY;
    pl.boost = 0;
    pl.shake = 1;
    pl.invuln = 1;
    app.sfx.pop(pl.pos.clone(), 'ZAP!', '#ffd23f', 'crash');
    app.achievements.unlock('lightningrod');
  }

  /** Skimming low along a runway tops up the boost tank. */
  updateRunways(dt) {
    const pl = this.player, ap = this.planet.airports?.list.find((a) => a.c.angleTo(pl.up) < HALF + 0.02);
    const on = !!ap && pl.alt < ap.top + 0.9 && Math.abs(pl.up.dot(ap.side)) < 0.04;
    if (on) pl.boost = Math.min(1, pl.boost + REFUEL * dt);
    if (on && !this.refuelling) this.app.sfx.pop(pl.pos.clone(), 'REFUEL!', '#3fa7ff', 'ring');
    this.refuelling = on;
  }

  /** An erupting volcano's ash plume chokes the engine and empties the boost tank. */
  updateAsh(dt) {
    const pl = this.player, app = this.app, ash = Math.max(0, ...(this.planet.volcanoes || []).map((v) => v.ashAt(pl.pos)));
    pl.engine = ash > 0 ? ASH_ENGINE : 1;
    if (!ash) return;
    pl.boost = Math.max(0, pl.boost - dt);
    pl.shake = Math.max(pl.shake, 0.5);
    if (!this.warnedAsh) {
      this.warnedAsh = true;
      app.hud.toast('🌋 Volcanic ash! Your engine is choking. Get out of the plume!');
    }
    if ((this.ashT -= dt) <= 0) { this.ashT = 0.6; app.sfx.pop(pl.pos.clone(), 'COUGH!', '#8a7f9e', 'crash'); }
  }

  /** Coins are banked as they're earned, so quitting mid-run keeps them. */
  earn(n) {
    this.runCoins += n;
    this.progress.addCoins(n);
  }

  /** Daily runs keep their own best (they're flown in the stock plane); free flights update the hangar best. */
  gameOver() {
    const p = this.progress, ach = this.app.achievements;
    this.over = true;
    this.time = 0;
    let best;
    if (this.daily) {
      const prev = p.dailyBest(this.dailyDate);
      best = p.recordDaily(this.dailyDate, this.score) ? "🎉 New best today!" : `Today's best: ${prev}`;
      ach.unlock('daily');
    } else {
      const prev = p.best;
      best = p.recordScore(this.score) ? '🎉 New best!' : `Best: ${prev}`;
    }
    if (this.score >= 1500) ach.unlock('ace');
    for (const k in this.player.input) this.player.input[k] = false;
    const stolen = this.stolen ? ` · 😈 ${this.stolen} stolen` : '';
    this.dom.result.innerHTML = `${this.daily ? `📅 Daily ${this.dailyDate}<br>` : ''}Score <b>${this.score}</b> · ${this.deliveries} deliveries${stolen}<br>
      🪙 +${this.runCoins} coins (you have ${p.coins})<br>${best}`;
    this.dom.share.classList.toggle('hidden', !this.daily);
    this.dom.over.classList.remove('hidden');
    this.app.sfx.play('gameover');
    this.updateHud();
  }

  /** Copy a short brag plus a link that opens today's challenge. */
  async shareDaily() {
    const url = `${location.origin}${location.pathname}?daily`;
    const text = `📅 Planet Pop daily ${this.dailyDate}: ⭐ ${this.score} with ${this.deliveries} deliveries. Can you beat it? ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      this.app.hud.toast('🔗 Result copied! Paste it to challenge a friend.');
    } catch {
      prompt('Copy your result:', text);
    }
  }

  updateHud() {
    const d = this.dom, pl = this.player, c = this.dest.c;
    d.score.textContent = `⭐ ${this.score}`;
    d.time.textContent = `⏱ ${Math.max(0, Math.ceil(this.time))}`;
    d.time.classList.toggle('low', this.time <= 10);
    d.combo.textContent = `🔥 x${this.combo}`;
    d.coins.textContent = `🪙 ${this.runCoins}`;
    d.boost.style.width = `${Math.round(pl.boost * 100)}%`;
    _t.copy(c).addScaledVector(pl.up, -c.dot(pl.up));          // direction to target along the ground
    _s.crossVectors(pl.up, pl.fwd);                             // plane's left
    d.arrow.style.transform = `rotate(${-Math.atan2(_t.dot(_s), _t.dot(pl.fwd))}rad)`;
    const km = Math.round(pl.up.angleTo(c) * R * 100);
    const comboLeft = Math.max(0, Math.ceil(this.par - this.elapsed));
    const what = `${this.cargo.icon} ${this.cargo.name}${this.broken ? ' (broken!)' : ''}`;
    const rex = this.rival ? ` · 😈 ${this.rival.kmTo(c)} km` : '';
    d.goal.textContent = km < 90
      ? `${what}: swoop down over ${this.dest.name}!${rex}`
      : `${what} → ${this.dest.name} · ${km} km · combo ${comboLeft}s${rex}`;
  }
}
