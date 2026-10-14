import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/dom.mjs';
import { todayKey, dailySeed, dailyParams } from '../js/game/Daily.js';
import { Progress, BASE_STATS } from '../js/game/Progress.js';
import { rollCargo } from '../js/game/Cargo.js';
import { mulberry32 } from '../js/core/Noise.js';

beforeEach(() => localStorage.clear());

test('the daily seed depends only on the date', () => {
  assert.match(todayKey(), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(dailySeed('2026-10-15'), dailySeed('2026-10-15'));
  const seeds = new Set(Array.from({ length: 60 }, (_, i) => dailySeed(new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10))));
  assert.equal(seeds.size, 60, 'two days share a planet');
  for (const s of seeds) assert.ok(Number.isInteger(s) && s >= 0 && s < 1e9);
  assert.deepEqual(dailyParams('2026-10-15'), { seed: dailySeed('2026-10-15'), land: 0.45, cities: 6 });
});

test('a seeded cargo roll gives everyone the same parcels', () => {
  const roll = () => { const r = mulberry32(7); return Array.from({ length: 30 }, () => rollCargo(false, r).id); };
  assert.deepEqual(roll(), roll());
  assert.ok(new Set(roll()).size > 1);
});

test('the daily best is kept per day and survives a reload', () => {
  const p = new Progress();
  assert.equal(p.dailyBest('2026-10-15'), null);
  assert.equal(p.recordDaily('2026-10-15', 500), true);
  assert.equal(p.recordDaily('2026-10-15', 300), false);
  assert.equal(p.recordDaily('2026-10-15', 800), true);
  assert.equal(new Progress().dailyBest('2026-10-15'), 800);
  assert.equal(p.dailyBest('2026-10-16'), null, 'a new day starts fresh');
  assert.equal(p.recordDaily('2026-10-16', 100), true);
  assert.equal(p.best, 0, 'daily scores are separate from the free-flight best');
});

test('the stock plane ignores upgrades', () => {
  const p = new Progress();
  p.addCoins(5000);
  p.buy('engine');
  p.buy('clock');
  assert.equal(BASE_STATS.speed, 1);
  assert.equal(BASE_STATS.startTime, 90);
  assert.ok(p.stats.speed > BASE_STATS.speed);
});
