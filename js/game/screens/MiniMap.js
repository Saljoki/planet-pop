import * as THREE from 'three';
import { R, TAU, tangentBasis } from '../../core/Geo.js';
import { MapGlobe } from '../../render/MapGlobe.js';
import { Widget } from '../../ui/Widget.js';

/** How much of the planet the map shows: half its width, in world units, by what's being driven (tap: ×FAR). */
const ZOOM = { car: 1.8, boat: 2.8, plane: 4.2 }, FAR = 2.6;
const PINK = '#ff5fa2', INK = '#1b1530';
const _x = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3(), _vp = new THREE.Vector4();
const NORTH = new THREE.Vector3(0, 1, 0);

/**
 * 🗺️ The mini-map in a corner of the game: a round, heading-up map of the planet round the player (MapGlobe draws
 * the land, towns and roads into the game's own canvas), with the player's arrow in the middle and what matters on
 * top: where to go (the HUD arrow's goal), the delivery beacon, pickups and drop-offs, rings, race checkpoints, Rex,
 * town names and north. Tap it to zoom out and back in. 🗺️ or M shows and hides it (remembered, for small screens).
 */
export class MiniMap extends Widget {
  constructor(game) {
    super({ id: 'gMap', parent: game.el, html: '<canvas id="gMapInk"></canvas>' });
    this.game = game;
    this.far = false;
    this.globe = null;
    this.rect = null;
    this.ink = this.$('gMapInk');
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 60);
    game.el.insertAdjacentHTML('beforeend', '<button id="gMapBtn" title="Show or hide the map (M)">🗺️</button>');
    this.button = game.el.querySelector('#gMapBtn');
    this.button?.addEventListener('click', () => this.toggleShown());
    this.el.addEventListener('click', () => { this.far = !this.far; });
    addEventListener('resize', () => { this.rect = null; });
    game.app.settings?.onChange((key) => { if (key === 'minimap' && game.active) this.sync(); });
  }

  get wanted() { return this.game.app.settings?.get('minimap') ?? true; }

  /** A run is starting: a map of this planet (made once per planet), showing if the player wants it. */
  begin() {
    const planet = this.game.planet;
    if (this.mapOf !== planet) {
      this.globe?.dispose();
      this.globe = new MapGlobe(planet);
      this.mapOf = planet;
    }
    this.far = false;
    this.sync();
  }

  end() { this.hide(); }

  sync() {
    this.toggle(this.wanted);
    this.button?.classList.toggle('on', this.wanted);
    this.rect = null;
  }

  /** The 🗺️ button and M: show or hide it, and remember. */
  toggleShown() { this.game.app.settings?.set('minimap', !this.wanted); this.sync(); }

  /** Half the width of the map (world units). */
  get span() { return (ZOOM[this.game.player?.kind] ?? ZOOM.car) * (this.far ? FAR : 1); }

  /** Where the map sits on screen (CSS pixels), measured once and again after a resize or showing it. */
  measure() {
    const b = this.ink.getBoundingClientRect?.();
    return b && b.width ? { left: b.left, top: b.top, size: b.width } : null;
  }

  /** Once a frame, after the planet is drawn: the map into its corner of the canvas, then the marks over it. */
  render(renderer) {
    const pl = this.game.player;
    if (!this.open || !pl || !this.globe) return;
    const rect = (this.rect ??= this.measure());
    if (!rect) return;
    const k = this.span, up = pl.up, cam = this.cam;
    this.orient();
    cam.position.copy(up).multiplyScalar(R + 20);
    cam.up.copy(_f);
    cam.lookAt(0, 0, 0);
    Object.assign(cam, { left: -k, right: k, top: k, bottom: -k });
    cam.updateProjectionMatrix();

    const pr = renderer.getPixelRatio(), H = renderer.domElement.clientHeight || innerHeight, s = rect.size;
    const x = rect.left, y = H - rect.top - s;
    this.globe.mask.set((x + s / 2) * pr, (y + s / 2) * pr, (s / 2) * pr);
    this.globe.setInk((2 * k) / R / (s * pr));
    const auto = renderer.autoClear;
    renderer.getViewport(_vp);
    renderer.autoClear = false;
    renderer.setRenderTarget(null);
    renderer.setViewport(x, y, s, s);
    renderer.setScissor(x, y, s, s);
    renderer.setScissorTest(true);
    renderer.clearDepth();
    renderer.render(this.globe.scene, cam);
    renderer.setScissorTest(false);
    renderer.setViewport(_vp);
    renderer.autoClear = auto;
    this.drawMarks(s, k);
  }

  /** Heading up: the map's up is the way the player is facing (along the ground), its right their right. */
  orient() {
    const pl = this.game.player, up = pl.up;
    _f.copy(pl.fwd).addScaledVector(up, -pl.fwd.dot(up));
    if (_f.lengthSq() < 1e-8) _f.copy(tangentBasis(up)[0]);
    _f.normalize();
    _x.crossVectors(_f, up);
  }

  /** Pixel position on the map (from its top left) of a point on the planet, or on the rim if it's off the map. */
  place(pos, half, scale, out) {
    _n.copy(pos).normalize();
    const mx = _n.dot(_x), my = _n.dot(_f), rim = half - 8;
    let px = mx * R * scale, py = my * R * scale;
    const far = _n.dot(this.game.player.up) < 0 || Math.hypot(px, py) > rim;
    if (far) {
      const l = Math.hypot(mx, my);
      if (l < 1e-6) return null;
      px = (mx / l) * rim;
      py = (my / l) * rim;
    }
    out.x = half + px;
    out.y = half - py;
    out.far = far;
    return out;
  }

  /** The marks over the map: what matters in this run, town names, north, and the player in the middle. */
  drawMarks(s, k) {
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1), cv = this.ink, size = Math.round(s * dpr);
    if (cv.width !== size) { cv.width = size; cv.height = size; }
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, s, s);
    const half = s / 2, scale = half / k, g = this.game, props = g.props, run = g.run, at = { x: 0, y: 0, far: false };
    const t = g.app.simTime ?? 0;

    ctx.font = '12px Bangers, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineJoin = 'round';
    for (const site of g.planet.cities.sites) { // town names
      if (!this.place(site.c, half, scale, at) || at.far) continue;
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff';
      ctx.strokeText(site.name, at.x, at.y + 4);
      ctx.fillStyle = INK;
      ctx.fillText(site.name, at.x, at.y + 4);
    }
    const dot = (x, y, r, fill, line = INK, w = 2) => {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.lineWidth = w;
      ctx.strokeStyle = line;
      ctx.stroke();
    };
    if (props) {
      for (const ring of props.rings) if (this.place(ring.position, half, scale, at) && !at.far) dot(at.x, at.y, 3.5, null, '#3fa7ff', 2.5);
      props.gates.forEach((gate, i) => {
        if (!gate.visible || !this.place(gate.position, half, scale, at) || at.far) return;
        const last = i === props.gates.length - 1;
        dot(at.x, at.y, 4, last ? PINK : gate === props.nextGate ? '#ffd23f' : '#fff');
      });
      if (props.pad.visible && this.place(props.pad.position, half, scale, at)) dot(at.x, at.y, 5, props.person.visible ? '#2ee59d' : PINK);
      if (props.beacon.visible && this.place(props.beacon.position, half, scale, at)) this.pin(ctx, at, PINK);
    }
    const rex = run?.rival || run?.rex;
    if (rex && this.place(rex.pos, half, scale, at)) dot(at.x, at.y, 4, '#ff4d4d');
    const hud = g.hud;
    if (hud.hasGoal && this.place(hud.goal, half, scale, at)) dot(at.x, at.y, 7 + Math.sin(t * 5) * 1.5, null, PINK, 3);

    _n.copy(NORTH);
    if (Math.abs(g.player.up.dot(NORTH)) < 0.995) { // north, on the rim
      const l = Math.hypot(_n.dot(_x), _n.dot(_f)), nx = half + (_n.dot(_x) / l) * (half - 9), ny = half - (_n.dot(_f) / l) * (half - 9);
      dot(nx, ny, 7, '#fff', INK, 1.5);
      ctx.fillStyle = INK;
      ctx.font = '11px Bangers, sans-serif';
      ctx.fillText('N', nx, ny + 4);
    }
    // the player, in the middle, heading up
    ctx.beginPath();
    ctx.moveTo(half, half - 9);
    ctx.lineTo(half + 7, half + 7);
    ctx.lineTo(half, half + 3);
    ctx.lineTo(half - 7, half + 7);
    ctx.closePath();
    ctx.fillStyle = '#ffd23f';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }

  /** A map pin (the delivery), pointing at `at`. */
  pin(ctx, at, colour) {
    const { x, y } = at;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - 9, y - 9, x - 7, y - 19, x, y - 19);
    ctx.bezierCurveTo(x + 7, y - 19, x + 9, y - 9, x, y);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y - 12, 3, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }
}
