/**
 * Parcel types for Sky Courier.
 * pay: points multiplier · par: combo-timer multiplier · speed/climb: plane handling while carrying it.
 */
export const CARGO = {
  standard: { id: 'standard', icon: '📦', name: 'Parcel', tip: 'A regular delivery', pay: 1, par: 1, color: '#c98a4b', weight: 45 },
  urgent: { id: 'urgent', icon: '⚡', name: 'Urgent', tip: 'Tight timer, double pay', pay: 2, par: 0.65, color: '#ffd23f', weight: 20 },
  fragile: { id: 'fragile', icon: '🥚', name: 'Fragile', tip: "Don't crash: it breaks!", pay: 1.6, par: 1, color: '#9fd8ff', weight: 20, fragile: true },
  heavy: { id: 'heavy', icon: '🏋️', name: 'Heavy', tip: 'Slower plane, bigger payout', pay: 1.5, par: 1.35, color: '#8f86a8', weight: 15, speed: 0.8, climb: 0.7 },
};

/**
 * Random parcel, weighted. The first parcel of a run is always a regular one. Pass a seeded `rand` for the daily
 * route, and `bias` (e.g. { urgent: 3 }) to make some kinds more common for a mission.
 */
export function rollCargo(first = false, rand = Math.random, bias = null) {
  if (first) return CARGO.standard;
  const list = Object.values(CARGO), w = (c) => c.weight * (bias?.[c.id] ?? 1);
  let r = rand() * list.reduce((sum, c) => sum + w(c), 0);
  for (const c of list) if ((r -= w(c)) < 0) return c;
  return CARGO.standard;
}
