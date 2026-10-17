import { themeOf } from '../world/Themes.js';
import { worldOf } from '../space/Worlds.js';

/**
 * Sky Courier missions, played in order: first the made-up planets', then the real worlds' (planet.world), each list
 * opening up one at a time. Each is flown on a fixed planet so the things it needs are there (an airport for Pit Stop,
 * volcanoes for Ash Dodger, Mars's dust storms…). `goal.stat` names a counter the game keeps during a run; `failIf`
 * names one that ends the mission the moment it goes above zero.
 * Setup flags: cargo (weight multipliers), rival (Rex from the start), night (the sun stands still with the start city in
 * darkness, and parcels go to dark cities), dark (parcels go to dark cities, and the sun keeps moving), ufoIn (seconds
 * until the UFO drops in; it lingers), eruptions (volcanoes start early), landmark (the one parcel goes to this landmark
 * instead of a town), carry (that parcel's kind), item (what it's called on the goal line).
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
  // on the real worlds
  { id: 'flag', icon: '🚩', name: 'One Small Step', brief: 'Fly a flag to Tranquility Base, where Apollo 11 landed.',
    planet: { world: 'moon' }, goal: { stat: 'landmark', target: 1 }, reward: 150, landmark: 'Tranquility Base', item: '🚩 Flag' },
  { id: 'dust', icon: '🌪️', name: 'Dust Storm Medicine', brief: 'Deliver 3 urgent parcels of medicine while dust storms sweep Mars.',
    planet: { world: 'mars' }, goal: { stat: 'urgent', target: 3 }, reward: 250, cargo: { urgent: 4 } },
  { id: 'acid', icon: '⚡', name: 'Acid Rain', brief: 'Deliver 3 parcels between the cloud towns of Venus. Get struck by lightning and it’s over.',
    planet: { world: 'venus' }, goal: { stat: 'deliveries', target: 3 }, failIf: 'zaps', reward: 300 },
  { id: 'shade', icon: '🌗', name: 'Keep to the Shade', brief: 'Deliver 3 parcels to towns on Mercury’s night side. The sunshine cooks you.',
    planet: { world: 'mercury' }, goal: { stat: 'night', target: 3 }, reward: 350, dark: true },
  { id: 'hotel', icon: '🛎️', name: 'Room Service', brief: 'Fly a birthday cake to the Ice Hotel on Pluto’s heart. Crash and it’s over.',
    planet: { world: 'pluto' }, goal: { stat: 'landmark', target: 1 }, failIf: 'broken', reward: 400, landmark: 'The Ice Hotel', carry: 'fragile', item: '🎂 Birthday cake' },
  { id: 'storm', icon: '🌀', name: 'Eye of the Storm', brief: 'Fly a loop round Jupiter’s Great Red Spot, a storm wider than Earth.',
    planet: { world: 'jupiter' }, goal: { stat: 'loops', target: 1 }, reward: 300 },
  { id: 'ringrun', icon: '💫', name: 'Ring Run', brief: 'Fly through Saturn’s ring ice 3 times. Touch a chunk and it’s over.',
    planet: { world: 'saturn' }, goal: { stat: 'threads', target: 3 }, failIf: 'ice', reward: 400 },
  { id: 'chill', icon: '🧊', name: 'Cold Chain', brief: 'Deliver 2 fragile parcels between Uranus’s weather stations. Break one and it’s over.',
    planet: { world: 'uranus' }, goal: { stat: 'fragile', target: 2 }, failIf: 'broken', reward: 350, cargo: { fragile: 4 } },
  { id: 'gale', icon: '💨', name: 'Gale Force', brief: 'Deliver 3 parcels on Neptune, where the wind blows you west all the time.',
    planet: { world: 'neptune' }, goal: { stat: 'deliveries', target: 3 }, reward: 400 },
  { id: 'sulphur', icon: '🌋', name: 'Sulphur Run', brief: 'Deliver 3 parcels on Io while its volcanoes erupt. Fly into a plume and it’s over.',
    planet: { world: 'io' }, goal: { stat: 'deliveries', target: 3 }, failIf: 'ash', reward: 400, eruptions: true },
  { id: 'sample', icon: '🧪', name: 'Ocean Sample', brief: 'Fly a sample of Europa’s hidden ocean to the scientists at Conamara Chaos. It’s fragile.',
    planet: { world: 'europa' }, goal: { stat: 'landmark', target: 1 }, failIf: 'broken', reward: 350, landmark: 'Conamara Chaos', carry: 'fragile', item: '🧪 Ocean sample' },
  { id: 'huygens', icon: '📡', name: 'Battery for Huygens', brief: 'Take a new battery to the Huygens probe, which landed on Titan in 2005.',
    planet: { world: 'titan' }, goal: { stat: 'landmark', target: 1 }, reward: 300, landmark: 'The Huygens landing site', item: '🔋 A battery' },
];

/** Where a mission is flown, for the board and the briefing: a real world, or a kind of made-up planet ({ icon, name }). */
export const placeOf = (m) => (m.planet.world ? worldOf(m.planet.world) : themeOf(m.planet.theme));

/** Readable names for the counters, for the HUD and the board. */
export const STAT_LABEL = {
  deliveries: 'parcels', urgent: 'urgent', fragile: 'fragile', heavy: 'heavy', rings: 'rings', refuels: 'refuels',
  rexStreak: 'in a row', night: 'at night', ufo: 'UFO', landmark: 'delivered', loops: 'loop', threads: 'through the ring',
};

export const missionIndex = (id) => MISSIONS.findIndex((m) => m.id === id);
