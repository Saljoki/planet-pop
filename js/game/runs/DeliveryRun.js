import * as THREE from 'three';
import { R } from '../../core/Geo.js';
import { SPEED } from '../vehicles/Plane.js';
import { rollCargo } from '../Cargo.js';
import { Rival, RIVAL } from '../Rival.js';
import { Run } from './Run.js';

const DELIVERY_BONUS = 20, RING_BONUS = 5, RING_COINS = 5, CRASH_PENALTY = 8, LIGHTNING_PENALTY = 5;
const UFO_BONUS = 300, UFO_COINS = 30, ACE = 1500, REPAIR = 0.15;
const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _s = new THREE.Vector3();

/** Briefing tips for every flavour of courier run. */
export const COURIER_TIPS = [
  'Follow the pink arrow to the town, then swoop down low through the pink beacon to deliver.',
  'Deliver fast to build a combo, up to x5. Blue rings add 5 seconds and refill your boost.',
  'Crashing costs 8 seconds and some health. Lightning hurts too; skim a runway or deliver a parcel to patch up.',
  'After your first delivery, Rival Rex races you for every parcel.',
];

/**
 * 📦 The courier run: carry parcels from city to city before the clock runs out. Fast deliveries build a combo,
 * blue rings add time and refill boost, crashing costs time, and after the first delivery Rex races you for every
 * parcel. DailyRun and MissionRun are variations on this.
 */
export class DeliveryRun extends Run {
  static briefing() {
    return { icon: '📦', title: 'Courier run', goal: 'Deliver as many parcels as you can before the clock runs out.',
      tips: [...COURIER_TIPS, 'Coins from deliveries and rings buy upgrades in the hangar.'] };
  }

  constructor(game, opts) {
    super(game, opts);
    this.cargoBias = null; // a mission can make one kind of parcel more likely
    this.rival = null;
  }

  /** What the toast says as the run starts. */
  get intro() { return '📦 Deliver parcels between cities! Swoop low through the pink beacon.'; }

  /** A line above the score on the results card. */
  get resultHead() { return ''; }

  /** Whether the results card offers 🔗 Share. */
  get shareable() { return false; }

  takeoff() {
    const sites = this.planet.cities.sites;
    Object.assign(this, { score: 0, combo: 1, time: this.stats.startTime, deliveries: 0, coins: 0, stolen: 0, rivalStreak: 0 });
    // counters missions are judged on
    this.tally = { deliveries: 0, standard: 0, urgent: 0, fragile: 0, heavy: 0, broken: 0, rings: 0, refuels: 0, rexStreak: 0, ufo: 0, ash: 0, night: 0 };
    this.from = sites[Math.floor(this.rand() * sites.length)];
    this.pickDest(true);
    const heading = new THREE.Vector3().copy(this.dest.c).addScaledVector(this.from.c, -this.dest.c.dot(this.from.c));
    if (heading.lengthSq() < 1e-6) heading.copy(this.from.u);
    return { at: this.from.c, heading };
  }

  begin() {
    this.game.props.placeBeacon(this.dest);
    this.app.hud.toast(this.intro);
  }

  /** Which cities can be the next destination (missions can narrow it down). */
  destinations(sites) { return sites; }

  /** Where the arrow should point instead of the parcel's city, with the goal line to show (missions use this). */
  target() { return null; }

  /** Next destination and a fresh parcel for it. */
  pickDest(first = false) {
    const g = this.game, others = this.destinations(this.planet.cities.sites.filter((s) => s !== this.from));
    this.dest = others[Math.floor(this.rand() * others.length)];
    this.cargo = rollCargo(first, this.rand, this.cargoBias);
    this.broken = false;
    const here = g.player?.up ?? this.from.c; // after a steal the player isn't at `from`
    this.par = ((here.angleTo(this.dest.c) * (R + 2)) / SPEED * 1.25 + 6) * this.cargo.par; // beat this for a combo
    this.elapsed = 0;
    g.player?.setCargo(this.cargo);
    this.rival?.newLeg(this.from);
    g.props?.placeBeacon(this.dest);
    if (!first) this.app.hud.toast(`${this.cargo.icon} New ${this.cargo.name.toLowerCase()} for ${this.dest.name}: ${this.cargo.tip}`);
  }

  crashed() {
    this.time -= CRASH_PENALTY;
    this.combo = 1;
    if (this.cargo.fragile && !this.broken) {
      this.broken = true;
      this.tally.broken++;
      this.app.sfx.pop(this.player.pos.clone(), 'SMASH!', '#9fd8ff', 'crash');
    } else super.crashed();
  }

  caughtUfo() {
    this.score += UFO_BONUS;
    this.earn(UFO_COINS);
    this.tally.ufo++;
    this.app.sfx.pop(this.player.pos.clone(), `BEAMED UP! +${UFO_BONUS}`, '#7dffb0', 'ufo');
  }

  ring(ring) {
    this.time += RING_BONUS;
    this.score += 50;
    this.earn(RING_COINS);
    this.tally.rings++;
    this.app.sfx.pop(ring.position.clone(), `+${RING_BONUS}s!`, '#3fa7ff', 'ring');
  }

  /** Rings respawn along the current route so they're worth chasing. */
  placeRing(ring) { this.game.props.alongRoute(ring, this.player.up, this.dest.c); }

  zapped() { this.time -= LIGHTNING_PENALTY; }

  refuelled() { this.tally.refuels++; }

  inAsh(dt) { this.tally.ash += dt; }

  update(dt) {
    const pl = this.player;
    this.time -= dt;
    this.elapsed += dt;
    const arrived = pl.up.angleTo(this.dest.c) < 0.07 && pl.alt < this.planet.surfR(this.dest.c) + 3.2;
    if (arrived) this.deliver();
    if (this.rival?.update(dt, this.dest, this.cargo) && !arrived) this.steal();
    this.checkEnd();
  }

  /** Over when the clock runs out. */
  checkEnd() {
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
      const t = this.tally;
      t.deliveries++;
      t[cargo.id]++;
      if (this.planet.nightAt(this.dest.c) > 0.5) t.night++;
      this.earn(Math.round(pts / 10));
      app.sfx.pop(this.player.pos.clone(), fast && this.combo > 1 ? `+${pts}! x${this.combo}` : `+${pts}!`, '#2ee59d', 'deliver');
      app.haptics?.buzz('deliver');
      app.achievements.unlock('courier');
      if (this.combo >= 4) app.achievements.unlock('combo');
    }
    this.player.repair(REPAIR); // the customer's mechanic patches you up a little
    if (this.rival && ++this.rivalStreak >= RIVAL.streak) app.achievements.unlock('outrun');
    this.tally.rexStreak = Math.max(this.tally.rexStreak, this.rival ? this.rivalStreak : 0);
    this.from = this.dest;
    this.pickDest();
    if (!this.rival) this.spawnRival();
    this.rival.setLevel(this.deliveries);
  }

  /** Rex takes off right after your first delivery, from the same city, and races you from then on. */
  spawnRival() {
    const app = this.app, pl = this.player, side = _s.crossVectors(pl.up, pl.fwd).normalize();
    const start = _v.copy(this.from.c).addScaledVector(side, 0.05).normalize();
    const heading = _t.copy(this.dest.c).addScaledVector(start, -this.dest.c.dot(start));
    if (heading.lengthSq() < 1e-6) heading.copy(pl.fwd);
    this.rival = new Rival(this.planet, {
      from: this.from, start, heading, tag: this.game.hud.dom.rival, toScreen: (p) => app.sfx.toScreen(p),
    });
    app.renderer.compileAsync?.(this.rival.plane.group, app.camera, app.scene)?.catch(() => {});
    app.hud.toast(`😈 ${RIVAL.name} is racing you for every parcel! Get there first or he steals the delivery.`);
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

  /** Coins are banked as they're earned, so quitting mid-run keeps them. */
  earn(n) {
    this.coins += n;
    this.game.progress.addCoins(n);
  }

  /** Save the score; returns the line about the best for the results card. */
  recordBest() {
    const p = this.game.progress, prev = p.best;
    return p.recordScore(this.score) ? '🎉 New best!' : `Best: ${prev}`;
  }

  /** Out of health: the run ends there, with what you'd scored. */
  wrecked() { this.gameOver('💥 Wrecked!'); }

  gameOver(title = "⏰ Time's up!") {
    this.time = 0;
    const best = this.recordBest();
    if (this.score >= ACE) this.app.achievements.unlock('ace');
    const stolen = this.stolen ? ` · 😈 ${this.stolen} stolen` : '';
    this.game.finish({
      title,
      html: `${this.resultHead}Score <b>${this.score}</b> · ${this.deliveries} deliveries${stolen}<br>
      🪙 +${this.coins} coins (you have ${this.game.progress.coins})<br>${best}`,
      share: this.shareable,
    });
  }

  hud(h) {
    const d = h.dom, pl = this.player, aim = this.target(pl.up), c = aim?.c ?? this.dest.c;
    d.score.textContent = `⭐ ${this.score}`;
    d.time.textContent = `⏱ ${Math.max(0, Math.ceil(this.time))}`;
    d.time.classList.toggle('low', this.time <= 10);
    d.combo.textContent = `🔥 x${this.combo}`;
    d.coins.textContent = `🪙 ${this.coins}`;
    h.pointAt(c);
    const km = Math.round(pl.up.angleTo(c) * R * 100);
    const comboLeft = Math.max(0, Math.ceil(this.par - this.elapsed));
    const what = `${this.cargo.icon} ${this.cargo.name}${this.broken ? ' (broken!)' : ''}`;
    const rex = this.rival ? ` · 😈 ${this.rival.kmTo(c)} km` : '';
    d.goal.textContent = aim ? `${aim.text} · ${km} km` : km < 90
      ? `${what}: swoop down over ${this.dest.name}!${rex}`
      : `${what} → ${this.dest.name} · ${km} km · combo ${comboLeft}s${rex}`;
  }

  end() {
    this.rival?.dispose();
    this.rival = null;
  }
}
