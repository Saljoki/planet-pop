/** The daily challenge: the same planet and parcel route for everyone, changing at midnight UTC. */

export const todayKey = () => new Date().toISOString().slice(0, 10);

/** FNV-1a hash of the date, as a planet seed. */
export function dailySeed(key = todayKey()) {
  let h = 2166136261;
  for (const ch of key) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0) % 1e9;
}

export const dailyParams = (key = todayKey()) => ({ seed: dailySeed(key), land: 0.45, cities: 6 });
