import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { HARM } from '../js/game/vehicles/Vehicle.js';

/** Put the plane just under the ground at its own spot, so the next frame crashes it. */
function crashNow(game, planet) {
  const pl = game.player;
  pl.invuln = 0;
  pl.alt = planet.groundR(pl.up) - 0.05;
  game.update(1 / 60);
}

describe('vehicle health', () => {
  let app, planet, game;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 42, land: 0.25, cities: 2 })); // has an airport
    game = app.game;
  });
  after(() => { game.stop(); planet.dispose(); });

  it('hitting the ground costs health and makes the plane splutter and wobble', () => {
    game.start();
    const pl = game.player, speed = pl.speed;
    assert.equal(pl.health, 1);
    crashNow(game, planet);
    assert.ok(Math.abs(pl.health - (1 - HARM.crash)) < 1e-9, `health ${pl.health}`);
    assert.ok(pl.stall > 0.9 && pl.speed < speed * 0.6, 'the engine should splutter after a crash');
    game.stop();
  });

  it('wrecking the plane ends a courier run, and says so', () => {
    game.start();
    for (let i = 0; i < 4; i++) crashNow(game, planet);
    assert.ok(game.player.wrecked && game.over, 'four crashes should wreck a stock plane');
    assert.match(game.results.dom.title.textContent, /Wrecked/);
    assert.ok(app.unlocked.includes('totalled'));
    game.stop();
  });

  it('in free flight a wreck puts a fresh plane at the nearest town', () => {
    game.start({ free: true });
    for (let i = 0; i < 4; i++) crashNow(game, planet);
    assert.ok(game.player.wrecked && !game.over, 'free flight should carry on after a wreck');
    run(app, 2.5, { game: true });
    const pl = game.player, town = planet.cities.sites.reduce((a, b) => (a.c.angleTo(pl.up) < b.c.angleTo(pl.up) ? a : b));
    assert.ok(!pl.wrecked && pl.health === 1 && pl.group.visible, 'no fresh plane after the wreck');
    assert.ok(town.c.angleTo(pl.up) < 0.2, 'the fresh plane should be over a town');
    game.stop();
  });

  it('lightning hurts, and skimming a runway patches the plane up', () => {
    game.start({ free: true });
    const pl = game.player, storm = planet.weather.storms[0];
    for (let i = 0; i < 60 * 20 && pl.health === 1; i++) { // sit in the storm until lightning hits
      const c = planet.weather.stormCenter(storm, new THREE.Vector3());
      pl.up.copy(c).normalize();
      pl.alt = c.length();
      game.update(1 / 60);
    }
    assert.ok(pl.health < 1, 'lightning never hit');
    const ap = planet.airports.list[0];
    pl.health = 0.4;
    for (let i = 0; i < 60; i++) {
      pl.up.copy(planet.airports.at(ap, 0, 0, new THREE.Vector3()));
      pl.fwd.copy(ap.fwd).addScaledVector(pl.up, -ap.fwd.dot(pl.up)).normalize();
      pl.alt = ap.top + 0.5;
      game.update(1 / 60);
    }
    assert.ok(pl.health > 0.6, `the runway didn't repair the plane (${pl.health.toFixed(2)})`);
    game.stop();
  });

  it('armour softens every knock', () => {
    const p = game.progress;
    p.addCoins(5000);
    p.buy('armour');
    p.buy('armour');
    game.start();
    crashNow(game, planet);
    assert.ok(Math.abs(game.player.health - (1 - HARM.crash * 0.6)) < 1e-9, `two levels of armour: health ${game.player.health}`);
    game.stop();
  });

  it('a delivery patches the plane up a little', () => {
    game.start();
    game.player.health = 0.5;
    game.run.deliver();
    assert.ok(game.player.health > 0.6);
    game.stop();
  });
});
