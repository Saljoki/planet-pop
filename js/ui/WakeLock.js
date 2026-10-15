/**
 * Keeps the screen on while something wants it (flying, the tour) and lets it sleep otherwise.
 * Browsers drop the lock when the page is hidden, so it's taken again when the page comes back.
 */
export class WakeLock {
  constructor() {
    this.reasons = new Set();
    this.lock = null;
    this.supported = typeof navigator !== 'undefined' && !!navigator.wakeLock;
    if (this.supported) document.addEventListener?.('visibilitychange', () => this.sync());
  }

  /** `reason` ('game', 'tour'…) wants the screen kept on, or no longer does. */
  want(reason, on) {
    if (on) this.reasons.add(reason);
    else this.reasons.delete(reason);
    this.sync();
  }

  get held() { return !!this.lock; }

  async sync() {
    if (!this.supported) return;
    const need = this.reasons.size > 0 && document.visibilityState === 'visible';
    if (need && !this.lock) {
      try {
        this.lock = await navigator.wakeLock.request('screen');
        this.lock.addEventListener?.('release', () => { this.lock = null; });
      } catch { this.lock = null; } // e.g. battery saver, or not allowed
    } else if (!need && this.lock) {
      const l = this.lock;
      this.lock = null;
      l.release().catch(() => {});
    }
  }
}
