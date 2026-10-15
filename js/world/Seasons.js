import * as THREE from 'three';
import { TAU, smoothstep } from '../core/Geo.js';
import { shared } from '../render/Toon.js';

const YEAR = 8;          // days per year: 20 minutes at 1x, much less with time sped up
const RECOLOR = 2;       // seconds between tree repaints
const NAMES = [['☀️', 'Summer'], ['🍂', 'Autumn'], ['❄️', 'Winter'], ['🌸', 'Spring']];
const AUTUMN = ['#ff8c42', '#ff5f45', '#ffd23f', '#e8743b'].map((c) => new THREE.Color(c));
const BLOSSOM = ['#ffb7d5', '#fff0f6', '#ffc9e3'].map((c) => new THREE.Color(c));
const FRESH = new THREE.Color('#9be36b'), FROST = new THREE.Color('#f4f7ff');
const _v = new THREE.Vector3(), _c = new THREE.Color();

/**
 * The year turns on worlds that have seasons: the hemisphere tilted away from the sun gets winter, with snow creeping
 * down from the pole, sea ice and frosted trees, while the other has summer. Leaves turn in autumn and blossom in spring.
 * Everything here is cosmetic and driven by the sky's clock, so the time-speed slider fast-forwards the year.
 */
export class Seasons {
  constructor(planet) {
    this.planet = planet;
    this.on = !!planet.theme.seasons;
    this.offset = ((planet.params.seed % 997) / 997) * TAU;
    this.timer = 0;
    this.winter = [0, 0];
    shared.uAxis.value.copy(planet.app.sky.axis);
    shared.uWinter.value.set(0, 0);
    this.trees = this.on ? planet.nature.treeGroups : [];
    this.update(0);
  }

  /** Angle through the year for the north (0 midsummer, π/2 autumn, π midwinter, 3π/2 spring). */
  get angle() { return this.planet.app.sky.angle / YEAR + this.offset; }

  /** Season angle for the hemisphere of direction d. */
  angleAt(d) { return this.angle + (d.dot(this.planet.app.sky.axis) < 0 ? Math.PI : 0); }

  /** 0..1 winter snow cover at unit direction d (matches the terrain shader, without its ragged edge). */
  snowAt(d, lift = 0) {
    if (!this.on) return 0;
    const lat = d.dot(this.planet.app.sky.axis), w = this.winter[lat > 0 ? 0 : 1];
    const edge = 1.05 - 0.5 * w - Math.max(lift, 0) * 0.18;
    return smoothstep(edge, edge + 0.04, Math.abs(lat));
  }

  /** "🍂 Autumn" for wherever `pos` is, or '' on worlds without seasons. */
  nameAt(pos) {
    if (!this.on) return '';
    const a = ((this.angleAt(_v.copy(pos).normalize()) % TAU) + TAU) % TAU;
    const [icon, name] = NAMES[Math.round(a / (TAU / 4)) % 4];
    return `${icon} ${name}`;
  }

  update(dt) {
    if (!this.on) return;
    const a = this.angle;
    this.winter = [Math.max(0, -Math.cos(a)), Math.max(0, Math.cos(a))];
    shared.uWinter.value.set(...this.winter);
    if ((this.timer -= dt) > 0) return;
    this.timer = RECOLOR;
    this.paintTrees();
    const app = this.planet.app;
    app.hud?.setSeason?.(this.nameAt(app.camera.position));
  }

  paintTrees() {
    const p = this.planet, axis = p.app.sky.axis;
    for (const { mesh, list, deciduous } of this.trees) {
      list.forEach((t, i) => {
        const lat = Math.abs(t.d.dot(axis)), seasonal = smoothstep(0.15, 0.4, lat); // little change in the tropics
        const a = this.angleAt(t.d), autumn = Math.max(0, Math.sin(a)) * seasonal, spring = Math.max(0, -Math.sin(a)) * seasonal;
        _c.copy(t.base);
        if (deciduous) {
          if (autumn > 0) _c.lerp(AUTUMN[t.pick % AUTUMN.length], Math.min(1, autumn * 1.4));
          if (spring > 0) _c.lerp(t.pick % 5 < 2 ? BLOSSOM[t.pick % BLOSSOM.length] : FRESH, Math.min(1, spring * 1.3));
        }
        const snow = this.snowAt(t.d, p.heightAt(t.d));
        if (snow > 0) _c.lerp(FROST, snow * (deciduous ? 0.8 : 0.6));
        mesh.setColorAt(i, _c);
      });
      mesh.instanceColor.needsUpdate = true;
    }
  }

  dispose() { shared.uWinter.value.set(0, 0); }
}
