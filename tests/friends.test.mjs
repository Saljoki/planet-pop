import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers/world.mjs';
import { Friends } from '../js/net/Friends.js';
import { TabLink } from '../js/net/TabLink.js';
import { makeState, readState, readHello, planetOf, planetKey } from '../js/net/Wire.js';

const PARAMS = { seed: 20261014, land: 0.45, cities: 5, theme: 'classic' };
const wait = (ms) => new Promise((ok) => setTimeout(ok, ms));

describe('what friends send each other', () => {
  it('only well-formed hellos and positions get through', () => {
    const planet = planetOf(PARAMS);
    assert.deepEqual(planet, { seed: 20261014, land: 45, cities: 5, theme: 'classic' });
    assert.equal(readHello({ v: 1, name: ' <b>Sam</b> ', planet }).name, 'bSam/b');
    assert.equal(readHello({ v: 1, name: 42, planet }).name, 'Pilot');
    assert.equal(readHello({ v: 1, name: 'Sam', planet }).key, planetKey(planet));
    for (const bad of [null, 'hi', { v: 2, name: 'Sam', planet }, { v: 1, name: 'Sam' }, { v: 1, planet: { ...planet, theme: 'mars' } },
      { v: 1, planet: { ...planet, seed: -1 } }, { v: 1, planet: { ...planet, land: 45.5 } }, { v: 1, planet: { ...planet, cities: 99 } }]) {
      assert.equal(readHello(bad), null, JSON.stringify(bad));
    }
    const good = { k: 'plane', c: null, b: '#ffd23f', t: '#ff4d4d', u: [0, 1, 0], f: [1, 0, 0], a: 11.6, r: 0.2, p: 0.1, w: 0 };
    const s = readState(good);
    assert.equal(s.kind, 'plane');
    assert.ok(Math.abs(s.up.length() - 1) < 1e-9 && Math.abs(s.fwd.dot(s.up)) < 1e-9);
    assert.deepEqual(readState({ k: null }), { kind: null });
    for (const bad of [{ ...good, k: 'tank' }, { ...good, u: [NaN, 1, 0] }, { ...good, u: [0, 1] }, { ...good, f: [0, 5, 0] },
      { ...good, a: Infinity }, { ...good, u: [0, 0, 0] }, 'st', null]) {
      assert.equal(readState(bad), null, JSON.stringify(bad));
    }
    const odd = readState({ ...good, b: 'url(x)', a: 1e9, r: 99, c: 'tank' });
    assert.equal(odd.body, '#ffd23f', 'colours must be colours');
    assert.ok(odd.alt < 60 && odd.roll <= 1.6);
  });

  it('room codes: typed any old way, or pasted as a whole invite link', () => {
    assert.match(Friends.newCode(), /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal(Friends.cleanCode(' k7q-mpa '), 'K7QMPA');
    assert.equal(Friends.cleanCode('https://saljoki.github.io/planet-pop/?seed=1&room=K7QMPA&theme=ice'), 'K7QMPA');
    assert.equal(Friends.cleanCode('ab'), null);
    assert.equal(Friends.cleanCode(''), null);
  });
});

describe('two players in a room', () => {
  let a, b;
  before(async () => {
    localStorage.clear();
    a = (await makeWorld(PARAMS)).app;
    b = (await makeWorld(PARAMS)).app;
    a.settings.values.playerName = 'Ata';
    b.settings.values.playerName = 'Sam';
    for (const app of [a, b]) {
      app.toasts = [];
      app.hud.toast = (t) => app.toasts.push(t);
      app.friends = new Friends(app, { link: () => new TabLink() });
    }
  });
  after(() => { a.friends.leave(true); b.friends.leave(true); a.game.stop(); a.planet.dispose(); b.planet.dispose(); });

  /** Let a few frames of news go back and forth. */
  const tick = async (frames = 3) => {
    for (let i = 0; i < frames; i++) {
      a.friends.update(1 / 15);
      b.friends.update(1 / 15);
      await wait(25);
    }
  };

  it('see each other’s cars on the same planet, with names, and leave', async () => {
    assert.ok(await a.friends.join('TESTRM'));
    assert.ok(await b.friends.join('testrm'), 'codes are the same whatever the case');
    await tick();
    assert.deepEqual(b.friends.people.map((g) => g.name), ['Ata']);
    assert.deepEqual(a.friends.people.map((g) => g.name), ['Sam']);
    assert.ok(a.toasts.some((t) => /Sam joined/.test(t)));

    a.game.start({ drive: 'car' });
    const car = a.game.player;
    await tick(4);
    await wait(200); // (friends are drawn a moment behind, smoothly)
    await tick(1);
    const ghost = b.friends.people[0];
    assert.equal(ghost.kind, 'car');
    assert.ok(ghost.model?.group.visible, 'Ata’s car should be on Sam’s planet');
    assert.ok(ghost.model.pos.distanceTo(car.pos) < 0.01, `Ata’s car is in the wrong place (${ghost.model.pos.distanceTo(car.pos).toFixed(3)})`);
    assert.equal(ghost.tag.textContent, 'Ata');
    assert.equal(ghost.doing, '🚗 driving');
    assert.deepEqual(b.friends.here, [ghost], 'on the mini-map too');

    b.params.seed += 1; // Sam is on another planet now: Ata's car isn't on it
    await tick(2);
    assert.equal(ghost.model, null);
    b.params.seed -= 1;
    await tick(2);
    assert.ok(ghost.model, 'and back again');

    a.game.stop();
    await tick(2);
    assert.equal(ghost.kind, null, 'out of the car: just looking round');

    b.friends.receive('nobody', 'st', { k: 'plane', u: [0, 1, 0], f: [1, 0, 0], a: 11 }); // positions before a hello: ignored
    assert.equal(b.friends.people.length, 1);
    b.friends.receive(ghost.id, 'st', { k: 'plane', u: [NaN, 1, 0], f: [1, 0, 0], a: 11 });
    assert.equal(ghost.kind, null, 'nonsense is ignored');

    a.friends.leave();
    await tick(2);
    assert.equal(b.friends.people.length, 0);
    assert.ok(b.toasts.some((t) => /Ata left/.test(t)));
  });

  it('a friend on another planet: 🌍 Go there builds it', async () => {
    let built = null;
    b.newPlanet = async (seed, initial, theme) => { built = { seed, theme }; };
    b.friends.receive('far', 'hi', { v: 1, name: 'Kim', planet: { seed: 7, land: 30, cities: 3, theme: 'ice' } });
    assert.ok(b.toasts.some((t) => /Kim joined \(on another planet/.test(t)));
    await b.friends.goTo('far');
    assert.deepEqual(built, { seed: 7, theme: 'ice' });
    assert.equal(b.params.land, 0.3);
    assert.equal(b.params.cities, 3);
    Object.assign(b.params, PARAMS);
  });

  it('the plane’s pose survives the trip', () => {
    a.game.start({ free: true });
    const pl = a.game.player;
    pl.roll = 0.3;
    const s = readState(JSON.parse(JSON.stringify(makeState(pl))));
    assert.ok(s.up.distanceTo(pl.up) < 1e-3 && s.fwd.distanceTo(pl.fwd) < 1e-3 && Math.abs(s.alt - pl.alt) < 1e-3);
    assert.equal(s.roll, 0.3);
    assert.equal(s.body, pl.paint.body);
    a.game.stop();
  });
});
