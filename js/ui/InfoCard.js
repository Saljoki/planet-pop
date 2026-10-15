import { Widget } from './Widget.js';

/** Icon and plain name for each kind of thing on the planet. */
export const KINDS = {
  city: ['🏙️', 'Town'], car: ['🚗', 'Car'], person: ['🚶', 'Townsperson'], tram: ['🚋', 'Tram'], train: ['🚂', 'Steam train'],
  plane: ['✈️', 'Airliner'], helicopter: ['🚁', 'Helicopter'], boat: ['🚢', 'Boat'], whale: ['🐋', 'Whale'], balloon: ['🎈', 'Balloon'],
  bird: ['🐦', 'Bird'], storm: ['⛈️', 'Rain cloud'], airport: ['🛬', 'Airport'], harbour: ['⚓', 'Harbour'], volcano: ['🌋', 'Volcano'],
  ufo: ['🛸', 'U.F.O.'], rocket: ['🚀', 'Rocket'], satellite: ['🛰️', 'Satellite'], station: ['🛰️', 'Space station'], moon: ['🌕', 'Moon'],
  spot: ['📍', 'Spot'],
};

const WHALE = { swim: 'Swimming deep down', rise: 'Coming up for air', blow: 'Blowing a spout', breach: 'Leaping out of the sea!', dive: 'Diving, tail in the air' };

/** What something is doing right now, in a few words. */
export function describe(e, p) {
  const at = (list, i) => list?.[i];
  switch (e.kind) {
    case 'car': return p.traffic.isWaiting(e.id) ? 'Waiting at a red light' : 'Driving along the highway';
    case 'person': return at(p.people.people, e.id)?.pause > 0 ? 'Stopping to look around' : 'Out for a stroll';
    case 'tram': {
      const t = at(p.trams.trams, p.trams.entities.indexOf(e));
      return t?.wait > 0 ? `At a stop in ${t.line.city.name}` : `Running through ${t?.line.city.name ?? 'town'}`;
    }
    case 'train': return p.railway.inTunnel?.(p.railway.phi) ? 'In the tunnel' : 'Puffing round the railway';
    case 'plane': {
      const pl = at(p.planes.list, e.id);
      return pl?.ap && pl.wait > 0 ? `Waiting at ${pl.ap.name}` : pl?.ap ? `Flying a lap from ${pl.ap.name}` : 'Cruising round the planet';
    }
    case 'helicopter': {
      const h = at(p.helicopters.list, e.id);
      return h?.state === 'hover' ? `Hovering over ${h.at.name}` : `Flying to ${h?.next?.name ?? 'the next town'}`;
    }
    case 'boat': return p.boats.isDocked(e.id) ? 'Tied up at the pier' : 'Steaming across the sea';
    case 'whale': return WHALE[at(p.whales.list, e.id)?.state] ?? 'Swimming';
    case 'volcano': return { erupt: 'Erupting!', rumble: 'Rumbling…' }[p.volcano.state] ?? 'Asleep, for now';
    case 'ufo': return p.ufo.hovering ? 'Hovering. Catch it before it goes!' : 'Zipping about';
    case 'rocket': return { countdown: 'Counting down', flight: 'Lift-off!' }[p.space.state] ?? 'On the launch pad';
    case 'city': return p.nightAt(e.pos) > 0.5 ? 'Lights on for the night' : 'Busy with the day';
    case 'storm': return 'Raining, with the odd lightning bolt';
    case 'balloon': return 'Drifting on the wind';
    case 'bird': return 'Flying with the flock';
    case 'airport': return 'Planes land and take off here';
    case 'harbour': return 'The ferry calls here';
    case 'satellite': return 'Orbiting the planet';
    case 'station': return 'Orbiting with its solar wings out';
    case 'moon': return 'Keeping an eye on things';
    default: return '';
  }
}

/** A card about one thing (press and hold on phones): what it is, what it's up to, a Follow button, and Drive for cars and boats. */
export class InfoCard extends Widget {
  constructor(app) {
    super({ id: 'info', className: 'panel', html: `<div class="iHead"><span id="iIcon"></span><div><b id="iName"></b><small id="iKind"></small></div></div>
      <p id="iStatus"></p><div class="row"><button id="iFollow" class="big">👀 Follow</button><button id="iDrive" class="big drive hidden"></button>
      <button id="iClose">✕</button></div>` });
    this.app = app;
    this.entity = null;
    this.dom = { icon: this.$('iIcon'), name: this.$('iName'), kind: this.$('iKind'), status: this.$('iStatus') };
    this.on('iFollow', 'click', () => { const e = this.entity; this.hide(); if (e) app.rig.focus(e); });
    this.on('iClose', 'click', () => this.hide());
    this.drive = this.$('iDrive');
    this.on('iDrive', 'click', () => { const e = this.entity; this.hide(); if (e) app.game.driveThis(e); });
  }

  get open() { return !!this.entity; }

  show(e) {
    this.entity = e;
    const [icon, kind] = KINDS[e.kind] ?? ['❓', e.kind];
    this.dom.icon.textContent = icon;
    this.dom.name.textContent = e.name;
    this.dom.kind.textContent = kind;
    const drivable = { car: '🚗 Drive', boat: '⛵ Steer' }[e.kind];
    this.drive.classList.toggle('hidden', !drivable);
    if (drivable) this.drive.textContent = drivable;
    this.refresh();
    super.show();
    this.app.haptics?.buzz('tap');
  }

  hide() {
    this.entity = null;
    super.hide();
  }

  /** Keep the status line current while the card is up. */
  refresh() {
    if (this.entity && this.app.planet) this.dom.status.textContent = describe(this.entity, this.app.planet);
  }
}
