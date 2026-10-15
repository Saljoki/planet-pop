import { TAU, tangentBasis } from '../core/Geo.js';
import { HALF } from '../world/Airports.js';

const REFUEL = 0.9, ASH_ENGINE = 0.55;

/**
 * What the planet does to the plane in any run: thunderstorms buffet and zap it, runways refuel it, volcanic ash
 * chokes the engine. The effects on the plane happen here; the run hears about them (zapped, refuelled, inAsh) to
 * score them its own way.
 */
export class FlightHazards {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  /** A fresh run: warnings will be shown again. */
  reset() {
    Object.assign(this, { stormT: 1.2, warnedStorm: false, refuelling: false, warnedAsh: false, ashT: 0 });
  }

  update(dt) {
    this.storm(dt);
    this.runways(dt);
    this.ash(dt);
  }

  /** Inside a thundercloud the plane is buffeted, and every few seconds lightning may hit it. */
  storm(dt) {
    const g = this.game, pl = g.player, app = g.app, weather = g.planet.weather, storm = weather.stormAt(pl.pos);
    pl.turbulence = storm ? 1 : 0;
    if (!storm) { this.stormT = 1.2; return; } // a short grace period after flying in
    if (!this.warnedStorm) {
      this.warnedStorm = true;
      app.hud.toast('⛈️ Thunderstorm! Get out before lightning strikes.');
    }
    if ((this.stormT -= dt) > 0) return;
    this.stormT = 2 + Math.random() * 1.5;
    const hit = pl.invuln <= 0 && Math.random() < 0.5;
    const aim = pl.pos.clone();
    if (!hit) { // a near miss crackles past the wing
      const [u, v] = tangentBasis(pl.up), a = Math.random() * TAU;
      aim.addScaledVector(u, Math.cos(a) * 0.8).addScaledVector(v, Math.sin(a) * 0.8);
    }
    weather.strike(storm, aim);
    if (!hit) return;
    g.run.zapped();
    pl.boost = 0;
    pl.shake = 1;
    pl.invuln = 1;
    app.sfx.pop(pl.pos.clone(), 'ZAP!', '#ffd23f', 'crash');
    app.haptics?.buzz('zap');
    app.achievements.unlock('lightningrod');
  }

  /** Skimming low along a runway tops up the boost tank. */
  runways(dt) {
    const g = this.game, pl = g.player, ap = g.planet.airports?.list.find((a) => a.c.angleTo(pl.up) < HALF + 0.02);
    const on = !!ap && pl.alt < ap.top + 0.9 && Math.abs(pl.up.dot(ap.side)) < 0.04;
    if (on) pl.boost = Math.min(1, pl.boost + REFUEL * dt);
    if (on && !this.refuelling) { g.run.refuelled(); g.app.sfx.pop(pl.pos.clone(), 'REFUEL!', '#3fa7ff', 'ring'); }
    this.refuelling = on;
  }

  /** An erupting volcano's ash plume chokes the engine and empties the boost tank. */
  ash(dt) {
    const g = this.game, pl = g.player, app = g.app, ash = Math.max(0, ...(g.planet.volcanoes || []).map((v) => v.ashAt(pl.pos)));
    pl.engine = ash > 0 ? ASH_ENGINE : 1;
    if (!ash) return;
    g.run.inAsh(dt);
    pl.boost = Math.max(0, pl.boost - dt);
    pl.shake = Math.max(pl.shake, 0.5);
    if (!this.warnedAsh) {
      this.warnedAsh = true;
      app.hud.toast('🌋 Volcanic ash! Your engine is choking. Get out of the plume!');
    }
    if ((this.ashT -= dt) <= 0) { this.ashT = 0.6; app.sfx.pop(pl.pos.clone(), 'COUGH!', '#8a7f9e', 'crash'); }
  }
}
