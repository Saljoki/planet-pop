import * as THREE from 'three';
import { R, frame, tangentBasis } from '../core/Geo.js';

const SIGHTSEER = 120; // seconds of free flight for the trophy
const _v = new THREE.Vector3(), _m = new THREE.Matrix4();

/**
 * Sky Courier without the courier: no clock, no parcels, no Rex. Fly anywhere; rings refill the boost, runways
 * still refuel, storms still zap and the UFO can still be caught for fun. No score or coins, so nothing to farm.
 */
export class FreeFlight {
  constructor(game) {
    this.game = game;
    this.time = 0;
  }

  update(dt) {
    const g = this.game, pl = g.player, app = g.app, planet = g.planet;
    this.time += dt;
    pl.update(dt);
    if (pl.crashed) {
      app.sfx.pop(pl.pos.clone(), 'BONK!', '#ff4d4d');
      app.haptics?.buzz('crash');
    }
    g.updateStorm(dt);
    g.updateRunways(dt);
    g.updateAsh(dt);
    if (planet.ufo?.catchBy(pl.pos)) {
      app.sfx.pop(pl.pos.clone(), 'BEAMED UP!', '#7dffb0', 'ufo');
      app.achievements.unlock('ufo');
    }
    for (const ring of g.rings) {
      if (ring.position.distanceTo(pl.pos) > g.stats.magnet) continue;
      pl.boost = 1;
      app.sfx.pop(ring.position.clone(), 'WHEE!', '#3fa7ff', 'ring');
      app.haptics?.buzz('ring');
      this.placeRing(ring);
    }
    if (this.time >= SIGHTSEER) app.achievements.unlock('sightseer');
    this.hud();
  }

  /** Rings turn up a little way ahead, so there's always one to aim for. */
  placeRing(ring) {
    const pl = this.game.player, [u] = tangentBasis(pl.up);
    const d = _v.copy(pl.up).addScaledVector(pl.fwd, 0.15 + Math.random() * 0.25).addScaledVector(u, (Math.random() - 0.5) * 0.2).normalize();
    const alt = Math.max(R + 1.8 + Math.random() * 1.4, this.game.planet.groundR(d) + 0.9);
    frame(_m, d.clone().multiplyScalar(alt), d, pl.fwd);
    ring.position.setFromMatrixPosition(_m);
    ring.quaternion.setFromRotationMatrix(_m);
  }

  /** The nearest town and how far it is. */
  nearest() {
    const up = this.game.player.up;
    let best = null, ang = Infinity;
    for (const c of this.game.planet.cities.sites) {
      const a = c.c.angleTo(up);
      if (a < ang) { ang = a; best = c; }
    }
    return best && { city: best, km: Math.round(ang * R * 100) };
  }

  hud() {
    const d = this.game.dom, pl = this.game.player, t = Math.floor(this.time), near = this.nearest();
    d.free.textContent = `🕊️ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    d.boost.style.width = `${Math.round(pl.boost * 100)}%`;
    d.goal.textContent = !near ? '🕊️ Free flight: fly anywhere!' : near.km < 90
      ? `🕊️ Over ${near.city.name}` : `🕊️ Free flight · ${near.city.name} is ${near.km} km away`;
  }
}
