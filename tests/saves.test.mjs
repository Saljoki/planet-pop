import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fakeEl } from './helpers/dom.mjs';
import { makeSaveCode, readSaveCode, applySave, SAVED_KEYS } from '../js/core/SaveCode.js';
import { SaveBox } from '../js/game/screens/SaveBox.js';
import { Progress } from '../js/game/Progress.js';
import { Settings } from '../js/game/Settings.js';

const fill = () => {
  const p = new Progress();
  p.addCoins(777);
  p.buy('engine');
  new Settings().setPlayerName('Ata');
  localStorage.setItem('planetpop.trophies', JSON.stringify(['courier', 'ufo']));
  localStorage.setItem('planetpop.quality', 'fast'); // this device's own: not in a save
};

describe('save codes', () => {
  beforeEach(() => localStorage.clear());

  it('carry progress, trophies and options to another browser', async () => {
    fill();
    const code = await makeSaveCode();
    assert.match(code, /^PLANETPOP1-[A-Za-z0-9_-]+$/);
    localStorage.clear();
    applySave(await readSaveCode(`  ${code.slice(0, 30)}\n${code.slice(30)} `)); // (pasted with line breaks)
    const p = new Progress();
    assert.equal(p.coins, 777 - 150);
    assert.equal(p.level('engine'), 1);
    assert.equal(new Settings().playerName, 'Ata');
    assert.deepEqual(JSON.parse(localStorage.getItem('planetpop.trophies')), ['courier', 'ufo']);
    assert.equal(localStorage.getItem('planetpop.quality'), null, 'device settings stay with the device');
  });

  it('turn away anything that isn’t a good save', async () => {
    const bad = async (code, why) => assert.rejects(readSaveCode(code), why);
    await bad('hello', /isn’t a Planet Pop save code/);
    await bad('PLANETPOP1-%%%%', /isn’t a Planet Pop save code/);
    await bad('PLANETPOP1-AAAA', /isn’t a Planet Pop save code/);
    const plain = (obj) => `PLANETPOP0-${Buffer.from(JSON.stringify(obj)).toString('base64url')}`;
    await bad(plain({ v: 2, data: {} }), /damaged/);
    await bad(plain({ v: 1, data: { 'planetpop.courier': '{not json' } }), /damaged/);
    await bad(plain({ v: 1, data: { 'planetpop.courier': 5 } }), /damaged/);
    await bad(plain({ v: 1, data: { evil: '1' } }), /empty/);
    await bad('PLANETPOP0-' + 'A'.repeat(300000), /too long/);
    const ok = await readSaveCode(plain({ v: 1, data: { 'planetpop.best': '12', evil: '"x"' } }));
    assert.deepEqual(ok, { 'planetpop.best': '12' }, 'only the game’s own keys are loaded');
    assert.ok(SAVED_KEYS.every((k) => k.startsWith('planetpop.')));
  });

  it('Options: loading a code takes a second tap, then replaces the progress and reloads', async () => {
    fill();
    const code = await makeSaveCode();
    localStorage.clear();
    const box = new SaveBox({ hud: { toast() {} } }, fakeEl());
    let reloaded = 0;
    box.reload = () => reloaded++;
    assert.equal(await box.load('nonsense'), false);
    assert.equal(await box.load(code), false, 'the first tap only warns');
    assert.equal(new Progress().coins, 0);
    assert.equal(await box.load(code), true);
    assert.equal(reloaded, 1);
    assert.equal(new Progress().coins, 777 - 150);
    localStorage.clear();
    assert.equal(await box.load(code, true), true, 'a chosen file loads straight away');
  });
});
