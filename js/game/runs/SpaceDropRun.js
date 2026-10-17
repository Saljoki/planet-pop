import * as THREE from 'three';
import { R } from '../../core/Geo.js';
import { Car } from '../vehicles/Car.js';
import { Ground } from '../vehicles/Ground.js';
import { worldOf } from '../../space/Worlds.js';
import { clock } from '../../space/SpaceCourier.js';
import { Rival, RIVAL } from '../Rival.js';
import { Run } from './Run.js';

const PULL_IN = 0.16, SLOW = 0.3; // how close (units) and how slow (units/s) a rover hands a parcel over, as a van does
const WRECK_COST = 10;            // seconds off the clock for a wreck (a fresh one turns up at the spaceport)
const REX_SPEED = { air: 0.9, road: 0.45 }; // Rex flies; against a rover he takes it easier (a rover's slower than a plane)
const REX_LEAD_MAX = 20;          // seconds of head start he can bring from the cruise, at most

/**
 * 🚀 The space courier's last stretch: from the spaceport to the parcel's town, by rover or car (opts.drive: pull in
 * at the pink pad by the town) or by plane, hopper or glider (swoop through the beacon over it). The parcel's own
 * clock carries on from the trip (app.spaceCourier.job); handing it over pays and ends the run, offering the next one.
 * If Rex is after the parcel too, he flies for the town with whatever lead he had at the end of the cruise: get there
 * first and it pays its extra, or he takes it.
 */
export class SpaceDropRun extends Run {
  static briefing() {
    return { icon: '🚀', title: 'Space courier', goal: 'Get the parcel from the spaceport to its town before its clock runs out.',
      tips: ['Follow the arrow. By road, slow right down on the pink pad by the town; by air, swoop low through the beacon.',
        'Fragile parcels break if you crash. Late parcels pay half.'] };
  }

  static vehicleKind({ drive } = {}) { return drive ? 'car' : 'plane'; }

  constructor(game, opts) {
    super(game, opts);
    this.job = game.app.spaceCourier.job;
    this.byRoad = !!opts.drive;
  }

  get rings() { return 0; }

  get layout() { return { badge: null, stats: true, arrow: true }; }

  takeoff() {
    const p = this.planet, pad = p.space?.site, courier = this.app.spaceCourier;
    this.ground = new Ground(p);
    this.town = this.job.town ? p.cities.sites.find((s) => s.name === this.job.town) : null;
    this.town ??= courier.townFor(p);
    this.job.town = this.town.name;
    this.cargo = this.job.cargo;
    if (this.byRoad) {
      const stops = this.ground.stops(this.town);
      this.stop = (pad && stops.length ? stops.reduce((a, b) => (a.at.angleTo(pad.d) < b.at.angleTo(pad.d) ? a : b)) : stops[0]) ?? { at: this.town.c };
    }
    const at = pad ? pad.d.clone().addScaledVector(pad.fwd, this.byRoad ? 0.1 : 0.02).normalize() : this.town.c.clone();
    const heading = this.town.c.clone().addScaledVector(at, -this.town.c.dot(at));
    if (heading.lengthSq() < 1e-6) heading.copy(pad?.fwd ?? this.town.u);
    return { at, heading };
  }

  vehicle(at, heading) {
    return this.byRoad ? new Car(this.planet, at, heading, this.stats, this.game.progress.skinDef) : super.vehicle(at, heading);
  }

  begin() {
    const props = this.game.props;
    if (this.byRoad) props.placePad(this.stop.at, this.ground.carR(this.stop.at), 'dropoff');
    else props.placeBeacon(this.town);
    this.app.hud.toast(`${this.job.cargo.icon} ${this.job.what} for ${this.town.name}: ${this.job.left > 0 ? `${clock(this.job.left)} left!` : 'late, but they still want it!'}`);
    if (this.job.rex) this.spawnRex();
  }

  /** Rex takes off from the spaceport for the town: ahead by his lead from the cruise, or circling the pad till he catches up. */
  spawnRex() {
    const app = this.app, pl = this.player, lead = Math.min(REX_LEAD_MAX, this.job.rex.lead ?? 0);
    const start = pl.up.clone().addScaledVector(new THREE.Vector3().crossVectors(pl.up, pl.fwd).normalize(), 0.05).normalize();
    this.rival = new Rival(this.planet, { from: { c: start }, start, heading: pl.fwd, tag: this.game.hud.dom.rival, toScreen: (p) => app.sfx.toScreen(p) });
    this.rival.plane.stats = { ...this.rival.plane.stats, speed: REX_SPEED[this.byRoad ? 'road' : 'air'] };
    if (lead < 0) Object.assign(this.rival, { rest: -lead, restAt: start }); // (behind: he waits his turn)
    for (let t = 0; t < lead; t += 0.05) this.rival.update(0.05, this.town, this.cargo); // (ahead: he's already on his way)
    app.hud.toast(lead > 0.5 ? `😈 ${RIVAL.name} is ${Math.round(lead)} s ahead! Beat him to ${this.town.name}.`
      : lead < -0.5 ? `😈 You beat ${RIVAL.name} through space by ${Math.round(-lead)} s. Keep it up!` : `😈 Neck and neck with ${RIVAL.name}! Go!`);
  }

  destPoint() { return this.byRoad ? this.stop.at : this.town.c; }

  arrived() {
    const pl = this.player;
    if (this.byRoad) return this.stop.at.angleTo(pl.up) * R < PULL_IN && Math.abs(pl.v) < SLOW;
    return pl.up.angleTo(this.town.c) < 0.07 && pl.alt < this.planet.surfR(this.town.c) + 3.2;
  }

  crashed() {
    if (this.job.cargo.fragile && !this.job.broken) {
      this.job.broken = true;
      this.app.sfx.pop(this.player.pos.clone(), 'SMASH!', '#9fd8ff', 'crash');
    } else super.crashed();
  }

  /** A wreck costs time; a fresh vehicle turns up at the spaceport. */
  wrecked() {
    this.job.left -= WRECK_COST;
    this.game.respawnSoon();
  }

  respawnPoint() {
    const pad = this.planet.space?.site;
    if (!pad) return super.respawnPoint();
    return { at: pad.d.clone().addScaledVector(pad.fwd, 0.1).normalize(), heading: pad.fwd, name: 'the spaceport' };
  }

  update(dt) {
    if (this.done) return;
    this.job.left -= dt;
    if (this.arrived()) this.deliver();
    else if (this.rival?.update(dt, this.town, this.cargo)) this.lost();
  }

  /** Rex got there first: he takes the parcel. */
  lost() {
    const app = this.app, job = app.spaceCourier.lose();
    this.done = true;
    app.sfx.pop(this.rival.pos.clone(), 'STOLEN!', '#8f5cff', 'crash');
    this.rival.gloat(this.town);
    this.game.finish({
      title: `😈 ${RIVAL.name} got there first`,
      html: `He took the ${job.what} to ${this.town.name}. No pay this time, and your streak's gone.`,
      again: '📦 Next parcel',
      againFn: () => app.spaceCourier.openBoard(),
    }, 'gameover');
  }

  end() {
    this.rival?.dispose();
    this.rival = null;
  }

  deliver() {
    const app = this.app, r = app.spaceCourier.deliver(), world = worldOf(r.to);
    this.done = true;
    app.sfx.pop(this.player.pos.clone(), r.coins ? `+${r.coins}!` : 'OOPS!', r.coins ? '#2ee59d' : '#9fd8ff', r.coins ? 'deliver' : 'crash');
    app.haptics?.buzz('deliver');
    const how = (r.broken ? '🥚 It arrived in pieces: no pay this time.'
      : r.onTime ? `On time${r.streak > 1 ? `: 🔥 streak x${r.streak}, +${Math.round((r.bonus - 1) * 100)}%` : '!'}` : '⏰ Late: half pay.')
      + (r.rex ? `<br>😈 You beat ${RIVAL.name}!` : '');
    this.game.finish({
      title: r.broken ? '🥚 Delivered… in pieces' : r.onTime ? '📦 Delivered!' : '📦 Delivered, late',
      html: `${r.what} to ${this.town.name} on ${world.icon} ${world.name}<br>${how}<br>🪙 +${r.coins} coins (you have ${this.game.progress.coins})`,
      again: '📦 Next parcel',
      againFn: () => app.spaceCourier.openBoard(),
    }, r.coins ? 'trophy' : 'gameover');
  }

  hud(h) {
    const d = h.dom, pl = this.player, job = this.job, c = this.destPoint();
    d.score.textContent = `${job.cargo.icon} ${job.cargo.name}${job.broken ? ' (broken!)' : ''}`;
    d.time.textContent = job.left > 0 ? `⏱ ${clock(job.left)}` : '⏰ Late';
    d.time.classList.toggle('low', job.left <= 15);
    d.combo.textContent = `🔥 x${Math.max(1, this.app.spaceCourier.streak)}`;
    d.coins.textContent = `🪙 ${job.left > 0 ? job.pay : Math.round(job.pay / 2)}`;
    h.pointAt(c);
    const km = Math.round(pl.up.angleTo(c) * R * 100);
    const rex = this.rival ? ` · 😈 ${this.rival.kmTo(c)} km` : '';
    d.goal.textContent = km < 90
      ? `${job.what}: ${this.byRoad ? `pull in at the pink pad by ${this.town.name}!` : `swoop down over ${this.town.name}!`}${rex}`
      : `${job.what} → ${this.town.name} · ${km} km${rex}`;
  }
}
