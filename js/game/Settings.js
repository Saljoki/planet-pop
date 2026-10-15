import { loadJson, saveJson } from '../core/Store.js';

const KEY = 'planetpop.settings';

/** Game options and their defaults. */
export const DEFAULTS = {
  invertY: false,  // up dives, down climbs (keys, thumbstick, tilt and controller alike)
  sensitivity: 1,  // steering speed, 0.5 … 1.5
  sound: true,     // the Sound switch: mutes everything
  sfxVolume: 1,    // sound effects, 0 … 1
  briefing: true,  // show the start screen before each Sky Courier run
};

/** The player's options, saved in this browser. `values` is one live object, so whatever holds it sees changes. */
export class Settings {
  constructor() {
    const saved = loadJson(KEY, {});
    this.values = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) this.values[k] = saved[k];
    this.listeners = [];
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (!(key in DEFAULTS) || this.values[key] === value) return;
    this.values[key] = value;
    saveJson(KEY, this.values);
    for (const fn of this.listeners) fn(key, value);
  }

  /** Called with (key, value) whenever an option changes. */
  onChange(fn) { this.listeners.push(fn); }
}
