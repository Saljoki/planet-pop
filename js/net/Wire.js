import * as THREE from 'three';
import { R } from '../core/Geo.js';
import { VERSION } from '../core/Version.js';
import { cleanName } from '../game/Settings.js';
import { THEME_IDS } from '../world/Themes.js';
import { WORLDS, WORLD_IDS } from '../space/Worlds.js';

// What players in a room send each other, and checking what arrives: it comes from other people's browsers, so
// nothing is trusted. Two messages: 'hi' (who I am and which planet I'm on) and 'st' (where my vehicle is now).

export const PROTOCOL = 2; // (2: the real worlds, Earth, the Moon and Mars)
const KINDS = ['plane', 'car', 'boat'], CAR_KINDS = ['car', 'van', 'taxi'];
const HEX = /^#[0-9a-f]{6}$/i;
const _c = new THREE.Color();

/**
 * The planet as everyone builds it: { seed, land (%), cities, theme }, plus `world` on a real world (which decides the
 * rest), and as one comparable string.
 */
export function planetOf(params) {
  const p = { seed: params.seed, land: Math.round(params.land * 100), cities: params.cities, theme: params.theme };
  return params.world ? { world: params.world, ...p } : p;
}

export function planetKey(p) { return p.world ? `world:${p.world}` : `${p.seed}:${p.land}:${p.cities}:${p.theme}`; }

export function makeHello(app) {
  return { v: PROTOCOL, name: app.settings.playerName || 'Pilot', planet: planetOf(app.params), game: VERSION };
}

/** A 'hi' from someone: { name, planet, key }, or null if it isn't one we understand. */
export function readHello(d) {
  if (!d || typeof d !== 'object' || d.v !== PROTOCOL || !d.planet || typeof d.planet !== 'object') return null;
  const { seed, land, cities, theme, world } = d.planet;
  if (world !== undefined) { // a real world: its own seed, towns and look, whatever was sent
    if (!WORLD_IDS.includes(world) || !Number.isInteger(land) || land < 25 || land > 70) return null;
    const w = WORLDS[world], planet = { world, seed: w.seed, land, cities: w.cities, theme: w.theme };
    return { name: (typeof d.name === 'string' && cleanName(d.name)) || 'Pilot', planet, key: planetKey(planet) };
  }
  if (![seed, land, cities].every(Number.isInteger) || seed < 0 || seed > 1e9 || land < 25 || land > 70 || cities < 2 || cities > 8) return null;
  if (!THEME_IDS.includes(theme)) return null;
  const planet = { seed, land, cities, theme };
  return { name: (typeof d.name === 'string' && cleanName(d.name)) || 'Pilot', planet, key: planetKey(planet) };
}

const round = (x, n = 1e4) => Math.round(x * n) / n;
const vec = (v) => [round(v.x), round(v.y), round(v.z)];
const hex = (c) => (typeof c === 'string' && HEX.test(c) ? c : `#${_c.set(c ?? '#ffffff').getHexString()}`);

/** Where the player's vehicle is now (an 'st'), or that they aren't driving anything. */
export function makeState(pl) {
  if (!pl) return { k: null };
  return {
    k: pl.kind, c: pl.carKind ?? null, b: hex(pl.paint?.body), t: hex(pl.paint?.trim),
    u: vec(pl.up), f: vec(pl.fwd), a: round(pl.alt), r: round(pl.roll ?? pl.lean ?? 0, 1e3), p: round(pl.pitchV ?? pl.pitch ?? 0, 1e3),
    w: pl.wrecked || !pl.group.visible ? 1 : 0,
  };
}

const unit = (a) => {
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) return null;
  const v = new THREE.Vector3(...a);
  return v.lengthSq() > 0.25 && v.lengthSq() < 4 ? v.normalize() : null;
};
const angle = (x) => (Number.isFinite(x) ? Math.max(-1.6, Math.min(1.6, x)) : 0);

/** An 'st' from someone: { kind, carKind, body, trim, up, fwd, alt, roll, pitch, hidden }, { kind: null }, or null. */
export function readState(d) {
  if (!d || typeof d !== 'object') return null;
  if (d.k === null) return { kind: null };
  if (!KINDS.includes(d.k)) return null;
  const up = unit(d.u), fwd = unit(d.f);
  if (!up || !fwd || !Number.isFinite(d.a)) return null;
  fwd.addScaledVector(up, -fwd.dot(up));
  if (fwd.lengthSq() < 1e-6) return null;
  return {
    kind: d.k, carKind: CAR_KINDS.includes(d.c) ? d.c : 'car',
    body: HEX.test(d.b) ? d.b : '#ffd23f', trim: HEX.test(d.t) ? d.t : '#ff4d4d',
    up, fwd: fwd.normalize(), alt: Math.max(R - 1, Math.min(R + 40, d.a)),
    roll: angle(d.r), pitch: angle(d.p), hidden: d.w === 1,
  };
}
