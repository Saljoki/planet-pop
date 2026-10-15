import * as THREE from 'three';
import { R, raySphere } from '../core/Geo.js';

const SOUND_FOR = {
  'KRAKA-BOOM!': 'boom', 'WHOOOSH!': 'whoosh', 'FWOOSH!': 'whoosh', 'ZOOM!': 'zoom', 'VROOM!': 'vroom',
  'BEEP BEEP!': 'beep', 'CHOO CHOO!': 'choo', 'TOOT TOOT!': 'toot', 'SQUAWK!': 'squawk', 'BONK!': 'crash',
  'SCREECH!': 'screech', 'RUMBLE…': 'rumble', 'KABOOM!': 'boom', 'BWEE-OOO!': 'ufo', 'HI!': 'chirp', 'NICE DAY!': 'chirp', 'OOH!': 'chirp',
};
const AMBIENT = {
  plane: [['ZOOM!', '#3fa7ff']],
  car: [['VROOM!', '#ff4d4d'], ['BEEP BEEP!', '#ffd23f']],
  train: [['CHOO CHOO!', '#ff8c42']],
  boat: [['TOOT TOOT!', '#2ee59d']],
  bird: [['SQUAWK!', '#8f5cff']],
  balloon: [['FWOOSH!', '#ff5fa2']],
  person: [['HI!', '#ffd23f'], ['NICE DAY!', '#2ee59d'], ['OOH!', '#ff5fa2']],
};
const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _p = new THREE.Vector3(), _q = new THREE.Vector3();

/** Comic sound-effect bubbles plus tiny synthesized sounds (no audio files). */
export class Sfx {
  constructor(app) {
    this.app = app;
    this.enabled = true;
    this.ctx = null;
    this.timer = 4;
    const unlock = () => this.unlock(); // browsers only allow audio after a user gesture
    addEventListener('pointerdown', unlock);
    addEventListener('keydown', unlock);
  }

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.out = this.ctx.createGain();
      this.out.gain.value = 0.6;
      this.out.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  ready() { return this.enabled && this.ctx?.state === 'running'; }

  tone(f0, f1, dur, type = 'square', vol = 0.06, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, vol, f0, f1, delay = 0) {
    const c = this.ctx, t = c.currentTime + delay;
    if (!this.noiseBuf) {
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    s.loop = true;
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(f0, t);
    fl.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(this.out);
    s.start(t);
    s.stop(t + dur + 0.05);
  }

  play(name) {
    if (!this.ready()) return;
    const T = (...a) => this.tone(...a), N = (...a) => this.noise(...a);
    const arp = (notes, gap, dur, type, vol) => notes.forEach((f, i) => T(f, 0, dur, type, vol, i * gap));
    switch (name) {
      case 'pop': T(500, 900, 0.12, 'square', 0.04); break;
      case 'beep': T(880, 0, 0.16, 'square', 0.05); break;
      case 'boom': N(1.3, 0.5, 1200, 60); T(80, 35, 0.9, 'sine', 0.35); break;
      case 'whoosh': N(1.6, 0.3, 250, 3500); break;
      case 'zoom': T(200, 700, 0.4, 'sawtooth', 0.035); break;
      case 'vroom': T(90, 170, 0.45, 'sawtooth', 0.05); break;
      case 'choo': N(0.16, 0.25, 3000, 900); N(0.16, 0.25, 3000, 900, 0.25); break;
      case 'toot': T(330, 0, 0.4, 'triangle', 0.09); break;
      case 'screech': N(0.5, 0.12, 5000, 1400); T(1400, 900, 0.35, 'sawtooth', 0.02); break;
      case 'shutter': N(0.06, 0.4, 6000, 2500); N(0.09, 0.3, 4000, 1200, 0.09); break;
      case 'firework': N(0.5, 0.3, 2500, 200); [0.15, 0.25, 0.32, 0.41, 0.5].forEach((d) => N(0.05, 0.12, 6000, 3000, d)); break;
      case 'rumble': N(1.6, 0.35, 160, 60); break;
      case 'ufo': T(300, 1300, 0.5, 'sine', 0.06); T(1300, 250, 0.7, 'sine', 0.06, 0.5); break;
      case 'chirp': T(700, 1100, 0.08, 'triangle', 0.05); T(900, 1300, 0.08, 'triangle', 0.05, 0.1); break;
      case 'squawk': T(1100, 600, 0.1, 'sawtooth', 0.035); T(1100, 600, 0.1, 'sawtooth', 0.035, 0.14); break;
      case 'ring': T(880, 0, 0.1, 'triangle', 0.07); T(1320, 0, 0.2, 'triangle', 0.07, 0.08); break;
      case 'crash': N(0.45, 0.45, 1600, 120); T(220, 60, 0.35, 'square', 0.07); break;
      case 'deliver': arp([523, 659, 784, 1047], 0.09, 0.18, 'triangle', 0.08); break;
      case 'trophy': arp([784, 988, 1175, 1568], 0.08, 0.22, 'square', 0.04); break;
      case 'start': arp([392, 523, 659], 0.1, 0.18, 'triangle', 0.08); break;
      case 'gameover': arp([523, 440, 349, 262], 0.16, 0.3, 'triangle', 0.08); break;
    }
  }

  /** Screen position of a world point, or null if off-screen or hidden behind the planet. */
  toScreen(pos) {
    const cam = this.app.camera;
    _d.subVectors(pos, cam.position);
    const dist = _d.length();
    _d.divideScalar(dist);
    const t = raySphere(cam.position, _d, R);
    if (t > 0 && t < dist - 0.3) return null;
    _v.copy(pos).project(cam);
    if (_v.z > 1 || Math.abs(_v.x) > 0.95 || Math.abs(_v.y) > 0.95) return null;
    return { x: ((_v.x + 1) / 2) * innerWidth, y: ((1 - _v.y) / 2) * innerHeight };
  }

  pop(pos, text, color = '#ff5fa2', sound) {
    const s = pos ? this.toScreen(pos) : { x: innerWidth / 2, y: innerHeight / 3 };
    if (!s) return;
    this.play(sound ?? SOUND_FOR[text] ?? (/^\d!$/.test(text) ? 'beep' : 'pop'));
    if (document.querySelectorAll('.bubble').length > 6) return;
    const el = document.createElement('div');
    el.className = 'bubble';
    el.textContent = text;
    el.style.left = `${s.x}px`;
    el.style.top = `${s.y}px`;
    el.style.background = color;
    document.getElementById('ui').append(el);
    setTimeout(() => el.remove(), 1350);
  }

  /** Every few seconds, something near the camera makes a noise. */
  update(dt) {
    const app = this.app, p = app.planet;
    if (!p || app.paused || app.building || (this.timer -= dt) > 0) return;
    this.timer = (app.game.active ? 6 : 3.5) + Math.random() * 3;
    const cam = app.camera.position, picks = [];
    for (const e of p.entities) {
      const lines = AMBIENT[e.kind];
      if (!lines) continue;
      e.getPos(_p);
      if (_p.distanceTo(cam) < 5 && this.toScreen(_p)) picks.push([e, lines]);
    }
    if (!picks.length) return;
    const [e, lines] = picks[Math.floor(Math.random() * picks.length)];
    const [text, color] = lines[Math.floor(Math.random() * lines.length)];
    e.getPos(_p);
    this.pop(_p.addScaledVector(_q.copy(_p).normalize(), 0.25), text, color);
  }
}
