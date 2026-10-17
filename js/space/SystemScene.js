import * as THREE from 'three';
import { LAYER_FX, canvasTexture } from '../core/Geo.js';
import { toon } from '../render/Toon.js';
import { mulberry32 } from '../core/Noise.js';
import { BODIES } from './Bodies.js';
import { position, moonAngle, orbitAngle, mapPosition } from './Orbits.js';
import { BodyArt } from './BodyArt.js';

const DEG = Math.PI / 180;
const EARTH_W = 12756;
const MOON_GAP = 4.2;       // the Moon's distance from Earth on the map (times Earth's drawn size; other moons say their own gap)
const MIN_SIZE = 0.009;     // nothing is drawn smaller than this much of its distance from the camera (times √size)
const AWAY = new THREE.Vector3(620, 160, 560); // where a made-up planet "beyond the solar system" shows
const _v = new THREE.Vector3(), _a = [0, 0, 0];

/** How big a body is drawn on the map: the square root of its real width, Earth 1.6 (the Sun is set by hand). */
export const mapSize = (b) => b.size ?? 1.6 * Math.sqrt(b.width / EARTH_W);

/**
 * The 3D system map: the Sun with its light, every body from Bodies.js as a globe with its own picture, orbit lines,
 * the asteroid and Kuiper belts, and (on a made-up planet) where that planet is. place(ms) puts everything where it
 * really is on that date; distances and sizes are squeezed (see Orbits.mapPosition and mapSize).
 */
export class SystemScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.AmbientLight('#8a7fd0', 0.35));
    const sun = new THREE.PointLight('#fff4dd', 3, 0, 0); // (no fall-off: the outer planets stay lit)
    this.scene.add(sun);
    this.sphere = new THREE.SphereGeometry(1, 48, 32);
    this.bodies = BODIES.map((b) => this.makeBody(b));
    this.byId = Object.fromEntries(this.bodies.map((b) => [b.def.id, b]));
    this.away = this.makeBody({ id: 'away', name: 'This planet', icon: '🪐', size: 1.6, look: { kind: 'rock', color: '#ffffff', spots: '#cfc8ea' } });
    this.away.group.visible = false;
    this.buildOrbits();
    this.belts = [this.belt(1400, 2.1, 3.3, 0.06, '#c3b6e6', 1.6, 7), this.belt(900, 30, 48, 0.12, '#8fa7d9', 1.4, 31)];
    this.spin = 0;
  }

  /** A globe (tilted on its axis, with rings if it has them), or the Sun with its glow. */
  makeBody(def) {
    const group = new THREE.Group(), tilt = new THREE.Group(), size = mapSize(def);
    tilt.rotation.z = (def.tilt ?? 0) * DEG;
    group.add(tilt);
    this.scene.add(group);
    let mesh;
    if (def.look.kind === 'sun') {
      mesh = new THREE.Mesh(this.sphere, new THREE.MeshBasicMaterial({ color: def.look.color }));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: SystemScene.glowTexture(), color: '#ffb84a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      glow.scale.setScalar(5.5);
      glow.layers.set(LAYER_FX);
      mesh.add(glow);
    } else {
      mesh = new THREE.Mesh(this.sphere, toon('#ffffff', { map: BodyArt.texture(def.look, def.id) }));
    }
    tilt.add(mesh);
    if (def.look.rings) tilt.add(this.rings(def.look.rings));
    return { def, group, tilt, mesh, size, pos: group.position, scale: 1, turn: Math.random() * Math.PI * 2 };
  }

  /** Three bands of ring, unlit (they're ice and dust), on the planet's equator. */
  rings(color) {
    const g = new THREE.Group();
    [[1.3, 1.6, 0.55], [1.65, 2.05, 0.85], [2.1, 2.3, 0.45]].forEach(([a, b, o]) => {
      const m = new THREE.Mesh(new THREE.RingGeometry(a, b, 72, 1), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.layers.set(LAYER_FX);
      g.add(m);
    });
    return g;
  }

  /** The whole path of each orbit, from its elements on the date (they barely change in a lifetime). */
  buildOrbits() {
    const now = Date.now();
    this.orbits = new THREE.Group();
    for (const b of BODIES) {
      if (!b.orbit) continue;
      const pts = [];
      for (let k = 0; k <= 256; k++) pts.push(new THREE.Vector3(...mapPosition(position(b.orbit, now, (k / 256) * Math.PI * 2), _a)));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: b.id === 'pluto' ? '#8f86c9' : '#b7aef0', transparent: true, opacity: b.id === 'pluto' ? 0.35 : 0.5 }));
      line.layers.set(LAYER_FX);
      this.orbits.add(line);
    }
    this.scene.add(this.orbits);
  }

  /** A ring of dots between a and b au from the Sun (squeezed like everything else), a little thick. */
  belt(n, a, b, thick, color, px, seed) {
    const rng = mulberry32(seed), pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = a + (b - a) * rng(), t = rng() * Math.PI * 2, k = 100 / Math.sqrt(r);
      pos.set([Math.cos(t) * r * k, (rng() - 0.5) * thick * 2 * r * k * 0.5, -Math.sin(t) * r * k], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: px, sizeAttenuation: false, transparent: true, opacity: 0.8, depthWrite: false }));
    pts.layers.set(LAYER_FX);
    this.scene.add(pts);
    return { pts, period: Math.sqrt(((a + b) / 2) ** 3) * 365.25 }; // (days round the Sun: Kepler's third law)
  }

  static glowTexture() {
    return (SystemScene.glow ??= canvasTexture(128, 128, (ctx, w) => {
      const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.25, 'rgba(255,220,140,0.5)');
      g.addColorStop(1, 'rgba(255,200,100,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, w);
    }));
  }

  /** A made-up planet to show where we are (out beyond the solar system), or null to hide it. */
  setAway(name, color) {
    this.away.group.visible = !!name;
    if (!name) return;
    this.away.def.name = name;
    this.away.mesh.material.color.set(color);
  }

  /** Every body where it really is at time `ms`, drawn no smaller than a dot from where `camera` is. */
  place(ms, camera) {
    for (const b of this.bodies) if (b.def.orbit) b.pos.set(...mapPosition(position(b.def.orbit, ms), _a));
    this.away.pos.copy(AWAY);
    for (const b of [...this.bodies, this.away]) this.scaleFor(b, camera);
    for (const moon of this.bodies) { // each moon round its planet, near side towards it
      if (!moon.def.parent) continue;
      const host = this.byId[moon.def.parent], a = moon.def.days ? orbitAngle(moon.def, ms) : moonAngle(ms);
      const gap = (moon.def.gap ?? MOON_GAP) * host.size * host.scale;
      moon.pos.set(host.pos.x + Math.cos(a) * gap, host.pos.y, host.pos.z - Math.sin(a) * gap);
      moon.mesh.rotation.y = Math.atan2(-(host.pos.z - moon.pos.z), host.pos.x - moon.pos.x);
    }
    const days = (ms - Date.now()) / 86400000;
    for (const belt of this.belts) belt.pts.rotation.y = (days / belt.period) * Math.PI * 2;
  }

  scaleFor(b, camera) {
    const d = camera.position.distanceTo(b.pos), min = d * MIN_SIZE * Math.sqrt(b.size / 1.6);
    b.scale = Math.max(1, min / b.size);
    b.tilt.scale.setScalar(b.size * b.scale);
  }

  /** Each globe turns: faster for a shorter day (squeezed, so even Venus moves a little); dt in seconds. */
  update(dt) {
    for (const b of this.bodies) {
      if (!b.def.hours || b.def.parent) continue; // (a moon keeps one face to its planet)
      b.mesh.rotation.y += dt * 0.6 * Math.sqrt(24 / b.def.hours);
    }
    this.away.mesh.rotation.y += dt * 0.4;
  }

  /** The body drawn nearest to screen point (x, y), within reach of a finger, or null. */
  pick(x, y, camera) {
    let best = null, bestD = Infinity;
    for (const b of [...this.bodies, this.away]) {
      if (!b.group.visible) continue;
      const s = this.toScreen(b.pos, camera);
      if (!s) continue;
      const d = Math.hypot(s[0] - x, s[1] - y), reach = Math.max(28, this.screenRadius(b, camera) + 12);
      if (d < reach && d < bestD) { best = b; bestD = d; }
    }
    return best;
  }

  /** Screen position (CSS pixels) of a point, or null when it's behind the camera. */
  toScreen(p, camera) {
    _v.copy(p).project(camera);
    if (_v.z > 1) return null;
    return [((_v.x + 1) / 2) * innerWidth, ((1 - _v.y) / 2) * innerHeight];
  }

  /** How big a body looks, in CSS pixels across its radius. */
  screenRadius(b, camera) {
    const d = camera.position.distanceTo(b.pos) || 1;
    return (b.size * b.scale * innerHeight) / (2 * d * Math.tan((camera.fov * DEG) / 2));
  }
}
