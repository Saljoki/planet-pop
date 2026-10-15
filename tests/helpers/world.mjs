import { fakeEl } from './dom.mjs';
import * as THREE from 'three';
import { Sky } from '../../js/sky/Sky.js';
import { Planet } from '../../js/world/Planet.js';
import { Hud } from '../../js/ui/Hud.js';
import { Sfx } from '../../js/ui/Sfx.js';
import { Achievements } from '../../js/ui/Achievements.js';
import { CameraRig } from '../../js/camera/CameraRig.js';
import { CourierGame } from '../../js/game/CourierGame.js';
import { Settings } from '../../js/game/Settings.js';
import { TrophyWatch } from '../../js/ui/TrophyWatch.js';

/** An App-shaped object with everything except the WebGL renderer, post-processing and quality control. */
export function makeApp(params) {
  const app = {
    params, simTime: 0, paused: false, building: false, timeScale: 1, unlocked: [],
    renderer: { capabilities: { getMaxAnisotropy: () => 8 }, domElement: fakeEl('canvas') },
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(45, 1.6, 0.05, 2000),
    togglePause() {},
    onFocus(e) { this.focused = e.kind; this.trophies.arrived(e); },
  };
  app.camera.position.set(0, 0.3, 1).normalize().multiplyScalar(36);
  app.settings = new Settings();
  app.hud = new Hud(app);
  app.sky = new Sky(app.scene);
  app.sfx = new Sfx(app);
  app.achievements = new Achievements(app.hud);
  const unlock = app.achievements.unlock.bind(app.achievements);
  app.achievements.unlock = (id) => { app.unlocked.push(id); unlock(id); };
  app.trophies = new TrophyWatch(app);
  app.rig = new CameraRig(app);
  app.game = new CourierGame(app);
  return app;
}

export async function makeWorld(params) {
  const app = makeApp({ traffic: 5, ...params });
  const planet = new Planet(app, app.params);
  await planet.build();
  app.planet = planet;
  return { app, planet };
}

/** Advance the world (and optionally the camera and game) by `seconds` in fixed steps. */
export function run(app, seconds, { dt = 1 / 20, camera = false, game = false, each } = {}) {
  for (let t = 0; t < seconds; t += dt) {
    app.simTime += dt;
    app.sky.update(dt);
    app.planet.update(dt, app.simTime);
    if (game && app.game.active) app.game.update(dt);
    if (camera) app.rig.update(dt);
    each?.();
  }
}

/** Throws if any instance matrix in the planet contains NaN or Infinity. */
export function assertFiniteInstances(root, label) {
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    if (!o.isInstancedMesh) return;
    for (let i = 0; i < o.count; i++) {
      o.getMatrixAt(i, m);
      if (!m.elements.every(Number.isFinite)) throw new Error(`${label}: ${o.geometry.type} #${i} has a non-finite matrix`);
    }
  });
}
