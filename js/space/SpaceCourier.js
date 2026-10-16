import { WORLD_IDS, worldOf } from './Worlds.js';
import { position, mapPosition } from './Orbits.js';
import { CARGO } from '../game/Cargo.js';
import { ParcelBoard } from '../game/screens/ParcelBoard.js';

const GOODS = ['🧪 Medicine', '🌱 Seeds for the greenhouses', '🍕 Pizza', '📮 The post', '🔧 Spare parts', '🧸 A birthday present',
  '🎸 A guitar', '🍦 Ice cream', '📚 Library books', '🧦 Warm socks', '🛰️ A satellite dish', '🥐 Fresh croissants'];
const KINDS = [[CARGO.standard, 40], [CARGO.urgent, 25], [CARGO.fragile, 20], [CARGO.heavy, 15]];
const AWAY_AU = 50;     // how far a made-up planet "beyond the solar system" counts as being
const LAST_LEG = 70;    // seconds allowed for launching, landing and the last stretch to the town
const STREAK_MAX = 3;   // the on-time bonus stops growing here (x1.5)

/** Where a body is on the system map today (the Moon by Earth, a made-up planet far out), for timing a trip. */
function mapAt(id, ms) {
  if (id === 'away') return [620, 160, 560];
  const [x, y, z] = mapPosition(position(id === 'moon' ? 'earth' : id, ms));
  return id === 'moon' ? [x + 7, y, z] : [x, y, z];
}

/** Real distance between two bodies today, in au (the Moon is next to Earth). */
function distanceAU(a, b, ms) {
  if (a === 'away' || b === 'away') return AWAY_AU;
  const pa = position(a === 'moon' ? 'earth' : a, ms), pb = position(b === 'moon' ? 'earth' : b, ms);
  return Math.max(0.00257, Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]));
}

/**
 * 🚀 The space courier (app.spaceCourier): parcels from the world you're on to another one. Take one from the board
 * (ParcelBoard: the hangar, the system map, or after a delivery) and the rocket leaves straight away; the parcel's
 * clock runs through the trip and the last stretch, from the spaceport to its town by rover or by air
 * (runs/SpaceDropRun.js). Pay goes with today's real distance and the kind of parcel; on time pays in full and builds
 * a streak, late pays half, and a broken fragile parcel pays nothing.
 */
export class SpaceCourier {
  constructor(app) {
    this.app = app;
    this.job = null;    // { from, to, cargo, what, pay, limit, left, au, town?, broken }
    this.streak = 0;
    this.offers = null;
  }

  /** The body we're on: a real world's id, or 'away' for a made-up planet. */
  get here() { return this.app.planet?.world?.id ?? 'away'; }

  openBoard() {
    this.board ??= new ParcelBoard(this.app, this);
    this.board.show();
  }

  /** Three parcels from here to other worlds (the same until one is taken or delivered). */
  currentOffers() {
    if (this.offers?.from !== this.here) {
      const dests = WORLD_IDS.filter((id) => id !== this.here).sort(() => Math.random() - 0.5).slice(0, 3);
      this.offers = { from: this.here, list: dests.map((to) => this.offer(this.here, to)) };
    }
    return this.offers.list;
  }

  /** A parcel from `from` to `to`, priced on today's distance. */
  offer(from, to, rand = Math.random, ms = Date.now()) {
    let r = rand() * 100, cargo = CARGO.standard;
    for (const [c, w] of KINDS) if ((r -= w) < 0) { cargo = c; break; }
    const au = distanceAU(from, to, ms), [a, b] = [mapAt(from, ms), mapAt(to, ms)];
    const cruise = Math.min(34, Math.max(12, 8 + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) / 9)); // (as Cruise times it)
    const pay = Math.round(((15 + 20 * Math.sqrt(au)) * cargo.pay) / 5) * 5; // (the Moon ~15, Mars ~40, Pluto ~130)
    const limit = Math.round((cruise + LAST_LEG) * (cargo.id === 'urgent' ? 0.75 : cargo.id === 'heavy' ? 1.2 : 1));
    return { from, to, cargo, what: GOODS[Math.floor(rand() * GOODS.length)], pay, limit, au };
  }

  /** Take a parcel: off by rocket straight away. False if a trip can't start right now. */
  take(offer) {
    const app = this.app;
    if (this.job || !app.trip.go(offer.to)) return false;
    this.job = { ...offer, left: offer.limit, broken: false };
    this.offers = null;
    app.hud.toast(`${offer.cargo.icon} ${offer.what} for ${worldOf(offer.to).name}: ${clock(offer.limit)} on the clock!`);
    return true;
  }

  /** Back on the way with a parcel whose trip didn't happen (or after taking a detour). */
  resume() { return !!this.job && this.app.trip.go(this.job.to); }

  /** Give up on the parcel (from the board). */
  drop() {
    this.job = null;
    this.streak = 0;
  }

  /** Whether the parcel is for the world we're on now. */
  get due() { return !!this.job && this.job.to === this.here; }

  /** The town the parcel goes to: the nearest to the spaceport (a rover can always get there by road). */
  townFor(planet) {
    const pad = planet.space?.site?.d ?? planet.cities.sites[0].c;
    return planet.cities.sites.reduce((a, b) => (a.c.angleTo(pad) < b.c.angleTo(pad) ? a : b));
  }

  /** Real seconds: the parcel's clock runs while the rocket's on its way (the last stretch runs it itself). */
  update(dt) {
    if (this.job && this.app.trip.active && !this.app.paused) this.job.left -= dt;
  }

  /** Handed over: pay up. Returns what happened, for the results card. */
  deliver() {
    const app = this.app, job = this.job, onTime = job.left > 0;
    if (job.broken) this.streak = 0;
    else this.streak = onTime ? Math.min(STREAK_MAX, this.streak + 1) : 0;
    const bonus = 1 + (Math.max(1, this.streak) - 1) * 0.25;
    const coins = job.broken ? 0 : Math.round(job.pay * (onTime ? bonus : 0.5));
    if (coins) app.game.progress.addCoins(coins);
    app.achievements.unlock('spacecourier');
    this.job = null;
    this.offers = null;
    return { ...job, coins, onTime, streak: this.streak, bonus };
  }
}

/** m:ss */
export const clock = (s) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;

