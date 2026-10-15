import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run, assertFiniteInstances } from './helpers/world.mjs';
import { todayKey, dailySeed } from '../js/game/Daily.js';
import { HALF } from '../js/world/Airports.js';

const PLANETS = [
  { seed: 20261014, land: 0.45, cities: 5 },
  { seed: 12345, land: 0.3, cities: 8 },
  { seed: 42, land: 0.25, cities: 2 }, // small land: no room for a railway
];

for (const params of PLANETS) {
  describe(`planet ${params.seed} (land ${params.land * 100}%, ${params.cities} cities)`, () => {
    let app, planet;
    before(async () => {
      localStorage.clear();
      ({ app, planet } = await makeWorld(params));
    });
    after(() => planet.dispose());

    it('builds a populated world', () => {
      const kinds = new Set(planet.entities.map((e) => e.kind));
      for (const k of ['city', 'car', 'boat', 'balloon', 'plane', 'bird', 'moon', 'satellite', 'station', 'storm']) {
        assert.ok(kinds.has(k), `missing ${k}`);
      }
      assert.ok(planet.cities.sites.length >= 2);
      assert.ok(planet.nature.mountains.length > 10);
      assert.ok(planet.people.people.length > 20, 'hardly anyone in town');
      assert.ok(planet.volcano.d, 'no volcano');
      assert.ok(planet.airports.list.length + planet.harbours.list.length > 0, 'no airport or harbour anywhere');
    });

    it('airports sit on levelled ground, clear of towns and roads', () => {
      for (const ap of planet.airports.list) {
        for (let i = -4; i <= 4; i++) {
          const d = planet.airports.at(ap, (i / 4) * HALF, 0, new THREE.Vector3());
          assert.ok(planet.meshR(d) <= ap.top + 0.001, `${ap.name}: ground pokes through the runway`);
          assert.ok(ap.top - planet.meshR(d) < 0.15, `${ap.name}: runway floats ${(ap.top - planet.meshR(d)).toFixed(2)} above the ground`);
          assert.ok(!planet.cities.inCity(d) && !planet.roads.near(d, 0.012), `${ap.name}: runway overlaps a town or road`);
        }
      }
    });

    it('people stand on the rendered ground', () => {
      const m = new THREE.Matrix4(), pos = new THREE.Vector3();
      planet.people.people.forEach((_, i) => {
        planet.people.body.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        const gap = pos.length() - planet.meshR(pos.clone().normalize());
        assert.ok(gap > -0.004 && gap < 0.008, `person ${i} is ${gap.toFixed(3)} off the ground`);
      });
    });

    it('runs 80 s of life: traffic lights, train tunnel, rocket, landings, ferries, eruption, UFO', () => {
      let waited = false, exited = false, docked = false, bombs = false;
      const states = new Set(), volcano = new Set(), ufo = new Set();
      const start = planet.people.people.map((w) => w.from);
      run(app, 80, {
        each: () => {
          waited ||= planet.traffic.cars.some((c) => c.waiting);
          exited ||= planet.railway.justExited;
          docked ||= planet.boats.boats.some((_, i) => planet.boats.isDocked(i));
          bombs ||= planet.volcano.bombs.some((b) => b.live);
          if (planet.space.state) states.add(planet.space.state);
          volcano.add(planet.volcano.state);
          ufo.add(planet.ufo.state);
        },
      });
      assertFiniteInstances(planet.root, 'after simulation');
      assert.ok(waited, 'no car ever waited at a red light');
      if (planet.railway.tunnel) assert.ok(exited, 'train never left the tunnel');
      if (planet.padSite) assert.ok(states.has('flight'), `rocket never launched (${[...states]})`);
      if (planet.airports.list.length) assert.ok(planet.planes.list.some((p) => p.landed), 'no plane ever landed');
      if (planet.harbours.list.length) assert.ok(docked, 'no ferry ever docked');
      assert.ok(volcano.has('erupt') && bombs, `volcano never erupted (${[...volcano]})`);
      assert.ok(ufo.has('hover'), `the UFO never showed up (${[...ufo]})`);
      assert.ok(planet.people.people.some((w, i) => w.from !== start[i]), 'nobody walked anywhere');
    });

    it('rebuilds traffic from the slider', () => {
      planet.traffic.rebuild(0);
      run(app, 1);
      planet.traffic.rebuild(10);
      run(app, 2);
      assert.equal(planet.traffic.cars.length, planet.roads.list.length * 2 * 10);
      assertFiniteInstances(planet.root, 'after traffic rebuild');
    });

    it('camera flies to and follows every kind of thing without going underground', () => {
      const rig = app.rig, firstOfKind = {};
      for (const e of planet.entities) firstOfKind[e.kind] ??= e;
      for (const e of Object.values(firstOfKind)) {
        if (e.kind === 'ufo') { planet.ufo.arrive(); planet.ufo.update(3.01, app.simTime); } // hovering, so it won't fly off mid-test
        rig.focus(e);
        run(app, 2.5, { dt: 1 / 60, camera: true });
        assert.equal(rig.mode, 'local', `focus on ${e.kind}`);
        const pos = app.camera.position;
        assert.ok(Number.isFinite(pos.x), `camera NaN following ${e.kind}`);
        assert.ok(pos.length() >= rig.floorAt(pos.clone().normalize()) - 1e-6, `camera underground at ${e.kind}`);
      }
      rig.release();
      run(app, 2, { dt: 1 / 60, camera: true });
      assert.equal(rig.mode, 'orbit');
      rig.orbit.alt = 0.4; // zoomed all the way in
      run(app, 0.2, { dt: 1 / 60, camera: true });
      const dir = app.camera.position.clone().normalize();
      assert.ok(app.camera.position.length() >= planet.groundR(dir) + 0.49, 'orbit camera below ground');
      assert.ok(rig.pickGround(640, 400), 'clicking the planet finds the ground');
    });

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
          game.player.steerToward(game.dest.c, 1.5);
          cargo.add(game.cargo.id);
          delivered = game.deliveries;
        },
      });
      assert.ok(delivered >= 4, `only ${delivered} deliveries in 2 minutes`);
      assert.ok(prog.coins > coins, 'no coins earned');
      assert.ok(cargo.size >= 2, 'cargo never varied');
      assert.equal(app.rig.mode, 'game');
    });

    it('Sky Courier: Rival Rex races you, steals parcels, and can be outrun', () => {
      const game = app.game, rex = game.rival;
      assert.ok(rex, 'no rival after the first delivery');
      assert.ok(Number.isFinite(rex.pos.x));
      assert.ok(rex.plane.stats.speed > 0.8 && rex.plane.stats.speed <= 1.1, 'the rival speeds up with each delivery, within limits');
      game.over = false;
      game.time = 100;
      const pl = game.player, dest = game.dest, combo = (game.combo = 3), stolen = game.stolen;
      pl.up.copy(dest.c).negate(); // the player is on the far side of the planet
      pl.alt = planet.groundR(pl.up) + 3;
      rex.rest = 0;
      rex.loaded = false;
      rex.plane.up.copy(dest.c);
      rex.plane.alt = planet.surfR(dest.c) + 1.5;
      game.update(1 / 60);
      assert.equal(game.stolen, stolen, 'the rival stole a parcel he never picked up');
      rex.loaded = true; // now he has collected it
      game.update(1 / 60);
      assert.equal(game.stolen, stolen + 1, 'the rival reached the city but nothing was stolen');
      assert.ok(game.combo < combo);
      assert.equal(game.from, dest);
      assert.notEqual(game.dest, dest);
      assert.ok(rex.rest > 0, 'the rival should circle for a moment after stealing');
      for (let i = 0; i < 5; i++) game.deliver();
      assert.ok(app.unlocked.includes('outrun'));
    });

    it('Sky Courier: runways refuel, volcanic ash chokes the engine, the UFO pays a bonus', () => {
      const game = app.game, pl = game.player;
      game.over = false;
      game.time = 100;
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
      const u = planet.ufo, score = game.score;
      u.arrive();
      u.update(3.01, app.simTime);
      pl.up.copy(u.group.position).normalize();
      pl.alt = u.group.position.length();
      game.update(1 / 60);
      assert.ok(game.score >= score + 300, 'flying through the UFO paid nothing');
      game.update(1 / 60);
      assert.ok(game.score < score + 600, 'the UFO bonus paid twice');
      u.leave();
    });

    it('Sky Courier: a crash breaks fragile cargo, and it pays nothing', () => {
      const game = app.game, pl = game.player;
      game.cargo = { ...game.cargo, fragile: true, pay: 1.6 };
      game.broken = false;
      pl.up.copy(game.from.c); // over the previous city: solid ground, and not the destination
      pl.fwd.copy(game.from.u).addScaledVector(pl.up, -game.from.u.dot(pl.up)).normalize();
      pl.alt = planet.groundR(pl.up) - 0.05;
      pl.invuln = 0;
      game.update(1 / 60);
      assert.ok(game.broken);
      const score = game.score;
      game.deliver();
      assert.equal(game.score, score);
      assert.equal(game.combo, 1);
    });

    it('Sky Courier: thunderclouds shake the plane and lightning hits it', () => {
      const game = app.game, pl = game.player, storm = planet.weather.storms[0];
      let zaps = 0, shaken = 0;
      for (let i = 0; i < 60 * 30; i++) {
        const c = planet.weather.stormCenter(storm, new THREE.Vector3());
        pl.up.copy(c).normalize();
        pl.alt = c.length();
        pl.fwd.copy(storm.u).addScaledVector(pl.up, -storm.u.dot(pl.up)).normalize();
        game.time = 100;
        game.update(1 / 60);
        planet.update(1 / 60, (app.simTime += 1 / 60));
        if (pl.turbulence) shaken++;
        if (game.time < 96) zaps++;
      }
      assert.ok(shaken > 1700, 'no turbulence inside the storm');
      assert.ok(zaps >= 1, 'lightning never hit');
      assert.ok(app.unlocked.includes('lightningrod'));
    });

    it('Sky Courier: the run ends, the best score is saved, and you can fly again', () => {
      const game = app.game;
      game.time = 0.001;
      game.update(1 / 60);
      assert.ok(game.over);
      assert.ok(game.progress.best >= game.score);
      game.stop();
      game.start();
      assert.ok(game.active);
      game.stop();
      assert.equal(game.rival, null);
      run(app, 2, { dt: 1 / 60, camera: true });
      assert.equal(app.rig.mode, 'orbit');
    });

    it('Daily challenge: same route every time, stock plane, its own best score', () => {
      const game = app.game, prog = game.progress;
      assert.ok(prog.level('engine') > 0, 'the free-flight test should have bought an engine upgrade');
      const route = () => {
        game.start({ daily: true });
        const legs = [`${game.from.name}>${game.dest.name}:${game.cargo.id}`];
        for (let i = 0; i < 8; i++) {
          game.deliver();
          legs.push(`${game.dest.name}:${game.cargo.id}`);
        }
        return legs;
      };
      const first = route();
      assert.equal(game.player.stats.speed, 1, 'daily runs use the stock plane');
      const best = prog.best;
      game.gameOver(); // not via update(): the instant deliveries may leave the plane over its next city
      assert.ok(game.over);
      assert.equal(prog.dailyBest(todayKey()), game.score);
      assert.equal(prog.best, best, 'a daily run should not change the free-flight best');
      assert.ok(!game.dom.share.classList.contains('hidden'), 'share button hidden after a daily run');
      assert.ok(app.unlocked.includes('daily'));
      game.stop();
      assert.deepEqual(route(), first, 'two daily runs on the same day got different routes');
      game.stop();
    });

    it("Daily challenge: builds today's planet first when another one is loaded", async () => {
      const game = app.game;
      let built = null;
      app.newPlanet = async (seed) => { built = seed; };
      await game.startDaily();
      assert.equal(built, dailySeed());
      assert.equal(app.params.seed, dailySeed());
      assert.ok(game.active && game.daily);
      game.stop();
    });
  });
}
