import { loadFlag, saveFlag } from '../core/Store.js';

const KEY = 'planetpop.tilt', DEG = Math.PI / 180;
const STEER_RANGE = 25 * DEG, CLIMB_RANGE = 20 * DEG, DEAD = 3 * DEG;

const shape = (a, range) => {
  const m = Math.abs(a);
  return m < DEAD ? 0 : Math.sign(a) * Math.min(1, (m - DEAD) / (range - DEAD));
};

/**
 * Phone orientation (DeviceOrientationEvent beta and gamma, in degrees) and the screen's rotation (0, 90, 180, 270)
 * → how far it's turned like a steering wheel, and how far it's tipped away from where it was held at the start.
 * The world's "up" in the phone's own axes is (-cosβ·sinγ, sinβ, cosβ·cosγ); its screen-right part is the wheel turn.
 */
export function tiltAngles(beta, gamma, screenAngle = 0) {
  const b = beta * DEG, g = gamma * DEG, s = screenAngle * DEG;
  const ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b), uz = Math.cos(b) * Math.cos(g);
  const right = ux * Math.cos(s) - uy * Math.sin(s), top = ux * Math.sin(s) + uy * Math.cos(s);
  return { wheel: Math.asin(Math.max(-1, Math.min(1, -right))), pitch: Math.atan2(uz, top) };
}

/** Axes for the plane: steer -1 left … 1 right, climb -1 down … 1 up (tip the top away to dive, toward you to climb). */
export function tiltAxes(beta, gamma, screenAngle, neutralPitch) {
  const { wheel, pitch } = tiltAngles(beta, gamma, screenAngle);
  return { steer: shape(wheel, STEER_RANGE), climb: shape(neutralPitch - pitch, CLIMB_RANGE) };
}

/**
 * Optional tilt steering for Sky Courier. iPhones ask permission first, which needs a tap, so it's switched on
 * from a button. The way the phone is held when a run starts (or when tilt is switched on) counts as level.
 */
export class TiltSteer {
  constructor() {
    this.supported = typeof DeviceOrientationEvent !== 'undefined';
    this.on = false;
    this.steer = 0;
    this.climb = 0;
    this.neutral = null;
    this.wanted = loadFlag(KEY, false);
    this.onOrient = (e) => this.read(e);
  }

  /** Must be called from a tap on iPhone (permission prompt). Resolves to whether tilt is now on. */
  async enable() {
    if (!this.supported) return false;
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function' && (await DeviceOrientationEvent.requestPermission()) !== 'granted') return false;
    } catch { return false; }
    this.save(true);
    this.start();
    return true;
  }

  disable() {
    this.save(false);
    this.stop();
  }

  /** Listen (if the player chose tilt before); called when a run starts. */
  start() {
    if (!this.supported || this.on) { this.calibrate(); return; }
    this.on = true;
    this.heard = false;
    this.calibrate();
    addEventListener('deviceorientation', this.onOrient);
    // no readings (no sensor, or the permission lapsed after a reload): show it as off, so a tap can ask again
    clearTimeout(this.watch);
    this.watch = setTimeout(() => { if (this.on && !this.heard) this.stop(); }, 1500);
  }

  stop() {
    this.on = false;
    this.steer = this.climb = 0;
    removeEventListener('deviceorientation', this.onOrient);
  }

  /** The next reading becomes "level". */
  calibrate() { this.neutral = null; }

  save(on) {
    this.wanted = on;
    saveFlag(KEY, on);
  }

  read(e) {
    if (e.beta == null || e.gamma == null) return;
    this.heard = true;
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    if (this.neutral === null) this.neutral = tiltAngles(e.beta, e.gamma, angle).pitch;
    Object.assign(this, tiltAxes(e.beta, e.gamma, angle, this.neutral));
  }
}
