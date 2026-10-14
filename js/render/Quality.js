import { shared } from './Toon.js';

const LEVELS = [
  { name: 'Crisp', full: true, shadow: 2048, every: 1, ink: true, msaa: 4 },     // full device resolution
  { name: 'Sharp', full: false, shadow: 2048, every: 1, ink: true, msaa: 4 },    // 1 pixel per CSS pixel
  { name: 'Balanced', full: false, shadow: 1024, every: 2, ink: true, msaa: 0 }, // FXAA only, lighter shadows every 2nd frame
  { name: 'Fast', full: false, shadow: 1024, every: 3, ink: false, msaa: 0 },    // no edge-ink pass (outlines stay)
];
const FIXED = { crisp: 0, balanced: 2, fast: 3 };
const SLOW_MS = 25;   // slower than ~40 fps → step down
const STEADY_MS = 19; // ~52 fps or better (any 60 Hz+ screen running smoothly) → may step up
const KEY = 'planetpop.quality';
const clampLevel = (l) => Math.min(LEVELS.length - 1, Math.max(0, l | 0));

/**
 * Render quality. 'auto' starts from the last level that ran well, steps down only on a sustained slowdown
 * that a cheaper level actually fixes, and steps back up once frames are steady.
 * Resolution never drops below one pixel per CSS pixel, so the picture stays sharp.
 */
export class Quality {
  constructor(app) {
    this.app = app;
    this.max = Math.min(devicePixelRatio || 1, 2);
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* storage unavailable */ }
    this.mode = saved.mode in FIXED ? saved.mode : 'auto';
    this.level = this.mode === 'auto' ? clampLevel(saved.level ?? 0) : FIXED[this.mode];
    this.frame = 0;
    this.blockedUntil = LEVELS.map(() => 0);
    this.holdUntil = 0;
    this.probe = null;
    this.reset(3);
    this.apply();
  }

  get name() { return LEVELS[this.level].name; }
  get pr() { return this.app.renderer.getPixelRatio(); } // handy in DevTools: app.quality.pr

  apply() {
    const app = this.app, L = LEVELS[this.level];
    const pr = L.full ? this.max : Math.min(1, this.max);
    if (app.renderer.getPixelRatio() !== pr) app.renderer.setPixelRatio(pr);
    shared.uHalftone.value = Math.max(4, 5 * pr);
    app.postfx.enabled = app.userInk && L.ink;
    app.postfx.setSamples?.(L.msaa);
    const light = app.sky.light;
    light.castShadow = app.userShadows;
    if (light.shadow.mapSize.x !== L.shadow) {
      light.shadow.mapSize.set(L.shadow, L.shadow);
      light.shadow.map?.dispose();
      light.shadow.map = null;
    }
    app.resize();
    app.hud.setQuality(this.mode, L.name);
    try { localStorage.setItem(KEY, JSON.stringify({ mode: this.mode, level: this.level })); } catch { /* storage unavailable */ }
  }

  setMode(mode) {
    this.mode = mode in FIXED ? mode : 'auto';
    if (this.mode !== 'auto') this.level = FIXED[this.mode];
    this.probe = null;
    this.reset(2);
    this.apply();
  }

  pauseFor(seconds) { this.reset(seconds); }
  reset(warm) { this.warm = warm; this.acc = 0; this.frames = 0; this.steady = 0; }

  /** True on the frames where the shadow map should be redrawn. */
  shadowFrame() { return this.frame++ % LEVELS[this.level].every === 0; }

  step(level) {
    this.level = level;
    this.reset(1);
    this.apply();
  }

  tick(dt) {
    if (this.warm > 0) { this.warm -= dt; return; }
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return;
    const ms = (this.acc / this.frames) * 1000;
    this.acc = 0;
    this.frames = 0;
    if (this.mode !== 'auto') return;
    const now = performance.now() / 1000;

    if (this.probe) { // was the last step down worth it?
      const { from, before } = this.probe;
      this.probe = null;
      if (ms > before * 0.85) { // not limited by the GPU: cheaper settings don't help, so keep the nicer look
        this.holdUntil = now + 300;
        this.step(from);
        return;
      }
    }
    if (ms > SLOW_MS && this.level < LEVELS.length - 1 && now >= this.holdUntil) {
      this.blockedUntil[this.level] = now + 180; // don't climb straight back into a level that was too slow
      this.probe = { from: this.level, before: ms };
      this.step(this.level + 1);
    } else if (ms < STEADY_MS && this.level > 0) {
      if (++this.steady >= 3 && now >= this.blockedUntil[this.level - 1]) this.step(this.level - 1);
    } else {
      this.steady = 0;
    }
  }
}
