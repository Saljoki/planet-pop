import * as THREE from 'three';
import { LAYER_FX } from './core/Geo.js';
import { shared } from './render/Toon.js';
import { PostFX } from './render/PostFX.js';
import { Quality } from './render/Quality.js';
import { Detail } from './render/Detail.js';
import { Sky } from './sky/Sky.js';
import { Planet } from './world/Planet.js';
import { Hud } from './ui/Hud.js';
import { Sfx } from './ui/Sfx.js';
import { Achievements } from './ui/Achievements.js';
import { CameraRig } from './camera/CameraRig.js';
import { CourierGame } from './game/CourierGame.js';
import { DebugStats } from './ui/DebugStats.js';
import { Ambience } from './ui/Ambience.js';
import { PhotoMode } from './ui/PhotoMode.js';
import { Gamepad } from './game/input/Gamepad.js';
import { Haptics } from './ui/Haptics.js';
import { WakeLock } from './ui/WakeLock.js';
import { TourMode } from './ui/TourMode.js';
import { FindMenu } from './ui/FindMenu.js';
import { TrophyWatch } from './ui/TrophyWatch.js';
import { Settings } from './game/Settings.js';
import { SaveBox } from './game/screens/SaveBox.js';
import { Friends } from './net/Friends.js';
import { FriendsMenu } from './ui/FriendsMenu.js';
import { dailyParams } from './game/Daily.js';
import { THEME_IDS, pickTheme } from './world/Themes.js';
import { WORLD_IDS, worldOf } from './space/Worlds.js';
import { SystemMap } from './space/SystemMap.js';
import { Trip } from './space/Trip.js';

/**
 * Planet settings from the address bar (?seed=…&land=…&cities=…&theme=…), with defaults for anything missing.
 * ?daily means today's planet; ?world=moon (or earth, mars) one of the real worlds.
 */
function paramsFromUrl() {
  const q = new URLSearchParams(location.search);
  if (q.has('daily')) return dailyParams();
  const world = WORLD_IDS.includes(q.get('world')) ? q.get('world') : null;
  const num = (key, fallback, lo, hi) => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  };
  return {
    seed: Math.floor(num('seed', 20261014, 0, 1e9)),
    land: num('land', 45, 25, 70) / 100,
    cities: Math.round(num('cities', 5, 2, 8)),
    theme: THEME_IDS.includes(q.get('theme')) ? q.get('theme') : 'classic', // links from before themes existed stay classic
    world,
  };
}

/** Owns the renderer, the frame loop, and swaps planets in and out. */
export class App {
  constructor() {
    this.params = { ...paramsFromUrl(), traffic: 5 };
    this.dailyLink = new URLSearchParams(location.search).has('daily'); // opened from a shared daily result
    this.roomLink = new URLSearchParams(location.search).get('room'); // opened from a friend's invite
    this.timeScale = 1;
    this.paused = false;
    this.simTime = 0;
    this.planet = null;
    this.building = false;
    this.pending = null;      // a planet requested while another one was still building
    this.worldMode = 'random'; // 'random' gives each new planet a theme picked from its seed, or a fixed theme id
    this.userInk = true;     // panel checkboxes; the quality level can still turn the ink pass off
    this.userShadows = true;

    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    r.setClearColor(0x000000, 0);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.BasicShadowMap; // crisp comic shadows
    r.shadowMap.autoUpdate = false;          // updated once per frame, not once per render pass
    document.body.prepend(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 2000);
    this.camera.layers.enable(LAYER_FX);
    const start = Math.max(36, 14 / (Math.tan(THREE.MathUtils.degToRad(22.5)) * this.camera.aspect));
    this.camera.position.set(0, 0.3, 1).normalize().multiplyScalar(start);
    this.scene.add(this.camera);

    this.settings = new Settings();     // before anything that reads an option
    this.ambience = new Ambience(this); // before the HUD, which shows its saved volume
    this.haptics = new Haptics();       // likewise its vibration setting
    this.wakeLock = new WakeLock();
    this.hud = new Hud(this);
    this.postfx = new PostFX(r);
    this.sky = new Sky(this.scene);
    this.sfx = new Sfx(this);
    this.achievements = new Achievements(this.hud);
    this.trophies = new TrophyWatch(this);
    this.rig = new CameraRig(this);
    this.map = new SystemMap(this);
    this.trip = new Trip(this);
    this.game = new CourierGame(this);
    this.quality = new Quality(this);
    this.debug = new DebugStats(this);
    this.photo = new PhotoMode(this);
    this.gamepad = new Gamepad(this);
    this.tour = new TourMode(this);
    this.find = new FindMenu(this);
    this.friends = new Friends(this);
    this.friendsMenu = new FriendsMenu(this);
    this.detail = new Detail();
    this.onRendered = null; // one-shot callback with the canvas right after a frame is drawn (photo mode)

    addEventListener('resize', () => this.resize());
    this.clock = new THREE.Clock();
    this.newPlanet(this.params.seed, true);
    r.setAnimationLoop(() => this.frame());
  }

  resize() {
    const r = this.renderer, w = innerWidth, h = innerHeight, pr = r.getPixelRatio();
    r.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.postfx.setSize(Math.floor(w * pr), Math.floor(h * pr));
  }

  /**
   * theme: a theme id, or leave it out to follow the World setting (the first planet keeps the address bar's).
   * world: a real world's id ('earth', 'moon', 'mars'): it comes with its own seed and look; null for a made-up planet.
   */
  async newPlanet(seed = Math.floor(Math.random() * 1e9), initial = false, theme = null, world = null) {
    if (this.building) { this.pending = { seed, theme, world }; return; }
    this.building = true;
    this.params.seed = seed;
    if (!initial) {
      this.params.theme = theme ?? (this.worldMode === 'random' ? pickTheme(seed) : this.worldMode);
      this.params.world = world;
    }
    this.hud.setLoading(true);
    await new Promise((res) => setTimeout(res, 30)); // let the overlay paint first
    try {
      this.swapIn(await this.buildPlanet(this.params), initial);
    } catch (err) {
      console.error(err);
      this.hud.toast('💥 Planet build failed (see console)');
    }
    this.hud.setLoading(false);
    this.quality.pauseFor(3);
    this.building = false;
    if (initial && this.settings.playerName) this.hud.toast(`👋 Welcome back, ${this.settings.playerName}!`);
    if (initial) SaveBox.welcome(this.hud);
    if (initial && this.roomLink) { // opened from an invite: into the room (and a name first, if there isn't one)
      this.friends.join(this.roomLink);
      if (!this.settings.playerName) this.friendsMenu.show();
    }
    if (initial && this.dailyLink) {
      this.dailyLink = false;
      this.hud.toast("📅 Today's daily challenge is ready. Press Daily challenge to fly it!");
      this.game.openHangar();
    }
    if (this.pending) {
      const { seed: s, theme: t, world: w } = this.pending;
      this.pending = null;
      this.newPlanet(s, false, t, w);
    }
  }

  /** A planet, built and ready to show (it's in the scene, but nothing draws the scene while a trip cruises). */
  async buildPlanet(params) {
    const planet = new Planet(this, params);
    await planet.build();
    await this.warmUp();
    return planet;
  }

  /** A real world built quietly in the background (a trip builds the next world during the cruise). */
  async buildWorld(id) {
    this.building = true;
    try {
      return await this.buildPlanet({ ...this.params, world: id });
    } finally {
      this.building = false;
    }
  }

  /** Show a built planet in place of the old one. */
  swapIn(planet, initial = false) {
    if (this.game.active) this.game.stop();
    this.rig.release(true);
    this.map.close(true);
    this.planet?.dispose();
    this.planet = planet;
    this.detail.collect(planet.root);
    this.params.world = planet.world?.id ?? null;
    if (planet.world) Object.assign(this.params, { seed: planet.params.seed, theme: planet.params.theme, cities: planet.params.cities });
    this.sky.setTheme(planet.theme);
    this.sky.dayLength = planet.world?.day ?? 150;
    this.hud.setTheme(planet.world ?? planet.theme);
    if (!initial) this.achievements.unlock('newworld');
    if (!planet.world || planet.world.id === 'earth') this.achievements.visitTheme(planet.theme.id); // (the kinds of made-up world)
    this.updateUrl();
  }

  /** Compile every shader while the loading screen is up, so nothing stutters the first time it appears. */
  async warmUp() {
    try {
      const compiling = this.renderer.compileAsync(this.scene, this.camera);
      await Promise.race([compiling, new Promise((res) => setTimeout(res, 5000))]);
    } catch (err) {
      console.warn('Shader warm-up skipped', err);
    }
  }

  /** Keep the address bar pointing at the current planet, so the link can be shared. */
  updateUrl() {
    const p = this.params;
    const q = p.world ? new URLSearchParams({ world: p.world })
      : new URLSearchParams({ seed: p.seed, land: Math.round(p.land * 100), cities: p.cities, theme: p.theme });
    if (this.friends?.code) q.set('room', this.friends.code);
    if (this.friends?.tabs) q.set('net', 'tabs');
    try { history.replaceState(null, '', `${location.pathname}?${q}`); } catch { /* e.g. sandboxed iframe */ }
  }

  async sharePlanet() {
    this.updateUrl();
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      this.hud.toast('🔗 Link copied! Anyone who opens it gets this exact planet.');
    } catch {
      prompt('Copy this link to share the planet:', url);
    }
  }

  frame() {
    const real = Math.min(this.clock.getDelta(), 0.1);
    const scale = this.paused ? 0 : this.game.active ? 1 : this.timeScale;
    const dt = Math.min(real, 0.05) * scale;
    const steps = Math.max(1, Math.ceil(dt / 0.05)), h = dt / steps; // sub-steps keep fast-forward stable
    const map = this.map.open; // (the planet waits, unseen, while the system map is up)
    for (let i = 0; i < steps && !map; i++) {
      this.simTime += h;
      shared.uTime.value = this.simTime;
      this.sky.update(h);
      this.planet?.update(h, this.simTime);
    }
    this.trophies.update();
    this.gamepad.update();
    if (this.game.active) this.game.update(dt, real);
    if (this.trip.active) this.trip.update(dt);
    this.friends.update(real);
    this.tour.update(real);
    if (map) this.map.update(real);
    else this.rig.update(real);
    this.hud.update(real);
    this.sfx.update(real);
    this.ambience.update(real);
    this.quality.tick(real);
    this.debug.begin();
    if (map) this.map.render(this.postfx);
    else {
      this.sky.fitShadow(this.camera);
      this.detail.update(this.camera);
      if (this.quality.shadowFrame()) this.renderer.shadowMap.needsUpdate = true;
      this.postfx.render(this.scene, this.camera);
      if (this.game.active) this.game.draw(this.renderer);
      this.friends.draw();
    }
    if (this.onRendered) { const done = this.onRendered; this.onRendered = null; done(this.renderer.domElement); }
    this.debug.end(real);
  }

  togglePause() {
    this.paused = !this.paused;
    this.hud.panel.setPaused(this.paused);
    this.game.pauseMenu?.sync();
  }

  /** A touch, click or key on the planet: the user is here (stops the tour). */
  onUserInput() { this.tour?.input(); }
  setTimeScale(x) { this.timeScale = x; }
  setInk(on) { this.userInk = on; this.quality.apply(); }
  setShadows(on) { this.userShadows = on; this.quality.apply(); }
  setQuality(mode) { this.quality.setMode(mode); }
  setTraffic(n) { this.params.traffic = n; this.planet?.traffic.rebuild(n); }
  /** Go straight to one of the real worlds ('earth', 'moon', 'mars'), no trip (a link, a friend). */
  visitWorld(id) { if (worldOf(id)) this.newPlanet(this.params.seed, false, null, id); }

  /** A slider moved: rebuild this planet that way (a real world becomes a made-up one, in the World setting's look). */
  setWorldParam(key, value) {
    this.params[key] = value;
    this.newPlanet(this.params.seed, false, THEME_IDS.includes(this.params.theme) && !this.params.world ? this.params.theme : null);
  }

  /** 'random', or a theme id: rebuilds this planet in that theme straight away. */
  setWorld(mode) {
    this.worldMode = mode;
    if (mode === 'random') this.hud.toast('🎲 Every new planet will be a surprise world.');
    else if (mode !== this.params.theme) this.newPlanet(this.params.seed, false, mode);
  }

  /** The camera has arrived at something to follow it. */
  onFocus(e) {
    this.trophies.arrived(e);
    this.hud.info.hide();
  }
}
