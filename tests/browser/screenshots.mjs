// Opens the game in headless Chrome (software WebGL via SwiftShader), plays through key scenes and saves
// screenshots plus a report to ./screenshots. Exits non-zero on page errors or shader compile errors.
//   npm run screenshots            (SCENES=airport,photo renders just the scenes whose names contain those words)
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
async function scene(name, note, steps) {
  if (ONLY && !ONLY.some((k) => name.includes(k))) return;
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
await page.keyboard.press('Shift'); // a key press unlocks audio, so the ambience graph gets built too
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
    audio: window.app.sfx.ctx?.state ?? 'none', ambience: !!window.app.ambience.layers,
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
await page.evaluate(() => app.togglePause()); // world scenes below are staged, so freeze it
await scene('06-airport', 'Airport: one plane waiting to take off, another on final approach', async () => {
  const has = await page.evaluate(() => {
    const { planet } = app, ap = planet.airports.list[0];
    if (!ap) return false;
    const mine = planet.planes.list.filter((p) => p.ap === ap);
    Object.assign(mine[0], { a: 0, wait: 30 });
    if (mine[1]) Object.assign(mine[1], { a: Math.PI * 2 - 0.3, wait: 0 });
    planet.planes.update(0, app.simTime);
    app.rig.focus(planet.airports.entities[0]);
    return true;
  });
  if (!has) throw new Error('this planet has no airport');
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('07-harbour', 'Harbour: ferry tied up at the pier, lighthouse on the shore', async () => {
  await page.evaluate(() => {
    const { planet } = app, boats = planet.boats;
    const i = boats.boats.findIndex((b) => b.harbour === planet.harbours.list[0]);
    Object.assign(boats.boats[i], { phi: Math.PI * 2, wait: 30 });
    boats.update(0, app.simTime);
    app.rig.focus(planet.harbours.entities[0]);
  });
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('08-people', 'Following a pedestrian through town', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'person')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('09-volcano', 'The volcano erupting: lava bombs, glow and a thick plume', async () => {
  const has = await page.evaluate(() => {
    const v = app.planet.volcano;
    if (!v.d) return false;
    v.state = 'erupt';
    v.timer = -0.5;
    for (let i = 0; i < 75; i++) v.update(1 / 30); // a couple of seconds into the eruption
    app.rig.focus(v.entity);
    return true;
  });
  if (!has) throw new Error('this planet has no volcano');
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('10-aurora', 'Aurora over the pole on the night side', async () => {
  await page.evaluate(() => {
    const { rig, sky } = app, pole = sky.axis, d = pole.clone().multiplyScalar(Math.cos(0.95)).addScaledVector(sky.sunDir, -Math.sin(0.95)).normalize();
    rig.release(true);
    Object.assign(rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt: 7 });
  });
  await frames(4);
});
await scene('11-ufo', 'A UFO hovering with its tractor beam on', async () => {
  await page.evaluate(() => {
    const u = app.planet.ufo;
    u.arrive();
    u.update(3.01, app.simTime); // straight to the hover
    app.rig.focus(u.entity);
  });
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('12-photo-live', 'Photo mode: comic frame, caption and the Pop filter, previewed live', async () => {
  await page.evaluate(() => {
    const ph = app.photo, u = app.planet.ufo;
    if (!u.hovering) { u.arrive(); u.update(3.01, app.simTime); }
    ph.enter();
    Object.assign(ph.opts, { frame: 'comic', filter: 'pop', caption: 'We are not alone!' });
    ph.refresh();
    app.rig.focus(u.entity);
  });
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('13-photo-result', 'The finished photo, ready to save or share', async () => {
  await page.evaluate(() => app.photo.snap());
  await until(() => document.getElementById('photoImg').naturalWidth > 0);
  const size = await page.evaluate(() => { const i = document.getElementById('photoImg'); return [i.naturalWidth, i.naturalHeight]; });
  if (size[0] < 1000) throw new Error(`photo is only ${size.join('×')}`);
  await frames(2);
});
await page.evaluate(() => app.photo.exit());
await page.evaluate(() => app.togglePause());
await scene('14-hangar', 'Sky Courier hangar', async () => {
  await page.evaluate(() => { app.rig.release(true); app.game.progress.addCoins(400); app.game.openHangar(); });
  await frames(3);
});
await scene('15-courier', 'Sky Courier in flight', async () => {
  await page.evaluate(() => { app.game.hangar.hide(); app.game.start(); });
  await until(() => app.rig.mode === 'game');
  await frames(4);
});
await scene('16-lightning', 'Lightning striking the plane inside a thundercloud', async () => {
  await page.evaluate(() => { // pause the world, park the plane in a storm, let the chase camera catch up
    app.togglePause();
    const { planet, game } = app, storm = planet.weather.storms[0], pl = game.player;
    const c = planet.weather.stormCenter(storm, pl.pos.clone());
    pl.up.copy(c).normalize();
    pl.alt = c.length() - 0.3;
    pl.fwd.copy(storm.u).addScaledVector(pl.up, -storm.u.dot(pl.up)).normalize();
    pl.sync();
  });
  await frames(12);
  await page.evaluate(() => {
    const { planet, game } = app;
    planet.weather.strike(planet.weather.storms[0], game.player.pos.clone());
    planet.weather.boltT = 0.33; // a visible moment of the flicker; paused, so it stays
    planet.weather.bolt.visible = true;
  });
  await frames(2);
});
await scene('17-rival', 'Rival Rex racing just ahead, with his name tag', async () => {
  await page.evaluate(() => { // still paused: one delivery spawns Rex, then park him ahead and to the left
    const { game, planet } = app, pl = game.player;
    game.deliver();
    pl.up.copy(game.from.c); // out of the storm: just took off from the city we delivered to
    pl.alt = planet.groundR(pl.up) + 1.8;
    pl.fwd.copy(game.dest.c).addScaledVector(pl.up, -game.dest.c.dot(pl.up)).normalize();
    pl.sync();
    const rex = game.rival.plane, left = pl.up.clone().cross(pl.fwd).normalize();
    rex.up.copy(pl.up).applyAxisAngle(left, 0.1).addScaledVector(left, 0.02).normalize(); // +angle about left = forward
    rex.fwd.copy(pl.fwd).addScaledVector(rex.up, -pl.fwd.dot(rex.up)).normalize();
    rex.alt = pl.alt + 0.15;
    rex.sync();
    game.updateHud();
  });
  await frames(12); // let the chase camera settle, then pin the name tag (paused, so the game loop doesn't)
  await page.evaluate(() => app.game.rival.placeTag());
  await frames(2);
});
await scene('18-daily-over', 'End of a daily challenge run, with the share button', async () => {
  await page.evaluate(() => {
    const { game } = app;
    game.stop();
    game.start({ daily: true });
    game.deliver();
    game.deliver();
    game.time = 0.01; // start() already unpaused the world
  });
  await until(() => app.game.over);
  await frames(2);
});
const missionDefs = () => page.evaluate(async () => { window.MISSIONS = (await import('./js/game/Missions.js')).MISSIONS; });
await scene('19-missions', 'The mission board, with the first mission done', async () => {
  await missionDefs();
  await page.evaluate(() => { app.game.stop(); app.game.hangar.hide(); app.game.progress.completeMission(MISSIONS[0]); app.game.board.show(); });
  await frames(2);
});
await scene('20-mission-hud', 'Flying a mission: the goal next to the score, the arrow pointing at a runway', async () => {
  await page.evaluate(() => { app.game.board.hide(); app.game.start({ mission: MISSIONS.find((m) => m.id === 'pitstop') }); });
  await until(() => app.rig.mode === 'game');
  await frames(4);
});
await scene('21-mission-complete', 'Mission complete, with the reward and the next mission', async () => {
  await page.evaluate(() => {
    const g = app.game;
    g.stop();
    g.progress.missions.delete('rush');
    g.start({ mission: MISSIONS.find((m) => m.id === 'rush') });
    g.tally.urgent = 2; // as if two urgent parcels just went out
    g.update(1 / 60);
  });
  await until(() => app.game.over);
  await frames(2);
});
for (const [i, theme] of ['ice', 'desert', 'candy', 'lava'].entries()) {
  await scene(`${22 + i}-theme-${theme}`, `The ${theme} world`, async () => {
    await page.evaluate(() => app.game.stop());
    await page.goto(`${base}index.html?${PLANET}&theme=${theme}`, { waitUntil: 'domcontentloaded' });
    await until(() => window.app?.planet && !window.app.building, 240000);
    await page.evaluate(() => { app.rig.orbit.alt = 13; app.rig.orbit.pitch = 0.35; });
    await frames(4);
  });
}
await scene('26-mobile', 'Phone-sized screen (390 × 844) with the ?debug stats overlay', async () => {
  await page.evaluate(() => app.game.stop());
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}index.html?${PLANET}&debug`, { waitUntil: 'domcontentloaded' });
  await until(() => window.app?.planet && !window.app.building, 240000);
  await frames(4);
});
await scene('27-mobile-courier', 'Daily challenge HUD on a phone', async () => {
  await page.evaluate(() => { app.game.start({ daily: true }); app.game.deliver(); });
  await until(() => app.rig.mode === 'game');
  await frames(6);
});

await scene('28-offline', 'Reloaded with the network off: the service worker serves every file', async () => {
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
  await page.setOfflineMode(true);
  await page.goto(`${base}index.html?${PLANET}`, { waitUntil: 'domcontentloaded' });
  await until(() => window.app?.planet && !window.app.building, 240000);
  if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) throw new Error('the page was not served by the service worker');
  await frames(3);
});
await page.setOfflineMode(false);

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
