import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/dom.mjs';
import { Progress, SKINS } from '../js/game/Progress.js';
import { rollCargo } from '../js/game/Cargo.js';

beforeEach(() => localStorage.clear());

test('the best score from before the hangar existed carries over', () => {
  localStorage.setItem('planetpop.best', '900');
  assert.equal(new Progress().best, 900);
});

test('upgrades cost coins, cap at their max level and change the stats', () => {
  const p = new Progress();
  assert.equal(p.buy('engine'), false, 'no coins yet');
  p.addCoins(5000);
  for (let i = 0; i < 6; i++) p.buy('engine');
  assert.equal(p.level('engine'), 4);
  assert.equal(p.nextCost('engine'), null);
  assert.equal(p.coins, 5000 - (150 + 350 + 700 + 1200));
  assert.equal(p.stats.speed, 1.32);
});

test('paint jobs: bought with coins, or unlocked by a trophy for free', () => {
  const p = new Progress();
  p.addCoins(300);
  const gold = SKINS.find((s) => s.id === 'gold');
  assert.equal(p.skinState(gold, new Set()), 'locked');
  assert.equal(p.chooseSkin('gold', new Set()), false);
  assert.equal(p.chooseSkin('gold', new Set(['ace'])), true);
  assert.equal(p.coins, 300);
  assert.equal(p.chooseSkin('fire', new Set()), true);
  assert.equal(p.coins, 50);
  assert.equal(p.chooseSkin('mint', new Set()), false, 'cannot afford');
});

test('progress survives a reload', () => {
  const p = new Progress();
  p.addCoins(1000);
  p.buy('wings');
  p.chooseSkin('sky', new Set());
  p.recordScore(4321);
  const again = new Progress();
  assert.equal(again.coins, p.coins);
  assert.equal(again.level('wings'), 1);
  assert.equal(again.skin, 'sky');
  assert.equal(again.best, 4321);
});

test('cargo mix follows the weights, and every run starts with a regular parcel', () => {
  const counts = {};
  for (let i = 0; i < 40000; i++) { const id = rollCargo().id; counts[id] = (counts[id] || 0) + 1; }
  const pct = (id) => (counts[id] / 40000) * 100;
  assert.ok(Math.abs(pct('standard') - 45) < 2);
  assert.ok(Math.abs(pct('urgent') - 20) < 2);
  assert.ok(Math.abs(pct('fragile') - 20) < 2);
  assert.ok(Math.abs(pct('heavy') - 15) < 2);
  assert.equal(rollCargo(true).id, 'standard');
});
