import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import { precacheSource } from '../scripts/precache.mjs';

const root = new URL('../', import.meta.url);

test('precache.js lists every game file (run `npm run precache` after changing files)', async () => {
  assert.equal(await readFile(new URL('precache.js', root), 'utf8'), await precacheSource(), 'precache.js is out of date');
});

test('everything the page needs is local: no CDN, fonts and three.js in the repo', async () => {
  const html = await readFile(new URL('index.html', root), 'utf8');
  assert.ok(!/https?:\/\//.test(html.replace(/<!--[\s\S]*?-->/g, '')), 'index.html still loads something from the internet');
  const map = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]).imports;
  await access(new URL(map.three, root));
  await access(new URL(`${map['three/addons/']}utils/BufferGeometryUtils.js`, root));
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));
  for (const icon of manifest.icons) await access(new URL(icon.src, root));
  assert.ok(manifest.icons.some((i) => i.purpose === 'maskable'), 'no maskable icon for Android');
});
