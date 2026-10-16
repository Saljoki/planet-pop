import { SystemScene } from './SystemScene.js';
import { MapView } from './MapView.js';
import { SystemBar, SPEEDS } from '../ui/SystemBar.js';
import { MapLabels } from '../ui/MapLabels.js';
import { WorldCard } from '../ui/WorldCard.js';
import { Cruise } from './Cruise.js';

const DAY = 86400000;

/**
 * The system map (🪐, M, or zoom out past the edge): our solar system on today's date, drawn in place of the planet.
 * The planet stays as it was underneath and comes back when the map closes. Built the first time it opens.
 * state: 'closed', 'opening' (zooming out from our world), 'open', 'closing' (zooming back in), or 'cruise' (a trip's
 * ship crossing it: see Cruise).
 */
export class SystemMap {
  constructor(app) {
    this.app = app;
    this.state = 'closed';
    this.date = Date.now();
    this.speed = 1; // index into SPEEDS
    this.scene = null;
    addEventListener('keydown', (e) => {
      if (e.code !== 'Escape' || this.state !== 'open') return;
      if (this.card.open) this.card.hide();
      else this.close();
    });
  }

  get open() { return this.state !== 'closed'; }

  /** What takes the drags and pinches: the map's camera, or the ship while cruising. */
  get input() { return this.state === 'cruise' ? this.cruiser : this.view; }

  build() {
    this.scene = new SystemScene();
    this.view = new MapView();
    this.view.onZoomIn = () => { if (this.view.focus === this.here) this.close(); };
    this.bar = new SystemBar(this, this.app.hud.touch);
    this.labels = new MapLabels(this);
    this.labels.build([...this.scene.bodies, this.scene.away]);
    this.card = new WorldCard(this);
  }

  /** The body for the world we're on (a made-up planet is shown out beyond the solar system). */
  get here() {
    const w = this.app.planet?.world;
    return w ? this.scene.byId[w.id] : this.scene.away;
  }

  /** Whether the map can open now (not during a run, a photo, or while a planet builds). */
  get allowed() {
    const a = this.app;
    return !!a.planet && !a.building && !a.game.active && !a.photo?.active && !a.trip?.active;
  }

  toggle() { if (this.open) this.close(); else this.show(); }

  /** Open the map, zooming out from our world to the inner planets. */
  show() {
    if (this.open || !this.allowed) return false;
    const app = this.app;
    if (!this.scene) this.build();
    app.tour?.stop();
    app.hud.info.hide();
    app.find?.hide();
    app.hud.hideLabel();
    const p = app.planet;
    this.scene.setAway(p.world ? null : `Planet ${p.params.seed}`, p.theme.pal.g1);
    this.date = Date.now();
    this.scene.place(this.date, this.view.camera);
    const here = this.here;
    this.bar.setHere(here);
    this.view.set(here, { dist: here.size * 12, pitch: 0.3 });
    this.view.update(0);
    this.scene.place(this.date, this.view.camera);
    this.state = 'opening';
    const far = here === this.scene.away ? 1900 : Math.max(280, here.pos.length() * 2.6);
    this.view.glideTo(null, { dist: far, pitch: 0.95 }, 2.2, () => { this.state = 'open'; });
    document.body.classList.add('in-map');
    this.bar.show();
    this.labels.show();
    this.bar.update();
    return true;
  }

  /** Back to the world we're on, zooming in on it (instant: straight away, for a trip or a new planet). */
  close(instant = false) {
    if (!this.open || (this.state === 'closing' && !instant)) return;
    this.card.hide();
    if (this.state === 'cruise') { this.cruiser.end(); instant = true; }
    const done = () => {
      this.state = 'closed';
      document.body.classList.remove('in-map');
      this.bar.hide();
      this.labels.hide();
    };
    if (instant) { done(); return; }
    this.state = 'closing';
    this.view.glideTo(this.here, { dist: this.here.size * 12 }, 1.1, done);
  }

  /** Back to where everything is today. */
  today() {
    this.date = Date.now();
    this.bar.update();
    if (this.card.open) this.card.refresh();
  }

  /** Off to another world: by rocket. */
  travel(id) { this.app.trip.go(id); }

  /**
   * Straight into a trip's cruise (no zooming out): the ship flies from body `fromId` ('away' for a made-up planet) to
   * `toId`, on today's positions, with the clock stopped. onArrive() once it gets there.
   */
  cruise(fromId, toId, onArrive) {
    if (!this.scene) this.build();
    this.cruiser ??= new Cruise(this.app, this);
    this.card.hide();
    const p = this.app.planet;
    this.scene.setAway(p?.world ? null : `Planet ${p?.params.seed}`, p?.theme.pal.g1 ?? '#ffffff');
    this.date = Date.now();
    this.scene.place(this.date, this.view.camera);
    const from = fromId === 'away' ? this.scene.away : this.scene.byId[fromId];
    this.state = 'cruise';
    document.body.classList.add('in-map');
    this.bar.hide();
    this.labels.show();
    this.cruiser.begin(from, this.scene.byId[toId], onArrive);
    this.scene.place(this.date, this.view.camera);
  }

  /** Centre on a body and show its card. */
  select(b) {
    if (this.state !== 'open') return;
    const dist = b.def.id === 'sun' ? 70 : b.def.id === 'earth' ? b.size * 16 : b.size * 9;
    this.view.glideTo(b, { dist }, 1.2);
    this.card.show(b);
    this.app.haptics?.buzz('tap');
  }

  /** A tap on the map: that body's card, or nothing under the finger closes the card. */
  tap(x, y) {
    if (this.state !== 'open') return;
    const b = this.scene.pick(x, y, this.view.camera);
    if (b) this.select(b);
    else this.card.hide();
  }

  /** Double tap: that body, or just closer. */
  zoomAt(x, y) {
    if (this.state !== 'open') return;
    const b = this.scene.pick(x, y, this.view.camera);
    if (b) this.select(b);
    else this.view.glideTo(this.view.focus, { dist: this.view.dist * 0.5 }, 0.6);
  }

  /** The pointer over a body shows a hand. */
  hover(x, y) {
    if (this.state !== 'open') return;
    this.app.renderer.domElement.style.cursor = this.scene.pick(x, y, this.view.camera) ? 'pointer' : '';
  }

  /** dt: real seconds. The clock runs while the map is open (not while paused). */
  update(dt) {
    if (this.state === 'cruise') {
      this.scene.update(dt);
      this.cruiser.update(this.app.paused ? 0 : dt);
      this.scene.place(this.date, this.view.camera);
      this.labels.update();
      return;
    }
    if (this.state === 'open' && !this.app.paused) {
      this.date += dt * DAY * SPEEDS[this.speed];
      this.barT = (this.barT ?? 0) - dt;
      if (this.barT <= 0) { this.barT = 0.25; this.bar.update(); }
    }
    this.scene.update(dt);
    this.view.update(dt);
    this.scene.place(this.date, this.view.camera);
    this.labels.update();
    this.card.update(dt);
    this.view.clear(this.card.open ? this.card.el.getBoundingClientRect?.() : null);
  }

  render(postfx) { postfx.render(this.scene.scene, this.view.camera); }
}
