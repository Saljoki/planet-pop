import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { makeWorld, run, assertFiniteInstances } from './helpers/world.mjs';
import { THEMES, THEME_IDS, pickTheme } from '../js/world/Themes.js';
import { TREE_SHAPES } from '../js/world/TreeShapes.js';
import { dailyParams } from '../js/game/Daily.js';

describe('world themes', () => {
  it('every theme is complete and its tree shapes exist', () => {
    for (const t of Object.values(THEMES)) {
      for (const k of ['seabed', 'sand', 'g1', 'g2', 'g3', 'rock', 'snow', 'city']) assert.match(t.pal[k], /^#[0-9a-f]{6}$/i, `${t.id} ${k}`);
      assert.ok(TREE_SHAPES[t.trees.a.shape] && TREE_SHAPES[t.trees.b.shape], `${t.id}: unknown tree shape`);
      assert.ok(t.buildings.length && t.mountains.colors.length && t.storms >= 1 && t.volcanoes >= 1);
    }
  });

  it('surprise planets: about a third classic, every theme turns up, same seed same theme', () => {
    const counts = Object.fromEntries(THEME_IDS.map((t) => [t, 0]));
    for (let s = 0; s < 5000; s++) counts[pickTheme(s * 7919 + 13)]++;
    assert.ok(counts.classic > 1500 && counts.classic < 2100, `classic ${counts.classic}`);
    for (const t of THEME_IDS) assert.ok(counts[t] > 500, `${t} only ${counts[t]}`);
    assert.equal(pickTheme(123456), pickTheme(123456));
    assert.equal(dailyParams('2026-10-15').theme, pickTheme(dailyParams('2026-10-15').seed));
  });

  for (const theme of ['ice', 'desert', 'candy', 'lava']) {
    it(`builds and runs a ${theme} world`, async () => {
      const { app, planet } = await makeWorld({ seed: 20261014, land: 0.45, cities: 5, theme });
      assert.equal(planet.theme.id, theme);
      run(app, 30, { dt: 1 / 20 });
      assertFiniteInstances(planet.root, theme);
      const look = THEMES[theme];
      assert.equal(planet.weather.storms.length, look.storms);
      assert.equal(planet.weather.precip, look.precip.kind);
      assert.equal(planet.weather.flakes.length > 0, look.mountains.snow, 'snow on the peaks only where the theme has it');
      if (theme === 'lava') {
        assert.equal(planet.boats.boats.length, 0, 'boats on a lava sea');
        assert.equal(planet.harbours.list.length, 0);
        assert.ok(planet.volcanoes.length >= 2, `only ${planet.volcanoes.length} volcano`);
      } else {
        assert.ok(planet.boats.boats.length > 0);
      }
      planet.dispose();
    });
  }
});
