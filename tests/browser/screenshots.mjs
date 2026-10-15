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
let sceneNo = 0;
/** Scenes are numbered in the order they run (skipped ones keep their number, so file names stay stable). */
async function scene(label, note, steps) {
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
}

const t0 = Date.now();
await page.goto(`${base}index.html?${PLANET}`, { waitUntil: 'domcontentloaded' });
await until(() => window.app?.planet && !window.app.building, 240000);
const loadSeconds = (Date.now() - t0) / 1000;
console.log(`Planet built and shaders warmed up in ${loadSeconds.toFixed(1)} s`);
await page.keyboard.press('Shift'); // a key press unlocks audio, so the ambience graph gets built too
await page.evaluate(() => app.tour.setAuto(false)); // no idle tour taking over the camera mid-run (remembered across reloads)
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

await scene('orbit-day', 'Planet from orbit in daylight', () => frames(3));
await scene('orbit-night', 'Night side: city windows, street lamps, city glow', async () => {
  await page.evaluate(() => { app.sky.angle += Math.PI; app.sky.update(0); });
  await frames(4);
});
await page.evaluate(() => { app.sky.angle -= Math.PI; app.sky.update(0); });
await scene('city', 'Flown down to a city', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'city')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('street', 'Following a car at street level', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'car')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('train', 'Following the train', async () => {
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
await scene('airport', 'Airport: one plane waiting to take off, another on final approach', async () => {
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
await scene('harbour', 'Harbour: ferry tied up at the pier, lighthouse on the shore', async () => {
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
await scene('people', 'Following a pedestrian through town', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'person')));
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await scene('tram', 'A tram on its line through town', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'tram')));
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => Object.assign(app.rig.local, { pitch: 0.4, dist: 0.8, yaw: Math.PI }));
  await frames(3);
});
await scene('whale', 'A whale leaping out of the sea', async () => {
  await page.evaluate(() => app.rig.focus(app.planet.entities.find((e) => e.kind === 'whale')));
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => {
    const { sky } = app, ws = app.planet.whales, w = ws.list[0];
    window.savedAngle ??= sky.angle;
    sky.angle = Math.atan2(w.c.dot(sky.sv), w.c.dot(sky.su)) - 0.6; // mid-morning over the whale
    sky.update(0);
    Object.assign(w, { state: 'breach', t: 0.62, dur: 1.8 });
    Object.assign(app.rig.local, { pitch: 0.2, dist: 1.1, yaw: Math.PI * 0.55 });
    ws.update(0);
  });
  await frames(2);
});
const restoreSky = () => page.evaluate(() => { // back to the time of day before a scene moved the sun
  if (window.savedAngle === undefined) return;
  app.sky.angle = window.savedAngle;
  app.sky.update(0);
  delete window.savedAngle;
});
await restoreSky();
await scene('volcano', 'The volcano erupting: lava bombs, glow and a thick plume', async () => {
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
await scene('aurora', 'Aurora over the pole on the night side', async () => {
  await page.evaluate(() => {
    const { rig, sky } = app, pole = sky.axis, d = pole.clone().multiplyScalar(Math.cos(0.95)).addScaledVector(sky.sunDir, -Math.sin(0.95)).normalize();
    rig.release(true);
    Object.assign(rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt: 7 });
  });
  await frames(4);
});
await scene('ufo', 'A UFO hovering with its tractor beam on', async () => {
  await page.evaluate(() => {
    const u = app.planet.ufo;
    u.arrive();
    u.update(3.01, app.simTime); // straight to the hover
    app.rig.focus(u.entity);
  });
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
const midnightOver = (c) => page.evaluate((i) => { // turn the sun to the far side of city i
  const { sky } = app, c = app.planet.cities.sites[i].c;
  window.savedAngle ??= sky.angle;
  sky.angle = Math.atan2(c.dot(sky.sv), c.dot(sky.su)) + Math.PI;
  sky.update(0);
}, c);
await scene('helicopter', 'A helicopter sweeping its searchlight over a town at night', async () => {
  const i = await page.evaluate(() => {
    const h = app.planet.helicopters.list[0];
    Object.assign(h, { state: 'hover', wait: 60 });
    return app.planet.cities.sites.indexOf(h.at);
  });
  await midnightOver(i);
  await page.evaluate(() => app.rig.focus(app.planet.helicopters.entities[0]));
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => Object.assign(app.rig.local, { pitch: 0.6, dist: 2.2 }));
  await frames(3);
});
await scene('fireworks', 'Midnight fireworks over a city', async () => {
  await midnightOver(0);
  await page.evaluate(() => {
    const f = app.planet.fireworks, c = f.cities[0];
    f.start(c);
    for (let i = 0; i < 75; i++) f.update(1 / 30); // a couple of seconds into the show
    app.rig.focus(app.planet.entities.find((e) => e.kind === 'city' && e.name === c.city.name));
  });
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => { app.rig.local.pitch = 0.35; app.rig.local.dist = 5; });
  await frames(4);
});
await scene('meteors', 'A meteor shower over the night side', async () => {
  await midnightOver(0);
  await page.evaluate(() => {
    const m = app.planet.meteors;
    app.rig.release(true);
    const d = app.planet.cities.sites[0].c;
    Object.assign(app.rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt: 3 }); // low: looking out at the sky
  });
  await frames(3); // let the camera settle first: meteors aim for where it looks
  await page.evaluate(() => {
    const m = app.planet.meteors;
    m.start();
    for (let i = 0; i < 40; i++) { m.spawn(); m.update(0.03); }
  });
  await frames(2);
});
await scene('rainbow', 'A rainbow beside a rain cloud', async () => {
  await page.evaluate(() => {
    const { sky, planet } = app, r = planet.rainbows.list[0], c = planet.weather.stormCenter(r.storm, app.camera.position.clone()).normalize();
    window.savedAngle ??= sky.angle;
    sky.angle = Math.atan2(c.dot(sky.sv), c.dot(sky.su)) - 0.9; // morning sun off to one side of the storm
    sky.update(0);
    r.t = 12;
    planet.rainbows.update(0);
    app.rig.focus(planet.entities.find((e) => e.kind === 'storm' && e.storm === r.storm));
  });
  await until(() => app.rig.mode === 'local');
  await frames(4);
});
const season = (angle, lean, alt) => page.evaluate((angle, lean, alt) => { // that season in the north, seen by day
  const { sky, rig } = app, s = app.planet.seasons;
  window.savedOffset ??= s.offset;
  s.offset = angle - sky.angle / 8;
  s.timer = 0;
  s.update(0);
  const d = sky.axis.clone().multiplyScalar(lean).addScaledVector(sky.sunDir, 1 - lean).normalize();
  rig.release(true);
  Object.assign(rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt });
}, angle, lean, alt);
await scene('winter', 'Midwinter in the north: snow down to the mid-latitudes, sea ice and frosted trees', async () => {
  await season(Math.PI, 0.6, 13);
  await frames(3);
});
await scene('autumn', 'Autumn leaves in the northern forests', async () => {
  await season(Math.PI / 2, 0.5, 2.6);
  await frames(3);
});
await restoreSky();
await page.evaluate(() => {
  if (window.savedOffset !== undefined) { app.planet.seasons.offset = window.savedOffset; app.planet.seasons.timer = 0; }
});
await scene('turned-view', 'Orbit view turned and tilted (two fingers, or right-drag), with the compass to reset it', async () => {
  await page.evaluate(() => { const rig = app.rig; rig.release(true); Object.assign(rig.orbit, { alt: 13, heading: 0.7, tilt: 0.4 }); });
  await frames(3);
});
await scene('find', 'The Find menu: what is happening now, every kind of thing, and the towns', async () => {
  await page.evaluate(() => {
    const u = app.planet.ufo;
    if (!u.hovering) { u.arrive(); u.update(3.01, app.simTime); }
    app.rig.resetView();
    app.find.show();
  });
  await frames(3);
});
await scene('info-card', 'Info card for a whale (press and hold on phones)', async () => {
  await page.evaluate(() => { app.find.hide(); const w = app.planet.whales; w.showOff(0); app.rig.focus(w.entities[0]); });
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => app.hud.info.show(app.planet.whales.entities[0]));
  await frames(3);
});
await scene('tour', 'Tour mode: hopping between sights with a caption', async () => {
  await page.evaluate(() => { app.hud.info.hide(); if (app.paused) app.togglePause(); app.tour.start(); }); // the tour needs the world running
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await page.evaluate(() => { app.tour.stop(); if (!app.paused) app.togglePause(); });
await scene('photo-live', 'Photo mode: comic frame, caption and the Pop filter, previewed live', async () => {
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
await scene('photo-result', 'The finished photo, ready to save or share', async () => {
  await page.evaluate(() => app.photo.snap());
  await until(() => document.getElementById('photoImg').naturalWidth > 0);
  const size = await page.evaluate(() => { const i = document.getElementById('photoImg'); return [i.naturalWidth, i.naturalHeight]; });
  if (size[0] < 1000) throw new Error(`photo is only ${size.join('×')}`);
  await frames(2);
});
await page.evaluate(() => app.photo.exit());
await page.evaluate(() => app.togglePause());
await scene('hangar', 'Sky Courier hangar', async () => {
  await page.evaluate(() => { app.rig.release(true); app.game.progress.addCoins(400); app.game.openHangar(); });
  await frames(3);
});
await scene('courier', 'Sky Courier in flight', async () => {
  await page.evaluate(() => { app.game.hangar.hide(); app.game.start(); });
  await until(() => app.rig.mode === 'game');
  await frames(4);
});
await scene('lightning', 'Lightning striking the plane inside a thundercloud', async () => {
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
await scene('rival', 'Rival Rex racing just ahead, with his name tag', async () => {
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
await scene('daily-over', 'End of a daily challenge run, with the share button', async () => {
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
await scene('missions', 'The mission board, with the first mission done', async () => {
  await missionDefs();
  await page.evaluate(() => { app.game.stop(); app.game.hangar.hide(); app.game.progress.completeMission(MISSIONS[0]); app.game.board.show(); });
  await frames(2);
});
await scene('mission-hud', 'Flying a mission: the goal next to the score, the arrow pointing at a runway', async () => {
  await page.evaluate(() => { app.game.board.hide(); app.game.start({ mission: MISSIONS.find((m) => m.id === 'pitstop') }); });
  await until(() => app.rig.mode === 'game');
  await frames(4);
});
await scene('mission-complete', 'Mission complete, with the reward and the next mission', async () => {
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
await scene('free-flight', 'Free flight: no clock or parcels, just the plane and the planet', async () => {
  await page.evaluate(() => { app.game.stop(); app.game.start({ free: true }); });
  await until(() => app.rig.mode === 'game');
  await frames(6);
});
await scene('pause-menu', 'The pause menu', async () => {
  await page.evaluate(() => app.togglePause());
  await frames(2);
});
await scene('pause-resume', 'Clicking Resume on the pause menu carries on flying', async () => {
  await page.click('#pResume'); // a real click: the menu sits inside the click-through game layer
  await frames(2);
  if (await page.evaluate(() => app.paused)) throw new Error('Resume did not respond to a click');
});
await page.evaluate(() => { if (app.paused) app.togglePause(); app.game.stop(); });
for (const theme of ['ice', 'desert', 'candy', 'lava']) {
  await scene(`theme-${theme}`, `The ${theme} world`, async () => {
    await page.evaluate(() => app.game.stop());
    await page.goto(`${base}index.html?${PLANET}&theme=${theme}`, { waitUntil: 'domcontentloaded' });
    await until(() => window.app?.planet && !window.app.building, 240000);
    await page.evaluate(() => { app.rig.orbit.alt = 13; app.rig.orbit.pitch = 0.35; });
    await frames(4);
  });
}
await scene('mobile', 'Phone-sized screen (390 × 844) with the ?debug stats overlay', async () => {
  await page.evaluate(() => app.game.stop());
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(`${base}index.html?${PLANET}&debug`, { waitUntil: 'domcontentloaded' });
  await until(() => window.app?.planet && !window.app.building, 240000);
  await frames(4);
});
const ufoHere = () => page.evaluate(() => { const u = app.planet.ufo; if (!u.hovering) { u.arrive(); u.update(3.01, app.simTime); } });
await scene('mobile-sheet', 'Phone: the controls slide up from the bottom as a sheet', async () => {
  await page.evaluate(() => document.getElementById('panelToggle').click());
  await frames(2);
});
await scene('mobile-find', 'Phone: the Find sheet', async () => {
  await ufoHere();
  await page.evaluate(() => app.find.show());
  await frames(2);
});
await scene('mobile-info', 'Phone: press and hold on something for its info card', async () => {
  await page.evaluate(() => { app.find.hide(); app.rig.focus(app.planet.entities.find((e) => e.kind === 'train')); });
  await until(() => app.rig.mode === 'local');
  await page.evaluate(() => app.hud.info.show(app.planet.entities.find((e) => e.kind === 'train')));
  await frames(3);
});
await scene('mobile-tour', 'Phone: tour mode', async () => {
  await ufoHere();
  await page.evaluate(() => { app.hud.info.hide(); app.tour.start(); });
  await until(() => app.rig.mode === 'local');
  await frames(3);
});
await page.evaluate(() => app.tour.stop());
await scene('mobile-courier', 'Daily challenge on a phone, a thumb on the stick', async () => {
  await page.evaluate(() => { app.game.start({ daily: true }); app.game.deliver(); });
  await until(() => app.rig.mode === 'game');
  await page.touchscreen.touchStart(110, 640);
  await page.touchscreen.touchMove(150, 600);
  await frames(6);
});
await page.touchscreen.touchEnd().catch(() => {}); // (nothing to lift if that scene was filtered out)
await scene('mobile-free', 'Free flight on a phone', async () => {
  await page.evaluate(() => { app.game.stop(); app.game.start({ free: true }); });
  await until(() => app.rig.mode === 'game');
  await frames(5);
});
await scene('mobile-pause', 'Pause menu on a phone: tilt steering and vibration switches', async () => {
  await page.evaluate(() => app.togglePause());
  await frames(2);
});
await page.tap('#pResume');
if (await page.evaluate(() => app.paused)) problems.push('mobile-pause: tapping Resume did not resume');
await page.evaluate(() => { if (app.paused) app.togglePause(); });
await scene('landscape-courier', 'Phone on its side, flying', async () => {
  await page.setViewport({ width: 844, height: 390, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: true });
  await frames(5);
});
await scene('landscape-panel', 'Phone on its side: the controls come in from the right', async () => {
  await page.evaluate(() => { app.game.stop(); document.getElementById('panel').classList.remove('hidden'); });
  await until(() => app.rig.mode === 'orbit');
  await frames(3);
});

await scene('offline', 'Reloaded with the network off: the service worker serves every file', async () => {
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
