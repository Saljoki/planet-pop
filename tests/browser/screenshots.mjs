// Opens the game in headless Chrome (software WebGL via SwiftShader), plays through key scenes and saves
// screenshots plus a report to ./screenshots. Exits non-zero on page errors or shader compile errors.
//   npm run screenshots            (OFFLINE=1 skips Google Fonts when the network blocks them)
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'screenshots');
const THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';
const THREE_LOCAL = join(ROOT, 'node_modules', 'three') + sep;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain' };
const PLANET = 'seed=20261014&land=45&cities=5';

// ---------- static server for the repo ----------
const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^[/\\]+/, '');
  const file = join(ROOT, rel || 'index.html');
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}/`;

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: await chromium.executablePath(),
  headless: true,
  args: [...chromium.args, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
});

const problems = [], log = [], shots = [];
const page = await browser.newPage();
page.on('console', (m) => {
  const text = m.text();
  log.push(`[${m.type()}] ${text}`);
  const benign = /Failed to load resource|fonts\.g|Terrain worker unavailable/.test(text);
  if ((m.type() === 'error' || /Shader Error|WebGLProgram/.test(text)) && !benign) problems.push(text);
});
page.on('pageerror', (e) => problems.push(`Uncaught: ${e.message}`));
await page.setRequestInterception(true);
page.on('request', async (req) => {
  const url = req.url();
  if (url.startsWith(THREE_CDN)) { // serve three.js from node_modules: same version, no CDN dependency
    try {
      return await req.respond({ status: 200, contentType: 'text/javascript', body: await readFile(THREE_LOCAL + url.slice(THREE_CDN.length)) });
    } catch {
      return req.respond({ status: 404, body: '' });
    }
  }
  if (process.env.OFFLINE && /fonts\.(googleapis|gstatic)\.com/.test(url)) return req.abort();
  return req.continue();
});
// Screenshots should show the full-quality look, whatever the software renderer's speed.
await page.evaluateOnNewDocument(() => localStorage.setItem('planetpop.quality', JSON.stringify({ mode: 'crisp', level: 0 })));

const frames = (n) => page.evaluate((n) => new Promise((done) => {
  let k = 0;
  const tick = () => (++k >= n ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);
const until = (fn, timeout = 60000) => page.waitForFunction(fn, { timeout, polling: 200 });
const shot = async (name, note) => {
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  shots.push({ name, note });
  console.log(`  📸 ${name}: ${note}`);
};
async function scene(name, note, steps) {
  try {
    await steps();
    await shot(name, note);
  } catch (err) {
    problems.push(`${name}: ${err.message}`);
    console.log(`  ✖ ${name}: ${err.message}`);
  }
}

const t0 = Date.now();
await page.goto(`${base}index.html?${PLANET}`, { waitUntil: 'domcontentloaded' });
await until(() => window.app?.planet && !window.app.building, 240000);
const loadSeconds = (Date.now() - t0) / 1000;
console.log(`Planet built and shaders warmed up in ${loadSeconds.toFixed(1)} s`);
await frames(4);

const stats = await page.evaluate(async () => {
  const { renderer, quality } = window.app, info = renderer.info;
  info.autoReset = false;
  info.reset();
  const start = performance.now();
  await new Promise((done) => { let k = 0; const f = () => (++k >= 5 ? done() : requestAnimationFrame(f)); requestAnimationFrame(f); });
  const out = {
    frameMs: Math.round((performance.now() - start) / 5),
    drawCallsPerFrame: Math.round(info.render.calls / 5),
    trianglesPerFrame: Math.round(info.render.triangles / 5),
    programs: info.programs.length,
    quality: quality.name, pixelRatio: quality.pr,
  };
  info.autoReset = true;
  return out;
});

await scene('01-orbit-day', 'Planet from orbit in daylight', () => frames(3));
await scene('02-orbit-night', 'Night side: city windows, street lamps, city glow', async () => {
  await page.evaluate(() => { app.sky.angle += Math.PI; app.sky.update(0); });
  await frames(4);
});
await page.evaluate(() => { app.sky.angle -= Math.PI; app.sky.update(0); });
await scene('03-city', 'Flown down to a city', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'city')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('04-street', 'Following a car at street level', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'car')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('05-train', 'Following the train', async () => {
  const hasTrain = await page.evaluate(() => {
    const train = app.planet.entities.find((e) => e.kind === 'train');
    if (train) app.rig.focus(train);
    return !!train;
  });
  if (!hasTrain) throw new Error('this planet has no railway');
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('06-hangar', 'Sky Courier hangar', async () => {
  await page.evaluate(() => { app.rig.release(true); app.game.progress.addCoins(400); app.game.openHangar(); });
  await frames(3);
});
await scene('07-courier', 'Sky Courier in flight', async () => {
  await page.evaluate(() => { app.game.hangar.hide(); app.game.start(); });
  await until(() => app.rig.mode === 'game');
  await frames(4);
});
await scene('08-lightning', 'Lightning striking the plane inside a thundercloud', async () => {
  await page.evaluate(() => {
    const { planet, game } = app, storm = planet.weather.storms[0], pl = game.player;
    const c = planet.weather.stormCenter(storm, pl.pos.clone());
    pl.up.copy(c).normalize();
    pl.alt = c.length() - 0.3;
    pl.fwd.copy(storm.u).addScaledVector(pl.up, -storm.u.dot(pl.up)).normalize();
    pl.sync();
    planet.weather.strike(storm, pl.pos.clone());
  });
  await frames(2);
});
await scene('09-game-over', 'End-of-run summary', async () => {
  await page.evaluate(() => { app.game.time = 0.01; });
  await until(() => app.game.over);
  await frames(2);
});
await scene('10-mobile', 'Phone-sized screen (390 × 844)', async () => {
  await page.evaluate(() => app.game.stop());
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}index.html?${PLANET}`, { waitUntil: 'domcontentloaded' });
  await until(() => window.app?.planet && !window.app.building, 240000);
  await frames(4);
});

const report = {
  commit: process.env.GITHUB_SHA || 'local',
  loadSeconds,
  renderer: await browser.version(),
  stats,
  problems,
  shots,
  log: log.slice(-80),
};
await writeFile(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
await writeFile(join(OUT, 'README.md'), [
  `# Screenshots for ${report.commit.slice(0, 7)}`,
  '',
  `Rendered in headless Chrome with software WebGL (SwiftShader), so frame times are not representative of a real GPU.`,
  `Draw calls per frame: ${stats.drawCallsPerFrame} · triangles per frame: ${stats.trianglesPerFrame.toLocaleString('en')} · shader programs: ${stats.programs}`,
  '',
  problems.length ? `## ⚠️ Problems\n\n${problems.map((p) => `- ${p}`).join('\n')}\n` : '✅ No page or shader errors.\n',
  ...shots.map((s) => `## ${s.note}\n\n![${s.name}](${s.name}.png)\n`),
].join('\n'));

console.log(`Stats: ${JSON.stringify(stats)}`);
console.log(problems.length ? `✖ ${problems.length} problem(s):\n${problems.join('\n')}` : '✔ No page or shader errors');
await browser.close();
server.close();
process.exit(problems.length ? 1 : 0);
