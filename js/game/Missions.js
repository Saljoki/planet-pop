/**
 * Sky Courier missions, played in order. Each is flown on a fixed planet so the things it needs are there
 * (an airport for Pit Stop, volcanoes for Ash Dodger…). `goal.stat` names a counter the game keeps during a run;
 * `failIf` names one that ends the mission the moment it goes above zero.
 * Setup flags: cargo (weight multipliers), rival (Rex from the start), night (the sun stands still with the start city in
 * darkness, and parcels go to dark cities), ufoIn (seconds until the UFO drops in; it lingers), eruptions (volcanoes start early).
 */
export const MISSIONS = [
  { id: 'first', icon: '📦', name: 'First Flight', brief: 'Deliver 3 parcels.',
    planet: { seed: 20261014, land: 0.45, cities: 5, theme: 'classic' }, goal: { stat: 'deliveries', target: 3 }, reward: 100 },
  { id: 'rush', icon: '⚡', name: 'Rush Hour', brief: 'Deliver 2 urgent parcels.',
    planet: { seed: 777, land: 0.45, cities: 6, theme: 'desert' }, goal: { stat: 'urgent', target: 2 }, reward: 150, cargo: { urgent: 3 } },
  { id: 'rings', icon: '💍', name: 'Ring Master', brief: 'Fly through 15 blue rings. The arrow shows the nearest.',
    planet: { seed: 5, land: 0.45, cities: 4, theme: 'candy' }, goal: { stat: 'rings', target: 15 }, reward: 150 },
  { id: 'care', icon: '🥚', name: 'Handle With Care', brief: 'Deliver 2 fragile parcels. Break one and it’s over.',
    planet: { seed: 777, land: 0.45, cities: 6, theme: 'ice' }, goal: { stat: 'fragile', target: 2 }, failIf: 'broken', reward: 200, cargo: { fragile: 4 } },
  { id: 'pitstop', icon: '⛽', name: 'Pit Stop', brief: 'Refuel by skimming an airport runway twice.',
    planet: { seed: 42, land: 0.25, cities: 2, theme: 'classic' }, goal: { stat: 'refuels', target: 2 }, reward: 200 },
  { id: 'heavy', icon: '🏋️', name: 'Heavy Lifter', brief: 'Deliver 3 heavy parcels.',
    planet: { seed: 9001, land: 0.6, cities: 6, theme: 'desert' }, goal: { stat: 'heavy', target: 3 }, reward: 250, cargo: { heavy: 4 } },
  { id: 'rex', icon: '😈', name: 'Outrun Rex', brief: 'Beat Rival Rex to 3 cities in a row. He’s here from the start.',
    planet: { seed: 777, land: 0.45, cities: 6, theme: 'classic' }, goal: { stat: 'rexStreak', target: 3 }, reward: 250, rival: true },
  { id: 'night', icon: '🌙', name: 'Night Shift', brief: 'Deliver 3 parcels to cities in darkness.',
    planet: { seed: 12345, land: 0.3, cities: 8, theme: 'ice' }, goal: { stat: 'night', target: 3 }, reward: 300, night: true },
  { id: 'ufo', icon: '🛸', name: 'Close Encounter', brief: 'A UFO is coming. Fly right through it.',
    planet: { seed: 12345, land: 0.3, cities: 8, theme: 'candy' }, goal: { stat: 'ufo', target: 1 }, reward: 300, ufoIn: 12 },
  { id: 'ash', icon: '🌋', name: 'Ash Dodger', brief: 'Deliver 4 parcels while the volcanoes erupt. Touch the ash and it’s over.',
    planet: { seed: 20261014, land: 0.45, cities: 5, theme: 'lava' }, goal: { stat: 'deliveries', target: 4 }, failIf: 'ash', reward: 400, eruptions: true },
];

/** Readable names for the counters, for the HUD and the board. */
export const STAT_LABEL = {
  deliveries: 'parcels', urgent: 'urgent', fragile: 'fragile', heavy: 'heavy', rings: 'rings', refuels: 'refuels',
  rexStreak: 'in a row', night: 'at night', ufo: 'UFO',
};

export const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
