import { HARM } from './vehicles/Vehicle.js';
import { Progress } from './Progress.js';
import { dailyParams } from './Daily.js';
import { CourierProps } from './CourierProps.js';
import { FlightHazards } from './FlightHazards.js';
import { Widget } from '../ui/Widget.js';
import { keepSaves } from '../core/Store.js';
import { FlightControls } from './input/FlightControls.js';
import { runClass } from './runs/modes.js';
import { CourierHud } from './screens/CourierHud.js';
import { MiniMap } from './screens/MiniMap.js';
import { EngineSound } from '../ui/EngineSound.js';
import { ResultsScreen } from './screens/ResultsScreen.js';
import { PauseMenu } from './screens/PauseMenu.js';
import { Briefing } from './screens/Briefing.js';
import { OptionsMenu } from './screens/OptionsMenu.js';
import { Hangar } from './screens/Hangar.js';
import { MissionBoard } from './screens/MissionBoard.js';
import { RoadBoard } from './screens/RoadBoard.js';

const RESPAWN = 1.8; // seconds of smoke after a wreck before a fresh vehicle turns up (free modes)
const LONG_JUMP = 5;  // seconds a rover must stay off the ground for the Giant Leap trophy

/**
 * Sky Courier: fly a little plane (or drive a car, or sail a boat) around the planet. This runs the show: it starts
 * and stops runs, moves the vehicle (vehicles/) each frame and hands what happens to the current run (runs/), which
 * decides the rules. Around it are the menus and HUD (screens/, the mini-map too), the controls (input/), the beacon
 * and rings (CourierProps) and the weather and volcanoes (FlightHazards).
 */
export class CourierGame {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.over = false;  // the run has ended and the results card is up
    this.run = null;    // the current Run
    this.player = null; // the Vehicle being driven
    this.props = null;  // its CourierProps
    this.respawnT = 0;  // counting down to a fresh vehicle after a wreck
    this.progress = new Progress();
    this.touch = matchMedia('(pointer: coarse)').matches;
    // the game layer, in front of the planet; what's in it is stacked in this order
    this.layer = new Widget({ id: 'game' });
    this.el = this.layer.el;
    this.hud = new CourierHud(this);
    this.minimap = new MiniMap(this);
    this.engine = new EngineSound(app.sfx);
    this.hornT = 0;
    this.results = new ResultsScreen(this);
    this.controls = new FlightControls(this);
    this.controls.bindBoost(this.hud.dom.boostBtn);
    this.hazards = new FlightHazards(this);
    this.options = new OptionsMenu(app, this);
    this.briefing = new Briefing(app, this);
    this.pauseMenu = new PauseMenu(this);
    this.board = new MissionBoard(app, this.progress, (m) => this.startMission(m));
    this.roads = new RoadBoard(app, (opts) => this.launch(opts));
    this.hangar = new Hangar(app, this.progress, {
      onFly: () => this.launch(), onFree: () => this.launch({ free: true }), onDaily: () => this.startDaily(),
      onMissions: () => this.board.show(), onRoads: () => this.roads.show(), onSpace: () => app.spaceCourier?.openBoard(),
      onOptions: () => this.options.show(() => this.hangar.show()),
    });
  }

  /** Build the planet a run needs (unless it's already loaded), then start. */
  async flyOn(want, opts, note) {
    const app = this.app, p = app.params;
    if (this.active) return;
    if (app.building) { app.hud.toast('🌍 The planet is still being built. Try again in a moment.'); return; }
    const there = want.world ? p.world === want.world
      : !p.world && p.seed === want.seed && p.land === want.land && p.cities === want.cities && p.theme === want.theme;
    if (!app.planet || !there) {
      app.hud.toast(note);
      if (want.world) await app.newPlanet(p.seed, false, null, want.world); // (a real world: its own seed and look)
      else {
        Object.assign(app.params, want);
        app.hud.panel.syncParams(app.params);
        await app.newPlanet(want.seed, false, want.theme);
      }
    }
    this.launch(opts);
  }

  /** The briefing first (unless switched off in Options), then the run. */
  launch(opts = {}) {
    if (this.active) return;
    if (this.app.settings?.get('briefing') === false) this.start(opts);
    else this.briefing.show(opts);
  }

  startMission(def) { return this.flyOn(def.planet, { mission: def }, `${def.icon} Building the planet for ${def.name}…`); }

  /** Today's challenge: build today's planet if needed, then fly the stock plane on the shared route. */
  startDaily() { return this.flyOn(dailyParams(), { daily: true }, "📅 Building today's planet…"); }

  openHangar() {
    if (this.active) return;
    this.hangar.show();
  }

  /** Take over a car or boat from the planet (its info card's Drive button) and drive it about. */
  driveThis(e) {
    if (this.active || this.app.building) return;
    this.launch({ drive: e.kind === 'boat' ? 'boat' : 'car', take: { kind: e.kind, id: e.id, name: e.name } });
  }

  /** Same kind of run again: a courier run, free flight, today's daily, or the same mission. */
  again() {
    const opts = this.run.opts;
    this.stop();
    this.start(opts);
  }

  /** Start a run straight away (launch() shows the briefing first). opts: see runClass() in runs/modes.js. */
  start(opts = {}) {
    const app = this.app, p = app.planet;
    if (this.active) return;
    if (!p || app.building) { app.hud.toast('🌍 The planet is still being built. Try again in a moment.'); return; }
    if (p.cities.sites.length < 2) { app.hud.toast('📦 Sky Courier needs at least 2 cities. Try a new planet!'); return; }
    if (app.paused) app.togglePause();
    Object.assign(this, { active: true, over: false, planet: p, respawnT: 0 });
    const run = (this.run = new (runClass(opts))(this, opts)), { at, heading } = run.takeoff();
    this.player = run.vehicle(at, heading);
    if (app.settings) this.player.controls = app.settings.values; // Invert Y and sensitivity, live
    this.player.setCargo(run.cargo);
    this.props = new CourierProps(p, run.rings);
    this.hazards.reset();
    this.airT = 0; // seconds a rover's been off the ground (for the Giant Leap trophy)
    app.rig.setGame(this.player);
    app.hud.setGameMode(true);
    this.layer.show();
    this.results.hide();
    this.hud.setLayout(run.layout, this.player);
    this.minimap.begin();
    this.engine.start(this.player.kind);
    this.controls.attach();
    app.wakeLock?.want('game', true);
    app.sfx.play('start');
    run.begin();
    app.renderer.compileAsync?.(this.props.group, app.camera, app.scene)?.catch(() => {}); // new props: compile now, not mid-flight
    const flying = this.player.kind === 'plane', tilt = this.controls.tilt.supported ? ' ⏸ has tilt steering.' : '';
    if (this.touch) app.hud.toast(flying ? `👆 Drag on the left to steer and climb, hold BOOST to speed up.${tilt}` : `👆 Drag on the left: sideways to steer, up to go, down to brake.${tilt}`);
    else if (flying && p.airports?.list.length) app.hud.toast('✈️ Tip: skim low along an airport runway to refuel your boost and patch up the plane.');
    this.hud.update();
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.controls.detach();
    this.player.dispose();
    this.player = null;
    this.run.end();
    this.run = null;
    this.props.dispose();
    this.props = null;
    this.minimap.end();
    this.engine.stop();
    this.app.wakeLock?.want('game', false);
    this.layer.hide();
    this.results.hide();
    this.pauseMenu.sync();
    this.app.hud.setGameMode(false);
    this.app.rig.release();
  }

  /** One frame: move the vehicle, tell the run what happened, then let it apply its rules. */
  update(dt) {
    if (!this.active || this.over || dt <= 0) return;
    const app = this.app, run = this.run, pl = this.player;
    if (this.respawnT > 0) { // wrecked in a free mode: a moment of smoke, then a fresh one
      pl.smoke.update(dt);
      if ((this.respawnT -= dt) <= 0) this.respawn();
      this.hud.update();
      return;
    }
    this.controls.update();
    pl.update(dt);
    this.airT = pl.kind === 'car' && pl.airborne && this.planet.theme.air ? this.airT + dt : 0; // (a rover: where the air's thin or gone)
    if (this.airT > LONG_JUMP) app.achievements.unlock('longjump');
    if (pl.crashed) {
      app.haptics?.buzz('crash');
      pl.damage(pl.impact ?? HARM.crash);
      run.crashed();
    }
    this.hazards.update(dt);
    if (this.planet.ufo?.catchBy(pl.pos)) {
      run.caughtUfo();
      app.achievements.unlock('ufo');
    }
    for (const ring of this.props.rings) {
      if (ring.position.distanceTo(pl.pos) > pl.stats.magnet) continue;
      pl.boost = 1;
      app.haptics?.buzz('ring');
      run.ring(ring);
      run.placeRing(ring);
    }
    run.update(dt);
    if (pl.wrecked && !this.over) this.wreck();
    this.props.update(dt);
    this.hud.update();
  }

  /** Once a frame, after the camera has moved: what's drawn over the view (the player's name tag, the mini-map). */
  draw(renderer) {
    this.hud.placeYou();
    this.engine.update(this.player, !this.over && !this.app.paused && this.respawnT <= 0);
    this.minimap.render(renderer);
  }

  /** The horn (H, the 📯 button, or Y on a controller): a car honks, a boat toots; a plane has none. */
  horn() {
    const pl = this.player, now = this.app.simTime ?? 0;
    if (!this.active || this.over || !pl || pl.kind === 'plane' || now - this.hornT < 0.35) return false;
    this.hornT = now;
    this.app.sfx.pop(pl.pos.clone().addScaledVector(pl.up, 0.15), pl.kind === 'boat' ? 'TOOT TOOT!' : 'HONK!', '#ffd23f');
    return true;
  }

  /** Out of health: up in smoke. The run decides what then (game over, or a fresh one in the free modes). */
  wreck() {
    const pl = this.player, app = this.app;
    pl.explode();
    app.sfx.pop(pl.pos.clone(), 'KABOOM!', '#ff8c42', 'boom');
    app.haptics?.buzz('crash');
    app.achievements.unlock('totalled');
    this.run.wrecked();
  }

  /** A fresh vehicle at the nearest town in a moment (the free modes, after a wreck). */
  respawnSoon() {
    this.respawnT = RESPAWN;
    this.controls.release();
  }

  respawn() {
    const { at, heading, name } = this.run.respawnPoint();
    this.player.respawn(at, heading);
    this.app.hud.toast(`🔧 Good as new${name ? `, at ${name}` : ''}. Mind how you go!`);
  }

  /** The run is over: freeze the plane and show its results card (see ResultsScreen.show) with a sound. */
  finish(card, sound = 'gameover') {
    this.over = true;
    this.controls.release();
    this.results.show(card);
    this.app.sfx.play(sound);
    keepSaves(); // there's progress worth keeping now
    this.hud.update();
  }
}
