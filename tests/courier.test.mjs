import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { todayKey, dailySeed, dailyParams } from '../js/game/Daily.js';
import { HALF } from '../js/world/Airports.js';

// The tests run in order and share one run: the first starts it, the next ones poke at it.
const PLANETS = [
  { seed: 20261014, land: 0.45, cities: 5 },
  { seed: 12345, land: 0.3, cities: 8 },
  { seed: 42, land: 0.25, cities: 2 }, // two cities: the smallest planet a run can be flown on
];

for (const params of PLANETS) {
  describe(`Sky Courier on planet ${params.seed} (${params.cities} cities)`, () => {
    let app, planet;
    before(async () => {
      localStorage.clear();
      ({ app, planet } = await makeWorld(params));
    });
    after(() => { app.game.stop(); planet.dispose(); });

    it('Sky Courier: hangar upgrades apply, deliveries pay coins, cargo varies', () => {
      const game = app.game, prog = game.progress;
      game.openHangar();
      prog.addCoins(1000);
      game.hangar.buy('engine');
      game.hangar.pickSkin('sky');
      game.hangar.hide();
      assert.equal(prog.level('engine'), 1);
      assert.equal(prog.skin, 'sky');
      const coins = prog.coins;
      game.start();
      assert.equal(game.player.stats.speed, 1.08);
      const cargo = new Set();
      let delivered = 0;
      run(app, 120, {
        dt: 1 / 60, camera: true, game: true,
        each: () => {
          if (game.over) return;
          game.player.steerToward(game.run.dest.c, 1.5);
          cargo.add(game.run.cargo.id);
          delivered = game.run.deliveries;
        },
      });
      assert.ok(delivered >= 4, `only ${delivered} deliveries in 2 minutes`);
      assert.ok(prog.coins > coins, 'no coins earned');
      assert.ok(cargo.size >= 2, 'cargo never varied');
      assert.equal(app.rig.mode, 'game');
    });

    it('Sky Courier: Rival Rex races you, steals parcels, and can be outrun', () => {
      const game = app.game, rex = game.run.rival;
      assert.ok(rex, 'no rival after the first delivery');
      assert.ok(Number.isFinite(rex.pos.x));
      assert.ok(rex.plane.stats.speed > 0.8 && rex.plane.stats.speed <= 1.1, 'the rival speeds up with each delivery, within limits');
      game.over = false;
      game.run.time = 100;
      const pl = game.player, dest = game.run.dest, combo = (game.run.combo = 3), stolen = game.run.stolen;
      pl.up.copy(dest.c).negate(); // the player is on the far side of the planet
      pl.alt = planet.groundR(pl.up) + 3;
      rex.rest = 0;
      rex.loaded = false;
      rex.plane.up.copy(dest.c);
      rex.plane.alt = planet.surfR(dest.c) + 1.5;
      game.update(1 / 60);
      assert.equal(game.run.stolen, stolen, 'the rival stole a parcel he never picked up');
      rex.loaded = true; // now he has collected it
      game.update(1 / 60);
      assert.equal(game.run.stolen, stolen + 1, 'the rival reached the city but nothing was stolen');
      assert.ok(game.run.combo < combo);
      assert.equal(game.run.from, dest);
      assert.notEqual(game.run.dest, dest);
      assert.ok(rex.rest > 0, 'the rival should circle for a moment after stealing');
      for (let i = 0; i < 5; i++) game.run.deliver();
      assert.ok(app.unlocked.includes('outrun'));
    });

    it('Sky Courier: runways refuel, volcanic ash chokes the engine, the UFO pays a bonus', () => {
      const game = app.game, pl = game.player;
      game.over = false;
      game.run.time = 100;
      for (const k in pl.input) pl.input[k] = false; // hands off: no leftover steering from the autopilot
      const ap = planet.airports.list[0];
      if (ap) {
        pl.up.copy(planet.airports.at(ap, -0.8 * HALF, 0, new THREE.Vector3()));
        pl.fwd.copy(ap.fwd).addScaledVector(pl.up, -ap.fwd.dot(pl.up)).normalize();
        pl.alt = ap.top + 0.5;
        pl.boost = 0;
        for (let i = 0; i < 30; i++) game.update(1 / 60);
        assert.ok(pl.boost > 0.3, `runway didn't refuel (boost ${pl.boost.toFixed(2)})`);
      }
      const v = planet.volcano;
      Object.assign(v, { state: 'erupt', timer: -1 });
      pl.up.copy(v.d);
      pl.alt = v.top.length() + 1;
      pl.boost = 1;
      game.update(1 / 60);
      assert.ok(pl.engine < 1, 'ash had no effect on the engine');
      assert.ok(pl.boost < 1, 'ash had no effect on the boost');
      Object.assign(v, { state: 'calm', timer: 60 });
      game.update(1 / 60);
      assert.equal(pl.engine, 1, 'engine still choking after the eruption');
      const u = planet.ufo, score = game.run.score;
      u.arrive();
      u.update(3.01, app.simTime);
      pl.up.copy(u.group.position).normalize();
      pl.alt = u.group.position.length();
      game.update(1 / 60);
      assert.ok(game.run.score >= score + 300, 'flying through the UFO paid nothing');
      game.update(1 / 60);
      assert.ok(game.run.score < score + 600, 'the UFO bonus paid twice');
      u.leave();
    });

    it('Sky Courier: a crash breaks fragile cargo, and it pays nothing', () => {
      const game = app.game, pl = game.player;
      game.run.cargo = { ...game.run.cargo, fragile: true, pay: 1.6 };
      game.run.broken = false;
      pl.up.copy(game.run.from.c); // over the previous city: solid ground, and not the destination
      pl.fwd.copy(game.run.from.u).addScaledVector(pl.up, -game.run.from.u.dot(pl.up)).normalize();
      pl.alt = planet.groundR(pl.up) - 0.05;
      pl.invuln = 0;
      game.update(1 / 60);
      assert.ok(game.run.broken);
      const score = game.run.score;
      game.run.deliver();
      assert.equal(game.run.score, score);
      assert.equal(game.run.combo, 1);
    });

    it('Sky Courier: thunderclouds shake the plane and lightning hits it', () => {
      const game = app.game, pl = game.player, storm = planet.weather.storms[0];
      let zaps = 0, shaken = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const c = planet.weather.stormCenter(storm, new THREE.Vector3());
        pl.up.copy(c).normalize();
        pl.alt = c.length();
        pl.fwd.copy(storm.u).addScaledVector(pl.up, -storm.u.dot(pl.up)).normalize();
        game.run.time = 100;
        game.update(1 / 60);
        planet.update(1 / 60, (app.simTime += 1 / 60));
        if (pl.turbulence) shaken++;
        if (game.run.time < 96) zaps++;
      }
      assert.ok(shaken > 1700, 'no turbulence inside the storm');
      assert.ok(zaps >= 1, 'lightning never hit');
      assert.ok(app.unlocked.includes('lightningrod'));
    });

    it('Sky Courier: the run ends, the best score is saved, and you can fly again', () => {
      const game = app.game;
      game.run.time = 0.001;
      game.update(1 / 60);
      assert.ok(game.over);
      assert.ok(game.progress.best >= game.run.score);
      game.stop();
      game.start();
      assert.ok(game.active);
      game.stop();
      assert.equal(game.run, null);
      run(app, 2, { dt: 1 / 60, camera: true });
      assert.equal(app.rig.mode, 'orbit');
    });

    it('Daily challenge: same route every time, stock plane, its own best score', () => {
      const game = app.game, prog = game.progress;
      assert.ok(prog.level('engine') > 0, 'the free-flight test should have bought an engine upgrade');
      const route = () => {
        game.start({ daily: true });
        const legs = [`${game.run.from.name}>${game.run.dest.name}:${game.run.cargo.id}`];
        for (let i = 0; i < 8; i++) {
          game.run.deliver();
          legs.push(`${game.run.dest.name}:${game.run.cargo.id}`);
        }
        return legs;
      };
      const first = route();
      assert.equal(game.player.stats.speed, 1, 'daily runs use the stock plane');
      const best = prog.best;
      game.run.gameOver(); // not via update(): the instant deliveries may leave the plane over its next city
      assert.ok(game.over);
      assert.equal(prog.dailyBest(todayKey()), game.run.score);
      assert.equal(prog.best, best, 'a daily run should not change the free-flight best');
      assert.ok(!game.results.dom.share.classList.contains('hidden'), 'share button hidden after a daily run');
      assert.ok(app.unlocked.includes('daily'));
      game.stop();
      assert.deepEqual(route(), first, 'two daily runs on the same day got different routes');
      game.stop();
    });

    it("Daily challenge: builds today's planet first when another one is loaded", async () => {
      const game = app.game;
      let built = null;
      app.newPlanet = async (seed, initial, theme, world) => { built = world ?? seed; };
      await game.startDaily();
      const want = dailyParams();
      assert.equal(built, want.world ?? dailySeed(), 'built the wrong planet (or none)');
      if (!want.world) assert.equal(app.params.seed, dailySeed());
      assert.ok(game.briefing.open && !game.active, 'the briefing should come first');
      game.briefing.start();
      assert.ok(game.active && game.run.opts.daily);
      game.stop();
    });
  });
}
