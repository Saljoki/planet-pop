import { worldOf } from './Worlds.js';

const COUNT = 3.6;  // seconds of countdown on the pad
const CLIMB = 4.2;  // seconds of climbing before the view hands over to the cruise

/**
 * A rocket trip to another world (app.trip): board the rocket on this world's pad, 3-2-1, lift off, cruise across
 * the system map (Cruise) while the next world builds quietly, then land on its pad. Nobody waits on a loading
 * screen: if the world isn't ready when the ship gets there, it waits in orbit.
 * state: 'idle', 'countdown', 'climb', 'cruise', 'landing'.
 */
export class Trip {
  constructor(app) {
    this.app = app;
    this.state = 'idle';
  }

  get active() { return this.state !== 'idle'; }

  /** Off to the real world `id` ('earth', 'moon', 'mars'). False if a trip can't start now. */
  go(id) {
    const app = this.app, map = app.map;
    if (this.active || app.building || app.game.active || !app.planet || !worldOf(id) || app.planet.world?.id === id) return false;
    Object.assign(this, { to: id, from: app.planet.world?.id ?? 'away', next: null, failed: false, arrived: false, t: 0, count: 4 });
    map.close(true);
    app.tour?.stop();
    app.hud.info.hide();
    app.find?.hide();
    this.setMode(true);
    app.buildWorld(id).then((p) => { this.next = p; this.check(); }, (err) => { console.error(err); this.failed = true; this.check(); });
    const space = app.planet.space;
    if (!space?.rocket) { this.cruise(); return true; }
    space.board();
    this.watch(space);
    this.state = 'countdown';
    app.hud.toast(`🚀 All aboard for ${worldOf(id).name}!`);
    return true;
  }

  /** dt: simulated seconds (so pausing holds the countdown, like the rocket). */
  update(dt) {
    const space = this.app.planet?.space;
    if (this.state === 'countdown') {
      this.t += dt;
      const c = Math.ceil(COUNT - 0.6 - this.t);
      if (c >= 1 && c <= 3 && c < this.count) { this.count = c; this.app.sfx.pop(space.rocket.position.clone(), `${c}!`, '#ffd23f'); }
      if (this.t >= COUNT) { space.launch(); this.state = 'climb'; this.t = 0; }
    } else if (this.state === 'climb') {
      this.t += dt;
      if (this.t >= CLIMB) this.cruise();
    }
  }

  cruise() {
    this.state = 'cruise';
    this.app.map.cruise(this.from, this.to, () => { this.arrived = true; this.check(); });
  }

  /** There with the world built: land. Still building: wait in orbit. It went wrong: back home. */
  check() {
    if (this.state !== 'cruise') return;
    const app = this.app, hud = app.map.cruiser?.hud;
    if (this.failed) {
      app.map.close(true);
      this.state = 'idle';
      this.setMode(false);
      app.hud.toast('💥 Mission control called the trip off (see console)');
      return;
    }
    if (!this.arrived) return;
    if (!this.next) { hud?.say('🛰️ In orbit: waiting for the landing pad to clear…'); return; }
    this.land();
  }

  /** The new world in place of the old, in daylight, and the rocket coming down onto its pad. */
  land() {
    const app = this.app, planet = this.next, stars = app.map.cruiser?.stars ?? 0;
    this.state = 'landing';
    this.next = null;
    app.swapIn(planet);
    const space = planet.space, rig = app.rig;
    if (space?.site) {
      const d = space.site.d, sky = app.sky;
      sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) - 0.5; // (mid-morning at the pad)
      sky.update(0);
      Object.assign(rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt: 30, heading: 0, tilt: 0 });
      rig.apply(rig.orbit.pose(rig.pose));
    }
    space?.land(() => this.done(planet.world, stars));
    if (space?.rocketEntity) this.watch(space);
    else this.done(planet.world, stars);
  }

  /** Follow our rocket, from a little further back and higher than usual (the whole rocket, and the sky it's off to). */
  watch(space) {
    const rig = this.app.rig;
    rig.focus(space.rocketEntity);
    Object.assign(rig.local, { dist: 3.4, pitch: 0.35 });
  }

  done(world, stars) {
    if (this.state !== 'landing') return;
    const app = this.app;
    this.state = 'idle';
    this.setMode(false);
    app.hud.toast(`👋 Welcome to ${world.name}!`);
    if (stars) {
      app.game.progress.addCoins(stars);
      app.hud.toast(`⭐ ${stars} fuel star${stars > 1 ? 's' : ''} caught: +${stars} coins`);
    }
  }

  /** The planet view's buttons step aside while travelling. */
  setMode(on) { document.body.classList.toggle('on-trip', on); }
}
