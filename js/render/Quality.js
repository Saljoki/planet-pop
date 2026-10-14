import { shared } from './Toon.js';

/** Adaptive resolution: drops pixel ratio (then ink edges) when frames run slow, raises it when there's headroom. */
export class Quality {
  constructor(app) {
    this.app = app;
    this.max = Math.min(devicePixelRatio, 2);
    this.pr = this.max;
    this.acc = 0;
    this.frames = 0;
    this.warm = 4;
    this.apply();
  }

  apply() {
    this.app.renderer.setPixelRatio(this.pr);
    shared.uHalftone.value = Math.max(4, 5 * this.pr);
    this.app.resize();
  }

  pauseFor(seconds) { this.warm = seconds; this.acc = 0; this.frames = 0; }

  tick(dt) {
    if (this.warm > 0) { this.warm -= dt; return; }
    this.acc += dt;
    this.frames++;
    if (this.acc < 2) return;
    const ms = (this.acc / this.frames) * 1000;
    this.acc = 0;
    this.frames = 0;
    if (ms > 26) {
      if (this.pr > 0.75) { this.pr = Math.max(0.75, this.pr - 0.25); this.apply(); }
      else if (this.app.postfx.enabled) this.app.setInk(false);
    } else if (ms < 14 && this.pr < this.max) {
      this.pr = Math.min(this.max, this.pr + 0.25);
      this.apply();
    }
  }
}
