import * as THREE from 'three';
import { R, smoothstep, tangentBasis } from '../core/Geo.js';

const KEY = 'planetpop.ambience';
const LEVEL = { wind: 0.09, waves: 0.16, city: 0.12, drone: 0.05 }; // full-volume gain of each layer
const _d = new THREE.Vector3(), _s = new THREE.Vector3();

/**
 * How loud each ambient layer should be (0..1) for where the camera is.
 * alt: height above sea level · sea: share of water below · city: closeness to a town · night: 0 day … 1 night.
 */
export function ambientMix({ alt, sea, city, night }) {
  const low = 1 - smoothstep(1.2, 8, alt), space = smoothstep(8, 30, alt);
  const land = low * (1 - sea);
  return {
    wind: 0.25 + 0.75 * smoothstep(0.5, 10, alt) * (1 - space),
    waves: low * sea,
    city: city * low * (1 - night * 0.5),
    drone: space,
    birds: land * (1 - night) * (1 - city * 0.6), // chance of a chirp, per second
    crickets: land * night * (1 - city * 0.5),
  };
}

/**
 * A synthesized soundscape that follows the camera: wind, surf, a city's murmur, birds by day, crickets by night,
 * and a low hum out in space. Shares the sound-effects audio context; has its own volume slider.
 */
export class Ambience {
  constructor(app) {
    this.app = app;
    let v = 0.5;
    try { const s = localStorage.getItem(KEY); if (s !== null) v = Math.min(1, Math.max(0, +s)); } catch { /* storage unavailable */ }
    this.volume = v;
    this.layers = null;
    this.chirpT = 1;
  }

  setVolume(v) {
    this.volume = v;
    try { localStorage.setItem(KEY, String(v)); } catch { /* storage unavailable */ }
  }

  /** Where the camera is, in the terms ambientMix understands. */
  environment() {
    const app = this.app, p = app.planet, cam = app.camera.position, dir = _d.copy(cam).normalize();
    const [u, v] = tangentBasis(dir);
    let sea = 0;
    for (let k = 0; k < 9; k++) { // how much of the ground around (and under) the camera is water
      const a = (k / 8) * Math.PI * 2, r = k === 8 ? 0 : 0.06;
      _s.copy(dir).addScaledVector(u, Math.cos(a) * r).addScaledVector(v, Math.sin(a) * r).normalize();
      if (p.heightAt(_s) < 0) sea += 1 / 9;
    }
    const nearest = Math.min(...p.cities.sites.map((s) => s.pos.distanceTo(cam)));
    return { alt: cam.length() - R, sea, city: 1 - smoothstep(1.2, 4.5, nearest), night: p.nightAt(cam) };
  }

  start() {
    const c = this.app.sfx.ctx, noise = (brown) => {
      const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < d.length; i++) {
        const w = Math.random() * 2 - 1;
        d[i] = brown ? (last = (last + 0.02 * w) / 1.02) * 3.5 : w;
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.start();
      return src;
    };
    const gain = () => { const g = c.createGain(); g.gain.value = 0; return g; };
    this.master = c.createGain();
    this.master.connect(c.destination);
    const L = (this.layers = { wind: gain(), waves: gain(), city: gain(), drone: gain() });
    for (const g of Object.values(L)) g.connect(this.master);

    const wf = c.createBiquadFilter();
    wf.type = 'bandpass'; wf.frequency.value = 420; wf.Q.value = 0.6;
    noise(false).connect(wf).connect(L.wind);
    const gust = c.createOscillator(), gustDepth = c.createGain(); // wind rises and falls
    gust.frequency.value = 0.09; gustDepth.gain.value = 180;
    gust.connect(gustDepth).connect(wf.frequency);
    gust.start();

    const surf = c.createGain(), sf = c.createBiquadFilter();
    sf.type = 'lowpass'; sf.frequency.value = 650;
    noise(false).connect(sf).connect(surf).connect(L.waves);
    const swell = c.createOscillator(), swellDepth = c.createGain(); // waves roll in every few seconds
    swell.frequency.value = 0.14; swellDepth.gain.value = 0.45;
    surf.gain.value = 0.55;
    swell.connect(swellDepth).connect(surf.gain);
    swell.start();

    const cf = c.createBiquadFilter();
    cf.type = 'lowpass'; cf.frequency.value = 380;
    noise(true).connect(cf).connect(L.city);

    for (const [f, detune] of [[55, 0], [82.5, 7], [110, -5]]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(L.drone);
      o.start();
    }
  }

  chirp(f0, f1, dur, vol, delay = 0) {
    const c = this.app.sfx.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  update(dt) {
    const app = this.app, sfx = app.sfx, c = sfx.ctx;
    if (!c || c.state !== 'running' || !app.planet || app.building) return;
    if (!this.layers) this.start();
    const mix = ambientMix(this.environment()), now = c.currentTime, on = sfx.enabled ? this.volume : 0;
    this.master.gain.setTargetAtTime(on, now, 0.3);
    for (const k of Object.keys(this.layers)) this.layers[k].gain.setTargetAtTime(mix[k] * LEVEL[k], now, 0.6);
    if (!on || (this.chirpT -= dt) > 0) return;
    this.chirpT = 0.4 + Math.random() * 0.8;
    if (Math.random() < mix.birds * 0.8) { // a little two- or three-note tweet
      const f = 2200 + Math.random() * 1600;
      for (let i = 0, n = 2 + Math.floor(Math.random() * 2); i < n; i++) this.chirp(f * (1 + i * 0.12), f * 1.3, 0.07, 0.03, i * 0.11);
    } else if (Math.random() < mix.crickets) {
      for (let i = 0; i < 3; i++) this.chirp(4300, 4200, 0.03, 0.015, i * 0.06);
    }
  }
}
