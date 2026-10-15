import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run } from './helpers/world.mjs';
import { readFileSync } from 'node:fs';
import { Settings, DEFAULTS, cleanName } from '../js/game/Settings.js';
import { VERSION } from '../js/core/Version.js';
import { DailyRun } from '../js/game/runs/DailyRun.js';
import { briefingFor, controlsFor } from '../js/game/screens/Briefing.js';
import { MISSIONS } from '../js/game/Missions.js';

describe('settings', () => {
  it('start from the defaults, are remembered, and ignore junk', () => {
    localStorage.clear();
    const a = new Settings();
    assert.deepEqual(a.values, DEFAULTS);
    const seen = [];
    a.onChange((k, v) => seen.push([k, v]));
    a.set('invertY', true);
    a.set('sensitivity', 1.3);
    a.set('nonsense', 5);
    assert.deepEqual(seen, [['invertY', true], ['sensitivity', 1.3]]);
    const b = new Settings();
    assert.equal(b.get('invertY'), true);
    assert.equal(b.get('sensitivity'), 1.3);
    localStorage.setItem('planetpop.settings', JSON.stringify({ invertY: 'yes', sensitivity: 2 }));
    const c = new Settings();
    assert.equal(c.get('invertY'), false, 'a string is not a switch');
    assert.equal(c.get('sensitivity'), 2);
    localStorage.clear();
  });

  it('the player name is tidied, kept short and remembered', () => {
    localStorage.clear();
    assert.equal(cleanName('  Ata \n  Ur   Rehman '), 'Ata Ur Rehman');
    assert.equal(cleanName('<b>Rex</b>'), 'bRex/b', 'no tags');
    assert.equal(cleanName('Supercalifragilistic'), 'Supercalifragili');
    assert.equal([...cleanName('🚀'.repeat(20))].length, 16, 'emoji count as one letter each');
    const a = new Settings();
    assert.equal(a.playerName, '');
    a.setPlayerName('  Zippy ');
    assert.equal(new Settings().playerName, 'Zippy');
    localStorage.setItem('planetpop.settings', JSON.stringify({ playerName: '<script>x' }));
    assert.equal(new Settings().playerName, 'scriptx', 'a hand-edited name is tidied on loading');
    localStorage.clear();
  });

  it('the version matches package.json', () => {
    assert.equal(VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url))).version);
  });
});

describe('briefing text', () => {
  it('explains each kind of run', () => {
    assert.match(briefingFor().goal, /parcels/);
    assert.match(briefingFor({ daily: true }).title, /Daily/);
    assert.match(briefingFor({ free: true }).goal, /No clock/);
    const m = MISSIONS.find((x) => x.id === 'care'), b = briefingFor({ mission: m });
    assert.equal(b.title, m.name);
    assert.equal(b.goal, m.brief);
    assert.ok(b.tips.some((t) => t.includes(String(m.reward))) && b.tips.some((t) => /slip/.test(t)));
  });

  it('shows the controls for the device, and says when Y is inverted', () => {
    assert.ok(controlsFor({ touch: true }).some((l) => /thumb/.test(l)));
    assert.ok(controlsFor({ touch: false }).some((l) => /Space/.test(l)));
    assert.ok(controlsFor({ pad: true }).some((l) => /stick/.test(l)));
    assert.ok(controlsFor({ invertY: false }).some((l) => /up to climb/.test(l)));
    assert.ok(controlsFor({ invertY: true }).some((l) => /up to dive/.test(l) && /Invert Y is on/.test(l)));
  });
});

describe('briefing, options and invert Y in Sky Courier', () => {
  let app, planet, game;
  before(async () => {
    localStorage.clear();
    ({ app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5 }));
    game = app.game;
  });
  after(() => { game.stop(); planet.dispose(); });

  it('the briefing comes first; Start begins the run, Back returns to where it was chosen', () => {
    game.launch();
    assert.ok(game.briefing.open && !game.active);
    game.briefing.back();
    assert.ok(!game.briefing.open && game.hangar.open, 'Back should reopen the hangar');
    game.hangar.hide();
    game.launch({ mission: MISSIONS[0] });
    game.briefing.back();
    assert.ok(game.board.open, 'Back from a mission briefing should reopen the mission board');
    game.board.hide();
    game.launch({ free: true });
    game.briefing.start();
    assert.ok(game.active && game.run.opts.free, 'Start did not begin the run it was briefing');
    game.stop();
  });

  it('controller: A in the hangar opens the briefing, A again takes off, B goes back', async () => {
    const { Gamepad } = await import('../js/game/input/Gamepad.js');
    const buttons = Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
    const pad = { connected: true, id: 'Test pad', axes: [0, 0, 0, 0], buttons }, router = new Gamepad(app);
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    const press = (i) => { buttons[i].pressed = true; router.update(); buttons[i].pressed = false; router.update(); };
    game.openHangar();
    press(0);
    assert.ok(game.briefing.open && !game.hangar.open && !game.active, 'A in the hangar should open the briefing');
    press(1);
    assert.ok(!game.briefing.open && game.hangar.open, 'B should go back to the hangar');
    press(0);
    press(0);
    assert.ok(game.active, 'A on the briefing should take off');
    game.stop();
    delete navigator.getGamepads;
  });

  it('switching the briefing off starts runs straight away (and Options can switch it back on)', () => {
    app.settings.set('briefing', false);
    game.launch();
    assert.ok(game.active && !game.briefing.open);
    game.stop();
    app.settings.set('briefing', true);
    game.launch();
    assert.ok(game.briefing.open);
    game.briefing.hide();
  });

  it('Invert Y flips climbing for keys and the thumbstick, live, and Rex is unaffected', () => {
    game.start();
    const pl = game.player, climbFor = (set) => {
      pl.alt = 14; // well clear of the town below
      Object.assign(pl.input, { up: false, down: false }, set);
      const a0 = pl.alt;
      run(app, 0.3, { game: true });
      Object.assign(pl.input, { up: false, down: false });
      return pl.alt - a0;
    };
    assert.ok(climbFor({ up: true }) > 0.2, 'up should climb');
    app.settings.set('invertY', true); // mid-run
    assert.ok(climbFor({ up: true }) < -0.2, 'inverted: up should dive');
    game.controls.stick = { steer: 0, climb: 1, reset() {} };
    assert.ok(climbFor({}) < -0.2, 'inverted: thumbstick up should dive');
    game.controls.stick = null;
    app.settings.set('invertY', false);
    assert.ok(climbFor({ down: true }) < -0.2);
    game.run.deliver(); // Rex turns up after the first delivery
    assert.equal(game.run.rival.plane.controls.invertY, false, 'Rex should not follow the player’s options');
    game.stop();
  });

  it('steering sensitivity scales the turn rate', () => {
    const turned = (sens) => {
      app.settings.set('sensitivity', sens);
      game.start();
      const before = game.player.fwd.clone();
      game.player.input.left = true;
      run(app, 0.25, { game: true });
      const ang = game.player.fwd.angleTo(before);
      game.stop();
      return ang;
    };
    const slow = turned(0.5), fast = turned(1.5);
    assert.ok(fast > slow * 2.2, `sensitivity had little effect (${slow.toFixed(3)} vs ${fast.toFixed(3)})`);
    app.settings.set('sensitivity', 1);
  });

  it('Options from the pause menu, then back to the pause menu', () => {
    app.togglePause = function () { this.paused = !this.paused; this.game.pauseMenu.sync(); };
    game.start();
    app.togglePause();
    assert.ok(!game.pauseMenu.el.classList.contains('hidden'));
    game.pauseMenu.el.classList.add('hidden');
    game.options.show(() => game.pauseMenu.sync());
    game.pauseMenu.sync();
    assert.ok(game.pauseMenu.el.classList.contains('hidden'), 'pause menu showing under Options');
    game.options.hide();
    assert.ok(!game.pauseMenu.el.classList.contains('hidden'), 'pause menu did not come back after Options');
    app.togglePause();
    game.stop();
  });

  it('sound switch and volume are options too', () => {
    app.settings.set('sound', false);
    assert.equal(app.sfx.enabled, false);
    app.settings.set('sound', true);
    assert.equal(app.sfx.enabled, true);
  });

  it('reset progress needs two taps and keeps trophies', () => {
    const p = game.progress;
    p.addCoins(500);
    p.buy('engine');
    p.completeMission(MISSIONS[0]);
    app.achievements.unlock('courier');
    game.options.show();
    game.options.reset();
    assert.ok(p.coins > 0, 'one tap should only arm it');
    game.options.reset();
    assert.equal(p.coins, 0);
    assert.equal(p.level('engine'), 0);
    assert.ok(!p.missionDone(MISSIONS[0].id));
    assert.ok(app.achievements.done.has('courier'), 'trophies should stay');
    const reloaded = new (p.constructor)();
    assert.equal(reloaded.coins, 0, 'the reset was not saved');
    game.options.hide();
  });

  it('your name: on the results card and in the daily share', async () => {
    app.settings.setPlayerName('Ata');
    game.start({ free: true });
    game.finish({ title: 'Done', html: '' });
    assert.equal(game.results.dom.who.textContent, '🧑‍✈️ Ata');
    assert.ok(!game.results.dom.who.classList.contains('hidden'));
    game.stop();
    let copied = '';
    Object.defineProperty(globalThis.navigator, 'clipboard', { value: { writeText: async (t) => { copied = t; } }, configurable: true });
    globalThis.location ??= { origin: 'https://example.test', pathname: '/' };
    await DailyRun.prototype.share.call({ app, date: '2026-10-16', score: 42, deliveries: 3 });
    assert.match(copied, /Ata scored ⭐ 42 with 3 deliveries/);
    app.settings.setPlayerName('');
    game.start({ free: true });
    game.finish({ title: 'Done', html: '' });
    assert.ok(game.results.dom.who.classList.contains('hidden'), 'no name, no name tag');
    game.stop();
  });

  it('the plane steers the right way with invert on (only climbing flips)', () => {
    app.settings.set('invertY', true);
    game.start();
    const pl = game.player, right = new THREE.Vector3().crossVectors(pl.fwd, pl.up), before = pl.fwd.clone();
    pl.input.right = true;
    run(app, 0.3, { game: true });
    assert.ok(pl.fwd.clone().sub(before).dot(right) > 0);
    game.stop();
    app.settings.set('invertY', false);
  });
});
