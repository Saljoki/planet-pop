import { Widget } from './Widget.js';

/** How fast the map's clock runs: days per second (the first is stopped). */
export const SPEEDS = [0, 1, 7, 30];
const SPEED_TEXT = ['⏸ Stopped', '▶ 1 day a second', '⏩ 1 week a second', '⏭ 1 month a second'];
const DAY = 86400000;

/** The system map's screen furniture: the date, its clock speed, Today, the 📦 parcel board, Back down, and the hint. */
export class SystemBar extends Widget {
  constructor(map, touch) {
    super({ id: 'mapUi', html: `
      <div id="mapBar" class="badge"><b>🪐 The Solar System</b><span id="mapDate"></span>
        <button id="mapSpeed" title="How fast the planets move"></button><button id="mapToday" class="hidden" title="Back to where everything is today">📅 Today</button>
        <button id="mapParcels" title="The space courier: parcels to other worlds">📦</button></div>
      <button id="mapBack"></button>
      <div id="mapHint" class="badge">${touch ? 'Drag to turn · Pinch to zoom · Tap a world for its card' : 'Drag to turn · Scroll to zoom · Click a world for its card'}</div>` });
    this.map = map;
    this.on('mapSpeed', 'click', () => { map.speed = (map.speed + 1) % SPEEDS.length; this.update(); });
    this.on('mapToday', 'click', () => map.today());
    this.on('mapBack', 'click', () => map.close());
    this.on('mapParcels', 'click', () => map.app.spaceCourier?.openBoard());
    this.dom = { date: this.$('mapDate'), speed: this.$('mapSpeed'), today: this.$('mapToday'), back: this.$('mapBack') };
  }

  /** Names the world we're on, for the way back. */
  setHere(body) { this.dom.back.textContent = `⬇️ Back to ${body.def.name}`; }

  update() {
    const m = this.map, d = this.dom;
    d.date.textContent = new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    d.speed.textContent = SPEED_TEXT[m.speed];
    d.today.classList.toggle('hidden', Math.abs(m.date - Date.now()) < DAY / 2);
  }
}
