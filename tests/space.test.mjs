import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, run, assertFiniteInstances } from './helpers/world.mjs';
import { WORLDS } from '../js/space/Worlds.js';
import { BODIES } from '../js/space/Bodies.js';
import { position, moonAngle, mapPosition } from '../js/space/Orbits.js';
import { fromLatLon } from '../js/core/WorldShape.js';
import { SystemMap } from '../js/space/SystemMap.js';
import { Trip } from '../js/space/Trip.js';
import { SpaceCourier } from '../js/space/SpaceCourier.js';
import { App } from '../js/App.js';
import { ROAD_TRIPS } from '../js/game/screens/RoadBoard.js';

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
    app.trip = { go: (id) => { went.push(id); map.close(true); } };
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

/** The test world, with the parts of App a trip uses (building and swapping planets; no WebGL). */
async function travelApp(world) {
  const { app } = await makeWorld({ world });
  for (const k of ['buildPlanet', 'buildWorld', 'swapIn']) app[k] = App.prototype[k].bind(app);
  Object.assign(app, { warmUp: async () => {}, detail: { collect() {} }, updateUrl() {}, haptics: null });
  app.map = new SystemMap(app);
  app.trip = new Trip(app);
  app.spaceCourier = new SpaceCourier(app);
  return app;
}

/** Run the app's frame the way App.frame does (planet, trip, map or camera), letting the background build go on. */
async function fly(app, seconds, until = () => false) {
  const dt = 1 / 20;
  for (let t = 0; t < seconds && !until(); t += dt) {
    if (!app.map.open) {
      app.simTime += dt;
      app.sky.update(dt);
      app.planet.update(dt, app.simTime);
    }
    if (app.trip.active) app.trip.update(dt);
    app.spaceCourier?.update(dt);
    if (app.game.active) app.game.update(dt);
    if (app.map.open) app.map.update(dt);
    else app.rig.update(dt);
    if (Math.round(t / dt) % 10 === 0) await new Promise((r) => setTimeout(r, 0));
  }
}

describe('trips', () => {
  it('Earth to the Moon: board, lift off, cruise, land', async () => {
    const app = await travelApp('earth');
    const coins = app.game.progress.coins;
    assert.equal(app.trip.go('moon'), true);
    assert.equal(app.trip.state, 'countdown');
    assert.equal(app.planet.space.state, 'boarding', 'the rocket waits for us');
    assert.equal(app.trip.go('mars'), false, 'one trip at a time');
    await fly(app, 10, () => app.trip.state === 'cruise');
    assert.equal(app.trip.state, 'cruise');
    assert.equal(app.map.state, 'cruise');
    assert.equal(app.rig.view, app.map.cruiser, 'drags steer the ship');
    const c = app.map.cruiser;
    c.items.push({ star: true, s: c.s + 0.01, x: c.x, y: c.y, size: 0.13 });
    await fly(app, 0.2);
    assert.ok(c.stars >= 1, 'caught a fuel star');
    app.rig.view.dragVelocity(400, 0);
    assert.ok(c.x > 0.5, 'a drag moves the ship across');
    await fly(app, 60, () => app.trip.state === 'landing');
    assert.equal(app.trip.state, 'landing');
    assert.equal(app.planet.world.id, 'moon');
    assert.equal(app.params.world, 'moon');
    assert.equal(app.map.state, 'closed');
    assert.equal(app.sky.dayLength, WORLDS.moon.day);
    assert.equal(app.planet.space.state, 'landing');
    await fly(app, 10, () => !app.trip.active);
    assert.equal(app.trip.state, 'idle');
    assert.equal(app.planet.space.state, 'countdown', 'landed, and back to its own launches');
    assert.equal(app.game.progress.coins, coins + c.stars, 'a coin a star');
    assert.ok(app.trip.card.open, 'welcome, and what to do next');
    app.game.start({ drive: 'car', from: 'pad' });
    assert.ok(app.game.player.up.angleTo(app.planet.space.site.d) < 0.12, 'the rover waits by the pad');
    assert.equal(app.game.player.carKind, 'car');
    app.game.stop();
  });

  it('from a made-up planet, and not to where we are', async () => {
    const { app: made } = await makeWorld({ seed: 4242, land: 0.45, cities: 5, theme: 'classic' });
    made.map = new SystemMap(made);
    made.trip = new Trip(made);
    made.buildWorld = () => new Promise(() => {}); // (never finishes: the ship waits in orbit)
    assert.equal(made.trip.go('earth'), true);
    assert.equal(made.trip.from, 'away');
    made.trip.cruise();
    const c = made.map.cruiser;
    assert.equal(c.from, made.map.scene.away);
    c.s = c.len;
    made.map.update(0.05);
    assert.equal(made.trip.arrived, true);
    assert.equal(made.trip.state, 'cruise', 'waits in orbit until the world is built');

    const app = await travelApp('mars');
    assert.equal(app.trip.go('mars'), false);
  });
});

const STYLE = { moon: 'hopper', mars: 'glider', venus: 'plane', mercury: 'hopper', pluto: 'hopper' };

describe('getting about on the other worlds', () => {
  for (const world of Object.keys(STYLE)) {
    it(`${world}: every run starts and runs, in the vehicles that suit it`, async () => {
      localStorage.clear();
      const { app, planet } = await makeWorld({ world });
      const game = app.game;
      for (const opts of [{}, { free: true }, ...ROAD_TRIPS.filter((t) => t.needs !== 'sea').map((t) => t.opts)]) {
        game.start(opts);
        const pl = game.player;
        if (pl.kind === 'plane') assert.equal(pl.style, STYLE[world]);
        run(app, 6, { game: true, camera: true });
        assert.ok(game.active || game.over, `${JSON.stringify(opts)} ended at once`);
        assert.ok(Number.isFinite(pl.pos.x) && pl.pos.length() > 9, `${JSON.stringify(opts)}: the vehicle went astray`);
        game.stop();
      }
      assert.equal(planet.traffic.rover, world !== 'venus', 'rovers on the roads where there’s no air');
      assertFiniteInstances(planet.root, world);
    });
  }

  it('low gravity: off the same crest, a rover on the Moon flies further than a car on Earth', async () => {
    const hang = async (world) => {
      const { app } = await makeWorld({ world });
      app.game.start({ drive: 'car' });
      const car = app.game.player;
      car.alt += 0.05;
      car.airborne = true;
      car.vy = 0.6;
      let t = 0;
      while (car.airborne && t < 20) { car.fall(1 / 60); t += 1 / 60; }
      app.game.stop();
      return t;
    };
    const earth = await hang('earth'), moon = await hang('moon');
    assert.ok(moon > earth * 4, `in the air ${moon.toFixed(2)} s on the Moon, ${earth.toFixed(2)} s on Earth`);
  });
});

describe('Venus, Mercury and Pluto', () => {
  it('Venus: towns on rafts in a sea of cloud, joined by bridges; airships, acid storms, the Sun rising in the west', async () => {
    const { app, planet } = await makeWorld({ world: 'venus' });
    assert.equal(planet.cities.sites.length, WORLDS.venus.cities, 'a town on every raft');
    for (const s of planet.cities.sites) assert.ok(planet.heightAt(s.c) > 0.1, 'a town off its raft');
    assert.ok(planet.terrain.ocean, 'the cloud sea');
    assert.ok(planet.roads.list.every((r, i) => r.n.distanceTo(new planet.roads.list[0].n.constructor(...WORLDS.venus.roads[i]).normalize()) < 1e-9), 'the highways where the rafts are');
    assert.ok(planet.roads.list.some((r) => r.water.some(Boolean)), 'bridges over the clouds');
    assert.ok(planet.heightAt(planet.padSite.d) > 0.1, 'the spaceport on its raft');
    assert.equal(planet.birds.flocks.length, 0, 'birds on Venus');
    assert.equal(planet.boats.boats.length + planet.whales.list.length, 0);
    assert.ok(planet.balloons.blimp && planet.balloons.list.length > 0, 'airships');
    assert.ok(planet.weather.storms.length > 0, 'acid storms');
    assert.ok(planet.rafts.list.length >= planet.cities.sites.length * 5, 'balloons holding up the rafts');
    assert.ok(WORLDS.venus.day < 0, 'the Sun rises in the west');
    run(app, 10);
    assertFiniteInstances(planet.root, 'venus');
  });

  it('Mercury: Terminus rolls ahead of the sunrise, and the sunshine cooks you', async () => {
    const { app, planet } = await makeWorld({ world: 'mercury' });
    const town = planet.rolling, sky = app.sky, at = () => town.entities[0].getPos(app.camera.position.clone());
    app.sky.dayLength = WORLDS.mercury.day;
    for (const s of planet.cities.sites) assert.ok(!planet.inBand(s.c, 0.14), 'a town on the rails');
    for (let i = 0; i < 3; i++) {
      run(app, 60);
      const c = sky.clock(at());
      assert.ok(c < 0 && c > -0.5, `Terminus at clock ${c.toFixed(2)}: should be just before dawn`);
    }
    assert.ok(at().length() > planet.surfR(at().normalize()) + 0.2, 'up on its rails');
    const game = app.game;
    game.start({ drive: 'car' });
    const pl = game.player, sun = sky.sunDir.clone();
    pl.place(sun, pl.fwd);
    pl.alt = pl.ground.carR(pl.up);
    game.update(0.5);
    for (let i = 0; i < 40; i++) game.update(0.05);
    assert.ok(game.hazards.hot && pl.health < 0.97, 'cooking in the sunshine');
    const hurt = pl.health;
    pl.place(sun.clone().negate(), pl.fwd);
    pl.alt = pl.ground.carR(pl.up);
    for (let i = 0; i < 40; i++) game.update(0.05);
    assert.ok(!game.hazards.hot && Math.abs(pl.health - hurt) < 0.02, 'fine at night');
    game.stop();
  });

  it('Pluto: the heart, ice mountains, Charon in the sky, the ice hotel, the lightest gravity', async () => {
    const { app, planet } = await makeWorld({ world: 'pluto' });
    assert.equal(planet.hf.shape.paint(...fromLatLon(19.5, 178.7)), 'snow', 'the heart is bright');
    assert.equal(planet.hf.shape.paint(...fromLatLon(0, 90)), 'mare', 'Belton Regio is dark');
    assert.equal(planet.space.moons.length, 1, 'Charon');
    assert.ok(planet.landmarks.entities.some((e) => e.name === 'The Ice Hotel'));
    assert.ok(planet.padSite.d.angleTo(new planet.padSite.d.constructor(...fromLatLon(30, -175))) < 1e-6, 'the spaceport where Pluto says');
    assert.ok(Math.min(...Object.values(WORLDS).map((w) => w.gravity)) === WORLDS.pluto.gravity);
    run(app, 10);
    assertFiniteInstances(planet.root, 'pluto');
  });
});

describe('the space courier', () => {
  it('a parcel from Earth to the Moon: the board, the trip on the clock, the last stretch by rover, paid', async () => {
    localStorage.clear();
    const app = await travelApp('earth'), courier = app.spaceCourier, game = app.game;
    const offers = courier.currentOffers();
    assert.equal(offers.length, 3);
    assert.ok(offers.every((o) => o.to !== 'earth' && o.pay > 0 && o.limit > 60), 'three parcels to other worlds');
    assert.deepEqual(courier.currentOffers(), offers, 'the same until one is taken');
    const far = courier.offer('earth', 'pluto', () => 0.1), near = courier.offer('earth', 'moon', () => 0.1);
    assert.ok(far.pay > near.pay * 3 && far.limit > near.limit, 'further pays more, and allows more time');
    const offer = { ...courier.offer('earth', 'moon', () => 0.1), what: '🍕 Pizza' };
    assert.equal(courier.take(offer), true);
    assert.equal(app.trip.state, 'countdown', 'off by rocket straight away');
    assert.equal(courier.take(offer), false, 'one parcel at a time');
    await fly(app, 90, () => app.trip.state === 'idle' && app.planet.world.id === 'moon');
    assert.equal(app.planet.world.id, 'moon');
    const job = courier.job;
    assert.ok(job.left < job.limit - 8, 'the clock ran through the trip');
    assert.ok(courier.due && app.trip.card.parcel, 'the landing card offers the way to town');
    const coins = game.progress.coins;
    game.start({ space: true, drive: 'car' });
    assert.equal(game.run.constructor.name, 'SpaceDropRun');
    assert.equal(game.player.kind, 'car');
    const run = game.run, left = job.left;
    game.update(1);
    assert.ok(job.left < left, 'the clock carries on');
    const pl = game.player;
    pl.place(run.stop.at, pl.fwd);
    pl.alt = pl.ground.carR(pl.up);
    pl.v = 0;
    game.update(1 / 60);
    assert.ok(game.over, 'handed over at the pad');
    assert.equal(courier.job, null);
    assert.ok(game.progress.coins >= coins + offer.pay, 'paid in full, on time');
    assert.equal(courier.streak, 1);
    assert.match(game.results.dom.title.textContent, /Delivered/);
    assert.equal(game.results.dom.again.textContent, '📦 Next parcel');
    game.stop();
  });

  it('late pays half, and a broken parcel nothing', async () => {
    const app = await travelApp('mars'), courier = app.spaceCourier, game = app.game;
    courier.job = { ...courier.offer('earth', 'mars', () => 0.1), left: -5, broken: false };
    const pay = courier.job.pay, coins = game.progress.coins;
    let r = courier.deliver();
    assert.equal(r.coins, Math.round(pay / 2));
    assert.equal(game.progress.coins, coins + Math.round(pay / 2));
    courier.job = { ...courier.offer('earth', 'mars', () => 0.5), left: 50, broken: true };
    r = courier.deliver();
    assert.equal(r.coins, 0);
    assert.equal(courier.streak, 0);
    courier.job = { ...courier.offer('venus', 'mars', () => 0.1), left: 50, broken: false };
    game.start({ space: true });
    assert.equal(game.player.kind, 'plane');
    assert.equal(game.player.style, 'glider');
    const run = game.run, pl = game.player;
    pl.up.copy(run.town.c);
    pl.alt = app.planet.surfR(run.town.c) + 1;
    game.update(1 / 60);
    assert.ok(game.over, 'swooped over the town');
    game.stop();
  });
});
