import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers/world.mjs';
import { MISSIONS } from '../js/game/Missions.js';
import { worldOf } from '../js/space/Worlds.js';
import { Progress } from '../js/game/Progress.js';
import { readPad } from '../js/game/input/Gamepad.js';

const def = (id) => MISSIONS.find((m) => m.id === id);

describe('missions', () => {
  beforeEach(() => localStorage.clear());

  it('unlock one at a time and pay their reward once', () => {
    const p = new Progress();
    assert.ok(p.missionUnlocked(0) && !p.missionUnlocked(1));
    assert.equal(p.completeMission(MISSIONS[0]), MISSIONS[0].reward);
    assert.equal(p.completeMission(MISSIONS[0]), 0, 'paid twice');
    assert.ok(p.missionUnlocked(1) && !p.missionUnlocked(2));
    assert.equal(new Progress().coins, MISSIONS[0].reward, 'reward not saved');
    const first = MISSIONS.findIndex((m) => m.planet.world);
    assert.ok(first > 1 && p.missionUnlocked(first) && !p.missionUnlocked(first + 1), 'the real worlds’ missions are a list of their own');
  });

  it('each mission planet has what its mission needs', async () => {
    const seen = new Map();
    for (const m of MISSIONS) {
      const key = JSON.stringify(m.planet);
      if (!seen.has(key)) {
        const { planet } = await makeWorld(m.planet);
        seen.set(key, {
          cities: planet.cities.sites.length, airports: planet.airports.list.length,
          volcanoes: planet.volcanoes.length, theme: planet.theme.id, storms: planet.weather.storms.length,
          landmarks: planet.landmarks.list.map((l) => l.name),
        });
        planet.dispose();
      }
      const w = seen.get(key);
      assert.ok(w.cities >= 2, `${m.id}: not enough cities`);
      assert.equal(w.theme, m.planet.world ? worldOf(m.planet.world).theme : m.planet.theme);
      if (m.landmark) assert.ok(w.landmarks.includes(m.landmark), `${m.id}: no ${m.landmark}`);
      if (m.failIf === 'zaps' || m.id === 'dust') assert.ok(w.storms >= 2, `${m.id}: only ${w.storms} storms`);
      if (m.goal.stat === 'refuels') assert.ok(w.airports > 0, `${m.id}: no airport to refuel at`);
      if (m.eruptions) assert.ok(w.volcanoes >= 2, `${m.id}: only ${w.volcanoes} volcano`);
    }
  });
});

describe('mission runs', () => {
  let app, planet;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld(def('first').planet));
  });

  it('First Flight: three deliveries complete it, pay the reward and unlock the next', () => {
    const game = app.game, coins = game.progress.coins;
    game.start({ mission: def('first') });
    assert.ok(game.run.def && !game.hud.dom.mission.classList.contains('hidden'));
    for (let i = 0; i < 3; i++) game.run.deliver();
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.title.textContent, /complete/);
    assert.ok(game.progress.missionDone('first'));
    assert.ok(game.progress.coins >= coins + def('first').reward);
    assert.ok(!game.results.dom.next.classList.contains('hidden'), 'no Next mission button');
    game.again();
    assert.equal(game.run.def.id, 'first', 'again should replay the same mission');
    game.stop();
  });

  it('Handle With Care fails when the fragile parcel breaks', () => {
    const game = app.game, pl = (game.start({ mission: def('care') }), game.player);
    game.run.cargo = { ...game.run.cargo, fragile: true };
    pl.up.copy(game.run.from.c);
    pl.alt = planet.groundR(pl.up) - 0.05;
    pl.invuln = 0;
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.title.textContent, /failed/);
    assert.match(game.results.dom.result.innerHTML, /broke/);
    assert.ok(!game.progress.missionDone('care'));
    game.stop();
  });

  it('running out of time fails a mission', () => {
    const game = app.game;
    game.start({ mission: def('rings') });
    game.run.time = 0.001;
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.result.innerHTML, /Out of time/);
    game.stop();
  });

  it('Night Shift starts in the dark, Outrun Rex starts with Rex, Close Encounter calls the UFO', () => {
    const game = app.game;
    game.start({ mission: def('night') });
    assert.ok(planet.nightAt(game.run.from.c) > 0.5, 'the start city is in daylight');
    game.stop();
    game.start({ mission: def('rex') });
    assert.ok(game.run.rival, 'no Rex at the start');
    game.stop();
    game.start({ mission: def('ufo') });
    assert.equal(planet.ufo.state, 'away');
    assert.equal(planet.ufo.timer, def('ufo').ufoIn);
    game.stop();
  });

  it('the same mission always gets the same route', () => {
    const game = app.game, route = () => {
      game.start({ mission: def('rush') });
      const legs = [game.run.from.name, game.run.dest.name];
      for (let i = 0; i < 5; i++) { game.run.deliver(); legs.push(`${game.run.dest.name}:${game.run.cargo.id}`); }
      game.stop();
      return legs;
    };
    const a = route();
    assert.deepEqual(route(), a);
    assert.ok(a.filter((l) => l.endsWith(':urgent')).length >= 1, 'Rush Hour should favour urgent parcels');
  });
});

describe('missions on the real worlds', () => {
  beforeEach(() => localStorage.clear());

  it('One Small Step: the flag goes to Tranquility Base, by hopper', async () => {
    const { app, planet } = await makeWorld({ world: 'moon' }), game = app.game;
    game.start({ mission: def('flag') });
    const run = game.run, pl = game.player;
    assert.equal(pl.style, 'hopper');
    assert.equal(run.dest.name, 'Tranquility Base');
    assert.ok(!run.rival, 'Rex on the Moon');
    game.update(1 / 60);
    assert.match(game.hud.dom.goal.textContent, /🚩 Flag → Tranquility Base/);
    pl.up.copy(run.dest.c);
    pl.alt = planet.surfR(run.dest.c) + 1;
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.title.textContent, /complete/);
    assert.ok(game.progress.missionDone('flag'));
    game.stop();
    planet.dispose();
  });

  it('Room Service carries a fragile cake to the Ice Hotel, and a crash ends it', async () => {
    const { app, planet } = await makeWorld({ world: 'pluto' }), game = app.game;
    game.start({ mission: def('hotel') });
    const run = game.run, pl = game.player;
    assert.equal(run.cargo.id, 'fragile');
    assert.equal(run.dest.name, 'The Ice Hotel');
    pl.up.copy(run.from.c);
    pl.alt = planet.groundR(pl.up) - 0.05;
    pl.invuln = 0;
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.result.innerHTML, /broke/);
    game.stop();
    planet.dispose();
  });

  it('Acid Rain ends at the first lightning strike; Mars has dust storms without lightning', async () => {
    const { app, planet } = await makeWorld({ world: 'venus' }), game = app.game;
    game.start({ mission: def('acid') });
    game.run.zapped();
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.result.innerHTML, /lightning/);
    game.stop();
    planet.dispose();

    const mars = await makeWorld({ world: 'mars' }), w = mars.planet.weather;
    assert.ok(w.dusty && w.storms.length === 2);
    assert.equal(w.entities[0].name, 'Dust Storm 1');
    let strikes = 0;
    w.strike = () => strikes++;
    for (let i = 0; i < 400; i++) w.update(0.05, i * 0.05);
    assert.equal(strikes, 0, 'lightning in a dust storm');
    const g = mars.app.game;
    g.start({ mission: def('dust') });
    const pl = g.player, health = pl.health;
    w.stormCenter(w.storms[0], pl.pos);
    g.hazards.update(1);
    assert.ok(pl.health < health, 'the grit wears the glider down');
    assert.equal(g.run.tally.zaps, 0);
    g.stop();
    mars.planet.dispose();
  });

  it('Keep to the Shade only sends parcels to towns in the dark, without stopping the Sun', async () => {
    const { app, planet } = await makeWorld({ world: 'mercury' }), game = app.game, day = app.sky.dayLength;
    game.start({ mission: def('shade') });
    const run = game.run, dark = planet.cities.sites.filter((s) => s !== run.from && planet.nightAt(s.c) > 0.5);
    if (dark.length) assert.ok(planet.nightAt(run.dest.c) > 0.5, 'a parcel to a town in the sunshine');
    assert.equal(app.sky.dayLength, day);
    game.stop();
    planet.dispose();
  });
});

describe('controller', () => {
  const pad = (axes, pressed = []) => ({ axes, buttons: Array.from({ length: 16 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0 })) });

  it('maps sticks, d-pad and buttons to flight controls', () => {
    assert.deepEqual(readPad(pad([-0.9, 0])), { left: true, right: false, up: false, down: false, boost: false, a: false, b: false, start: false, horn: false });
    assert.ok(readPad(pad([0, 0], [3])).horn, 'Y honks');
    const s = readPad(pad([0.1, -0.8], [0, 9]));
    assert.ok(!s.left && !s.right && s.up && s.boost && s.a && s.start, 'stick up, A and Start');
    assert.ok(readPad(pad([0, 0], [15])).right, 'd-pad right');
    assert.ok(readPad(pad([0, 0], [7])).boost, 'right trigger boosts');
    assert.ok(!readPad(pad([0.2, -0.2])).left, 'small stick wobbles are ignored');
  });

  it('only changes in controller state touch the plane, so the keyboard keeps working', async () => {
    const { app: a, planet: p } = await makeWorld({ seed: 42, land: 0.25, cities: 2 });
    const game = a.game;
    game.start();
    game.player.input.left = true;                 // held on the keyboard
    game.controls.pad(readPad(pad([0, 0])), readPad(pad([0, 0])));
    assert.ok(game.player.input.left, 'an idle controller cancelled a key');
    game.controls.pad(readPad(pad([0.9, 0])), readPad(pad([0, 0])));
    assert.ok(game.player.input.right);
    game.stop();
    p.dispose();
  });
});
