import { TAU, mod, tangentBasis } from '../core/Geo.js';

const LONG_JUMP = 5;      // seconds a rover must stay off the ground for the Giant Leap trophy
const LOOP_NEAR = 0.55;   // radians from a storm's middle that still count as going round it

/**
 * Things done in a vehicle that earn a trophy, and that missions can count (the run hears about them: looped,
 * threaded): a long jump in a rover, a loop round a storm (a landmark with loop: Jupiter's Great Red Spot), and a
 * pass through Saturn's ring ice without touching any. Once a frame while a run is on.
 */
export class Feats {
  constructor(game) {
    this.game = game;
    this.reset();
  }

  /** A fresh run: nothing done yet, and the storm to go round (if this planet has one). */
  reset() {
    const l = this.game.planet?.landmarks?.list.find((x) => x.loop);
    this.storm = l ? { d: l.d, name: l.name, basis: tangentBasis(l.d), trophy: l.loop } : null;
    Object.assign(this, { airT: 0, turned: 0, lastA: null, side: 0 });
  }

  update(dt) {
    const g = this.game, pl = g.player;
    this.airT = pl.kind === 'car' && pl.airborne && g.planet.theme.air ? this.airT + dt : 0; // (a rover: where the air's thin or gone)
    if (this.airT > LONG_JUMP) g.app.achievements.unlock('longjump');
    if (pl.kind !== 'plane') return;
    this.circle(pl);
    this.thread(pl);
  }

  /** How far round the storm we've gone (radians, either way), counting up to a full loop. */
  circle(pl) {
    const s = this.storm, g = this.game;
    if (!s) return;
    if (pl.up.angleTo(s.d) > LOOP_NEAR) { this.turned = 0; this.lastA = null; return; }
    const [u, v] = s.basis, a = Math.atan2(pl.up.dot(v), pl.up.dot(u));
    if (this.lastA !== null) this.turned += mod(a - this.lastA + Math.PI, TAU) - Math.PI;
    this.lastA = a;
    if (Math.abs(this.turned) < TAU) return;
    this.turned = 0;
    g.app.sfx.pop(pl.pos.clone(), 'ROUND THE STORM!', '#ff8c42', 'ring');
    g.app.achievements.unlock(s.trophy);
    g.run.looped();
  }

  /** Crossing the ring's sheet where the ice is, untouched (a knock leaves the ship shaken: it doesn't count). */
  thread(pl) {
    const rings = this.game.planet.rings;
    if (!rings?.ice.length) return;
    const h = pl.pos.dot(rings.axis), side = Math.sign(h) || 1, r = Math.sqrt(Math.max(0, pl.pos.lengthSq() - h * h));
    const crossed = this.side && side !== this.side && r > rings.inner && r < rings.inner + 2.4 && pl.invuln <= 0;
    this.side = side;
    if (!crossed) return;
    this.game.app.sfx.pop(pl.pos.clone(), 'THREADED!', '#9fd8ff', 'ring');
    this.game.app.achievements.unlock('ringrunner');
    this.game.run.threaded();
  }
}
