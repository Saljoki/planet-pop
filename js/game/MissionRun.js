import * as THREE from 'three';
import { STAT_LABEL } from './Missions.js';

const _v = new THREE.Vector3();

/** One attempt at a mission: sets up its special conditions, then watches the run's counters for success or failure. */
export class MissionRun {
  constructor(game, def) {
    this.game = game;
    this.def = def;
  }

  /** Called once the plane and props exist. */
  setup() {
    const g = this.game, app = g.app, p = g.planet, d = this.def;
    if (d.rival) g.spawnRival();
    if (d.night) { // turn the sun to the far side of the start city and hold it there
      const sky = app.sky, c = g.from.c;
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
    if (d.goal.stat === 'rings') g.rings.forEach((r) => g.placeRing(r)); // rings along the route, not all over the planet
  }

  /** Undo setup changes that outlive the run. */
  teardown() {
    const app = this.game.app, ufo = this.game.planet.ufo;
    if (this.dayLength) app.sky.dayLength = this.dayLength;
    if (this.def.ufoIn) Object.assign(ufo, { hoverTime: undefined, returnTime: undefined });
  }

  /** Night Shift only sends parcels to cities in darkness (while there are any). */
  destinations(sites) {
    if (!this.def.night) return sites;
    const dark = sites.filter((s) => this.game.planet.nightAt(s.c) > 0.5);
    return dark.length ? dark : sites;
  }

  /** Where the arrow should point instead of the parcel's city, with the goal line to show: a runway, the UFO… */
  target(from) {
    const g = this.game, p = g.planet, stat = this.def.goal.stat;
    if (this.check()) return null;
    const pl = g.player, near = (c, alt) => pl.up.angleTo(c) < 0.3 && pl.alt > alt ? ' · fly lower!' : '';
    if (stat === 'refuels' && p.airports.list.length) {
      const ap = p.airports.list.reduce((a, b) => (a.c.angleTo(from) < b.c.angleTo(from) ? a : b));
      return { c: ap.c, text: `⛽ Skim the runway at ${ap.name}${near(ap.c, ap.top + 0.9)}` };
    }
    if (stat === 'ufo' && p.ufo.hovering) {
      const pos = p.ufo.group.position;
      return { c: _v.copy(pos).normalize(), text: `🛸 Fly through the UFO!${near(_v, pos.length() + 0.5)}` };
    }
    if (stat === 'rings') {
      const ring = g.rings.reduce((a, b) => (a.position.distanceTo(pl.pos) < b.position.distanceTo(pl.pos) ? a : b));
      return { c: _v.copy(ring.position).normalize(), text: '💍 Next ring' };
    }
    return null;
  }

  /** e.g. { have: 1, need: 2, text: '1 / 2 urgent' } */
  progress() {
    const { stat, target } = this.def.goal, have = Math.min(target, this.game.tally[stat] || 0);
    return { have, need: target, text: `${have} / ${target} ${STAT_LABEL[stat] || stat}` };
  }

  /** 'done', a failure reason, or null while the mission is still on. */
  check() {
    const t = this.game.tally, d = this.def;
    if (d.failIf && t[d.failIf] > 0) return d.failIf;
    return (t[d.goal.stat] || 0) >= d.goal.target ? 'done' : null;
  }
}

/** Why a mission failed, in words. */
export const FAIL_REASON = {
  time: '⏰ Out of time.',
  broken: '🥚 The fragile parcel broke.',
  ash: '🌋 You flew into the ash.',
};
