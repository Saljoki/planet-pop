import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers/dom.mjs';
import { ambientMix, Ambience } from '../js/ui/Ambience.js';

test('ambient mix follows the camera: surf by the sea, a hum in space, birds by day and crickets at night', () => {
  const beach = ambientMix({ alt: 1, sea: 0.8, city: 0, night: 0 });
  const space = ambientMix({ alt: 40, sea: 0.5, city: 0, night: 0 });
  const town = ambientMix({ alt: 1, sea: 0, city: 1, night: 0 });
  const meadowDay = ambientMix({ alt: 1, sea: 0, city: 0, night: 0 });
  const meadowNight = ambientMix({ alt: 1, sea: 0, city: 0, night: 1 });
  assert.ok(beach.waves > 0.7 && space.waves === 0);
  assert.ok(space.drone === 1 && beach.drone === 0);
  assert.ok(town.city > 0.8 && beach.city === 0);
  assert.ok(meadowDay.birds > 0.8 && meadowDay.crickets === 0);
  assert.ok(meadowNight.crickets > 0.8 && meadowNight.birds === 0);
  for (const mix of [beach, space, town, meadowDay, meadowNight]) {
    for (const [k, v] of Object.entries(mix)) assert.ok(v >= 0 && v <= 1, `${k} out of range: ${v}`);
  }
});

test('the ambience volume is remembered', () => {
  localStorage.clear();
  const a = new Ambience({});
  assert.equal(a.volume, 0.5);
  a.setVolume(0.2);
  assert.equal(new Ambience({}).volume, 0.2);
});
