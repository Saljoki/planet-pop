import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, run, assertFiniteInstances } from './helpers/world.mjs';
import { WORLDS } from '../js/space/Worlds.js';
import { BODIES } from '../js/space/Bodies.js';
import { position, moonAngle, mapPosition } from '../js/space/Orbits.js';
import { fromLatLon } from '../js/core/WorldShape.js';
import { SystemMap } from '../js/space/SystemMap.js';

const day = (iso) => Date.parse(`${iso}T12:00:00Z`);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const lon = ([x, y]) => ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

describe('the real solar system', () => {
  it('puts the planets where they really are', () => {
    const r = (id, iso) => Math.hypot(...position(id, day(iso)));
    assert.ok(Math.abs(r('earth', '2026-01-03') - 0.9833) < 0.002, 'Earth nearest the Sun in early January');
    assert.ok(Math.abs(r('earth', '2026-07-06') - 1.0167) < 0.002, 'and furthest in early July');
    for (const [id, a] of [['mercury', 0.387], ['venus', 0.723], ['mars', 1.524], ['jupiter', 5.2], ['neptune', 30.07]]) {
      const d = r(id, '2026-10-16');
      assert.ok(d > a * 0.75 && d < a * 1.25, `${id} at ${d} au`);
    }
    // Mars comes closest at opposition: 12 January 2025, then 19 February 2027
    for (const [iso, from, to] of [['2025-01-12', '2024-12-01', '2025-02-20'], ['2027-02-19', '2027-01-01', '2027-04-10']]) {
      let best = null;
      for (let t = day(from); t < day(to); t += 86400000) {
        const d = dist(position('mars', t), position('earth', t));
        if (!best || d < best.d) best = { t, d };
      }
      assert.ok(Math.abs(best.t - day(iso)) < 10 * 86400000, `Mars closest on ${new Date(best.t).toISOString()}, not ${iso}`);
    }
  });

  it('has the Moon full when it is opposite the Sun', () => {
    for (const iso of ['2024-01-25', '2026-10-26']) { // full moons
      const t = day(iso), sunOpposite = lon(position('earth', t)); // (seen from Earth, the full Moon is where Earth is seen from the Sun)
      const off = Math.abs((((moonAngle(t) * 180) / Math.PI - sunOpposite + 540) % 360) - 180);
      assert.ok(off < 15, `the Moon ${off.toFixed(1)}° from full on ${iso}`);
    }
  });

  it('squeezes the map but keeps the order', () => {
    const t = day('2026-10-16'), out = BODIES.filter((b) => b.orbit).map((b) => [b.id, Math.hypot(...mapPosition(position(b.orbit, t)))]);
    for (let i = 1; i < out.length - 1; i++) assert.ok(out[i][1] > out[i - 1][1], `${out[i][0]} beyond ${out[i - 1][0]}`);
    assert.ok(Math.abs(out.find(([id]) => id === 'earth')[1] - 100) < 1);
    assert.ok(out.at(-2)[1] < 600, 'Neptune within reach');
  });
});

describe('real worlds', () => {
  it('Earth has its continents where they really are', async () => {
    const { app, planet } = await makeWorld({ world: 'earth' });
    const h = (lat, lng) => planet.hf.height(...fromLatLon(lat, lng));
    for (const [name, lat, lng] of [['London', 51.5, -0.1], ['Lahore', 31.5, 74.3], ['Nairobi', -1.3, 36.8], ['Chicago', 41.9, -87.6], ['Sydney', -33.9, 150.6]]) {
      assert.ok(h(lat, lng) > 0, `${name} is under the sea`);
    }
    for (const [name, lat, lng] of [['mid-Atlantic', 30, -40], ['mid-Pacific', 0, -150], ['Indian Ocean', -20, 75]]) assert.ok(h(lat, lng) < 0, `${name} is dry`);
    assert.ok(h(28, 86.9) > h(51.5, -0.1) + 0.3, 'the Himalaya stand above London');
    assert.equal(planet.world.id, 'earth');
    assert.equal(planet.params.seed, WORLDS.earth.seed, 'a real world always has its own seed');
    assert.ok(planet.landmarks.entities.some((e) => e.name === 'Mount Everest'));
    run(app, 10);
    assertFiniteInstances(planet.root, 'earth');
  });

  it('the Moon: no air, no sea, its dark seas, the first landing site', async () => {
    const { app, planet } = await makeWorld({ world: 'moon' });
    assert.equal(planet.theme.id, 'moon');
    assert.ok(!planet.terrain.ocean, 'an ocean on the Moon');
    assert.equal(planet.boats.boats.length, 0);
    assert.equal(planet.birds.flocks?.length ?? 0, 0);
    assert.equal(planet.weather.storms.length, 0);
    assert.ok(!planet.volcanoes.length && !planet.volcano.d, 'a volcano on the Moon');
    const shape = planet.hf.shape, [x, y, z] = fromLatLon(8.5, 31.4);
    assert.equal(shape.paint(x, y, z), 'mare', 'Mare Tranquillitatis is dark');
    assert.ok(planet.landmarks.entities.some((e) => e.name === 'Tranquility Base'));
    for (let i = 0; i < 400; i++) { // nowhere below the floor: no sea to fall into
      const d = fromLatLon(Math.asin(2 * ((i * 0.618) % 1) - 1) * 57.3, (i * 137.5) % 360 - 180);
      assert.ok(planet.hf.height(...d) >= WORLDS.moon.shape.floor - 1e-9);
    }
    run(app, 10);
    assertFiniteInstances(planet.root, 'moon');
  });

  it('Mars: Olympus Mons towers, Hellas sinks', async () => {
    const { planet } = await makeWorld({ world: 'mars' });
    const at = (lat, lng) => planet.hf.height(...fromLatLon(lat, lng));
    assert.ok(at(18.65, -133.8) > at(-42.4, 70.5) + 0.8);
    const [x, y, z] = fromLatLon(18.65, -133.8);
    assert.ok(planet.nature.mountains.some((m) => m.d.x * x + m.d.y * y + m.d.z * z > Math.cos(0.03)), 'a cone on the summit');
    assert.equal(planet.theme.air, 'thin');
    assert.equal(planet.space.moons.length, 2, 'Phobos and Deimos');
  });
});

describe('real summits', () => {
  for (const id of ['earth', 'mars']) {
    it(`${id}: every famous summit gets its mountain`, async () => {
      const { planet } = await makeWorld({ world: id });
      for (const k of WORLDS[id].peaks) {
        const [x, y, z] = fromLatLon(k.lat, k.lon);
        assert.ok(planet.nature.mountains.some((m) => m.d.x * x + m.d.y * y + m.d.z * z > Math.cos(0.02)), `no mountain at ${k.lat}, ${k.lon}`);
      }
    });
  }
});

describe('the system map', () => {
  it('opens from Mars, shows the right day, travels and closes', async () => {
    const { app } = await makeWorld({ world: 'mars' });
    const map = (app.map = new SystemMap(app));
    const went = [];
    app.visitWorld = (id) => went.push(id);
    assert.equal(map.show(), true);
    assert.equal(map.state, 'opening');
    for (let i = 0; i < 60 && map.state !== 'open'; i++) map.update(0.05);
    assert.equal(map.state, 'open');
    assert.equal(map.here.def.id, 'mars');
    assert.ok(Math.abs(map.date - Date.now()) < 5 * 86400000, 'the map starts on today');
    const mars = map.scene.byId.mars.pos, want = mapPosition(position('mars', map.date));
    assert.ok(dist(mars.toArray(), want) < 1e-6, 'Mars where its orbit says');
    const earth = map.scene.byId.earth, moon = map.scene.byId.moon;
    assert.ok(moon.pos.distanceTo(earth.pos) < 20, 'the Moon beside Earth');

    map.select(earth);
    assert.equal(map.card.body, earth);
    assert.equal(map.card.goal().text, '🚀 Travel to Earth');
    map.select(map.scene.byId.jupiter);
    assert.equal(map.card.goal().act, null, 'no landing on Jupiter yet');
    map.select(map.here);
    assert.match(map.card.goal().text, /Back down/);

    const before = map.date;
    map.update(1);
    assert.ok(map.date - before > 0.9 * 86400000, 'a day a second');
    map.select(earth);
    map.card.go();
    assert.deepEqual(went, ['earth']);
    assert.equal(map.state, 'closed');

    map.show();
    map.close();
    for (let i = 0; i < 60 && map.state !== 'closed'; i++) map.update(0.05);
    assert.equal(map.state, 'closed');
  });

  it("won't open over a run", async () => {
    const { app } = await makeWorld({ world: 'earth' });
    app.map = new SystemMap(app);
    app.game.active = true;
    assert.equal(app.map.show(), false);
  });
});
