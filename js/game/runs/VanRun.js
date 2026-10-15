import { R } from '../../core/Geo.js';
import { Car } from '../vehicles/Car.js';
import { Ground } from '../vehicles/Ground.js';
import { DeliveryRun } from './DeliveryRun.js';

const PULL_IN = 0.16, SLOW = 0.3; // how close (units) and how slow (units/s) to hand a parcel over
const CRUISE = 0.75;              // the speed deliveries are timed at (units/s)
const VANMAN = 3;                 // deliveries in one run for the trophy

/**
 * 🚐 Van courier: the courier run by road. Parcels go to a pink pad at the edge of one of the two nearest towns;
 * pull in slowly to hand them over. Same parcels, combos and clock as in the air, but no rings and no Rex.
 */
export class VanRun extends DeliveryRun {
  static briefing() {
    return { icon: '🚐', title: 'Van courier', goal: 'Drive parcels to the next town before the clock runs out.',
      tips: ['Follow the arrow to the pink pad at the edge of town and slow right down on it to deliver.',
        'Deliver fast to build a combo. Crashing costs 8 seconds and some health, and breaks fragile parcels.',
        'Highways are quickest. Each delivery patches the van up a little.'] };
  }

  static vehicleKind() { return 'car'; }

  get rings() { return 0; }

  get hasRival() { return false; }

  get intro() { return '🚐 Van courier: drive each parcel to the pink pad at the next town!'; }

  get resultHead() { return '🚐 Van courier<br>'; }

  get againLabel() { return '🚐 Drive again'; }

  get arriveHint() { return `pull in at the pink pad by ${this.dest.name}!`; }

  /** Where this parcel goes: a stop at the edge of the destination town (chosen once per parcel). */
  get stop() {
    if (this.stopFor !== this.dest) {
      const stops = this.ground.stops(this.dest);
      this.stopFor = this.dest;
      this.stopAt = stops[Math.floor(Math.random() * stops.length)] || { at: this.dest.c, town: this.dest };
    }
    return this.stopAt;
  }

  takeoff() {
    this.ground = new Ground(this.planet);
    super.takeoff();
    return this.ground.parking(this.from) || { at: this.from.c, heading: this.from.u };
  }

  vehicle(at, heading) { return new Car(this.planet, at, heading, this.stats, { kind: 'van' }); }

  /** The two nearest towns a van can pull in at. */
  destinations(sites) {
    const reachable = sites.filter((s) => this.ground.stops(s).length);
    return (reachable.length ? reachable : sites).sort((a, b) => a.c.angleTo(this.from.c) - b.c.angleTo(this.from.c)).slice(0, 2);
  }

  parFor(here) { return (here.angleTo(this.stop.at) * R) / CRUISE * 1.3 + 5; }

  markDest() { this.game.props.placePad(this.stop.at, this.ground.carR(this.stop.at), 'dropoff'); }

  destPoint() { return this.stop.at; }

  arrived() {
    const pl = this.player;
    return this.stop.at.angleTo(pl.up) * R < PULL_IN && Math.abs(pl.v) < SLOW;
  }

  deliver() {
    super.deliver();
    if (this.deliveries >= VANMAN) this.app.achievements.unlock('vanman');
  }

  recordBest() {
    const { prev, record } = this.game.progress.recordBest('van', this.score);
    return record ? '🎉 New best!' : `Best: ${prev}`;
  }
}
