// Around the planet: orbit, towns, transport, wildlife and the volcano.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.

export default async function world({ page, frames, until, scene, restoreSky }) {
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
}
