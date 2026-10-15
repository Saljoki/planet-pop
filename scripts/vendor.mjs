// Copies the third-party files the game loads (three.js and the Bangers font) from node_modules into the repo,
// so the game needs no CDN and works offline. Run after changing their versions: npm run vendor
import { mkdir, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FILES = [
  ['node_modules/three/build/three.module.min.js', 'vendor/three/three.module.min.js'],
  ['node_modules/three/examples/jsm/utils/BufferGeometryUtils.js', 'vendor/three/addons/utils/BufferGeometryUtils.js'],
  ['node_modules/three/LICENSE', 'vendor/three/LICENSE'],
  ['node_modules/@fontsource/bangers/files/bangers-latin-400-normal.woff2', 'fonts/bangers-latin-400-normal.woff2'],
  ['node_modules/@fontsource/bangers/LICENSE', 'fonts/LICENSE'],
];

for (const [from, to] of FILES) {
  await mkdir(dirname(join(ROOT, to)), { recursive: true });
  await copyFile(join(ROOT, from), join(ROOT, to));
  console.log(`${from} → ${to}`);
}
