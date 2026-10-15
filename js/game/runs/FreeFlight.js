import { R } from '../../core/Geo.js';
import { rollCargo } from '../Cargo.js';
import { Run } from './Run.js';

const SIGHTSEER = 120; // seconds of free flight for the trophy

/**
 * 🕊️ Sky Courier without the courier: no clock, no parcels, no Rex. Fly anywhere; rings refill the boost, runways
 * still refuel, storms still zap and the UFO can still be caught for fun. No score or coins, so nothing to farm.
 */
export class FreeFlight extends Run {
  static briefing() {
    return { icon: '🕊️', title: 'Free flight', goal: 'No clock, no parcels, no Rex. Fly anywhere you like.',
      tips: ['Rings refill your boost, and skimming low along a runway refuels it and patches up the plane.', 'Spot the UFO? Fly right through it.',
        'Pause and pick Back to planet when you’re done. No score or coins in free flight.'] };
  }

  get layout() { return { badge: 'free', stats: false, arrow: false }; }

  takeoff() {
    const sites = this.planet.cities.sites;
    this.from = sites[Math.floor(this.rand() * sites.length)];
    this.cargo = rollCargo(true, this.rand);
    return { at: this.from.c, heading: this.from.u.clone() };
  }

  begin() {
    this.app.hud.toast('🕊️ Free flight: no clock, no parcels. Fly anywhere you like! Rings refill your boost.');
  }

  ring(ring) { this.app.sfx.pop(ring.position.clone(), 'WHEE!', '#3fa7ff', 'ring'); }

  /** Rings turn up a little way ahead, so there's always one to aim for. */
  placeRing(ring) { this.game.props.ahead(ring, this.player); }

  update(dt) {
    this.time += dt;
    if (this.time >= SIGHTSEER) this.app.achievements.unlock('sightseer');
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
    const d = h.dom, t = Math.floor(this.time), near = this.nearest();
    d.free.textContent = `🕊️ ${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
    d.goal.textContent = !near ? '🕊️ Free flight: fly anywhere!' : near.km < 90
      ? `🕊️ Over ${near.city.name}` : `🕊️ Free flight · ${near.city.name} is ${near.km} km away`;
  }
}
