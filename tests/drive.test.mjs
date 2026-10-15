import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { R } from '../js/core/Geo.js';

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
