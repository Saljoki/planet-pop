// On the road and at sea: the road trips menu, driving a car (on the highway, off-road, one taken from the traffic),
// sailing a boat, damage and wrecks.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.

export default async function road({ page, frames, until, scene }) {
  await page.evaluate(() => { if (app.paused) app.togglePause(); app.game.stop(); app.rig.release(true); });

  await scene('road-trips', 'Road trips, from the hangar: free drive, taxi, van courier, the race and free sail', async () => {
    await page.evaluate(() => { app.game.openHangar(); });
    await page.click('#hRoads');
    await until(() => app.game.roads.open);
    await frames(2);
  });
  await page.evaluate(() => app.game.roads.hide());

  /** Start a free drive in the left lane of a highway town and drive on for a moment. */
  const driveOnHighway = (seconds) => page.evaluate((seconds) => {
    const g = app.game;
    g.stop();
    g.start({ drive: 'car' });
    const pl = g.player, town = app.planet.cities.sites.find((s) => pl.ground.roadAt(s.c)), spot = pl.ground.parking(town);
    pl.respawn(spot.at, spot.heading);
    pl.input.up = true;
    for (let i = 0; i < seconds * 30; i++) g.update(1 / 30);
  }, seconds);

  await scene('road-highway', 'Free drive: a car on the highway, health and boost bars and the speedometer', async () => {
    await driveOnHighway(2);
    await until(() => app.rig.mode === 'game');
    await frames(8);
  });
  await scene('road-offroad', 'Off the road: slower across the countryside, kicking up dust', async () => {
    await page.evaluate(() => { // just outside a town that isn't on a highway
      const g = app.game, pl = g.player, town = app.planet.cities.sites.find((s) => !pl.ground.roadAt(s.c)), spot = pl.ground.parking(town);
      pl.respawn(spot.at, spot.heading);
      pl.input.up = true;
      for (let i = 0; i < 40; i++) g.update(1 / 30);
    });
    await frames(8);
  });
  await scene('road-damage', 'A battered car: smoking, with the health bar in the red', async () => {
    await page.evaluate(() => { app.game.player.health = 0.22; });
    await frames(12);
  });
  await scene('road-drive-this', 'Press and hold a car on the highway: its card has a Drive button', async () => {
    await page.evaluate(() => {
      app.game.stop();
      const car = app.planet.traffic.entities[2];
      app.rig.focus(car);
    });
    await until(() => app.rig.mode === 'local');
    await page.evaluate(() => app.hud.info.show(app.planet.traffic.entities[2]));
    await frames(3);
  });
  await scene('road-taken', 'Driving that car: it leaves the traffic and the player takes the wheel', async () => {
    await page.click('#iDrive');
    await until(() => app.game.briefing.open || app.game.active);
    await page.evaluate(() => { if (app.game.briefing.open) app.game.briefing.start(); });
    await until(() => app.game.active);
    await page.evaluate(() => { const g = app.game; g.player.input.up = true; for (let i = 0; i < 45; i++) g.update(1 / 30); });
    await until(() => app.rig.mode === 'game');
    await frames(8);
  });
  await scene('road-sail', 'Free sail: a boat on the open sea, leaving a wake', async () => {
    const ok = await page.evaluate(() => {
      const g = app.game;
      g.stop();
      if (!app.planet.theme.sea.boats) return false;
      g.start({ drive: 'boat' });
      g.player.input.up = true;
      for (let i = 0; i < 60; i++) g.update(1 / 30);
      return true;
    });
    if (!ok) throw new Error('no sea to sail on this world');
    await until(() => app.rig.mode === 'game');
    await frames(8);
  });
  await scene('road-wreck', 'Out of health in a courier run: KABOOM, and the run is over', async () => {
    await page.evaluate(() => {
      const g = app.game;
      g.stop();
      g.start();
      for (let i = 0; i < 4; i++) {
        const pl = g.player;
        pl.invuln = 0;
        pl.alt = app.planet.groundR(pl.up) - 0.05;
        g.update(1 / 60);
      }
    });
    await until(() => app.game.over);
    await frames(4);
  });
  await page.evaluate(() => app.game.stop());
}
