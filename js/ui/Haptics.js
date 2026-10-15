const KEY = 'planetpop.vibrate';
const PATTERNS = { tap: 12, ring: 15, deliver: [30, 50, 40], crash: 140, zap: [60, 40, 60, 40, 90], trophy: [20, 40, 20, 40, 60] };

/** Little buzzes on phones that support vibration (Android; iPhones don't let web pages vibrate). */
export class Haptics {
  constructor() {
    // desktop Chrome has navigator.vibrate too, but nothing to buzz: only offer it on touch screens
    this.supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && matchMedia('(pointer: coarse)').matches;
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    this.enabled = saved !== '0';
  }

  setEnabled(on) {
    this.enabled = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
    if (on) this.buzz('tap');
  }

  buzz(kind) {
    if (!this.supported || !this.enabled) return;
    try { navigator.vibrate(PATTERNS[kind] ?? 20); } catch { /* not allowed right now */ }
  }
}
