// Phones, upright and on their side.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.
import { PLANET } from '../harness.mjs';

export default async function phone({ page, frames, until, scene, open, ufoHere, problems }) {
  await scene('mobile', 'Phone-sized screen (390 × 844) with the ?debug stats overlay', async () => {
    await page.evaluate(() => app.game.stop());
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await open(`${PLANET}&debug`);
    await frames(4);
  });
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
    await page.evaluate(() => { app.game.start({ daily: true }); app.game.run.deliver(); });
    await until(() => app.rig.mode === 'game');
    await page.touchscreen.touchStart(110, 640);
    await page.touchscreen.touchMove(150, 600);
    await frames(6);
  });
  await page.touchscreen.touchEnd().catch(() => {}); // (nothing to lift if that scene was filtered out)
  await scene('mobile-briefing', 'The briefing on a phone, with touch controls', async () => {
    await page.evaluate(async () => {
      const { MISSIONS } = await import('./js/game/Missions.js'); // (the page was reloaded at phone size)
      app.game.stop();
      app.game.launch({ mission: MISSIONS.find((m) => m.id === 'rings') });
    });
    await until(() => app.game.briefing.open);
    await frames(2);
  });
  await page.evaluate(() => app.game.briefing.hide());
  await scene('mobile-drive', 'Driving on a phone: the speedometer sits above the BOOST button', async () => {
    await page.evaluate(() => {
      const g = app.game;
      g.stop();
      g.start({ drive: 'car' });
      const pl = g.player, town = app.planet.cities.sites.find((s) => pl.ground.roadAt(s.c)), spot = pl.ground.parking(town);
      pl.respawn(spot.at, spot.heading);
      pl.input.up = true;
      for (let i = 0; i < 60; i++) g.update(1 / 30);
    });
    await until(() => app.rig.mode === 'game');
    await frames(5);
  });
  await scene('mobile-free', 'Free flight on a phone', async () => {
    await page.evaluate(() => { app.game.stop(); app.game.start({ free: true }); });
    await until(() => app.rig.mode === 'game');
    await frames(5);
  });
  await scene('mobile-pause', 'Pause menu on a phone', async () => {
    await page.evaluate(() => app.togglePause());
    await frames(2);
  });
  if (await page.evaluate(() => app.game.pauseMenu.open)) { // (only if that scene ran)
    await page.tap('#pResume');
    if (await page.evaluate(() => app.paused)) problems.push('mobile-pause: tapping Resume did not resume');
  }
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
}
