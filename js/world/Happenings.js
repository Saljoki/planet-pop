const WHALE = { rise: ['is coming up for air', 5], blow: ['is blowing a spout', 6], breach: ['is leaping out of the sea!', 8] };

/** An orbit view (for the camera rig) looking out from low over unit direction d. */
function lowView(d, alt, tilt) {
  return { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(Math.max(-1, Math.min(1, d.y))), alt, tilt, heading: 0 };
}

/**
 * What's going on around the planet right now, best first, for the Find menu and the tour.
 * Each happening: { id, icon, text, score, entity } to follow, or { …, view } for an orbit view (meteors, aurora).
 */
export function happenings(planet) {
  const p = planet, app = p.app, out = [], sun = app.sky.sunDir;
  const add = (id, icon, text, score, target) => { if (target) out.push({ id, icon, text, score, ...target }); };
  const city = (site) => ({ entity: p.cities.entities[p.cities.sites.indexOf(site)] });

  if (p.ufo?.hovering) add('ufo', '🛸', 'A UFO is hovering. Catch it before it goes!', 10, { entity: p.ufo.entity });
  for (const v of p.volcanoes || []) {
    if (v.state === 'erupt') add(`volcano:${v.name}`, '🌋', `${v.name} is erupting!`, 9, { entity: v.entity });
    else if (v.state === 'rumble') add(`volcano:${v.name}`, '🌋', `${v.name} is rumbling…`, 6, { entity: v.entity });
  }
  if (p.space?.state === 'countdown' || p.space?.state === 'flight') {
    add('rocket', '🚀', p.space.state === 'flight' ? 'Lift-off! The rocket is heading for space' : 'The rocket is counting down', 9, { entity: p.space.rocketEntity });
  }
  for (const f of p.fireworks?.cities || []) if (f.show > 0) add(`fireworks:${f.city.name}`, '🎆', `Midnight fireworks over ${f.city.name}`, 9, city(f.city));
  if (p.meteors?.active) {
    const d = sun.clone().negate().addScaledVector(app.sky.axis, 0.3).normalize();
    add('meteors', '🌠', 'A meteor shower on the night side', 7, { view: lowView(d, 3, 0.85) });
  }
  (p.rainbows?.list || []).forEach((r, i) => {
    if (p.rainbows.strength(i) < 0.4) return;
    add(`rainbow:${i}`, '🌈', 'A rainbow beside a rain cloud', 7, { entity: p.weather.entities.find((e) => e.storm === r.storm) });
  });
  (p.whales?.list || []).forEach((w, i) => {
    const [what, score] = WHALE[w.state] || [];
    if (what) add(`whale:${i}`, '🐋', `${p.whales.entities[i].name} ${what}`, score, { entity: p.whales.entities[i] });
  });
  (p.planes?.list || []).forEach((pl, i) => {
    if (pl.ap && pl.wait > 0) add(`plane:${i}`, '🛫', `${p.planes.entities[i].name} is about to take off from ${pl.ap.name}`, 5, { entity: p.planes.entities[i] });
  });
  (p.helicopters?.list || []).forEach((h, i) => {
    if (h.state === 'hover') add(`helicopter:${i}`, '🚁', `${p.helicopters.entities[i].name} is hovering over ${h.at.name}`, 4, { entity: p.helicopters.entities[i] });
  });
  // the aurora: whichever pole is in the dark
  for (const s of [1, -1]) {
    const pole = app.sky.axis.clone().multiplyScalar(s);
    if (pole.dot(sun) < -0.1) {
      const d = pole.clone().multiplyScalar(Math.cos(0.95)).addScaledVector(sun, -Math.sin(0.95)).normalize();
      add(`aurora:${s}`, '🌌', `Northern lights over the ${s > 0 ? 'north' : 'south'} pole`, 4, { view: lowView(d, 3.2, 0.7) });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Every kind of thing worth finding, with how many there are, for the Find menu. */
export const FIND_KINDS = ['city', 'train', 'tram', 'plane', 'helicopter', 'boat', 'whale', 'balloon', 'bird', 'airport', 'harbour',
  'volcano', 'rocket', 'satellite', 'station', 'moon', 'landmark'];

export function findable(planet) {
  const byKind = new Map(FIND_KINDS.map((k) => [k, []]));
  for (const e of planet.entities) {
    byKind.get(e.kind)?.push(e);
  }
  return byKind;
}
