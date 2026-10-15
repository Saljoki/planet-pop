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
  ['completionist', '👑', 'Planet Pro', 'Unlock every other trophy'],
];
const KEY = 'planetpop.trophies', WORLDS_KEY = 'planetpop.worlds', WORLD_KINDS = 5;

export class Achievements {
  constructor(hud) {
    this.hud = hud;
    this.cities = new Set();
    let saved = [];
    try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { /* storage unavailable */ }
    this.done = new Set(saved);
    hud.updateTrophies(this.done.size, DEFS.length);
  }

  unlock(id) {
    const def = DEFS.find((d) => d[0] === id);
    if (!def || this.done.has(id)) return;
    this.done.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.done])); } catch { /* storage unavailable */ }
    this.hud.toast(`🏆 ${def[1]} ${def[2]} — ${def[3]}`);
    this.hud.app.sfx?.play('trophy');
    this.hud.updateTrophies(this.done.size, DEFS.length);
    if (this.done.size === DEFS.length - 1) this.unlock('completionist');
  }

  /** Remembers which kinds of world (themes) have been seen, across visits. */
  visitTheme(id) {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem(WORLDS_KEY) || '[]'); } catch { /* storage unavailable */ }
    if (!seen.includes(id)) seen.push(id);
    try { localStorage.setItem(WORLDS_KEY, JSON.stringify(seen)); } catch { /* storage unavailable */ }
    if (seen.length >= WORLD_KINDS) this.unlock('globetrotter');
  }

  visitCity(name) {
    this.cities.add(name);
    if (this.cities.size >= 3) this.unlock('tourist');
  }

  list() { return DEFS.map(([id, icon, title, desc]) => ({ id, icon, title, desc, unlocked: this.done.has(id) })); }
}
