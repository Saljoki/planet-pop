// On the road and at sea: the road trips menu, driving a car (on the highway, off-road, down a town's main street,
// one taken from the traffic), sailing a boat, the taxi, the van courier (and the mini-map zoomed out), the race round
// the world, damage and wrecks.
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
  await scene('road-street', 'Driving down a town’s main street: streets cross in the middle of every town, and on the mini-map', async () => {
    await page.evaluate(() => { // into a town that isn't on a highway, along its street
      const g = app.game, pl = g.player, city = app.planet.cities.sites.find((s) => !pl.ground.roadAt(s.c));
      const at = (z) => city.c.clone().addScaledVector(city.v, z / 10).normalize();
      pl.respawn(at(-0.9), city.v);
      pl.input.up = true;
      for (let i = 0; i < 20; i++) g.update(1 / 30);
    });
    await frames(10);
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
  await scene('road-taxi', 'Taxi: someone waving on the green pad at the edge of town', async () => {
    await page.evaluate(() => { // drive up to the first fare and stop just short of it
      const g = app.game;
      g.stop();
      g.start({ road: 'taxi' });
      const pl = g.player, stop = g.run.fare.from;
      pl.respawn(stop.at.clone().addScaledVector(stop.heading, -0.5 / 10).normalize(), stop.heading);
      pl.input.up = true;
      for (let i = 0; i < 12; i++) g.update(1 / 30);
      pl.input.up = false;
      for (let i = 0; i < 20; i++) g.update(1 / 30);
    });
    await until(() => app.rig.mode === 'game');
    await frames(8);
  });
  await scene('road-van', 'Van courier: the parcel on the roof, the pink pad at the next town', async () => {
    await page.evaluate(() => {
      const g = app.game;
      g.stop();
      g.start({ road: 'van' });
      const pl = g.player, stop = g.run.stop;
      pl.respawn(stop.at.clone().addScaledVector(stop.heading, -0.6 / 10).normalize(), stop.heading);
      pl.input.up = true;
      for (let i = 0; i < 14; i++) g.update(1 / 30);
      pl.input.up = false;
    });
    await until(() => app.rig.mode === 'game');
    await frames(8);
  });
  await scene('road-map', 'The mini-map tapped to zoom out: towns, roads, the van and the pink drop-off pin', async () => {
    await page.click('#gMap');
    await until(() => app.game.minimap.far);
    await frames(3);
  });
  await page.evaluate(() => { app.game.minimap.far = false; });
  await scene('road-race', 'Round the world: Rex alongside at the start, the first checkpoint arch ahead', async () => {
    await page.evaluate(() => {
      const g = app.game;
      g.stop();
      g.start({ road: 'race' });
      g.player.input.up = true;
      for (let i = 0; i < 4.2 * 30; i++) g.update(1 / 30);
    });
    await until(() => app.rig.mode === 'game');
    await frames(10);
    await page.evaluate(() => app.game.run.rex.placeTag());
    await frames(1);
  });
  await scene('road-race-won', 'Through the finish ahead of Rex', async () => {
    await page.evaluate(() => {
      const g = app.game, run = g.run;
      for (const gate of run.gates) { g.player.place(gate.at, g.player.fwd); g.player.v = 0; g.update(1 / 60); }
    });
    await until(() => app.game.over);
    await frames(3);
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
