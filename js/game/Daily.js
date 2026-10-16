import { pickTheme, themeOf, aKindOf } from '../world/Themes.js';
import { WORLD_IDS, worldOf } from '../space/Worlds.js';

/**
 * The daily challenge: the same planet and parcel route for everyone, changing at midnight UTC. About every other day
 * the planet is one of the real worlds (the world of the day); otherwise it's a made-up one.
 */

export const todayKey = () => new Date().toISOString().slice(0, 10);

/** FNV-1a hash of the date, as a planet seed. */
export function dailySeed(key = todayKey()) {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1e9;
}

/** The day's planet: { seed, land, cities, theme }, plus `world` (a real world's id) on a world of the day. */
export function dailyParams(key = todayKey()) {
  const seed = dailySeed(key);
  if (seed % 2) {
    const w = worldOf(WORLD_IDS[Math.floor(seed / 2) % WORLD_IDS.length]);
    return { seed: w.seed, land: 0.45, cities: w.cities, theme: w.theme, world: w.id };
  }
  return { seed, land: 0.45, cities: 6, theme: pickTheme(seed) };
}

/** Where the day's challenge is flown, in words: e.g. '🔴 Mars' or '🍭 a candy world'. */
export function dailyPlace(key = todayKey()) {
  const p = dailyParams(key), w = p.world ? worldOf(p.world) : themeOf(p.theme);
  return `${w.icon} ${p.world ? w.name : aKindOf(w)}`;
}
