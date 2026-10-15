import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { stickAxes } from '../js/game/TouchStick.js';
import { tiltAngles, tiltAxes } from '../js/game/TiltSteer.js';
import { Gestures } from '../js/camera/Gestures.js';
import { happenings } from '../js/world/Happenings.js';
import { TourMode } from '../js/ui/TourMode.js';
import { FindMenu } from '../js/ui/FindMenu.js';
import { KINDS, describe as describeThing } from '../js/ui/InfoCard.js';

const wait = (ms) => new Promise((res) => setTimeout(res, ms));

/** A canvas stand-in that remembers its listeners, so pointer events can be played into Gestures. */
function surface() {
  const on = {};
  return {
    on,
    addEventListener: (type, fn) => (on[type] ??= []).push(fn),
    setPointerCapture() {},
    fire(type, id, x, y, extra = {}) {
      for (const fn of on[type] || []) fn({ type, pointerId: id, clientX: x, clientY: y, pointerType: 'touch', button: 0, preventDefault() {}, ...extra });
    },
  };
}

function recorder() {
  const log = [];
  const h = new Proxy({}, { get: (_, k) => (...a) => log.push([k, ...a]) });
  return { h, log, sum: (k, i = 1) => log.filter((e) => e[0] === k).reduce((s, e) => s + e[i], 0), has: (k) => log.some((e) => e[0] === k) };
}

describe('touch controls', () => {
  it('thumbstick: dead zone, full deflection, up is climb', () => {
    assert.deepEqual(stickAxes(3, -4), { steer: 0, climb: 0 });
    const right = stickAxes(200, 0);
    assert.equal(right.steer, 1);
    assert.equal(Math.abs(right.climb), 0);
    assert.equal(stickAxes(0, -60).climb, 1);
    assert.equal(stickAxes(0, 60).climb, -1);
    const diag = stickAxes(30, -30);
    assert.ok(diag.steer > 0.2 && diag.steer < 0.5 && diag.climb > 0.2, JSON.stringify(diag));
  });

  it('tilt: steering-wheel turns steer, tipping the top away dives, landscape is handled', () => {
    const upright = tiltAngles(90, 0, 0);
    assert.ok(Math.abs(upright.wheel) < 1e-9 && Math.abs(upright.pitch) < 1e-9);
    // held upright and turned clockwise like a wheel: the world's up leans toward the screen's left
    const level = tiltAxes(70, 0, 0, tiltAngles(70, 0, 0).pitch);
    assert.equal(level.steer, 0);
    assert.equal(level.climb, 0);
    assert.ok(tiltAxes(70, -30, 0, tiltAngles(70, 0, 0).pitch).steer !== 0, 'no steering from a sideways tilt');
    const away = tiltAxes(45, 0, 0, tiltAngles(70, 0, 0).pitch);   // top tipped away from you
    const toward = tiltAxes(85, 0, 0, tiltAngles(70, 0, 0).pitch); // pulled back toward you
    assert.ok(away.climb < -0.5 && toward.climb > 0.3, `${away.climb} ${toward.climb}`);
    // on its side (screen turned 90°): the phone's own up is now along its x axis
    const side = tiltAngles(0, -90, 90);
    assert.ok(Math.abs(side.wheel) < 1e-6 && Math.abs(side.pitch) < 1e-6, JSON.stringify(side));
    const sideTurn = tiltAxes(20, -70, 90, side.pitch);
    assert.ok(Math.abs(sideTurn.steer) > 0.5, 'no steering in landscape');
  });

  it('gestures: drag, pinch and twist, two-finger tilt, tap, double-tap and hold', async () => {
    const el = surface(), r = recorder();
    new Gestures(el, r.h);
    el.fire('pointerdown', 1, 100, 100);
    el.fire('pointermove', 1, 130, 110);
    el.fire('pointerup', 1, 130, 110);
    assert.equal(r.sum('drag', 1), 30);
    // pinch out while twisting
    el.fire('pointerdown', 1, 100, 200);
    el.fire('pointerdown', 2, 200, 200);
    for (let k = 1; k <= 6; k++) el.fire('pointermove', 2, 200 + k * 8, 200 + k * 6);
    el.fire('pointerup', 2, 248, 236);
    el.fire('pointerup', 1, 100, 200);
    assert.ok(r.has('zoom') && r.sum('twist') > 0.2 && !r.has('tilt'), 'pinch-and-twist not recognised');
    // both fingers slide up together: tilt
    const t = recorder(), el2 = surface();
    new Gestures(el2, t.h);
    el2.fire('pointerdown', 1, 100, 300);
    el2.fire('pointerdown', 2, 200, 300);
    for (let k = 1; k <= 6; k++) { el2.fire('pointermove', 1, 100, 300 - k * 10); el2.fire('pointermove', 2, 200, 300 - k * 10); }
    assert.ok(t.sum('tilt') < -30 && !t.has('zoom'), 'two-finger drag not recognised as tilt');
    // a tap waits to see if it's a double-tap
    const g = recorder(), el3 = surface();
    new Gestures(el3, g.h);
    el3.fire('pointerdown', 1, 50, 50);
    el3.fire('pointerup', 1, 50, 50);
    assert.ok(!g.has('tap'));
    await wait(320);
    assert.ok(g.has('tap'));
    el3.fire('pointerdown', 1, 80, 80);
    el3.fire('pointerup', 1, 80, 80);
    el3.fire('pointerdown', 1, 82, 81);
    el3.fire('pointerup', 1, 82, 81);
    await wait(320);
    assert.equal(g.log.filter((e) => e[0] === 'tap').length, 1, 'a double-tap also fired a tap');
    assert.ok(g.has('doubleTap'));
    el3.fire('pointerdown', 1, 60, 60);
    await wait(600);
    el3.fire('pointerup', 1, 60, 60);
    await wait(320);
    assert.ok(g.has('hold'));
    assert.equal(g.log.filter((e) => e[0] === 'tap').length, 1, 'a hold also fired a tap');
    // mouse clicks don't wait
    const m = recorder(), el4 = surface();
    new Gestures(el4, m.h);
    el4.fire('pointerdown', 1, 5, 5, { pointerType: 'mouse' });
    el4.fire('pointerup', 1, 5, 5, { pointerType: 'mouse' });
    assert.ok(m.has('tap'));
  });
});

describe('phone modes on a planet', () => {
  let app, planet;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5 }));
    app.tour = new TourMode(app);
    app.find = new FindMenu(app);
    app.game.hangar.hide();
    app.wakeLock = { reasons: new Set(), want(r, on) { if (on) this.reasons.add(r); else this.reasons.delete(r); } };
    app.togglePause = function () { this.paused = !this.paused; this.game.pauseMenu.sync(); }; // as App does
  });
  after(() => planet.dispose());

  it('camera: twist turns the orbit view, the compass resets it, double-tap swoops in, hold opens an info card', () => {
    const rig = app.rig;
    rig.release(true);
    run(app, 0.1, { camera: true });
    rig.orbit.alt = 13;
    rig.twist(0.6);
    rig.tilt(-100);
    assert.ok(rig.turned && Math.abs(rig.orbit.heading - 0.6) < 1e-9 && rig.orbit.tilt > 0.3);
    run(app, 0.05, { camera: true });
    assert.ok(rig.orbit.tilt > 0.05 && rig.orbit.tilt < 0.3, `tilt not capped at the horizon (${rig.orbit.tilt})`);
    const nadir = app.camera.position.clone().normalize().negate(), look = app.camera.getWorldDirection(new THREE.Vector3());
    assert.ok(look.angleTo(nadir) < Math.asin(10 / app.camera.position.length()), 'tilted so far the middle of the screen is off the planet');
    rig.resetView();
    run(app, 1, { dt: 1 / 30, camera: true });
    assert.ok(!rig.turned, 'compass did not reset the view');
    const alt = rig.orbit.alt;
    rig.zoomAt(640, 400);
    run(app, 1, { dt: 1 / 30, camera: true });
    assert.ok(rig.orbit.alt < alt * 0.6, 'double-tap did not zoom in');
    const whale = planet.whales.entities[0];
    planet.whales.list[0].state = 'blow';
    planet.whales.list[0].y = -0.03;
    rig.focus(whale);
    run(app, 2, { dt: 1 / 30, camera: true });
    whale.getPos(new THREE.Vector3()).project(app.camera); // it's on screen now
    app.hud.info.show(whale);
    assert.ok(app.hud.info.open);
    assert.match(app.hud.info.dom.status.textContent, /spout|air|Leaping|Diving|Swimming/);
    for (const e of planet.entities) assert.equal(typeof describeThing(e, planet), 'string');
    for (const k of new Set(planet.entities.map((e) => e.kind))) assert.ok(KINDS[k], `no icon for ${k}`);
  });

  it('happenings: live events come first and point somewhere', () => {
    planet.ufo.arrive();
    planet.ufo.update(3.01, app.simTime);
    planet.volcano.state = 'erupt';
    const list = happenings(planet);
    assert.equal(list[0].id, 'ufo');
    assert.ok(list.some((h) => h.id.startsWith('volcano')));
    for (const h of list) assert.ok(h.entity || h.view, `${h.id} has nowhere to go`);
    planet.meteors.start();
    const met = happenings(planet).find((h) => h.id === 'meteors');
    assert.ok(met?.view && met.view.alt < 5 && met.view.tilt > 0.5, 'meteor view should look up from low down');
  });

  it('find menu: visits each kind in turn, towns, and live events', () => {
    const f = app.find, rig = app.rig;
    f.show();
    assert.ok(f.open);
    f.go('kind:whale');
    assert.equal(rig.entity.kind, 'whale');
    const w = planet.whales.list[planet.whales.entities.indexOf(rig.entity)];
    assert.ok(w.force, 'the whale was not asked to show off');
    assert.ok(!f.open, 'menu stayed open');
    f.show();
    f.go('kind:whale');
    assert.equal(rig.entity, planet.whales.entities[1], 'second tap should visit the next whale');
    f.show();
    f.go('town:1');
    assert.equal(rig.entity, planet.cities.entities[1]);
    f.show();
    f.go('now:0');
    assert.equal(rig.entity.kind, 'ufo');
  });

  it('tour: starts when idle, hops between sights, stops on any input', () => {
    const tour = app.tour, rig = app.rig;
    rig.release(true);
    tour.idle = 0;
    run(app, 0.1);
    tour.update(61);
    assert.ok(tour.on, 'tour did not start after a minute idle');
    assert.ok(app.wakeLock.reasons.has('tour'), 'screen allowed to sleep during the tour');
    const first = tour.item;
    assert.ok(first && (rig.entity || rig.queued || rig.tween), 'tour went nowhere');
    for (let i = 0; i < 4; i++) { tour.t = 99; tour.update(0.1); }
    assert.notEqual(tour.item.id, first.id, 'tour stuck on one thing');
    assert.ok(new Set(tour.recent).size === tour.recent.length);
    tour.input({ target: null });
    assert.ok(!tour.on && !app.wakeLock.reasons.has('tour'), 'input did not stop the tour');
    tour.setAuto(false);
    tour.update(120);
    assert.ok(!tour.on, 'idle tour started while switched off');
    tour.setAuto(true);
  });

  it('free flight: no clock, no parcels, no coins; rings refill boost; quitting works', () => {
    const g = app.game, coins = g.progress.coins;
    g.start({ free: true });
    assert.ok(g.active && g.free && !g.dest && !g.beacon.visible);
    assert.ok(app.wakeLock.reasons.has('game'));
    const time = g.time;
    run(app, 5, { game: true });
    assert.equal(g.time, time, 'the clock ran in free flight');
    g.player.boost = 0;
    g.rings[0].position.copy(g.player.pos);
    run(app, 0.05, { game: true });
    assert.ok(g.player.boost > 0.9, 'ring did not refill the boost');
    assert.equal(g.progress.coins, coins, 'free flight paid coins');
    assert.ok(!g.rival, 'Rex turned up in free flight');
    g.free.time = 119.99;
    run(app, 0.05, { game: true });
    assert.ok(app.unlocked.includes('sightseer'));
    // the thumbstick steers: full right turns the plane right
    const right = new THREE.Vector3().crossVectors(g.player.fwd, g.player.up), before = g.player.fwd.clone();
    g.stick = { steer: 1, climb: 0, reset() {} };
    run(app, 0.3, { game: true });
    assert.ok(g.player.fwd.clone().sub(before).dot(right) > 0, 'stick right did not turn right');
    // …and banks into the turn: the plane's own up leans to the right, right wing down
    const tilted = new THREE.Vector3(0, 1, 0).applyQuaternion(g.player.group.quaternion);
    assert.ok(tilted.dot(new THREE.Vector3().crossVectors(g.player.fwd, g.player.up)) > 0.2, 'plane banks the wrong way turning right');
    g.stick = { steer: -1, climb: 0, reset() {} };
    run(app, 0.6, { game: true });
    const tiltedL = new THREE.Vector3(0, 1, 0).applyQuaternion(g.player.group.quaternion);
    assert.ok(tiltedL.dot(new THREE.Vector3().crossVectors(g.player.up, g.player.fwd)) > 0.2, 'plane banks the wrong way turning left');
    g.stick = null;
    g.stop();
    assert.ok(!g.active && !app.wakeLock.reasons.has('game'));
  });

  it('pause menu shows while a run is paused', () => {
    const g = app.game;
    g.start();
    app.togglePause();
    assert.ok(!g.pauseMenu.el.classList.contains('hidden'));
    app.togglePause();
    assert.ok(g.pauseMenu.el.classList.contains('hidden'));
    g.stop();
  });
});
