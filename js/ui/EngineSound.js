const TOP = 1.05; // a car's top speed on the road: the engine note is worked out against it

/**
 * What the engine sounds like at `speed` (units/s, either way) with the throttle at `throttle` (0..1): for a car, a
 * growl that climbs through three gears (and a little past the top with boost); for a boat, a slow putt-putt that
 * quickens. { freq (Hz), cutoff (Hz), vol, chug (Hz: how fast the putt-putt goes, 0 for none) }.
 */
export function engineNote(kind, speed, throttle) {
  const r = Math.abs(speed) / TOP;
  if (kind === 'boat') return { freq: 42 + r * 34, cutoff: 260 + r * 260, vol: 0.026 + 0.026 * throttle, chug: 4.5 + r * 9 };
  const rpm = r < 1 ? 0.3 + 0.7 * (r * 3 - Math.floor(r * 3)) : 1 + (r - 1) * 0.6; // (up through each gear, then a shift)
  return { freq: 52 + rpm * 78, cutoff: 320 + rpm * 900 + throttle * 450, vol: 0.016 + 0.024 * throttle + 0.008 * rpm, chug: 0 };
}

/**
 * The engine of the car or boat the player drives, synthesized (no audio files): two oscillators through a lowpass
 * filter, rising with the revs, louder on the gas, with a putt-putt wobble for a boat. Silent with the sound off, while
 * paused and once the run is over; planes keep their quiet (their props are loud enough in the imagination).
 */
export class EngineSound {
  constructor(sfx) {
    this.sfx = sfx;
    this.nodes = null;
    this.kind = null;
  }

  /** A run in a car or a boat is starting (or anything else: then it stays silent). */
  start(kind) {
    this.stop();
    this.kind = kind === 'car' || kind === 'boat' ? kind : null;
  }

  build() {
    const c = this.sfx.ctx, n = {};
    n.out = c.createGain();
    n.out.gain.value = 0;
    n.filter = c.createBiquadFilter();
    n.filter.type = 'lowpass';
    n.filter.Q.value = 2;
    n.a = c.createOscillator();
    n.a.type = this.kind === 'boat' ? 'square' : 'sawtooth';
    n.b = c.createOscillator();
    n.b.type = 'square';
    n.bGain = c.createGain();
    n.bGain.gain.value = 0.5;
    n.wobble = c.createGain(); // the putt-putt (or a car's rumble): a slow wobble on the volume
    n.wobble.gain.value = 1;
    n.lfo = c.createOscillator();
    n.lfoDepth = c.createGain();
    n.lfoDepth.gain.value = this.kind === 'boat' ? 0.8 : 0.15;
    n.lfo.frequency.value = this.kind === 'boat' ? 5 : 23;
    n.lfo.connect(n.lfoDepth).connect(n.wobble.gain);
    n.a.connect(n.filter);
    n.b.connect(n.bGain).connect(n.filter);
    n.filter.connect(n.wobble).connect(n.out).connect(this.sfx.out);
    for (const o of [n.a, n.b, n.lfo]) o.start();
    this.nodes = n;
  }

  /** Each frame: follow the vehicle (`running` false while paused or after the run). */
  update(pl, running) {
    const sfx = this.sfx;
    if (!this.kind || !sfx.ctx || sfx.ctx.state !== 'running') return;
    if (!this.nodes) this.build();
    const n = this.nodes, t = sfx.ctx.currentTime, on = running && sfx.enabled && pl && !pl.wrecked;
    const throttle = pl ? Math.max(0, pl.throttle?.() ?? 0) : 0, note = engineNote(this.kind, pl?.v ?? 0, throttle);
    n.a.frequency.setTargetAtTime(note.freq, t, 0.06);
    n.b.frequency.setTargetAtTime(note.freq / 2, t, 0.06);
    n.filter.frequency.setTargetAtTime(note.cutoff, t, 0.08);
    if (note.chug) n.lfo.frequency.setTargetAtTime(note.chug, t, 0.1);
    n.out.gain.setTargetAtTime(on ? note.vol : 0, t, on ? 0.08 : 0.04);
  }

  stop() {
    const n = this.nodes;
    this.nodes = null;
    if (!n) return;
    const t = this.sfx.ctx.currentTime;
    n.out.gain.setTargetAtTime(0, t, 0.04);
    for (const o of [n.a, n.b, n.lfo]) o.stop(t + 0.3);
    setTimeout(() => n.out.disconnect(), 400);
  }
}
