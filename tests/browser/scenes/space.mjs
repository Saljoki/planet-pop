// The real worlds, the system map and a rocket trip.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.

/** Look down on a latitude and longitude from `alt` above the ground, in morning light. */
const lookAt = (page, lat, lon, alt) => page.evaluate(([lat, lon, alt]) => {
  const a = (lat * Math.PI) / 180, b = (lon * Math.PI) / 180, d = app.camera.position.clone().set(Math.cos(a) * Math.cos(b), Math.sin(a), -Math.cos(a) * Math.sin(b));
  const sky = app.sky;
  sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) - 0.3;
  sky.update(0);
  app.rig.release(true);
  Object.assign(app.rig.orbit, { yaw: Math.atan2(d.x, d.z), pitch: Math.asin(d.y), alt, heading: 0, tilt: 0, tween: null });
}, [lat, lon, alt]);

export default async function space({ page, frames, until, scene, open }) {
  await scene('real-earth', 'Earth: Europe and Africa where they really are, the Sahara, the Alps', async () => {
    await page.evaluate(() => app.game.stop());
    await open('world=earth');
    await lookAt(page, 30, 15, 14);
    await frames(4);
  });

  await scene('real-moon', 'The Moon’s near side: the dark seas, craters, Earth in a black sky', async () => {
    await open('world=moon');
    await lookAt(page, 10, 5, 14);
    await frames(4);
  });

  await scene('real-mars', 'Mars: Tharsis and its volcanoes, Valles Marineris, the polar cap', async () => {
    await open('world=mars');
    await lookAt(page, 5, -100, 15);
    await frames(4);
  });

  await scene('landmark-olympus', 'Olympus Mons, with its info card', async () => {
    await page.evaluate(() => {
      const e = app.planet.landmarks.entities.find((x) => x.name === 'Olympus Mons');
      app.rig.focus(e);
    });
    await until(() => app.rig.mode === 'local');
    await frames(6);
    await page.evaluate(() => app.hud.info.show(app.planet.landmarks.entities.find((x) => x.name === 'Olympus Mons')));
    await frames(2);
  });

  await scene('system-map', 'The system map: every world where it really is today, orbits, the asteroid belt', async () => {
    await page.evaluate(() => { app.hud.info.hide(); app.rig.release(true); app.map.show(); });
    await until(() => app.map.state === 'open');
    await frames(3);
  });

  await scene('system-card', 'Earth’s card: the real numbers, today’s distance, and the trip there', async () => {
    await page.evaluate(() => app.map.select(app.map.scene.byId.earth));
    await frames(40);
  });

  await scene('system-far', 'Out to Pluto, with the Kuiper belt', async () => {
    await page.evaluate(() => { app.map.card.hide(); app.map.view.glideTo(null, { dist: 1700, pitch: 0.7 }, 0.1); });
    await frames(8);
  });

  await scene('trip-launch', 'A trip to Earth: lift-off from Mars', async () => {
    await page.evaluate(() => { app.timeScale = 4; app.trip.go('earth'); });
    await until(() => app.trip.state === 'climb' && app.trip.t > 2.5, 240000);
  });

  await scene('trip-cruise', 'The cruise: steer for the fuel stars, round the rocks', async () => {
    await until(() => app.trip.state === 'cruise', 240000);
    await page.evaluate(() => { app.timeScale = 1; const c = app.map.cruiser; c.s = c.len * 0.4; });
    await frames(6);
  });

  await scene('trip-arrive', 'Landing on Earth, and what to do next', async () => {
    await page.evaluate(() => { const c = app.map.cruiser; c.s = c.len; });
    await until(() => app.trip.state === 'landing', 240000);
    await page.evaluate(() => { app.timeScale = 4; });
    await until(() => app.trip.state === 'idle', 240000);
    await page.evaluate(() => { app.timeScale = 1; });
    await frames(4);
  });

  await scene('moon-rover', 'A rover on the Moon, by the spaceport', async () => {
    await page.evaluate(() => app.trip.card?.hide());
    await open('world=moon');
    await page.evaluate(() => {
      const d = app.planet.space.site.d, sky = app.sky;
      sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) - 0.5;
      sky.update(0);
      app.game.start({ drive: 'car', from: 'pad' });
    });
    await until(() => app.rig.mode === 'game');
    await frames(20);
  });

  await scene('moon-hopper', 'The hopper: no air for wings on the Moon', async () => {
    await page.evaluate(() => { app.game.stop(); app.game.start({ free: true }); });
    await until(() => app.rig.mode === 'game');
    await frames(20);
  });

  /** Fly to the first thing of `kind` (named `name`, if given), in morning light unless `light` is false. */
  const visit = (kind, name, light = true) => page.evaluate(([kind, name, light]) => {
    const e = app.planet.entities.find((x) => x.kind === kind && (!name || x.name === name)), sky = app.sky;
    const d = e.getPos(app.camera.position.clone()).normalize();
    if (light) { sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) - 0.4; sky.update(0); }
    app.rig.focus(e);
  }, [kind, name, light]);

  await scene('real-venus', 'Venus: a sea of yellow cloud, a town on its raft, highway bridges, airships and acid storms', async () => {
    await page.evaluate(() => app.game.stop());
    await open('world=venus');
    await lookAt(page, 11, -162.8, 14);
    await frames(4);
  });

  await scene('venus-town', 'A cloud city, held up by balloons', async () => {
    await visit('city');
    await until(() => app.rig.mode === 'local');
    await frames(6);
  });

  await scene('real-mercury', 'Mercury: Caloris basin, craters, the rails round the planet and a huge Sun', async () => {
    await open('world=mercury');
    await lookAt(page, 31.5, 162.7, 15);
    await frames(4);
  });

  await scene('mercury-terminus', 'Terminus, rolling on its rails just ahead of the sunrise', async () => {
    await visit('rolling', null, false);
    await until(() => app.rig.mode === 'local');
    await frames(6);
  });

  await scene('real-pluto', 'Pluto: the heart, the dark Belton Regio, ice mountains, Charon', async () => {
    await open('world=pluto');
    await lookAt(page, 15, 160, 15);
    await frames(4);
  });

  await scene('pluto-hotel', 'The ice hotel on Pluto’s heart', async () => {
    await visit('landmark', 'The Ice Hotel');
    await until(() => app.rig.mode === 'local');
    await frames(6);
    await page.evaluate(() => app.hud.info.show(app.planet.landmarks.entities.find((x) => x.name === 'The Ice Hotel')));
    await frames(2);
  });

  await scene('space-parcels', 'The space courier’s board on Pluto: three parcels to other worlds, paid by today’s distance', async () => {
    await page.evaluate(() => { app.hud.info.hide(); app.spaceCourier.openBoard(); });
    await frames(4);
  });

  await scene('space-landed', 'A parcel landed on the Moon: the way to its town, with its clock', async () => {
    await open('world=moon');
    await page.evaluate(async () => {
      const c = app.spaceCourier, { LandedCard } = await import('./js/ui/LandedCard.js'), { worldOf } = await import('./js/space/Worlds.js');
      c.job = { ...c.offer('earth', 'moon', () => 0.1), what: '🍕 Pizza', left: 64, broken: false };
      const d = app.planet.space.site.d, sky = app.sky;
      sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) - 0.5;
      sky.update(0);
      (app.trip.card ??= new LandedCard(app)).show(worldOf('moon'));
    });
    await frames(4);
  });

  await scene('space-drop', 'The last stretch by rover: the parcel’s clock, and the arrow to the town', async () => {
    await page.evaluate(() => { app.trip.card.hide(); app.game.start({ space: true, drive: 'car' }); });
    await until(() => app.rig.mode === 'game');
    await frames(20);
  });

  await scene('space-delivered', 'Handed over on time: paid, with the next parcel a tap away', async () => {
    await page.evaluate(() => {
      const pl = app.game.player, run = app.game.run;
      pl.place(run.stop.at, pl.fwd);
      pl.v = 0;
    });
    await until(() => app.game.over);
    await frames(10);
  });

  await scene('mission-flag', 'One Small Step: a flag for Tranquility Base, by hopper', async () => {
    await page.evaluate(async () => {
      const { MISSIONS } = await import('./js/game/Missions.js');
      app.game.stop();
      app.game.start({ mission: MISSIONS.find((m) => m.id === 'flag') });
    });
    await until(() => app.rig.mode === 'game');
    await frames(20);
  });

  await scene('space-missions', 'The missions board: the real worlds’ missions, a list of their own', async () => {
    await page.evaluate(() => {
      app.game.stop();
      app.game.board.show();
      app.game.board.el.querySelector('h3').scrollIntoView();
    });
    await frames(4);
  });

  await scene('mars-dust', 'A dust storm on Mars (no lightning), with its card', async () => {
    await page.evaluate(() => app.game.board.hide());
    await open('world=mars');
    await visit('storm');
    await until(() => app.rig.mode === 'local');
    await page.evaluate(() => app.hud.info.show(app.planet.entities.find((e) => e.kind === 'storm')));
    await frames(8);
  });

  await scene('real-jupiter', 'Jupiter: striped cloud, the Great Red Spot swirling, stations hanging from balloons', async () => {
    await page.evaluate(() => app.hud.info.hide());
    await open('world=jupiter');
    await lookAt(page, -10, 40, 15);
    await frames(4);
  });

  await scene('jupiter-station', 'A cloud station on Jupiter, held up by balloons, with Io and Europa in the sky', async () => {
    await visit('city');
    await until(() => app.rig.mode === 'local');
    await frames(6);
  });

  await scene('jupiter-ship', 'Eye of the Storm: the ship heading for the Great Red Spot', async () => {
    await page.evaluate(async () => {
      const { MISSIONS } = await import('./js/game/Missions.js');
      app.game.start({ mission: MISSIONS.find((m) => m.id === 'storm') });
      const pl = app.game.player, spot = app.game.feats.storm, [u] = spot.basis;
      pl.place(spot.d.clone().addScaledVector(u, -0.45).normalize(), u);
      pl.alt = 12;
    });
    await until(() => app.rig.mode === 'game');
    await frames(20);
  });

  await scene('real-saturn', 'Saturn: pale stripes, the hexagon round the pole, and the rings', async () => {
    await open('world=saturn');
    await lookAt(page, 28, -40, 34);
    await frames(4);
  });

  await scene('saturn-ringrun', 'Ring Run: up through the ring ice, between the chunks', async () => {
    await page.evaluate(async () => {
      const { MISSIONS } = await import('./js/game/Missions.js');
      app.game.start({ mission: MISSIONS.find((m) => m.id === 'ringrun') });
      const pl = app.game.player, ax = app.planet.rings.axis, d = new app.camera.position.constructor().crossVectors(ax, app.sky.su).normalize();
      pl.place(d.clone().addScaledVector(ax, 0.16).normalize(), ax.clone().negate());
      pl.alt = 14.4;
      pl.invuln = 99;
    });
    await until(() => app.rig.mode === 'game');
    await frames(16);
  });

  await scene('real-uranus', 'Uranus: pale blue-green cloud and faint rings', async () => {
    await page.evaluate(() => app.game.stop());
    await open('world=uranus');
    await lookAt(page, 20, -60, 15);
    await frames(4);
  });

  await scene('real-neptune', 'Neptune: deep blue, the Great Dark Spot with white clouds round it', async () => {
    await open('world=neptune');
    await lookAt(page, -15, 20, 15);
    await frames(4);
  });

  await scene('real-io', 'Io: sulphur yellow, dark lava, Pele’s red ring, and Jupiter filling the sky', async () => {
    await open('world=io');
    await lookAt(page, -10, 100, 16);
    await frames(4);
  });

  await scene('io-volcano', 'Pele erupting a plume of sulphur', async () => {
    await page.evaluate(() => { const v = app.planet.volcanoes[0]; v.state = 'erupt'; v.timer = 60; });
    await visit('volcano', 'Pele');
    await until(() => app.rig.mode === 'local');
    await frames(30);
  });

  await scene('real-europa', 'Europa: ice criss-crossed by reddish cracks, with Jupiter hanging overhead', async () => {
    await open('world=europa');
    await lookAt(page, 10, 80, 16);
    await frames(4);
  });

  await scene('real-titan', 'Titan: thick orange haze, dark dunes, and methane seas in the north', async () => {
    await open('world=titan');
    await lookAt(page, 50, -60, 16);
    await frames(4);
  });

  await scene('titan-huygens', 'Where Huygens landed on Titan, on the dark dunes', async () => {
    await visit('landmark', 'The Huygens landing site');
    await until(() => app.rig.mode === 'local');
    await frames(6);
  });

  await scene('phone-map', 'The system map on a phone, with a world’s card', async () => {
    await page.evaluate(() => app.hud.info.hide());
    await page.evaluate(() => app.game.stop());
    await page.setViewport({ width: 390, height: 780, deviceScaleFactor: 1 });
    await page.evaluate(() => app.map.show());
    await until(() => app.map.state === 'open');
    await page.evaluate(() => app.map.select(app.map.scene.byId.mars));
    await frames(40);
  });
  await page.evaluate(() => app.map.close(true));
  await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
}
