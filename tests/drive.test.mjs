import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { R } from '../js/core/Geo.js';
import { engineNote } from '../js/ui/EngineSound.js';

const left = (pl) => new THREE.Vector3().crossVectors(pl.up, pl.fwd); // (up × fwd points left)

describe('driving', () => {
  let app, planet, game;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5 }));
    game = app.game;
  });
  after(() => { game.stop(); planet.dispose(); });
  beforeEach(() => game.stop()); // (in case a failed test left a run going)

  /** Put the car in the left lane of a town on the highway, facing along it. */
  const onHighway = (pl) => {
    const town = planet.cities.sites.find((s) => pl.ground.roadAt(s.c)), spot = pl.ground.parking(town);
    pl.respawn(spot.at, spot.heading);
  };

  it('a car drives on the ground: never under it, never inside a building or in the sea', () => {
    game.start({ drive: 'car' });
    const pl = game.player;
    assert.equal(pl.kind, 'car');
    let worst = 0, inside = 0, wet = 0, t = 0, travelled = 0;
    run(app, 25, {
      dt: 1 / 60, game: true,
      each: () => { // wander about: gas on, steering drifting from side to side
        t += 1 / 60;
        Object.assign(pl.input, { up: true, steer: Math.sin(t * 0.7) * 0.8 });
        worst = Math.min(worst, pl.alt - pl.ground.carR(pl.up));
        travelled += Math.abs(pl.v) / 60;
        if (planet.cities.buildingAt(pl.up)) inside++;
        if (!pl.ground.roadAt(pl.up) && pl.ground.isWater(pl.up)) wet++;
      },
    });
    assert.ok(worst > -1e-6, `the car sank ${(-worst).toFixed(3)} into the ground`);
    assert.equal(inside, 0, 'the car drove into a building');
    assert.equal(wet, 0, 'the car drove into the sea');
    assert.ok(travelled > 8, `the car hardly moved (${travelled.toFixed(1)})`);
    game.stop();
  });

  it('steers the right way, brakes, reverses, and is quickest on the highway', () => {
    game.start({ drive: 'car' });
    const pl = game.player;
    onHighway(pl);
    assert.ok(pl.ground.roadAt(pl.up), 'a car should start on the highway when the town has one');
    pl.input.up = true;
    run(app, 2.5, { dt: 1 / 60, game: true });
    const onRoad = pl.v;
    assert.ok(onRoad > 0.9, `slow on the highway (${onRoad.toFixed(2)})`);
    const before = pl.fwd.clone();
    pl.input.left = true;
    run(app, 0.3, { dt: 1 / 60, game: true });
    assert.ok(pl.fwd.clone().sub(before).dot(left({ up: pl.up, fwd: before })) > 0, 'left should turn left');
    Object.assign(pl.input, { left: false, up: false, down: true });
    run(app, 2.5, { dt: 1 / 60, game: true });
    assert.ok(pl.v < -0.2, `holding brake should end up reversing (v ${pl.v.toFixed(2)})`);
    game.stop();
  });

  it('hitting a wall hard hurts; nudging one does not', () => {
    game.start({ drive: 'car' });
    const pl = game.player, city = planet.cities.sites.find((c) => c.blocks.size > 20);
    const spot = (b, x) => city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, b.z / R).normalize();
    // a building on the edge of town, with open ground in front of it
    const b = [...city.blocks.values()].find((k) => [0.13, 0.3, 0.5].every((gap) => !pl.ground.carBlock(spot(k, k.x - k.hx - gap))));
    assert.ok(b, 'no building to drive into');
    const face = (speed) => { // just short of the building's wall, driving straight at it
      pl.place(spot(b, b.x - b.hx - 0.13), city.u);
      pl.alt = pl.ground.carR(pl.up);
      Object.assign(pl, { v: speed, invuln: 0, health: 1 });
      pl.input.up = true;
      run(app, 0.4, { dt: 1 / 60, game: true });
    };
    face(0.2);
    assert.equal(pl.health, 1, 'a gentle bump should not hurt');
    face(1.05);
    assert.ok(pl.health < 0.95, 'driving into a wall at full speed should hurt');
    assert.equal(planet.cities.buildingAt(pl.up), null, 'the car ended up inside the building');
    game.stop();
  });

  it('every town has two main streets, crossing in the middle: a car drives right through', () => {
    game.start({ drive: 'car' });
    const pl = game.player, cities = planet.cities;
    const at = (city, x, z) => city.c.clone().addScaledVector(city.u, x / R).addScaledVector(city.v, z / R).normalize();
    for (const city of cities.sites) {
      for (const along of ['x', 'z']) {
        if (along === 'x' && pl.ground.roadAt(city.c)) continue; // (that one's the highway)
        const dir = along === 'x' ? city.u : city.v, start = along === 'x' ? at(city, -1.7, 0) : at(city, 0, -1.7);
        if (pl.ground.carBlock(start)) continue; // (the street runs into the sea or a mountain out there)
        pl.respawn(start, dir);
        Object.assign(pl, { invuln: 0, health: 1 });
        pl.input.up = true;
        let bumps = 0, middle = Infinity;
        run(app, 4.5, { dt: 1 / 60, game: true, each: () => { // (out the far side it may well run into the sea: fine)
          if ((pl.scraping || pl.crashed) && (pl.hitWhat === 'building' || pl.up.angleTo(city.c) * R < 1.45)) bumps++;
          middle = Math.min(middle, pl.up.angleTo(city.c) * R);
        } });
        pl.input.up = false;
        assert.ok(middle < 0.12, `${city.name}: didn't get to the middle along its ${along} street (${middle.toFixed(2)})`);
        assert.equal(bumps, 0, `${city.name}: bumped into something on its ${along} street`);
      }
      assert.equal(pl.ground.surface(at(city, 0.6, 0)), 'road', 'streets are as quick as roads');
    }
    game.stop();
  });

  it('trees are solid: glance off them, and a head-on hit hurts', () => {
    game.start({ drive: 'car' });
    const pl = game.player, nature = planet.nature, g = pl.ground;
    const ahead = (t, dir, k) => t.d.clone().addScaledVector(dir, -k / R).normalize();
    let tree = null, dir = null;
    for (const t of nature.treeGroups.flatMap((x) => x.list)) { // a tree with clear, flat ground in front of it
      const [u] = [new THREE.Vector3(0, 1, 0).cross(t.d).normalize()];
      const solid = nature.treeAt(t.d);
      if (!solid || [0.12, 0.3, 0.5].some((k) => g.carBlock(ahead(t, u, solid.r + k)) || g.mountain(ahead(t, u, solid.r + k)).r)) continue;
      tree = solid;
      dir = u;
      break;
    }
    assert.ok(tree, 'no tree to drive into');
    const face = (speed) => {
      pl.respawn(ahead(tree, dir, tree.r + 0.12), dir);
      Object.assign(pl, { v: speed, invuln: 0, health: 1 });
      pl.input.up = true;
      let closest = Infinity;
      run(app, 0.5, { dt: 1 / 60, game: true, each: () => { closest = Math.min(closest, pl.up.angleTo(tree.d) * R); } });
      pl.input.up = false;
      return closest;
    };
    assert.ok(face(0.2) > tree.r, 'the car drove into the tree');
    assert.equal(pl.health, 1, 'a gentle bump should not hurt');
    face(1.05);
    assert.ok(pl.health < 0.95, 'driving into a tree at full speed should hurt');
    game.stop();
  });

  it('steering eases in, and turns wider at speed', () => {
    game.start({ drive: 'car' });
    const pl = game.player;
    onHighway(pl);
    pl.v = 0.4;
    pl.input.left = true;
    run(app, 0.05, { dt: 1 / 60, game: true });
    assert.ok(pl.steer > 0 && pl.steer < 0.4, `the wheel should turn gradually (${pl.steer.toFixed(2)})`);
    const turnRate = (speed) => {
      onHighway(pl);
      Object.assign(pl, { v: speed, steer: 1 });
      pl.input.left = true;
      pl.input.up = speed > 0.5;
      const f0 = pl.fwd.clone();
      run(app, 0.25, { dt: 1 / 60, game: true });
      return f0.angleTo(pl.fwd) / 0.25;
    };
    const slow = turnRate(0.35), fast = turnRate(1.05);
    assert.ok(fast < slow * 0.85, `full speed should turn more gently (${fast.toFixed(2)} vs ${slow.toFixed(2)} rad/s)`);
    pl.input.left = false;
    game.stop();
  });

  it('the horn: H honks a car, toots a boat, and a plane has none', () => {
    const said = [], pop = app.sfx.pop;
    app.sfx.pop = (pos, text) => said.push(text);
    game.start({ drive: 'car' });
    assert.equal(game.horn(), true);
    assert.equal(game.horn(), false, 'not a continuous blare');
    game.stop();
    game.start({ drive: 'boat' });
    app.simTime += 1;
    assert.equal(game.horn(), true);
    game.stop();
    game.start({ free: true });
    app.simTime += 1;
    assert.equal(game.horn(), false);
    game.stop();
    app.sfx.pop = pop;
    assert.deepEqual(said, ['HONK!', 'TOOT TOOT!']);
  });

  it('the engine note climbs through the gears and growls louder on the gas', () => {
    const notes = [0.1, 0.33, 0.4].map((v) => engineNote('car', v, 1).freq);
    assert.ok(notes[0] < notes[1], 'revs rise in a gear');
    assert.ok(notes[2] < notes[1], 'and drop when it changes up');
    assert.ok(engineNote('car', 0.5, 1).vol > engineNote('car', 0.5, 0).vol);
    assert.ok(engineNote('car', 1.6, 1).freq > engineNote('car', 1.0, 1).freq, 'boost revs past the top');
    assert.ok(engineNote('boat', 0.8, 1).chug > engineNote('boat', 0, 0).chug, 'a boat putt-putts faster');
  });

  it('a boat stays on the water', () => {
    game.start({ drive: 'boat' });
    const pl = game.player;
    assert.equal(pl.kind, 'boat');
    let aground = 0, t = 0;
    run(app, 20, {
      dt: 1 / 60, game: true,
      each: () => {
        t += 1 / 60;
        Object.assign(pl.input, { up: true, steer: Math.sin(t * 0.5) });
        if (pl.ground.boatBlock(pl.up)) aground++;
      },
    });
    assert.equal(aground, 0, 'the boat sailed onto land');
    assert.ok(Math.abs(pl.alt - R) < 0.02);
    game.stop();
  });

  it('Drive this: takes over a car from the traffic and gives it back', () => {
    const traffic = planet.traffic, id = 3, before = traffic.cars.length, car = traffic.cars[id];
    const follower = traffic.cars.find((c) => c.leader === car);
    game.start({ drive: 'car', take: { kind: 'car', id, name: 'Turbo the car' } });
    assert.ok(car.taken && follower.leader !== car, 'the car behind should follow the one in front instead');
    const m = new THREE.Matrix4();
    traffic.body.getMatrixAt(id, m);
    assert.equal(new THREE.Vector3().setFromMatrixScale(m).length(), 0, 'the taken car should vanish from the traffic');
    assert.ok(game.player.pos.distanceTo(planet.roads.point(car.road, car.a, 0, new THREE.Vector3())) < 0.15, 'the player car should start where the car was');
    game.stop();
    assert.ok(!car.taken && follower.leader === car && traffic.cars.length === before, 'the car should rejoin the traffic');
  });

  it('Steer: takes the helm of a boat and gives it back', () => {
    const boats = planet.boats, id = 0, b = boats.boats[id], m = new THREE.Matrix4();
    boats.hull.getMatrixAt(id, m);
    const where = new THREE.Vector3().setFromMatrixPosition(m);
    game.start({ drive: 'boat', take: { kind: 'boat', id, name: b.harbour ? 'Ferry' : 'Boat' } });
    assert.ok(b.taken && game.player.kind === 'boat');
    assert.ok(game.player.pos.distanceTo(where) < 0.1, 'the player boat should start where the boat was');
    game.stop();
    assert.ok(!b.taken, 'the boat should carry on its rounds');
    assert.ok(app.unlocked.includes('sailor'));
  });

  it('traffic waits behind the player instead of driving through', () => {
    game.start({ drive: 'car' });
    const pl = game.player, traffic = planet.traffic;
    onHighway(pl);
    pl.input.up = false;
    run(app, 6, { dt: 1 / 60, game: true }); // parked in the lane
    const b = traffic.blocker;
    assert.ok(b, 'parked on the highway, the car should block its lane');
    const behind = traffic.cars.filter((c) => c.road === b.road && !c.taken && Math.abs((c.a - b.a) * R) < 0.4 && c.lane * (b.lat) > 0);
    for (const c of behind) {
      const gap = Math.abs(((c.a - b.a + Math.PI) % (2 * Math.PI)) - Math.PI) * R;
      assert.ok(gap > 0.08, `a car drove into the parked player (${gap.toFixed(3)})`);
    }
    game.stop();
  });
});

describe('mini-map', () => {
  let app, planet, game;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5 }));
    game = app.game;
  });
  after(() => { game.stop(); planet.dispose(); });

  it('shows in every run, heading up, with the goal marked; 🗺️ hides it and that is remembered', () => {
    game.start({ road: 'van' });
    const map = game.minimap, pl = game.player, half = 80, scale = half / map.span, at = {};
    assert.ok(map.open && map.globe, 'the map should show when a run starts');
    map.orient();
    const ahead = pl.up.clone().addScaledVector(pl.fwd, 0.05).normalize(), right = new THREE.Vector3().crossVectors(pl.fwd, pl.up);
    map.place(ahead, half, scale, at);
    assert.ok(at.y < half - 10 && Math.abs(at.x - half) < 1 && !at.far, 'straight ahead should be straight up the map');
    map.place(pl.up.clone().addScaledVector(right, 0.05).normalize(), half, scale, at);
    assert.ok(at.x > half + 10 && Math.abs(at.y - half) < 1, 'to the right should be on the right');
    map.place(pl.up.clone().negate().addScaledVector(pl.fwd, 0.2), half, scale, at);
    assert.ok(at.far && Math.abs(Math.hypot(at.x - half, at.y - half) - (half - 8)) < 1e-6, 'far away things sit on the rim');
    assert.ok(game.hud.hasGoal && game.hud.goal.distanceTo(game.run.stop.at) < 1e-6, 'the van’s drop-off is the goal');
    map.drawMarks(160, map.span); // (all the marks, on a stand-in canvas)
    map.toggleShown();
    assert.ok(!map.open && app.settings.get('minimap') === false);
    game.stop();
    game.start({ free: true });
    assert.ok(!game.minimap.open, 'hidden stays hidden in the next run');
    game.minimap.toggleShown();
    assert.ok(game.minimap.open && app.settings.get('minimap'));
    assert.equal(game.minimap.span, 4.2, 'a plane sees further');
    game.stop();
    assert.ok(!game.minimap.open, 'gone with the run');
  });
});
