// Ways of looking: the turned orbit view, Find, the info card, the tour and photo mode.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.

export default async function views({ page, frames, until, scene }) {
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
}
