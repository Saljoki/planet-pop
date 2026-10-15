// Draws the app icon (a comic planet with a ring) as SVG and renders the PNG sizes browsers and phones ask for.
//   npm run icons
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const OUT = fileURLToPath(new URL('../icons/', import.meta.url));
const INK = '#1b1530';

/** rounded: corner radius for a plain icon; 0 for full-bleed maskable / Apple icons (the OS crops those). */
const svg = (rounded) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="0.3" cy="0.25" r="0.9"><stop offset="0" stop-color="#5a35a8"/><stop offset="0.5" stop-color="#261659"/><stop offset="1" stop-color="#0c0824"/></radialGradient>
    <clipPath id="planet"><circle cx="256" cy="262" r="148"/></clipPath>
  </defs>
  <rect width="512" height="512" rx="${rounded}" fill="url(#bg)"/>
  <circle cx="256" cy="262" r="186" fill="#7a5fe0" opacity="0.35"/>
  <path d="M70 300 C 60 250, 452 200, 442 250" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
  <path d="M70 300 C 60 250, 452 200, 442 250" fill="none" stroke="#ffd23f" stroke-width="16" stroke-linecap="round"/>
  <circle cx="256" cy="262" r="148" fill="#3ea2f2" stroke="${INK}" stroke-width="14"/>
  <g clip-path="url(#planet)" stroke="${INK}" stroke-width="10" stroke-linejoin="round">
    <path d="M128 210 C 160 150, 250 150, 262 196 C 274 240, 214 250, 196 290 C 176 330, 120 310, 112 270 C 106 240, 116 226, 128 210 Z" fill="#66c94e"/>
    <path d="M300 300 C 330 270, 400 280, 404 330 C 408 380, 340 410, 306 384 C 280 364, 282 320, 300 300 Z" fill="#a6e35d"/>
    <path d="M300 150 C 330 140, 372 160, 366 190 C 360 214, 320 210, 304 196 C 290 182, 286 160, 300 150 Z" fill="#a6e35d"/>
  </g>
  <circle cx="200" cy="200" r="22" fill="#ffffff" opacity="0.55"/>
  <path d="M442 250 C 456 316, 84 366, 70 300" fill="none" stroke="${INK}" stroke-width="30" stroke-linecap="round"/>
  <path d="M442 250 C 456 316, 84 366, 70 300" fill="none" stroke="#ffd23f" stroke-width="16" stroke-linecap="round"/>
  <path d="M410 96 l10 26 26 10 -26 10 -10 26 -10 -26 -26 -10 26 -10 z" fill="#fff3a6"/>
  <path d="M104 402 l7 18 18 7 -18 7 -7 18 -7 -18 -18 -7 18 -7 z" fill="#ffffff"/>
</svg>`;

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, 'icon.svg'), svg(110));
const browser = await puppeteer.launch({ executablePath: await chromium.executablePath(), headless: true, args: chromium.args });
const page = await browser.newPage();
for (const [name, size, rounded] of [['icon-192.png', 192, 110], ['icon-512.png', 512, 110], ['icon-maskable-512.png', 512, 0], ['apple-touch-icon.png', 180, 0]]) {
  await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(rounded).replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: join(OUT, name), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  console.log(`icons/${name}`);
}
await browser.close();
