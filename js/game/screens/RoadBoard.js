import { Overlay } from '../../ui/Overlay.js';

/** Everything on wheels (and the boat), from the hangar's 🚗 Road trips button. `opts` start the run (see runs/modes.js). */
export const ROAD_TRIPS = [
  { id: 'drive', icon: '🚗', name: 'Free drive', desc: 'No clock, no score: highways, fields, hills. Go anywhere.', opts: { drive: 'car' } },
  { id: 'taxi', icon: '🚕', name: 'Taxi', desc: 'Pick up people waiting at the edge of town and drive them to the next. Quick and careful pays best.', opts: { road: 'taxi' } },
  { id: 'van', icon: '🚐', name: 'Van courier', desc: 'Parcels by road between nearby towns, against the clock.', opts: { road: 'van' } },
  { id: 'race', icon: '🏁', name: 'Round the world', desc: 'Race Rex once round the planet on the highway, through every checkpoint.', opts: { road: 'race' } },
  { id: 'sail', icon: '⛵', name: 'Free sail', desc: 'Take a boat out on the open sea.', opts: { drive: 'boat' }, needs: 'sea' },
];

/** The road trips: pick one and go. Free sail only shows on worlds with a sea to sail, and a giant has none at all. */
export class RoadBoard extends Overlay {
  constructor(app, onPlay) {
    super({ id: 'roads', html: `
      <button class="close" id="rClose" title="Close">✕</button>
      <h2>🚗 Road trips</h2>
      <p class="note">Your hangar upgrades work on the road too.</p>
      <div id="rList"></div>` });
    this.app = app;
    this.list = this.$('rList');
    this.on('rClose', 'click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-trip]');
      if (!b) return;
      this.hide();
      onPlay(ROAD_TRIPS.find((t) => t.id === b.dataset.trip).opts);
    });
  }

  show() { this.render(); super.show(); }

  render() {
    const sea = !!this.app.planet?.theme.sea.boats, world = this.app.planet?.world;
    if (world?.giant) { // (nothing to drive on)
      this.list.innerHTML = `<p class="note">🌫️ ${world.name} has no ground at all, so there are no roads. Fly to a world with ground for a road trip.</p>`;
      return;
    }
    this.list.innerHTML = ROAD_TRIPS.filter((t) => t.needs !== 'sea' || sea).map((t) => `<div class="mission"><span class="icon">${t.icon}</span>
      <div class="info">${t.name}<small>${t.desc}</small></div><button data-trip="${t.id}" class="big">▶ Go</button></div>`).join('');
  }
}
