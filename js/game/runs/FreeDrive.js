import { R } from '../../core/Geo.js';
import { Car } from '../vehicles/Car.js';
import { Boat } from '../vehicles/Boat.js';
import { Ground } from '../vehicles/Ground.js';
import { Run } from './Run.js';

const JOYRIDE = 60; // seconds in a borrowed car for the trophy

/**
 * 🚗 Free drive and ⛵ free sail: no clock, no score, just roam. opts.drive is 'car' or 'boat'; opts.take is a car or
 * boat from the world ({ kind, id }, from its info card's Drive button) to take over where it is, or else it starts
 * at a town (a car) or in open water by one (a boat); opts.from 'pad' starts beside the spaceport's launch pad (just
 * landed from a trip). Wrecks put a fresh one at the nearest town.
 */
export class FreeDrive extends Run {
  static briefing({ drive = 'car', take = null } = {}) {
    if (drive === 'boat') {
      return { icon: '⛵', title: take ? `Take the helm of ${take.name}` : 'Free sail', goal: 'No clock, no score. Steer anywhere there’s water.',
        tips: ['The shore is a wall: hit it hard and the boat takes damage.', 'Boost for a burst of speed; it refills by itself.',
          'Pause and pick Back to planet when you’re done; the boat carries on its rounds.'] };
    }
    return { icon: '🚗', title: take ? `Drive ${take.name}` : 'Free drive', goal: 'No clock, no score. Drive anywhere: highways, fields, hills, towns.',
      tips: ['Highways are quickest; grass, sand and snow are slower, and hills slow you down going up.', 'Buildings, steep mountains and the sea are walls. Hit them hard and the car takes damage.',
        'Traffic waits behind you (and honks). Crest a hill fast for a little air.'] };
  }

  static vehicleKind({ drive = 'car' } = {}) { return drive; }

  constructor(game, opts) {
    super(game, opts);
    this.boat = opts.drive === 'boat';
    this.take = opts.take || null;
    this.taken = null; // { color } once a car or boat from the world has been taken over
  }

  get layout() { return { badge: 'free', stats: false, arrow: false }; }

  get rings() { return 0; }

  /** The traffic or the boats, whichever the vehicle came from. */
  get source() { return this.take && (this.take.kind === 'boat' ? this.planet.boats : this.planet.traffic); }

  takeoff() {
    const p = this.planet, ground = new Ground(p);
    if (this.take) {
      this.taken = this.source.take(this.take.id);
      if (this.taken) return { at: this.taken.pos.clone().normalize(), heading: this.taken.fwd };
    }
    const pad = this.opts.from === 'pad' && p.space?.site;
    if (pad && !this.boat) {
      const at = pad.d.clone().addScaledVector(pad.fwd, 0.1).normalize(); // (far enough that the camera behind clears the pad)
      if (!ground.carBlock(at)) return { at, heading: pad.fwd };
    }
    const sites = p.cities.sites, town = sites[Math.floor(this.rand() * sites.length)];
    const spot = this.boat ? this.waterNear(ground, town) : ground.parking(town);
    return spot || { at: town.c, heading: town.u };
  }

  /** A boat starts by a harbour if there is one, else in open water near the town. */
  waterNear(ground, town) {
    const h = this.planet.harbours?.list[0];
    return ground.openWater(h ? h.loop.c : town.c);
  }

  vehicle(at, heading) {
    const paint = this.taken ? { body: this.taken.color } : this.game.progress.skinDef;
    return this.boat ? new Boat(this.planet, at, heading, this.stats, paint) : new Car(this.planet, at, heading, this.stats, paint);
  }

  begin() {
    const app = this.app;
    if (this.boat) app.achievements.unlock('sailor');
    app.hud.toast(this.boat ? '⛵ Free sail: steer anywhere there’s water.' : '🚗 Free drive: go anywhere. Highways are quickest!');
  }

  update(dt) {
    this.time += dt;
    if (this.taken && !this.boat && this.time >= JOYRIDE) this.app.achievements.unlock('joyrider');
  }

  respawnPoint() {
    const up = this.player.up, ground = new Ground(this.planet);
    const town = this.planet.cities.sites.reduce((a, b) => (a.c.angleTo(up) < b.c.angleTo(up) ? a : b));
    const spot = this.boat ? ground.openWater(up) : ground.parking(town);
    return { ...(spot || { at: town.c, heading: town.u }), name: this.boat ? null : town.name };
  }

  /** The nearest town and how far it is. */
  nearest() {
    const up = this.player.up;
    let best = null, ang = Infinity;
    for (const c of this.planet.cities.sites) {
      const a = c.c.angleTo(up);
      if (a < ang) { ang = a; best = c; }
    }
    return best && { city: best, km: Math.round(ang * R * 100) };
  }

  hud(h) {
    const d = h.dom, t = Math.floor(this.time), near = this.nearest(), icon = this.boat ? '⛵' : '🚗';
    d.free.textContent = `${icon} ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    d.goal.textContent = !near ? `${icon} Go anywhere!` : near.km < 150
      ? `${icon} In ${near.city.name}` : `${icon} ${near.city.name} is ${near.km} km away`;
  }

  end() {
    if (this.taken) this.source?.giveBack(this.take.id);
  }
}
