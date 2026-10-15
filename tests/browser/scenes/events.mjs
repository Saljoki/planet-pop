// Things that happen: night flights, fireworks, meteors, rainbows and the seasons.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.

export default async function events({ page, frames, until, scene, restoreSky, midnightOver }) {
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
}
