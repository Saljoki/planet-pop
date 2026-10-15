import * as THREE from 'three';
import { TAU } from '../core/Geo.js';
import { Sparks } from './Sparks.js';

const SHOW = 12, CHANCE = 0.65, MIDNIGHT = -0.97, DAWN = 0.3;
const COLORS = ['#ff4d6d', '#ffd23f', '#3fa7ff', '#2ee59d', '#ff8c42', '#d27bff', '#ffffff'];
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _u = new THREE.Vector3();

/** Around midnight most cities put on a firework show: rockets climb, burst into falling sparks, and crackle. */
export class Fireworks {
  constructor(planet) {
    this.planet = planet;
    this.sparks = new Sparks(planet.root, 2000, 0.16);
    this.rockets = [];
    this.cities = planet.cities.sites.map((city) => ({ city, armed: true, show: 0, next: 0 }));
  }

  /** Seconds left of a show over `city` (0 if none). */
  showAt(city) { return this.cities.find((c) => c.city === city)?.show || 0; }

  start(c) {
    c.show = SHOW;
    c.next = 0;
    const app = this.planet.app;
    if (app.camera.position.distanceTo(c.city.pos) < 7 || app.rig?.entity?.name === c.city.name) {
      app.hud?.toast(`🎆 Midnight fireworks over ${c.city.name}!`);
    }
  }

  launch(city) {
    const up = _u.copy(city.c), [a, b] = [Math.random() * TAU, Math.random() * 0.06];
    const side = _w.set(Math.cos(a), Math.sin(a), Math.cos(a * 1.7)).cross(up).normalize();
    const p = city.pos.clone().addScaledVector(side, (Math.random() - 0.5) * 0.9);
    const v = up.clone().multiplyScalar(1.5 + Math.random() * 0.6).addScaledVector(side, b * 10);
    this.rockets.push({ p, v, fuse: 0.75 + Math.random() * 0.45, color: COLORS[Math.floor(Math.random() * COLORS.length)] });
  }

  burst(r) {
    const app = this.planet.app, alt = COLORS[Math.floor(Math.random() * COLORS.length)], n = 70 + Math.floor(Math.random() * 30);
    const speed = 0.9 + Math.random() * 0.45;
    for (let i = 0; i < n; i++) {
      _v.randomDirection().multiplyScalar(speed * (0.85 + Math.random() * 0.3)).add(r.v.clone().multiplyScalar(0.15));
      this.sparks.emit(r.p, _v, i % 3 ? r.color : alt, 1.5 + Math.random() * 0.7);
    }
    const near = app.camera.position.distanceTo(r.p) < 7;
    if (near) {
      app.sfx?.play('firework');
      app.achievements?.unlock('fireworks');
      if (Math.random() < 0.25) app.sfx?.pop(r.p.clone(), ['BOOM!', 'POP!', 'CRACKLE!', 'WHEEE!'][Math.floor(Math.random() * 4)], r.color, 'none');
    }
  }

  update(dt) {
    const sky = this.planet.app.sky;
    for (const c of this.cities) {
      const s = sky.clock(c.city.c); // local time, so high-latitude towns get their midnight too
      if (c.armed && s < MIDNIGHT) { c.armed = false; if (Math.random() < CHANCE) this.start(c); }
      else if (!c.armed && s > DAWN) c.armed = true;
      if (c.show <= 0) continue;
      c.show -= dt;
      if ((c.next -= dt) <= 0) { c.next = 0.3 + Math.random() * 0.6; this.launch(c.city); }
    }
    this.rockets = this.rockets.filter((r) => {
      r.p.addScaledVector(r.v, dt);
      r.v.multiplyScalar(Math.exp(-dt * 0.6));
      this.sparks.emit(r.p, _w.copy(r.v).multiplyScalar(-0.1), '#ffd9a0', 0.35); // the rocket's sparkly tail
      if ((r.fuse -= dt) > 0) return true;
      this.burst(r);
      return false;
    });
    this.sparks.update(dt);
  }
}
