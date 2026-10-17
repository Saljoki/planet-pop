import { loadJson, saveJson } from '../core/Store.js';
import { WORLD_IDS } from '../space/Worlds.js';

const DEFS = [
  ['newworld', '🌍', 'World Builder', 'Generate a new planet'],
  ['tourist', '🏙️', 'Tourist', 'Visit 3 different cities'],
  ['nightowl', '🌙', 'Night Owl', 'Visit a city at night'],
  ['birdwatcher', '🐦', 'Birdwatcher', 'Follow a bird'],
  ['copilot', '✈️', 'Co-pilot', 'Follow a plane for 10 seconds'],
  ['tunnel', '🚂', 'Light at the End', 'Ride the train out of its tunnel'],
  ['redlight', '🚦', 'Patience', 'Wait at a red light with a car'],
  ['liftoff', '🚀', 'Liftoff!', 'Watch a rocket launch up close'],
  ['stormchaser', '⚡', 'Storm Chaser', 'Be near a lightning strike'],
  ['astronaut', '🛰️', 'Astronaut', 'Visit the space station'],
  ['moonwalker', '🌕', 'Moonwalker', 'Fly to the moon'],
  ['courier', '📦', 'Special Delivery', 'Deliver a parcel in Sky Courier'],
  ['combo', '🔥', 'On Fire', 'Reach a x4 delivery combo'],
  ['ace', '🏆', 'Sky Ace', 'Score 1500 in one Sky Courier run'],
  ['mechanic', '🔧', 'Mechanic', 'Buy your first upgrade in the hangar'],
  ['lightningrod', '🌩️', 'Lightning Rod', 'Get struck by lightning in Sky Courier'],
  ['outrun', '😈', 'Outrun', 'Beat Rival Rex to 5 cities in a row'],
  ['touchdown', '🛬', 'Touchdown', 'Watch a plane land at an airport'],
  ['peoplewatcher', '🚶', 'People Watcher', 'Follow someone on a stroll through town'],
  ['aurora', '🌌', 'Northern Lights', 'Visit a pole at night to see the aurora'],
  ['volcano', '🌋', 'Eruption!', 'Watch the volcano erupt up close'],
  ['ufo', '🛸', 'Close Encounter', 'Click the UFO before it flies away'],
  ['daily', '📅', 'Daily Flyer', 'Finish a daily challenge'],
  ['globetrotter', '🧳', 'Globetrotter', 'Visit all five kinds of world'],
  ['photographer', '📸', 'Say Cheese', 'Take a picture in photo mode'],
  ['missions', '🎯', 'Mission Accomplished', 'Complete every Sky Courier mission on the made-up planets'],
  ['fireworks', '🎆', 'Happy New Night', 'Watch a midnight firework show up close'],
  ['shootingstar', '🌠', 'Make a Wish', 'Be on the night side during a meteor shower'],
  ['rainbow', '🌈', 'Over the Rainbow', 'Fly close to a rainbow'],
  ['whalewatcher', '🐋', 'Whale Watcher', 'See a whale leap out of the sea up close'],
  ['chopper', '🚁', 'Chopper Ride', 'Follow a helicopter for 10 seconds'],
  ['tramride', '🚋', 'End of the Line', 'Ride a tram all the way to the end of its line'],
  ['snowday', '⛄', 'Snow Day', 'Visit a town in the winter snow'],
  ['sightseer', '🕊️', 'Free as a Bird', 'Spend two minutes in free flight'],
  ['couchpotato', '📺', 'Couch Potato', 'Watch the tour for three minutes'],
  ['totalled', '💥', 'Total Loss', 'Wreck a vehicle'],
  ['joyrider', '🚗', 'Joyrider', 'Take over a car on the road and drive it for a minute'],
  ['sailor', '⛵', 'Ahoy!', 'Take the helm of a boat'],
  ['cabbie', '🚕', 'Cabbie', 'Drop off 5 passengers in one taxi shift'],
  ['vanman', '🚐', 'Last Mile', 'Deliver 3 parcels by van in one run'],
  ['racer', '🏁', 'Round the World', 'Beat Rex in the round-the-world race'],
  ['rocketman', '🚀', 'Rocket Man', 'Fly to another world by rocket'],
  ['fuelup', '⭐', 'Fuelled Up', 'Catch 15 fuel stars on one trip'],
  ['grandtour', '🪐', 'Grand Tour', 'Visit every world in the solar system'],
  ['earthrise', '🌍', 'Earthrise', 'Watch Earth from the Moon'],
  ['longjump', '🦘', 'Giant Leap', 'Keep a rover in the air for 5 seconds'],
  ['terminus', '🚉', 'All Aboard', 'Visit Terminus, the town on rails'],
  ['icehotel', '🛎️', 'Check In', 'Visit the Ice Hotel on Pluto'],
  ['spacecourier', '📦', 'Interplanetary', 'Deliver a parcel to another world'],
  ['spacerace', '🥇', 'Space Race', 'Beat Rival Rex to a parcel on another world'],
  ['spacemissions', '🛰️', 'Mission Control', 'Complete every mission on the real worlds'],
  ['redspot', '🌀', 'Eye of the Storm', 'Fly a loop round Jupiter’s Great Red Spot'],
  ['ringrunner', '💫', 'Ring Runner', 'Fly through Saturn’s ring ice without touching any'],
  ['windrider', '💨', 'Gone with the Wind', 'Let Neptune’s winds carry you a quarter of the way round'],
  ['completionist', '👑', 'Planet Pro', 'Unlock every other trophy'],
];
const KEY = 'planetpop.trophies', WORLDS_KEY = 'planetpop.worlds', WORLD_KINDS = 5;
const VISITED_KEY = 'planetpop.visited'; // (the real worlds visited: ids)

export class Achievements {
  constructor(hud) {
    this.hud = hud;
    this.cities = new Set();
    this.done = new Set(loadJson(KEY, []));
    hud.panel.updateTrophies(this.done.size, DEFS.length);
  }

  unlock(id) {
    const def = DEFS.find((d) => d[0] === id);
    if (!def || this.done.has(id)) return;
    this.done.add(id);
    saveJson(KEY, [...this.done]);
    this.hud.toast(`🏆 ${def[1]} ${def[2]} — ${def[3]}`);
    this.hud.app.sfx?.play('trophy');
    this.hud.panel.updateTrophies(this.done.size, DEFS.length);
    if (this.done.size === DEFS.length - 1) this.unlock('completionist');
  }

  /** Remembers which kinds of world (themes) have been seen, across visits. */
  visitTheme(id) {
    const seen = loadJson(WORLDS_KEY, []);
    if (!seen.includes(id)) seen.push(id);
    saveJson(WORLDS_KEY, seen);
    if (seen.length >= WORLD_KINDS) this.unlock('globetrotter');
  }

  /** Remembers which real worlds have been visited, across visits. */
  visitWorld(id) {
    const seen = loadJson(VISITED_KEY, []);
    if (!seen.includes(id)) seen.push(id);
    saveJson(VISITED_KEY, seen);
    if (WORLD_IDS.every((w) => seen.includes(w))) this.unlock('grandtour');
  }

  visitCity(name) {
    this.cities.add(name);
    if (this.cities.size >= 3) this.unlock('tourist');
  }

  list() { return DEFS.map(([id, icon, title, desc]) => ({ id, icon, title, desc, unlocked: this.done.has(id) })); }
}
