import { Plane } from '../vehicles/Plane.js';

/**
 * One kind of Sky Courier run (a courier run, the daily, a mission, free flight…). CourierGame owns the plane, the
 * props, the hazards and the controls, and calls these hooks; a run only decides the rules: where the plane starts,
 * what scores, what the HUD says and when it's over. To add a new kind of run, extend this (or DeliveryRun) and add
 * it to runClass() in runs/modes.js.
 *
 * Each frame CourierGame flies the plane, then calls crashed() / zapped() / refuelled() / inAsh() / caughtUfo() /
 * ring() as those happen, then update(dt), then hud(). A run ends by calling game.finish() with its results card.
 */
export class Run {
  /** For the briefing before it starts: { icon, title, goal, tips }. */
  static briefing() { return { icon: '✈️', title: 'Sky Courier', goal: '', tips: [] }; }

  /** What it's flown or driven in, for the briefing's controls: 'plane', 'car' or 'boat'. */
  static vehicleKind() { return 'plane'; }

  /** opts: what was asked for ({ daily, mission, free, drive, road… }), kept so "Fly again" can repeat it. */
  constructor(game, opts = {}) {
    this.game = game;
    this.opts = opts;
    this.time = 0;                     // the run's clock (s): counts down in a courier run, up in free flight
    this.rand = Math.random;           // seeded by runs that must be the same for everyone
    this.stats = game.progress.stats;  // the plane: the player's upgrades, unless a run says otherwise
    this.cargo = null;                 // what the plane carries (just for looks unless the run says so)
  }

  get app() { return this.game.app; }
  get planet() { return this.game.planet; }
  get player() { return this.game.player; }

  /** Which HUD pieces show: a mode badge ('daily' | 'mission' | 'free' | null), the score badges, the arrow. */
  get layout() { return { badge: null, stats: true, arrow: true }; }

  /** Set up the run before the plane exists. Returns where it takes off: { at, heading } (unit vectors). */
  takeoff() { throw new Error(`${this.constructor.name} must say where the plane takes off`); }

  /** What the player drives (a Vehicle), starting at `at` facing `heading`. The courier plane unless a run says otherwise. */
  vehicle(at, heading) { return new Plane(this.planet, at, heading, this.stats, this.game.progress.skinDef); }

  /** The plane and props now exist: place things, set up special conditions, say hello. */
  begin() {}

  /** Bumped into the ground (the plane has already bounced back up). */
  crashed() { this.app.sfx.pop(this.player.pos.clone(), 'BONK!', '#ff4d4d'); }

  /** Flew through the hovering UFO. */
  caughtUfo() { this.app.sfx.pop(this.player.pos.clone(), 'BEAMED UP!', '#7dffb0', 'ufo'); }

  /** Flew through a ring (the boost is already refilled); placeRing() moves it on afterwards. */
  ring() {}

  /** Where a collected ring turns up next. */
  placeRing(ring) { this.game.props.scatter(ring); }

  /** Hit by lightning. */
  zapped() {}

  /** Started skimming a runway. */
  refuelled() {}

  /** Each frame inside a volcano's ash plume. */
  inAsh() {}

  /** Out of health. In a free mode a fresh one turns up at the nearest town; scored runs end (see DeliveryRun). */
  wrecked() { this.game.respawnSoon(); }

  /** Where a fresh vehicle turns up after a wreck: { at, heading, name }. */
  respawnPoint() {
    const up = this.player.up, town = this.planet.cities.sites.reduce((a, b) => (a.c.angleTo(up) < b.c.angleTo(up) ? a : b));
    return { at: town.c, heading: town.u, name: town.name };
  }

  /** Once a frame, after the plane has moved: the run's own rules, and calling game.finish() when it's over. */
  update() {}

  /** Fill in the HUD (CourierHud) for this frame. */
  hud() {}

  /** Copy a result to share (only runs whose results card has a Share button). */
  share() {}

  /** Undo anything that outlives the run. */
  end() {}
}
