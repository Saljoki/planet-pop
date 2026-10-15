import { describe, it, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld } from './helpers/world.mjs';
import { R } from '../js/core/Geo.js';
import { briefingFor, controlsFor } from '../js/game/screens/Briefing.js';
import { ROAD_TRIPS } from '../js/game/screens/RoadBoard.js';

/** Park the car on a spot (a direction), stopped. */
function parkAt(game, at) {
  const pl = game.player;
  pl.place(at, pl.fwd);
  pl.alt = pl.ground.carR(pl.up);
  pl.v = 0;
  game.update(1 / 60);
}

describe('road trips', () => {
  let app, planet, game;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5 }));
    game = app.game;
  });
  after(() => { game.stop(); planet.dispose(); });
  beforeEach(() => game.stop());

  it('every road trip starts in the right vehicle, with its own briefing and car controls', () => {
    for (const trip of ROAD_TRIPS) {
      const b = briefingFor(trip.opts);
      assert.ok(b.title && b.goal && b.tips.length, `${trip.id}: no briefing`);
      game.start(trip.opts);
      assert.equal(game.player.kind, trip.id === 'sail' ? 'boat' : 'car', trip.id);
      game.stop();
    }
    assert.ok(controlsFor({ vehicle: 'car' }).some((l) => /brake/.test(l)));
    assert.ok(controlsFor({ vehicle: 'car', touch: true }).some((l) => /up to go/.test(l)));
  });

  it('taxi: pick someone up, drop them off, get paid and more time', () => {
    game.start({ road: 'taxi' });
    const run = game.run, fare = run.fare;
    assert.equal(game.player.carKind, 'taxi');
    assert.ok(game.props.pad.visible && game.props.person.visible, 'nobody waiting');
    parkAt(game, fare.from.at);
    assert.ok(fare.riding, 'stopping on the pad should pick them up');
    assert.ok(!game.props.person.visible, 'the passenger should have got in');
    assert.notEqual(fare.to.town, fare.from.town, 'a fare goes to another town');
    const time = run.time, coins = game.progress.coins;
    parkAt(game, fare.to.at);
    assert.equal(run.fares, 1);
    assert.ok(run.score >= 100 && game.progress.coins > coins, 'no fare paid');
    assert.ok(run.time > time + 10, 'a fare should add time to the shift');
    assert.notEqual(run.fare, fare, 'there should be a new fare waiting');
  });

  it('taxi: driving onto the pad too fast does not count, and a bumpy ride pays less', () => {
    game.start({ road: 'taxi' });
    const run = game.run, pl = game.player;
    pl.place(run.fare.from.at, pl.fwd);
    pl.alt = pl.ground.carR(pl.up);
    pl.v = 1;
    pl.input.up = true;
    game.update(1 / 60);
    assert.ok(!run.fare.riding, 'picked up at full speed');
    parkAt(game, run.fare.from.at);
    const smooth = { ...run.fare };
    run.fare.comfort = 0.5; // two knocks on the way
    const score = run.score;
    run.fare.elapsed = smooth.par + 1; // (no tip either way)
    parkAt(game, run.fare.to.at);
    assert.equal(run.score - score, 50, 'half comfort should halve the fare');
  });

  it('van courier: parcels by road to the next towns, no Rex, no rings', () => {
    game.start({ road: 'van' });
    const run = game.run, from = run.from, near = planet.cities.sites.filter((s) => s !== from)
      .sort((a, b) => a.c.angleTo(from.c) - b.c.angleTo(from.c)).slice(0, 2);
    assert.equal(game.player.carKind, 'van');
    assert.equal(game.props.rings.length, 0);
    assert.ok(near.includes(run.dest), 'a van parcel should go to one of the two nearest towns');
    parkAt(game, run.stop.at);
    assert.equal(run.deliveries, 1);
    assert.equal(run.rival, null, 'Rex has no van');
  });

  it('round the world: wait for GO, every checkpoint in order, beat Rex', () => {
    game.start({ road: 'race' });
    const run = game.run, pl = game.player, start = pl.up.clone(), coins = game.progress.coins;
    pl.input.up = true;
    for (let i = 0; i < 60; i++) game.update(1 / 60);
    assert.ok(start.angleTo(pl.up) * R < 0.01, 'the car moved before GO');
    for (let i = 0; i < 200; i++) game.update(1 / 60);
    assert.ok(!pl.locked && run.rex.running && run.rex.dist > 0, 'nobody went at GO');
    const skipped = run.gates[2];
    parkAt(game, skipped.at);
    assert.equal(run.next, 0, 'a checkpoint out of order should not count');
    for (const gate of run.gates) parkAt(game, gate.at);
    assert.ok(game.over && run.next === run.gates.length, 'the race should be over at the finish');
    assert.match(game.results.dom.title.textContent, /beat Rex/);
    assert.equal(game.progress.coins, coins + 150);
    assert.ok(app.unlocked.includes('racer'));
    assert.ok(game.progress.bests.race > 0);
  });

  it('round the world: if Rex gets round first, he wins', () => {
    game.start({ road: 'race' });
    for (let i = 0; i < 200; i++) game.update(1 / 60);
    game.run.rex.dist = game.run.lap;
    game.update(1 / 60);
    assert.ok(game.over);
    assert.match(game.results.dom.title.textContent, /Rex wins/);
  });
});
