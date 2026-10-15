// The screenshot run's machinery: a static server for the repo, headless Chrome (software WebGL via SwiftShader),
// scene bookkeeping, and the report. The scenes themselves are in ./scenes, one file per area of the game.
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, rm } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OUT = join(ROOT, 'screenshots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.md': 'text/plain',
  '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
export const PLANET = 'seed=20261014&land=45&cities=5';

function serve() {
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
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok(server)));
}

/**
 * Start the server and the browser and load the planet. Returns the helpers scenes use:
 * page · base (the server's URL) · frames(n) · until(fn) · scene(label, note, steps) · open(query) and a few
 * staging helpers (restoreSky, midnightOver, ufoHere) · finish() to write the report and exit.
 */
export async function start() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/`;
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: await chromium.executablePath(),
    headless: true,
    args: [...chromium.args, '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
    defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 },
  });

  const problems = [], log = [], shots = [];
  const page = await browser.newPage();
  page.on('console', (m) => {
    const text = m.text();
    log.push(`[${m.type()}] ${text}`);
    const benign = /Failed to load resource|Terrain worker unavailable/.test(text);
    if ((m.type() === 'error' || /Shader Error|WebGLProgram/.test(text)) && !benign) problems.push(text);
  });
  page.on('pageerror', (e) => problems.push(`Uncaught: ${e.message}`));
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
  const ONLY = process.env.SCENES?.split(','); // e.g. SCENES=airport,harbour renders just those (quick iteration)
  let sceneNo = 0;
  /** Scenes are numbered in the order they run (skipped ones keep their number, so file names stay stable). */
  const scene = async (label, note, steps) => {
    const name = `${String(++sceneNo).padStart(2, '0')}-${label}`;
    if (ONLY && !ONLY.some((k) => label.includes(k))) return;
    try {
      await steps();
      await shot(name, note);
    } catch (err) {
      problems.push(`${name}: ${err.message}`);
      if (process.env.DEBUG) console.log(err.stack);
      console.log(`  ✖ ${name}: ${err.message}`);
    }
  };
  /** Load the game with this query string and wait for the planet. */
  const open = async (query) => {
    await page.goto(`${base}index.html?${query}`, { waitUntil: 'domcontentloaded' });
    await until(() => window.app?.planet && !window.app.building, 240000);
  };

  const t0 = Date.now();
  await open(PLANET);
  const loadSeconds = (Date.now() - t0) / 1000;
  console.log(`Planet built and shaders warmed up in ${loadSeconds.toFixed(1)} s`);
  await page.keyboard.press('Shift'); // a key press unlocks audio, so the ambience graph gets built too
  await page.evaluate(() => app.tour.setAuto(false)); // no idle tour taking over the camera mid-run (remembered across reloads)
  await frames(4);
  const stats = await measure(page);

  /** Back to the time of day before a scene moved the sun. */
  const restoreSky = () => page.evaluate(() => {
    if (window.savedAngle === undefined) return;
    app.sky.angle = window.savedAngle;
    app.sky.update(0);
    delete window.savedAngle;
  });
  /** Turn the sun to the far side of city i (restoreSky() turns it back). */
  const midnightOver = (i) => page.evaluate((i) => {
    const { sky } = app, c = app.planet.cities.sites[i].c;
    window.savedAngle ??= sky.angle;
    sky.angle = Math.atan2(c.dot(sky.sv), c.dot(sky.su)) + Math.PI;
    sky.update(0);
  }, i);
  /** Make sure the UFO is hovering somewhere. */
  const ufoHere = () => page.evaluate(() => { const u = app.planet.ufo; if (!u.hovering) { u.arrive(); u.update(3.01, app.simTime); } });

  const finish = async () => {
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
  };

  return { page, base, problems, frames, until, scene, open, restoreSky, midnightOver, ufoHere, finish };
}

/** Frame time, draw calls and so on, for the report. */
function measure(page) {
  return page.evaluate(async () => {
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
      audio: window.app.sfx.ctx?.state ?? 'none', ambience: !!window.app.ambience.layers,
    };
    info.autoReset = true;
    return out;
  });
}
