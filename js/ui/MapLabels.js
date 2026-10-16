import { Widget } from './Widget.js';

/**
 * A name tag over every body on the system map, kept clear of each other (the bigger body wins a squeeze, and the
 * one in focus and the one we're on always show). Tags are buttons: tapping one is the same as tapping its world.
 */
export class MapLabels extends Widget {
  constructor(map) {
    super({ id: 'mapLabels' });
    this.map = map;
    this.tags = [];
  }

  /** One tag per body (call again if the bodies change). */
  build(bodies) {
    this.el.innerHTML = '';
    this.tags = bodies.map((b) => {
      const el = document.createElement('button');
      el.className = 'mapLabel';
      el.addEventListener('click', () => this.map.select(b));
      this.el.append(el);
      return { b, el, text: '' };
    });
  }

  update() {
    const map = this.map, scene = map.scene, cam = map.view.camera, here = map.here, focus = map.view.focus;
    const rank = (t) => (t.b === focus ? 1e4 : 0) + (t.b === here ? 1e3 : 0) + t.b.size;
    const placed = [];
    for (const t of [...this.tags].sort((a, b) => rank(b) - rank(a))) {
      const s = t.b.group.visible && scene.toScreen(t.b.pos, cam);
      const x = s?.[0], y = s && s[1] - scene.screenRadius(t.b, cam) - 6;
      const show = !!s && x > -40 && x < innerWidth + 40 && y > 0 && y < innerHeight + 40
        && !placed.some(([px, py]) => Math.abs(px - x) < 74 && Math.abs(py - y) < 24);
      t.el.classList.toggle('hidden', !show);
      if (!show) continue;
      placed.push([x, y]);
      const text = `${t.b === here ? '📍 ' : ''}${t.b.def.icon} ${t.b.def.name}`;
      if (text !== t.text) { t.text = text; t.el.textContent = text; }
      t.el.classList.toggle('here', t.b === here);
      t.el.style.left = `${x.toFixed(1)}px`;
      t.el.style.top = `${y.toFixed(1)}px`;
    }
  }
}
