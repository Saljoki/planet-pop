import * as THREE from 'three';
import { R, TAU } from '../../core/Geo.js';
import { LANE } from '../../world/Roads.js';
import { Car } from '../vehicles/Car.js';
import { Ground } from '../vehicles/Ground.js';
import { RoadRival } from '../RoadRival.js';
import { Run } from './Run.js';

const GATES = 8;          // checkpoints round the world (the last is the finish, back where you started)
const THROUGH = 0.26;     // how close (units) to a checkpoint's middle counts as through it
const COUNTDOWN = 3.2;    // seconds of 3, 2, 1 before GO
const WIN_COINS = 150, LOSE_COINS = 30;
const _p = new THREE.Vector3();

/**
 * 🏁 Round the world: race Rex once round the planet on a highway, through every checkpoint in order, back to the
 * town you started from. It's one great circle, so there are no shortcuts: just traffic, bridges and Rex.
 */
export class RaceRun extends Run {
  static briefing() {
    return { icon: '🏁', title: 'Round the world', goal: 'Race Rex once round the planet on the highway, through all 8 checkpoints, back to the start.',
      tips: ['Wait for GO! Then follow the arrow through each yellow arch; the pink one is the finish.',
        'Traffic doesn’t move over for you: pull out to overtake (traffic keeps left here). Rex runs red lights, so you can too.',
        `Win for 🪙 ${WIN_COINS} coins (${LOSE_COINS} for taking part). Your fastest win is kept.`] };
  }

  static vehicleKind() { return 'car'; }

  get rings() { return 0; }

  get layout() { return { badge: 'free', stats: false, arrow: true }; }

  takeoff() {
    const p = this.planet, roads = p.roads, ground = (this.ground = new Ground(p));
    const towns = p.cities.sites.filter((s) => ground.roadAt(s.c));
    this.home = towns[Math.floor(this.rand() * towns.length)] || null;
    const on = this.home ? ground.roadAt(this.home.c) : { road: roads.list[0], a: 0 };
    Object.assign(this, { road: on.road, a0: on.a, dir: 1, next: 0, countdown: COUNTDOWN, beeped: 4, done: false });
    this.lap = TAU * R; // (near enough: the road's a great circle just above sea level)
    this.gates = Array.from({ length: GATES }, (_, k) => {
      const a = this.a0 + this.dir * ((k + 1) / GATES) * TAU, at = roads.dir(this.road, a, new THREE.Vector3());
      return { a, at, r: roads.radius(this.road, a), fwd: roads.tangent(this.road, a, new THREE.Vector3()).multiplyScalar(this.dir) };
    });
    const at = roads.point(this.road, this.a0, this.dir * LANE, new THREE.Vector3()).normalize();
    return { at, heading: roads.tangent(this.road, this.a0, new THREE.Vector3()).multiplyScalar(this.dir) };
  }

  vehicle(at, heading) { return new Car(this.planet, at, heading, this.stats, this.game.progress.skinDef); }

  begin() {
    const g = this.game, app = this.app;
    g.props.setGates(this.gates);
    g.props.markGates(0);
    this.player.locked = true;
    this.rex = new RoadRival(this.planet, this.road, this.a0, this.dir, { tag: g.hud.dom.rival, toScreen: (pos) => app.sfx.toScreen(pos) });
    app.hud.toast(`🏁 Round the world${this.home ? ` from ${this.home.name}` : ''}! Wait for GO…`);
  }

  /** How far round the player has got (units): checkpoints passed, plus the way to the next one. */
  get progressDist() {
    const seg = this.lap / GATES, gate = this.gates[this.next];
    return gate ? this.next * seg + Math.max(0, seg - gate.at.angleTo(this.player.up) * R) : this.lap;
  }

  update(dt) {
    const app = this.app, pl = this.player;
    if (this.countdown > 0) {
      this.countdown -= dt;
      const n = Math.ceil(this.countdown);
      if (n < this.beeped && n > 0) {
        this.beeped = n;
        app.sfx.pop(_p.copy(pl.up).multiplyScalar(pl.alt + 0.25), `${n}!`, '#ffd23f');
      }
      if (this.countdown <= 0) {
        pl.locked = false;
        this.rex.running = true;
        app.sfx.pop(_p.copy(pl.up).multiplyScalar(pl.alt + 0.25), 'GO!', '#2ee59d', 'start');
      }
      this.rex.update(dt, 0);
      return;
    }
    this.time += dt;
    const gate = this.gates[this.next];
    if (gate && gate.at.angleTo(pl.up) * R < THROUGH) this.through();
    this.rex.update(dt, this.rex.dist - this.progressDist);
    if (!this.done && this.rex.dist >= this.lap) this.over(false);
  }

  /** Through a checkpoint (the last one is the finish). */
  through() {
    const app = this.app;
    this.next++;
    this.game.props.markGates(this.next);
    if (this.next >= GATES) { this.over(true); return; }
    app.sfx.pop(this.player.pos.clone(), `✔ ${this.next}/${GATES}`, '#ffd23f', 'ring');
    app.haptics?.buzz('ring');
  }

  /** The race is over: won if the player got round first. */
  over(won, title = won ? '🏁 You beat Rex!' : '😈 Rex wins!') {
    this.done = true;
    const p = this.game.progress, app = this.app, coins = won ? WIN_COINS : LOSE_COINS, t = this.time;
    p.addCoins(coins);
    let best = '';
    if (won) {
      const { prev, record } = p.recordBest('race', Math.round(t * 10) / 10, true);
      best = record ? '<br>🎉 Your fastest win!' : `<br>Fastest win: ${fmt(prev)}`;
      app.achievements.unlock('racer');
    }
    const gap = Math.abs(this.rex.dist - this.progressDist);
    this.game.finish({
      title,
      html: `🏁 Round the world<br>${won ? `Your time <b>${fmt(t)}</b> · Rex was ${(gap * 100).toFixed(0)} km behind`
        : `You were ${this.next} of ${GATES} checkpoints round, ${(gap * 100).toFixed(0)} km behind`}<br>🪙 +${coins} coins (you have ${p.coins})${best}`,
      again: '🏁 Race again',
    }, won ? 'trophy' : 'gameover');
    if (won) app.haptics?.buzz('trophy');
  }

  wrecked() { this.over(false, '💥 Wrecked!'); }

  hud(h) {
    const d = h.dom, pl = this.player, gate = this.gates[this.next] || this.gates[GATES - 1];
    const ahead = this.progressDist >= this.rex.dist;
    d.free.textContent = `🏁 ${fmt(this.time)} · ${ahead ? '1st' : '2nd'}`;
    h.pointAt(gate.at);
    const km = Math.round(pl.up.angleTo(gate.at) * R * 100), gap = Math.round(Math.abs(this.rex.dist - this.progressDist) * 100);
    const rex = `😈 Rex ${ahead ? `${gap} km behind` : `${gap} km ahead`}`;
    if (this.countdown > 0) d.goal.textContent = '🏁 Get ready…';
    else if (this.next >= GATES) d.goal.textContent = `🏁 Finished! · ${rex}`;
    else d.goal.textContent = `${this.next === GATES - 1 ? '🏁 Finish' : `🚩 Checkpoint ${this.next + 1}/${GATES}`} · ${km} km · ${rex}`;
  }

  end() { this.rex?.dispose(); }
}

/** 83.4 seconds → '1:23.4'. */
function fmt(t) {
  const m = Math.floor(t / 60), s = t - m * 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`;
}
