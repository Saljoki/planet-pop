import { loadJson, saveJson } from '../core/Store.js';

const KEY = 'planetpop.settings';

/** Game options and their defaults. */
export const DEFAULTS = {
  invertY: false,  // up dives, down climbs (keys, thumbstick, tilt and controller alike)
  sensitivity: 1,  // steering speed, 0.5 … 1.5
  sound: true,     // the Sound switch: mutes everything
  sfxVolume: 1,    // sound effects, 0 … 1
  briefing: true,  // show the start screen before each Sky Courier run
  playerName: '',  // what the game calls the player ('' until they say)
  minimap: true,   // the little map in the corner while driving, sailing and flying
};

const NAME_MAX = 16;

/** A name as typed, tidied: no control characters or angle brackets, spaces squashed, at most 16 characters. */
export function cleanName(raw) {
  return [...String(raw ?? '').replace(/[\p{Cc}<>]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, NAME_MAX).join('').trim();
}

/** The player's options, saved in this browser. `values` is one live object, so whatever holds it sees changes. */
export class Settings {
  constructor() {
    const saved = loadJson(KEY, {});
    this.values = { ...DEFAULTS };
    for (const k of Object.keys(DEFAULTS)) if (typeof saved[k] === typeof DEFAULTS[k]) this.values[k] = saved[k];
    this.values.playerName = cleanName(this.values.playerName);
    this.listeners = [];
  }

  get(key) { return this.values[key]; }

  set(key, value) {
    if (!(key in DEFAULTS) || this.values[key] === value) return;
    this.values[key] = value;
    saveJson(KEY, this.values);
    for (const fn of this.listeners) fn(key, value);
  }

  /** The player's name, or '' if they haven't given one. */
  get playerName() { return this.values.playerName; }

  setPlayerName(raw) { this.set('playerName', cleanName(raw)); }

  /** Called with (key, value) whenever an option changes. */
  onChange(fn) { this.listeners.push(fn); }
}
