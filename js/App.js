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
import { Gamepad } from './game/Gamepad.js';
import { dailyParams } from './game/Daily.js';
import { THEME_IDS, pickTheme } from './world/Themes.js';

/** Planet settings from the address bar (?seed=…&land=…&cities=…&theme=…), with defaults for anything missing. ?daily means today's planet. */
function paramsFromUrl() {
  const q = new URLSearchParams(location.search);
  if (q.has('daily')) return dailyParams();
  const num = (key, fallback, lo, hi) => {
    const v = Number(q.get(key));
    return q.has(key) && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;
  };
  return {
    seed: Math.floor(num('seed', 20261014, 0, 1e9)),
    land: num('land', 45, 25, 70) / 100,
    cities: Math.round(num('cities', 5, 2, 8)),
    theme: THEME_IDS.includes(q.get('theme')) ? q.get('theme') : 'classic', // links from before themes existed stay classic
  };
}

/** Owns the renderer, the frame loop, and swaps planets in and out. */
export class App {
  constructor() {
    this.params = { ...paramsFromUrl(), traffic: 5 };
    this.dailyLink = new URLSearchParams(location.search).has('daily'); // opened from a shared daily result
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

    this.ambience = new Ambience(this); // before the HUD, which shows its saved volume
    this.hud = new Hud(this);
    this.postfx = new PostFX(r);
    this.sky = new Sky(this.scene);
    this.sfx = new Sfx(this);
    this.achievements = new Achievements(this.hud);
    this.rig = new CameraRig(this);
    this.game = new CourierGame(this);
    this.quality = new Quality(this);
    this.debug = new DebugStats(this);
    this.photo = new PhotoMode(this);
    this.gamepad = new Gamepad(this);
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

  /** theme: a theme id, or leave it out to follow the World setting (the first planet keeps the address bar's). */
  async newPlanet(seed = Math.floor(Math.random() * 1e9), initial = false, theme = null) {
    if (this.building) { this.pending = { seed, theme }; return; }
    this.building = true;
    this.params.seed = seed;
    if (!initial) this.params.theme = theme ?? (this.worldMode === 'random' ? pickTheme(seed) : this.worldMode);
    this.hud.setLoading(true);
    await new Promise((res) => setTimeout(res, 30)); // let the overlay paint first
    try {
      const planet = new Planet(this, this.params);
      await planet.build();
      await this.warmUp();
      if (this.game.active) this.game.stop();
      this.rig.release(true);
      this.planet?.dispose();
      this.planet = planet;
      this.detail.collect(planet.root);
      this.sky.setTheme(planet.theme);
      this.hud.setTheme(planet.theme);
      if (!initial) this.achievements.unlock('newworld');
      this.achievements.visitTheme(planet.theme.id);
      this.updateUrl();
    } catch (err) {
      console.error(err);
      this.hud.toast('💥 Planet build failed (see console)');
    }
    this.hud.setLoading(false);
    this.quality.pauseFor(3);
    this.building = false;
    if (initial && this.dailyLink) {
      this.dailyLink = false;
      this.hud.toast("📅 Today's daily challenge is ready. Press Daily challenge to fly it!");
      this.game.openHangar();
    }
    if (this.pending) {
      const { seed: s, theme: t } = this.pending;
      this.pending = null;
      this.newPlanet(s, false, t);
    }
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
    const q = new URLSearchParams({ seed: p.seed, land: Math.round(p.land * 100), cities: p.cities, theme: p.theme });
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
    for (let i = 0; i < steps; i++) {
      this.simTime += h;
      shared.uTime.value = this.simTime;
      this.sky.update(h);
      this.planet?.update(h, this.simTime);
    }
    if (this.planet) this.checkFollow();
    this.gamepad.update();
    if (this.game.active) this.game.update(dt, real);
    this.rig.update(real);
    this.sfx.update(real);
    this.ambience.update(real);
    this.quality.tick(real);
    this.sky.fitShadow(this.camera);
    this.detail.update(this.camera);
    if (this.quality.shadowFrame()) this.renderer.shadowMap.needsUpdate = true;
    this.debug.begin();
    this.postfx.render(this.scene, this.camera);
    if (this.onRendered) { const done = this.onRendered; this.onRendered = null; done(this.renderer.domElement); }
    this.debug.end(real);
  }

  togglePause() { this.paused = !this.paused; this.hud.setPaused(this.paused); }
  setTimeScale(x) { this.timeScale = x; }
  setInk(on) { this.userInk = on; this.quality.apply(); }
  setShadows(on) { this.userShadows = on; this.quality.apply(); }
  setQuality(mode) { this.quality.setMode(mode); }
  setTraffic(n) { this.params.traffic = n; this.planet?.traffic.rebuild(n); }
  setWorldParam(key, value) { this.params[key] = value; this.newPlanet(this.params.seed, false, this.params.theme); }

  /** 'random', or a theme id: rebuilds this planet in that theme straight away. */
  setWorld(mode) {
    this.worldMode = mode;
    if (mode === 'random') this.hud.toast('🎲 Every new planet will be a surprise world.');
    else if (mode !== this.params.theme) this.newPlanet(this.params.seed, false, mode);
  }

  onFocus(e) {
    const a = this.achievements;
    if (e.kind === 'bird') a.unlock('birdwatcher');
    if (e.kind === 'station') a.unlock('astronaut');
    if (e.kind === 'city') a.visitCity(e.name);
    if (e.kind === 'person') a.unlock('peoplewatcher');
    if (e.kind === 'ufo') a.unlock('ufo');
  }

  checkFollow() {
    const { rig, planet: p, achievements: a } = this, e = rig.entity;
    if (rig.mode !== 'local' || !e) return;
    if (e.kind === 'plane' && rig.followTime > 10) a.unlock('copilot');
    if (e.kind === 'helicopter' && rig.followTime > 10) a.unlock('chopper');
    if (e.kind === 'tram' && rig.followTime > 3 && p.trams.atEnd(p.trams.entities.indexOf(e))) a.unlock('tramride');
    if (e.kind === 'train' && p.railway.justExited) a.unlock('tunnel');
    if (e.kind === 'car' && e.mesh === p.traffic.body && p.traffic.isWaiting(e.id)) a.unlock('redlight');
    if (e.kind === 'city' && p.nightAt(e.pos) > 0.6) a.unlock('nightowl');
    if (e.kind === 'city' && p.seasons.snowAt(e.pos.clone().normalize()) > 0.5) a.unlock('snowday');
  }
}
