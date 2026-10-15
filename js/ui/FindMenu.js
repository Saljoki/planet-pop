import { happenings, findable } from '../world/Happenings.js';
import { KINDS } from './InfoCard.js';
import { Widget } from './Widget.js';

const PLURAL = { city: 'Towns', moon: 'Moon', station: 'Space station', rocket: 'Rocket', train: 'Train', volcano: 'Volcanoes' };

/**
 * 📍 Find: everything worth seeing in one list, so nobody has to hunt for a tiny whale on a phone screen.
 * "Happening now" lists live events; below, a button per kind of thing (each tap visits the next one) and the towns.
 */
export class FindMenu extends Widget {
  constructor(app) {
    super({ id: 'find', className: 'panel sheet', html: `<div class="grab"></div><div class="fHead"><h3>📍 Find</h3><button id="fClose" title="Close">✕</button></div>
      <button id="fTour" class="big">📺 Take the tour</button>
      <h4>Happening now</h4><div id="fNow"></div>
      <h4>Take me to…</h4><div id="fKinds" class="chips"></div>
      <h4>Towns</h4><div id="fTowns" class="chips"></div>` });
    this.app = app;
    this.cursor = {}; // per kind: which one to visit next
    this.dom = { now: this.$('fNow'), kinds: this.$('fKinds'), towns: this.$('fTowns') };
    this.on('fClose', 'click', () => this.hide());
    this.on('fTour', 'click', () => { this.hide(); app.tour.start(); });
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-go]');
      if (b) this.go(b.dataset.go);
    });
    addEventListener('keydown', (e) => {
      if (e.target?.tagName === 'INPUT' || app.game.active) return;
      if (e.code === 'KeyF') this.toggle();
      else if (e.code === 'Escape' && this.open) this.hide();
    });
  }

  toggle() { if (this.open) this.hide(); else this.show(); }

  show() {
    if (!this.app.planet || this.app.game.active) return;
    this.app.hud.closePanel?.();
    this.render();
    super.show();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.renderNow(), 2000);
  }

  hide() {
    clearInterval(this.timer);
    super.hide();
  }

  render() {
    const p = this.app.planet, kinds = findable(p);
    this.list = { now: [], kinds };
    this.renderNow();
    this.dom.kinds.innerHTML = [...kinds].filter(([, l]) => l.length).map(([k, l]) => {
      const [icon, name] = KINDS[k];
      const label = l.length > 1 ? `${PLURAL[k] ?? `${name}s`} <small>${l.length}</small>` : PLURAL[k] ?? name;
      return `<button data-go="kind:${k}">${icon} ${label}</button>`;
    }).join('');
    this.dom.towns.innerHTML = p.cities.sites.map((s, i) => `<button data-go="town:${i}">🏙️ ${s.name}</button>`).join('');
  }

  renderNow() {
    if (!this.app.planet) return;
    const now = (this.list.now = happenings(this.app.planet));
    this.dom.now.innerHTML = now.length
      ? now.map((h, i) => `<button class="event" data-go="now:${i}">${h.icon} ${h.text}</button>`).join('')
      : '<p class="quiet">All quiet right now. The tour will catch the next big moment.</p>';
  }

  /** Fly to the chosen thing and close the menu. */
  go(what) {
    const [type, key] = what.split(':'), rig = this.app.rig, p = this.app.planet;
    let target = null;
    if (type === 'now') target = this.list.now[+key];
    else if (type === 'town') target = { entity: p.cities.entities[+key] };
    else if (type === 'kind') {
      const list = this.list.kinds.get(key) || [], i = (this.cursor[key] ?? -1) + 1;
      this.cursor[key] = i % Math.max(1, list.length);
      target = { entity: list[this.cursor[key]] };
      if (key === 'whale') p.whales.showOff(p.whales.entities.indexOf(target.entity)); // come up and say hello
    }
    if (!target) return;
    this.hide();
    if (target.view) rig.orbitTo(target.view);
    else if (target.entity) rig.focus(target.entity);
  }
}
