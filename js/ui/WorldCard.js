import { Widget } from './Widget.js';
import { BODIES, bodyOf } from '../space/Bodies.js';
import { position } from '../space/Orbits.js';

const PLANETS = BODIES.filter((b) => b.orbit && b.id !== 'pluto').map((b) => b.id);
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];
const AU = 149.6; // million km
const num = (n) => n.toLocaleString('en-GB');

/** What kind of body it is, in a few words. */
function kindOf(def) {
  if (def.id === 'sun') return 'Our star';
  if (def.id === 'away') return 'A made-up planet, from beyond the solar system';
  if (def.parent) return `${bodyOf(def.parent).name}’s moon`;
  if (def.id === 'pluto') return 'Dwarf planet, out beyond Neptune';
  return `Planet, ${ORDINAL[PLANETS.indexOf(def.id)]} from the Sun`;
}

/**
 * The card for a body on the system map: its real numbers (NASA's), how far away it is on the date the map shows,
 * and the way there: Travel here, Back down (the world we're on), or a note that landing comes later.
 */
export class WorldCard extends Widget {
  constructor(map) {
    super({ id: 'worldCard', className: 'panel', html: `<div class="wHead"><span id="wIcon"></span><div><b id="wName"></b><small id="wKind"></small></div>
      <button id="wClose">✕</button></div><p id="wFacts"></p><div id="wStats"></div><p id="wNow" class="quiet"></p>
      <button id="wGo" class="big"></button>
      <p class="quiet">Sizes and distances on the map are squeezed to fit a screen; the numbers on this card are real.</p>` });
    this.map = map;
    this.body = null;
    this.on('wClose', 'click', () => this.hide());
    this.on('wGo', 'click', () => this.go());
    this.dom = { icon: this.$('wIcon'), name: this.$('wName'), kind: this.$('wKind'), facts: this.$('wFacts'), stats: this.$('wStats'), now: this.$('wNow'), go: this.$('wGo') };
  }

  get open() { return !!this.body; }

  show(body) {
    const def = body.def, d = this.dom;
    this.body = body;
    d.icon.textContent = def.icon;
    d.name.textContent = def.name;
    d.kind.textContent = kindOf(def);
    d.facts.textContent = def.facts ?? '';
    const stats = [
      def.width && ['Width', `${num(def.width)} km`],
      def.day && ['A day', def.day],
      def.year && ['A year', def.year],
      def.gravity && ['Gravity', `${def.gravity} × Earth’s`],
      def.temp !== undefined && ['Average', `${def.temp}°C`],
    ].filter(Boolean);
    d.stats.innerHTML = stats.map(([k, v]) => `<span>${k}</span><b>${v}</b>`).join(''); // (our own numbers, from Bodies.js)
    this.refresh();
    super.show();
  }

  hide() {
    this.body = null;
    super.hide();
  }

  /** The button: where it takes you from here. */
  goal() {
    const def = this.body.def, map = this.map;
    if (this.body === map.here) return { text: `⬇️ Back down to ${def.name}`, act: () => map.close() };
    if (def.world) return { text: `🚀 Travel to ${def.name}`, act: () => map.travel(def.world) };
    if (def.id === 'sun') return { text: '🔥 Far too hot to visit!', act: null };
    return { text: '🚧 Landing here comes later', act: null };
  }

  go() { if (this.body) this.goal().act?.(); }

  /** The numbers that change with the date (twice a second while open). */
  update(dt) {
    if (this.body && (this.t = (this.t ?? 0) - dt) <= 0) { this.t = 0.5; this.refresh(); }
  }

  refresh() {
    const def = this.body.def, d = this.dom, ms = this.map.date, g = this.goal();
    d.go.textContent = g.text;
    d.go.disabled = !g.act;
    if (!def.orbit) {
      d.now.textContent = def.around ?? '';
      return;
    }
    const p = position(def.orbit, ms), e = position('earth', ms);
    const sun = Math.hypot(...p) * AU, earth = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]) * AU;
    const date = new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    d.now.textContent = def.id === 'earth' ? `On ${date}: ${num(Math.round(sun * 10) / 10)} million km from the Sun.`
      : `On ${date}: ${num(Math.round(sun))} million km from the Sun and ${num(Math.round(earth))} million km from Earth.`;
  }
}
