import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers/world.mjs';
import { MISSIONS } from '../js/game/Missions.js';
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
  });

  it('each mission planet has what its mission needs', async () => {
    const seen = new Map();
    for (const m of MISSIONS) {
      const key = JSON.stringify(m.planet);
      if (!seen.has(key)) {
        const { planet } = await makeWorld(m.planet);
        seen.set(key, {
          cities: planet.cities.sites.length, airports: planet.airports.list.length,
          volcanoes: planet.volcanoes.length, theme: planet.theme.id,
        });
        planet.dispose();
      }
      const w = seen.get(key);
      assert.ok(w.cities >= 2, `${m.id}: not enough cities`);
      assert.equal(w.theme, m.planet.theme);
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
