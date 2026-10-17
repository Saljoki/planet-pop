import * as THREE from 'three';
import { R, TAU, LAYER_FX, frame, tangentBasis, canvasTexture } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { addMesh, addInstanced } from '../render/Outline.js';
import { PointEntity } from '../core/PointEntity.js';
import { Trails } from '../life/Trails.js';
import { CITY_A } from './Cities.js';
import { fromLatLon } from '../core/WorldShape.js';

const S = 1.2, H = 1.6, RIM = 0.4, BOMBS = 24, GRAVITY = 0.9;
const NAMES = ['Mt. Kaboom', 'Mt. Grumble', 'Mt. Fizzle', 'Mt. Sizzle'];
const ERUPTION = 6, RUMBLE = 5;
const _p = new THREE.Vector3(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();

/** The usual look: a purple-grey cone, orange lava and grey smoke (a theme's `volcano` changes it). */
const LOOK = { cone: '#7a668f', lava: '#ff7a2e', glow: '#ff7a2e', smoke: '#8a7f9e', bombs: '#ffb21f' };

/**
 * A volcano that smokes all day and erupts every minute or so, throwing glowing lava bombs. A real world can say
 * where its volcanoes are and what they're called (world.volcanoes: Io's), and its theme what they're made of
 * (Io's sulphur plumes; on Europa a low cone of ice that throws up water).
 */
export class Volcano {
  /** empty: a stand-in that never erupts, for worlds without volcanoes. */
  constructor(planet, index = 0, empty = false) {
    this.planet = planet;
    this.entities = [];
    this.state = 'calm';
    this.timer = 30 + index * 17 + Math.random() * 20; // several volcanoes take turns
    const real = !empty && planet.world?.volcanoes?.[index];
    const d = real ? new THREE.Vector3(...fromLatLon(real.lat, real.lon)) : !empty && this.find();
    if (!d) return;
    this.look = { ...LOOK, ...planet.theme.volcano };
    this.d = d;
    this.fwd = tangentBasis(d)[0];
    this.base = planet.surfR(d) - 0.3;
    this.hgt = Math.min(H * (this.look.low ? 0.45 : 1), R + 2.3 - this.base);
    this.top = d.clone().multiplyScalar(this.base + this.hgt - 0.12);
    this.name = real ? real.name : NAMES[(index + planet.rng.int(0, NAMES.length - 1)) % NAMES.length];
    planet.reserve(d, (S + 0.2) / R);
    this.cone = { d, s: S, base: this.base, hgt: this.hgt, volcano: true }; // for collision (Planet.groundR)
    this.build();
  }

  /** The highest open ground well away from towns, roads, the railway and airport approaches. */
  find() {
    const p = this.planet, rng = p.rng, m = p.railway.mountain;
    let best = null, bestH = 0.25;
    for (let tries = 0; tries < 2500; tries++) {
      const d = rng.dir(), h = p.heightAt(d);
      if (h < bestH) continue;
      if (p.roads.near(d, (S + 0.4) / R) || p.railway.near(d, (S + 0.3) / R) || p.isReserved(d, S / R + 0.05)) continue;
      if (p.cities.sites.some((s) => s.c.angleTo(d) < CITY_A + (S + 0.6) / R)) continue;
      if (p.keepClear.some((k) => k.d.angleTo(d) < k.ang + S / R)) continue;
      if (m && m.d.angleTo(d) < (m.s + S) / R + 0.05) continue;
      best = d;
      bestH = h;
    }
    return best;
  }

  build() {
    const p = this.planet, root = p.root, h = this.hgt;
    const g = (this.group = new THREE.Group());
    g.matrixAutoUpdate = false;
    frame(g.matrix, _p.copy(this.d).multiplyScalar(this.base), this.d, this.fwd);
    g.matrixWorldNeedsUpdate = true;
    root.add(g);
    // a broad cone with concave flanks and a wide, shallow crater (a narrow top reads as a chimney)
    const profile = [[S, 0], [S * 0.72, h * 0.3], [S * 0.5, h * 0.62], [RIM * 1.15, h * 0.9], [RIM, h], [RIM * 0.8, h - 0.08], [RIM * 0.55, h - 0.17], [0, h - 0.19]];
    const look = this.look;
    addMesh(g, new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 11), toon(look.cone, { flatShading: true }), 0.04);
    const lava = new THREE.Mesh(new THREE.CircleGeometry(RIM * 0.62, 11).rotateX(-Math.PI / 2).translate(0, h - 0.16, 0), new THREE.MeshBasicMaterial({ color: look.lava }));
    g.add(lava);

    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: look.glow, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    this.glow.position.copy(this.d).multiplyScalar(this.base + h + 0.25);
    this.glow.scale.setScalar(2.2);
    this.glow.layers.set(LAYER_FX);
    root.add(this.glow);

    this.smoke = new Trails(root, { max: 220, color: look.smoke, life: 4.5, grow: 3.5, drag: 0.25 });
    this.smokeT = 0;
    this.bombs = Array.from({ length: BOMBS }, () => ({ live: false, p: new THREE.Vector3(), v: new THREE.Vector3() }));
    this.bombMesh = addInstanced(root, new THREE.IcosahedronGeometry(0.06, 0), new THREE.MeshBasicMaterial({ color: look.bombs }), BOMBS, 0.006, { cast: false });
    this.bombT = 0;
    this.entity = new PointEntity(this.top.clone().addScaledVector(this.d, 0.3), 'volcano', this.name, this.fwd);
    this.entities.push(this.entity);
    this.updateBombs(0);
  }

  /** 0..1: how thick the ash is at `pos` (an erupting volcano's plume rises above the crater). */
  ashAt(pos) {
    if (this.state !== 'erupt' || !this.d) return 0;
    const along = pos.dot(this.d) - this.top.length();
    if (along < -0.2 || along > 3.5) return 0;
    const off = _w.copy(pos).addScaledVector(this.d, -pos.dot(this.d)).length(); // distance from the plume's axis
    return Math.max(0, 1 - off / (0.6 + along * 0.25));
  }

  update(dt) {
    if (!this.d) return;
    const p = this.planet, app = p.app, night = p.nightAt(this.top);
    this.timer -= dt;
    if (this.state === 'calm' && this.timer < RUMBLE) {
      this.state = 'rumble';
      if (!app.game?.active) app.hud?.toast(`🌋 ${this.name} is rumbling! Click it to watch the eruption.`);
      app.sfx?.pop(this.top.clone(), 'RUMBLE…', '#a39bbd');
    } else if (this.state === 'rumble' && this.timer <= 0) {
      this.erupt();
    } else if (this.state === 'erupt' && this.timer <= -ERUPTION) {
      this.state = 'calm';
      this.timer = 50 + Math.random() * 30;
    }
    const erupting = this.state === 'erupt';
    this.glow.material.opacity = Math.min(1, night * 0.7 + (erupting ? 0.6 : 0));
    if ((this.smokeT -= dt) <= 0) { // a lazy plume, thick and dark during an eruption
      this.smokeT = erupting ? 0.05 : this.state === 'rumble' ? 0.18 : 0.4;
      _v.copy(this.d).multiplyScalar(erupting ? 0.9 : 0.25).add(_w.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(0.15));
      this.smoke.emit(this.top, erupting ? 0.14 : 0.07, _v);
    }
    if (erupting && (this.bombT -= dt) <= 0) { this.bombT = 0.12; this.launchBomb(); }
    this.smoke.update(dt);
    this.updateBombs(dt);
  }

  erupt() {
    const app = this.planet.app, cam = app.camera.position;
    this.state = 'erupt';
    const near = cam.distanceTo(this.top) < 8 || app.rig?.entity === this.entity;
    if (near) {
      app.hud?.flash?.();
      app.achievements?.unlock('volcano');
    }
    if (_v.copy(cam).normalize().dot(this.d) > 0.3) app.sfx?.pop(this.top.clone().addScaledVector(this.d, 0.4), 'KABOOM!', '#ff4d4d', 'boom');
  }

  launchBomb() {
    const b = this.bombs.find((x) => !x.live);
    if (!b) return;
    const [u, v] = tangentBasis(this.d), a = Math.random() * TAU, s = 0.25 + Math.random() * 0.45;
    b.live = true;
    b.p.copy(this.top);
    b.v.copy(this.d).multiplyScalar(1.3 + Math.random() * 0.6).addScaledVector(u, Math.cos(a) * s).addScaledVector(v, Math.sin(a) * s);
  }

  updateBombs(dt) {
    const p = this.planet;
    this.bombs.forEach((b, i) => {
      if (b.live) {
        b.v.addScaledVector(_v.copy(b.p).normalize(), -GRAVITY * dt);
        b.p.addScaledVector(b.v, dt);
        if (b.v.dot(b.p) < 0 && b.p.length() < p.groundR(_v.copy(b.p).normalize()) + 0.03) { // splat
          b.live = false;
          this.smoke.emit(b.p, 0.05, _v.multiplyScalar(0.1));
        }
      }
      this.bombMesh.setMatrixAt(i, b.live ? _m.makeTranslation(b.p.x, b.p.y, b.p.z) : _m.makeScale(0, 0, 0));
    });
    this.bombMesh.instanceMatrix.needsUpdate = true;
  }
}

function glowTexture() {
  return canvasTexture(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}
