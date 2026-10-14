import { test } from 'node:test';
import assert from 'node:assert/strict';

// Fake clock + storage so the auto-quality controller can be driven with synthetic frame times.
let clock = 0;
const store = new Map();
globalThis.performance = { now: () => clock * 1000 };
globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
globalThis.devicePixelRatio = 1.25;
const { Quality } = await import('../js/render/Quality.js');

/** Runs the controller for `seconds` with frame time `frameMs(level)`; returns the controller and level changes. */
function simulate(frameMs, seconds = 600, { keepStore = false } = {}) {
  if (!keepStore) store.clear();
  let pr = 1.25;
  const app = {
    userInk: true, userShadows: true,
    renderer: { getPixelRatio: () => pr, setPixelRatio: (v) => { pr = v; } },
    postfx: { enabled: true, samples: 4, setSamples(n) { this.samples = n; } },
    sky: { light: { castShadow: true, shadow: { mapSize: { x: 2048, set(a) { this.x = a; } }, map: null } } },
    resize() {}, hud: { setQuality() {} },
  };
  const q = new Quality(app);
  let changes = 0, last = q.name;
  for (clock = 0; clock < seconds;) {
    const dt = frameMs(q.level) / 1000;
    clock += dt;
    q.tick(Math.min(dt, 0.1));
    if (q.name !== last) { changes++; last = q.name; }
  }
  return { q, app, changes };
}

test('a weak GPU settles on Balanced at full CSS resolution, never below 1.0', () => {
  const { q, app } = simulate((l) => [42, 30, 21, 15][l]);
  assert.equal(q.name, 'Balanced');
  assert.equal(q.pr, 1);
  assert.equal(app.postfx.samples, 0, 'Balanced relies on FXAA instead of multisampling');
});

test('a CPU-bound machine keeps Crisp (lower settings would not help)', () => {
  const { q } = simulate(() => 30);
  assert.equal(q.name, 'Crisp');
  assert.equal(q.pr, 1.25);
});

test('a fast machine at 60 Hz or 144 Hz never changes level', () => {
  for (const hz of [60, 144]) {
    const { q, changes } = simulate(() => 1000 / hz);
    assert.equal(q.name, 'Crisp');
    assert.equal(changes, 0);
  }
});

test('auto mode remembers the level between sessions', () => {
  simulate((l) => [42, 30, 21, 15][l], 60);
  const { q, changes } = simulate((l) => [42, 30, 21, 15][l], 60, { keepStore: true });
  assert.equal(q.name, 'Balanced');
  assert.equal(changes, 0);
});

test('fixed modes ignore frame times; Fast turns the ink pass off', () => {
  const { q, app } = simulate(() => 50, 30);
  q.setMode('fast');
  for (let i = 0; i < 300; i++) { clock += 0.05; q.tick(0.05); }
  assert.equal(q.name, 'Fast');
  assert.equal(app.postfx.enabled, false);
  q.setMode('crisp');
  assert.equal(q.name, 'Crisp');
  assert.equal(app.postfx.enabled, true);
});
