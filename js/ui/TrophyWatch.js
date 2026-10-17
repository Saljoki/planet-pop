/**
 * Trophies for watching things on the planet. To add one: give it an entry in Achievements' list, then a rule here.
 * ON_ARRIVE: kind of thing → trophy, unlocked when the camera arrives to follow one.
 * WHILE_FOLLOWING: checked every frame while following something of that kind; `when(e, planet, seconds)` says
 * whether it's earned yet (seconds = how long it has been followed).
 */
const ON_ARRIVE = { bird: 'birdwatcher', station: 'astronaut', person: 'peoplewatcher', ufo: 'ufo', moon: 'moonwalker', rolling: 'terminus' };
const WHILE_FOLLOWING = [
  { id: 'earthrise', kind: 'moon', when: (e, p) => p.world?.id === 'moon' && e.name === 'Earth' },
  { id: 'icehotel', kind: 'landmark', when: (e) => e.name === 'The Ice Hotel' },
  { id: 'copilot', kind: 'plane', when: (e, p, t) => t > 10 },
  { id: 'chopper', kind: 'helicopter', when: (e, p, t) => t > 10 },
  { id: 'tramride', kind: 'tram', when: (e, p, t) => t > 3 && p.trams.atEnd(p.trams.entities.indexOf(e)) },
  { id: 'tunnel', kind: 'train', when: (e, p) => p.railway.justExited },
  { id: 'redlight', kind: 'car', when: (e, p) => e.mesh === p.traffic.body && p.traffic.isWaiting(e.id) },
  { id: 'nightowl', kind: 'city', when: (e, p) => p.nightAt(e.pos) > 0.6 },
  { id: 'snowday', kind: 'city', when: (e, p) => p.seasons.snowAt(e.pos.clone().normalize()) > 0.5 },
];

export class TrophyWatch {
  constructor(app) {
    this.app = app;
  }

  /** The camera has arrived at something and is following it. */
  arrived(e) {
    const a = this.app.achievements;
    if (ON_ARRIVE[e.kind]) a.unlock(ON_ARRIVE[e.kind]);
    if (e.kind === 'city') a.visitCity(e.name); // all of a planet's towns, for the tourist trophy
  }

  /** Every frame. */
  update() {
    const { rig, planet: p, achievements: a } = this.app, e = rig.entity;
    if (!p || rig.mode !== 'local' || !e) return;
    for (const rule of WHILE_FOLLOWING) if (rule.kind === e.kind && rule.when(e, p, rig.followTime)) a.unlock(rule.id);
  }
}
