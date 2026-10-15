import { R } from '../../core/Geo.js';
import { Car } from '../vehicles/Car.js';
import { Ground } from '../vehicles/Ground.js';
import { Run } from './Run.js';

const FARE = 100, TIP = 8, SHIFT_BONUS = 15, CRASH_TIME = 4, REPAIR = 0.15, CABBIE = 5;
const PULL_IN = 0.16, SLOW = 0.3;   // how close (units) and how slow (units/s) to pick up or drop off
const CRUISE = 0.75;                // the speed fares are timed at (units/s)
const NAMES = ['Dot', 'Ziggy', 'Pip', 'Lulu', 'Mo', 'Tess', 'Gus', 'Wanda', 'Ida', 'Benny', 'Coco', 'Otto', 'Mabel', 'Nico', 'Rosa', 'Bob'];
const SHIRTS = ['#ff4d4d', '#3fa7ff', '#ffd23f', '#2ee59d', '#ff8c42', '#8f5cff', '#ff5fa2'];
const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * 🚕 Taxi: people wait at the edge of town (a green pad, someone waving); pull in slowly to pick them up, then drive
 * them to a stop at the next town (a pink pad). Each fare pays, more for a quick ride and less for a bumpy one, and
 * adds time to the shift. Quick fares in a row build a combo. The shift ends when the clock runs out (or the taxi's
 * wrecked).
 */
export class TaxiRun extends Run {
  static briefing() {
    return { icon: '🚕', title: 'Taxi', goal: 'Pick up people waiting at the edge of town and drive them to the next town before your shift ends.',
      tips: ['Follow the arrow to the green pad, slow right down on it to pick up, then to the pink pad to drop off.',
        'Quick rides tip well and build a combo. Every crash makes the ride bumpier and the tip smaller.',
        'Each fare adds 15 seconds to the shift. Highways are quickest; town centres are too tight for a taxi.'] };
  }

  static vehicleKind() { return 'car'; }

  get rings() { return 0; }

  get layout() { return { badge: null, stats: true, arrow: true }; }

  /** Towns a taxi can pull in at. */
  get towns() { return this.planet.cities.sites.filter((s) => this.ground.stops(s).length); }

  takeoff() {
    this.ground = new Ground(this.planet);
    Object.assign(this, { score: 0, time: this.stats.startTime, fares: 0, coins: 0, combo: 1, fare: null });
    const towns = this.towns;
    this.home = towns[Math.floor(this.rand() * towns.length)] || this.planet.cities.sites[0];
    return this.ground.parking(this.home) || { at: this.home.c, heading: this.home.u };
  }

  vehicle(at, heading) { return new Car(this.planet, at, heading, this.stats, { kind: 'taxi' }); }

  begin() {
    this.nextFare(this.home);
    this.app.hud.toast('🚕 Your shift has started! Someone’s waiting: follow the arrow.');
  }

  /** Where the taxi is, as a direction. */
  get here() { return this.player.up; }

  /** Towns nearest to `from` first. */
  byDistance(from, towns = this.towns) { return [...towns].sort((a, b) => a.c.angleTo(from) - b.c.angleTo(from)); }

  /** Someone new waiting at a stop near `town`, not right where the taxi is. */
  nextFare(town) {
    const stops = this.byDistance(town.c).slice(0, 2).flatMap((t) => this.ground.stops(t)).filter((s) => s.at.angleTo(this.here) * R > 0.6);
    const from = pick(stops.length ? stops : this.ground.stops(town));
    this.fare = { name: pick(NAMES), shirt: pick(SHIRTS), from, to: null, comfort: 1, elapsed: 0, par: 0, riding: false };
    this.props().placePad(from.at, this.ground.carR(from.at), 'pickup', this.fare.shirt);
  }

  props() { return this.game.props; }

  /** In they hop, and say where to: a stop at one of the three nearest other towns. */
  pickUp() {
    const f = this.fare, app = this.app;
    const towns = this.byDistance(f.from.town.c).filter((t) => t !== f.from.town).slice(0, 3), town = pick(towns.length ? towns : [f.from.town]);
    f.to = pick(this.ground.stops(town));
    f.riding = true;
    f.elapsed = 0;
    f.par = (f.from.at.angleTo(f.to.at) * R) / CRUISE * 1.3 + 5;
    this.props().placePad(f.to.at, this.ground.carR(f.to.at), 'dropoff');
    app.sfx.pop(this.player.pos.clone(), 'HOP IN!', '#2ee59d', 'ring');
    app.hud.toast(`🚕 ${f.name}: “To ${town.name}, please!”`);
  }

  /** Fare paid: more for a quick ride, less for a bumpy one. */
  dropOff() {
    const f = this.fare, app = this.app, fast = f.elapsed <= f.par;
    this.combo = fast ? Math.min(5, this.combo + 1) : 1;
    const pay = Math.round((FARE * this.combo + Math.max(0, (f.par - f.elapsed) * TIP)) * f.comfort);
    this.score += pay;
    this.fares++;
    this.earn(Math.round(pay / 10));
    this.time += SHIFT_BONUS;
    this.player.repair(REPAIR);
    app.sfx.pop(this.player.pos.clone(), fast && this.combo > 1 ? `+${pay}! x${this.combo}` : `+${pay}!`, '#2ee59d', 'deliver');
    app.haptics?.buzz('deliver');
    if (f.comfort < 1) app.hud.toast(`🤕 ${f.name}: “Bit of a bumpy ride…” Smaller tip this time.`);
    if (this.fares >= CABBIE) app.achievements.unlock('cabbie');
    this.nextFare(f.to.town);
  }

  earn(n) {
    this.coins += n;
    this.game.progress.addCoins(n);
  }

  crashed() {
    super.crashed();
    this.time -= CRASH_TIME;
    this.combo = 1;
    if (this.fare?.riding) {
      this.fare.comfort = Math.max(0.25, this.fare.comfort - 0.25);
      this.app.sfx.pop(this.player.pos.clone().addScaledVector(this.player.up, 0.1), 'OUCH!', '#ff8c42');
    }
  }

  update(dt) {
    const f = this.fare, pl = this.player;
    this.time -= dt;
    f.elapsed += dt;
    const stop = f.riding ? f.to : f.from;
    if (stop.at.angleTo(pl.up) * R < PULL_IN) {
      if (Math.abs(pl.v) < SLOW) {
        if (f.riding) this.dropOff();
        else this.pickUp();
      } else if (!this.hinted) {
        this.hinted = true;
        this.app.hud.toast('🛑 Slow right down on the pad!');
      }
    }
    if (this.time <= 0) this.shiftOver();
  }

  wrecked() { this.shiftOver('💥 Wrecked!'); }

  shiftOver(title = '🚕 Shift over!') {
    this.time = 0;
    const p = this.game.progress, { prev, record } = p.recordBest('taxi', this.score);
    this.game.finish({
      title,
      html: `🚕 Taxi<br>Score <b>${this.score}</b> · ${this.fares} fare${this.fares === 1 ? '' : 's'}<br>
      🪙 +${this.coins} coins (you have ${p.coins})<br>${record ? '🎉 New best!' : `Best: ${prev}`}`,
      again: '🚕 Drive again',
    });
  }

  hud(h) {
    const d = h.dom, f = this.fare, pl = this.player, stop = f.riding ? f.to : f.from;
    d.score.textContent = `⭐ ${this.score}`;
    d.time.textContent = `⏱ ${Math.max(0, Math.ceil(this.time))}`;
    d.time.classList.toggle('low', this.time <= 10);
    d.combo.textContent = `🔥 x${this.combo}`;
    d.coins.textContent = `🪙 ${this.coins}`;
    h.pointAt(stop.at);
    const km = Math.round(pl.up.angleTo(stop.at) * R * 100);
    d.goal.textContent = f.riding
      ? `🚕 ${f.name} → ${f.to.town.name} · ${km} km · tip ${Math.max(0, Math.ceil(f.par - f.elapsed))}s`
      : `🙋 ${f.name} is waiting near ${f.from.town.name} · ${km} km`;
  }
}
