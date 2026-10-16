// Copies the third-party files the game loads (three.js, the Bangers font, and Trystero for playing with friends)
// from node_modules into the repo, so the game needs no CDN and works offline. Run after changing their versions:
// npm run vendor
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
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

// Trystero (WebRTC rooms, matched up through public Nostr relays) comes in several packages: bundle them into one file.
const { build } = await import('esbuild');
await build({
  stdin: { contents: "export { joinRoom, selfId } from '@trystero-p2p/nostr';", resolveDir: ROOT },
  bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none',
  outfile: join(ROOT, 'vendor/trystero/trystero-nostr.js'),
});
const licences = [['Trystero (@trystero-p2p/nostr, @trystero-p2p/core)', 'node_modules/@trystero-p2p/nostr/LICENSE'],
  ['@noble/secp256k1', 'node_modules/@noble/secp256k1/LICENSE']];
const text = await Promise.all(licences.map(async ([name, file]) => `${name}\n\n${await readFile(join(ROOT, file), 'utf8')}`));
await writeFile(join(ROOT, 'vendor/trystero/LICENSE'), text.join('\n\n----------------------------------------\n\n'));
console.log('@trystero-p2p/nostr → vendor/trystero/trystero-nostr.js (+ LICENSE)');
