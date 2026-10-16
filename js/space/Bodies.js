/**
 * The Sun, the planets, the Moon and Pluto, for the system map: the real numbers (NASA's planetary fact sheet:
 * width in km, a day and a year, gravity with Earth = 1, average temperature in °C) and how each is drawn (colours,
 * stripes, rings), plus `hours` (one turn, in hours) and `tilt` (of its spin axis, in degrees: over 90 spins backwards).
 * `orbit` names its entry in ORBITS (space/Orbits.js); `world` is set where you can land (Worlds.js).
 * Map sizes and distances are squeezed with a square root (see Orbits.mapPosition), so everything fits a phone.
 */
export const BODIES = [
  { id: 'sun', name: 'The Sun', icon: '☀️', width: 1392700, size: 9, look: { kind: 'sun', color: '#ffd23f' },
    facts: 'A star: 109 Earths wide, 5,500°C on the surface. Everything here goes round it.' },
  { id: 'mercury', hours: 1407.6, tilt: 0.03, name: 'Mercury', icon: '🪨', orbit: 'mercury', width: 4879, day: '176 Earth days', year: '88 days', gravity: 0.38, temp: 167,
    look: { kind: 'rock', color: '#b7a99a', spots: '#8a7d70' }, facts: 'The smallest planet and the closest to the Sun: scorching days, freezing nights.' },
  { id: 'venus', hours: 5832.5, tilt: 177.4, name: 'Venus', icon: '🟡', orbit: 'venus', width: 12104, day: '117 Earth days', year: '225 days', gravity: 0.91, temp: 464,
    look: { kind: 'cloud', color: '#f2d38b', stripes: '#e4b866' }, facts: 'The hottest planet, under thick yellow clouds; it spins backwards, so the Sun rises in the west.' },
  { id: 'earth', hours: 23.9, tilt: 23.4, name: 'Earth', icon: '🌍', orbit: 'earth', world: 'earth', width: 12756, day: '24 hours', year: '365 days', gravity: 1, temp: 15,
    look: { kind: 'earth', color: '#3ea2f2', land: '#66c94e' }, facts: 'Home: the only world we know of with oceans of water on top, and life.' },
  { id: 'moon', hours: 655.7, tilt: 6.7, name: 'The Moon', icon: '🌕', parent: 'earth', world: 'moon', width: 3475, day: '29.5 Earth days', year: '27.3 days round Earth', gravity: 0.16, temp: -20,
    look: { kind: 'moon', color: '#d6d3e6', spots: '#7b7898' }, facts: 'The only other world people have walked on: twelve of them, between 1969 and 1972.' },
  { id: 'mars', hours: 24.6, tilt: 25.2, name: 'Mars', icon: '🔴', orbit: 'mars', world: 'mars', width: 6792, day: '24.7 hours', year: '687 days', gravity: 0.38, temp: -65,
    look: { kind: 'rock', color: '#d9824f', spots: '#8a4430', caps: '#fff3ea' }, facts: 'Red dust, the tallest volcano we know of, and robot rovers exploring it right now.' },
  { id: 'jupiter', hours: 9.9, tilt: 3.1, name: 'Jupiter', icon: '🟠', orbit: 'jupiter', width: 142984, day: '9.9 hours', year: '11.9 years', gravity: 2.36, temp: -110,
    look: { kind: 'gas', color: '#e8c9a0', stripes: '#c98f5a', spot: '#c8553d' }, facts: 'The biggest planet, all gas: 11 Earths wide, with a storm bigger than Earth.' },
  { id: 'saturn', hours: 10.7, tilt: 26.7, name: 'Saturn', icon: '🪐', orbit: 'saturn', width: 120536, day: '10.7 hours', year: '29.4 years', gravity: 0.92, temp: -140,
    look: { kind: 'gas', color: '#f0dca4', stripes: '#d9b877', rings: '#e8d7a8' }, facts: 'Famous for its rings: billions of chunks of ice, some as small as dust, some as big as houses.' },
  { id: 'uranus', hours: 17.2, tilt: 97.8, name: 'Uranus', icon: '🔵', orbit: 'uranus', width: 51118, day: '17.2 hours', year: '84 years', gravity: 0.89, temp: -195,
    look: { kind: 'gas', color: '#a8e6ea', stripes: '#93d6dd', rings: '#c9e6f2' }, facts: 'An icy giant that rolls round the Sun on its side.' },
  { id: 'neptune', hours: 16.1, tilt: 28.3, name: 'Neptune', icon: '🔵', orbit: 'neptune', width: 49528, day: '16.1 hours', year: '164 years', gravity: 1.12, temp: -200,
    look: { kind: 'gas', color: '#3f6fe0', stripes: '#3359c4', spot: '#24398a' }, facts: 'The windiest planet: winds of over 2,000 km/h blow clouds of frozen methane round it.' },
  { id: 'pluto', hours: 153.3, tilt: 122.5, name: 'Pluto', icon: '🤍', orbit: 'pluto', width: 2376, day: '6.4 Earth days', year: '248 years', gravity: 0.07, temp: -225,
    look: { kind: 'rock', color: '#d9c3a5', spots: '#8a6a52', heart: '#f4ece0' }, facts: 'A dwarf planet out past Neptune, with a huge heart-shaped plain of ice.' },
];

export const bodyOf = (id) => BODIES.find((b) => b.id === id) || null;
