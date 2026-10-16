import * as THREE from 'three';
import { tangentBasis } from '../../core/Geo.js';
import { mulberry32 } from '../../core/Noise.js';
import { dailySeed } from '../Daily.js';
import { CARGO } from '../Cargo.js';
import { MISSIONS, STAT_LABEL, missionIndex, placeOf } from '../Missions.js';
import { aKindOf } from '../../world/Themes.js';
import { DeliveryRun } from './DeliveryRun.js';

const _v = new THREE.Vector3();

/** Why a mission failed, in words. */
export const FAIL_REASON = {
  time: '⏰ Out of time.',
  broken: '🥚 The fragile parcel broke.',
  ash: '🌋 You flew into the ash.',
  zaps: '⚡ Struck by lightning.',
  wrecked: '💥 Wrecked.',
};

/**
 * 🎯 One attempt at a mission (see Missions.js): a courier run with special conditions, judged on the run's
 * counters. Its route is seeded by the mission, so it's the same every attempt.
 */
export class MissionRun extends DeliveryRun {
  static briefing({ mission }) {
    const world = placeOf(mission), where = mission.planet.world ? world.name : aKindOf(world);
    return { icon: mission.icon, title: mission.name, goal: mission.brief,
      tips: [`🪙 ${mission.reward} coins the first time you complete it.`, `Flown on ${where} (${world.icon}), the same every time.`,
        mission.failIf ? 'One slip ends the mission, so take it steady.' : 'Run out of time and you can try again straight away.'] };
  }

  constructor(game, opts) {
    super(game, opts);
    this.def = opts.mission;
    this.rand = mulberry32(dailySeed(`mission:${this.def.id}`));
    this.cargoBias = this.def.cargo || null;
  }

  get layout() { return { ...super.layout, badge: 'mission' }; }

  /** Rex only races on the made-up planets (or when the mission asks for him). */
  get hasRival() { return !this.def.planet.world; }

  get intro() { return `${this.def.icon} ${this.def.name}: ${this.def.brief}`; }

  begin() {
    this.setup();
    super.begin();
  }

  /** The mission's special conditions, once the plane and props exist. */
  setup() {
    const app = this.app, p = this.planet, d = this.def;
    if (d.rival) this.spawnRival();
    if (d.night) { // turn the sun to the far side of the start city and hold it there
      const sky = app.sky, c = this.from.c;
      sky.angle = Math.atan2(c.dot(sky.sv), c.dot(sky.su)) + Math.PI;
      sky.update(0);
      this.dayLength = sky.dayLength;
      sky.dayLength = Infinity;
    }
    if (d.ufoIn) { // (if it's already about, send it off first); it lingers and comes back quickly
      p.ufo.leave();
      Object.assign(p.ufo, { timer: d.ufoIn, hoverTime: 18, returnTime: 15 });
    }
    if (d.eruptions) p.volcanoes.forEach((v, i) => Object.assign(v, { state: 'calm', timer: 6 + i * 9 }));
    if (d.landmark) { // the one parcel goes to the landmark: it stands in for a town
      const l = p.landmarks.list.find((x) => x.name === d.landmark);
      this.spot = { c: l.d, u: tangentBasis(l.d)[0], name: l.name };
      this.dest = this.spot;
      this.par = this.parFor(this.player.up);
    }
    if (d.carry) {
      this.cargo = CARGO[d.carry];
      this.player.setCargo(this.cargo);
    }
    if (d.goal.stat === 'rings') this.game.props.rings.forEach((r) => this.placeRing(r)); // along the route, not all over the planet
  }

  /** Undo setup changes that outlive the run. */
  end() {
    if (this.dayLength) this.app.sky.dayLength = this.dayLength;
    if (this.def.ufoIn) Object.assign(this.planet.ufo, { hoverTime: undefined, returnTime: undefined });
    super.end();
  }

  /** Night Shift (and Keep to the Shade) only send parcels to cities in darkness (while there are any). */
  destinations(sites) {
    if (!this.def.night && !this.def.dark) return sites;
    const dark = sites.filter((s) => this.planet.nightAt(s.c) > 0.5);
    return dark.length ? dark : sites;
  }

  /** Where the arrow should point instead of the parcel's city, with the goal line to show: a runway, the UFO… */
  target(from) {
    const p = this.planet, stat = this.def.goal.stat;
    if (this.check()) return null;
    const pl = this.player, near = (c, alt) => pl.up.angleTo(c) < 0.3 && pl.alt > alt ? ' · fly lower!' : '';
    if (stat === 'refuels' && p.airports.list.length) {
      const ap = p.airports.list.reduce((a, b) => (a.c.angleTo(from) < b.c.angleTo(from) ? a : b));
      return { c: ap.c, text: `⛽ Skim the runway at ${ap.name}${near(ap.c, ap.top + 0.9)}` };
    }
    if (stat === 'ufo' && p.ufo.hovering) {
      const pos = p.ufo.group.position;
      return { c: _v.copy(pos).normalize(), text: `🛸 Fly through the UFO!${near(_v, pos.length() + 0.5)}` };
    }
    if (stat === 'rings') {
      const ring = this.game.props.rings.reduce((a, b) => (a.position.distanceTo(pl.pos) < b.position.distanceTo(pl.pos) ? a : b));
      return { c: _v.copy(ring.position).normalize(), text: '💍 Next ring' };
    }
    return null;
  }

  /** Handed over at the landmark (a landmark mission's one parcel), or an ordinary delivery. */
  deliver() {
    if (!this.spot || this.dest !== this.spot) { super.deliver(); return; }
    const pts = Math.round(100 * this.cargo.pay);
    this.score += pts;
    this.earn(Math.round(pts / 10));
    this.tally.deliveries++;
    this.tally.landmark++;
    this.app.sfx.pop(this.player.pos.clone(), `${this.def.icon} ${this.spot.name}!`, '#2ee59d', 'deliver');
    this.app.haptics?.buzz('deliver');
  }

  zapped() {
    super.zapped();
    this.tally.zaps++;
  }

  /** e.g. { have: 1, need: 2, text: '1 / 2 urgent' } */
  progress() {
    const { stat, target } = this.def.goal, have = Math.min(target, this.tally[stat] || 0);
    return { have, need: target, text: `${have} / ${target} ${STAT_LABEL[stat] || stat}` };
  }

  /** 'done', a failure reason, or null while the mission is still on. */
  check() {
    const t = this.tally, d = this.def;
    if (d.failIf && t[d.failIf] > 0) return d.failIf;
    return (t[d.goal.stat] || 0) >= d.goal.target ? 'done' : null;
  }

  checkEnd() {
    const result = this.check();
    if (result) this.endMission(result);
    else if (this.time <= 0) this.gameOver();
  }

  gameOver() {
    this.time = 0;
    this.endMission('time');
  }

  wrecked() { this.endMission('wrecked'); }

  /** Mission over: 'done', or why it failed. Rewards are paid the first time a mission is completed. */
  endMission(result) {
    const p = this.game.progress, def = this.def, won = result === 'done';
    const reward = won ? p.completeMission(def) : 0, next = MISSIONS[missionIndex(def.id) + 1];
    const list = MISSIONS.filter((m) => !m.planet.world === !def.planet.world); // (the made-up planets' or the real worlds')
    if (won && list.every((m) => p.missionDone(m.id))) this.app.achievements.unlock(def.planet.world ? 'spacemissions' : 'missions');
    this.game.finish({
      title: won ? '🎯 Mission complete!' : '❌ Mission failed',
      html: `${def.icon} <b>${def.name}</b><br>${won
        ? `${reward ? `🪙 +${reward} coins reward` : 'Already earned: no reward this time'}<br>${next ? `Next up: ${next.icon} ${next.name}` : '🏆 That was the last one!'}`
        : `${FAIL_REASON[result] || ''} ${this.progress().text}`}`,
      next: won ? next : null,
      again: won ? '↻ Play again' : '↻ Try again',
      bigAgain: !won || !next,
      board: true,
    }, won ? 'trophy' : 'gameover');
    if (won) this.app.haptics?.buzz('trophy');
  }

  hud(h) {
    h.dom.mission.textContent = `🎯 ${this.progress().text}`;
    super.hud(h);
  }
}
