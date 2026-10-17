/**
 * The Sun, the planets, their moons and Pluto, for the system map: the real numbers (NASA's planetary fact sheet:
 * width in km, a day and a year, gravity with Earth = 1, average temperature in °C) and how each is drawn (colours,
 * stripes, rings), plus `hours` (one turn, in hours) and `tilt` (of its spin axis, in degrees: over 90 spins backwards).
 * `orbit` names its entry in ORBITS (space/Orbits.js); `world` is set where you can land (Worlds.js). A moon has a
 * `parent` instead, and goes round it: `days` (one orbit; below 0 it goes round the wrong way, like Triton), `L0` (its
 * mean longitude at J2000, in degrees: Meeus's for Jupiter's moons, a guess for the others), `gap` (how far out it's
 * drawn, in its planet's drawn sizes), `au` (its real distance from its planet) and `around` (that in words, for its card).
 * Map sizes and distances are squeezed with a square root (see Orbits.mapPosition), so everything fits a phone.
 */
export const BODIES = [
  { id: 'sun', name: 'The Sun', icon: '☀️', width: 1392700, size: 9, look: { kind: 'sun', color: '#ffd23f' },
    facts: 'A star: 109 Earths wide, 5,500°C on the surface. Everything here goes round it.' },
  { id: 'mercury', hours: 1407.6, tilt: 0.03, name: 'Mercury', icon: '🪨', orbit: 'mercury', world: 'mercury', width: 4879, day: '176 Earth days', year: '88 days', gravity: 0.38, temp: 167,
    look: { kind: 'rock', color: '#b7a99a', spots: '#8a7d70' }, facts: 'The smallest planet and the closest to the Sun: scorching days, freezing nights.' },
  { id: 'venus', hours: 5832.5, tilt: 177.4, name: 'Venus', icon: '🟡', orbit: 'venus', world: 'venus', width: 12104, day: '117 Earth days', year: '225 days', gravity: 0.91, temp: 464,
    look: { kind: 'cloud', color: '#f2d38b', stripes: '#e4b866' }, facts: 'The hottest planet, under thick yellow clouds; it spins backwards, so the Sun rises in the west.' },
  { id: 'earth', hours: 23.9, tilt: 23.4, name: 'Earth', icon: '🌍', orbit: 'earth', world: 'earth', width: 12756, day: '24 hours', year: '365 days', gravity: 1, temp: 15,
    look: { kind: 'earth', color: '#3ea2f2', land: '#66c94e' }, facts: 'Home: the only world we know of with oceans of water on top, and life.' },
  { id: 'moon', hours: 655.7, tilt: 6.7, name: 'The Moon', icon: '🌕', parent: 'earth', au: 0.00257, around: 'About 384,000 km from Earth, going round it once a month.',
    world: 'moon', width: 3475, day: '29.5 Earth days', year: '27.3 days round Earth', gravity: 0.16, temp: -20,
    look: { kind: 'moon', color: '#d6d3e6', spots: '#7b7898' }, facts: 'The only other world people have walked on: twelve of them, between 1969 and 1972.' },
  { id: 'mars', hours: 24.6, tilt: 25.2, name: 'Mars', icon: '🔴', orbit: 'mars', world: 'mars', width: 6792, day: '24.7 hours', year: '687 days', gravity: 0.38, temp: -65,
    look: { kind: 'rock', color: '#d9824f', spots: '#8a4430', caps: '#fff3ea' }, facts: 'Red dust, the tallest volcano we know of, and robot rovers exploring it right now.' },
  { id: 'jupiter', hours: 9.9, tilt: 3.1, name: 'Jupiter', icon: '🟠', orbit: 'jupiter', world: 'jupiter', width: 142984, day: '9.9 hours', year: '11.9 years', gravity: 2.36, temp: -110,
    look: { kind: 'gas', color: '#e8c9a0', stripes: '#c98f5a', spot: '#c8553d' }, facts: 'The biggest planet, all gas: 11 Earths wide, with a storm bigger than Earth.' },
  { id: 'io', hours: 42.5, tilt: 0, name: 'Io', icon: '🌋', parent: 'jupiter', days: 1.769, L0: 106.08, gap: 4.6, au: 0.00282,
    around: 'About 422,000 km from Jupiter, going round it every 1.8 days.', world: 'io', width: 3643, day: '1.8 Earth days', year: '1.8 days round Jupiter',
    gravity: 0.18, temp: -130, look: { kind: 'sulphur', color: '#f0d25a', spots: '#c8553d', dark: '#3a2a20' },
    facts: 'The most volcanic place in the solar system: over 400 volcanoes, some throwing sulphur 400 km high.' },
  { id: 'europa', hours: 85.2, tilt: 0.1, name: 'Europa', icon: '🧊', parent: 'jupiter', days: 3.551, L0: 175.73, gap: 5.6, au: 0.00449,
    around: 'About 671,000 km from Jupiter, going round it every 3.6 days.', world: 'europa', width: 3122, day: '3.6 Earth days', year: '3.6 days round Jupiter',
    gravity: 0.13, temp: -160, look: { kind: 'ice', color: '#f2ece0', cracks: '#b5835a' },
    facts: 'A shell of ice over a hidden ocean with more water than all of Earth’s: one of the best places to look for life.' },
  { id: 'ganymede', hours: 171.7, tilt: 0.3, name: 'Ganymede', icon: '🌑', parent: 'jupiter', days: 7.155, L0: 120.56, gap: 6.6, au: 0.00716,
    around: 'About 1.07 million km from Jupiter, going round it every 7.2 days.', world: 'ganymede', width: 5268, day: '7.2 Earth days', year: '7.2 days round Jupiter',
    gravity: 0.15, temp: -163, look: { kind: 'rock', color: '#b9b0a6', spots: '#6f6158' },
    facts: 'The biggest moon in the solar system, wider than Mercury, and the only one with its own magnetic field and auroras.' },
  { id: 'saturn', hours: 10.7, tilt: 26.7, name: 'Saturn', icon: '🪐', orbit: 'saturn', world: 'saturn', width: 120536, day: '10.7 hours', year: '29.4 years', gravity: 0.92, temp: -140,
    look: { kind: 'gas', color: '#f0dca4', stripes: '#d9b877', rings: '#e8d7a8' }, facts: 'Famous for its rings: billions of chunks of ice, some as small as dust, some as big as houses.' },
  { id: 'titan', hours: 382.7, tilt: 0.3, name: 'Titan', icon: '🟤', parent: 'saturn', days: 15.945, L0: 0, gap: 6, au: 0.00817,
    around: 'About 1.2 million km from Saturn, going round it every 16 days.', world: 'titan', width: 5150, day: '16 Earth days', year: '16 days round Saturn',
    gravity: 0.14, temp: -179, look: { kind: 'cloud', color: '#e8a64a', stripes: '#d9953f' },
    facts: 'The only moon with thick air, and the only place besides Earth with rain, rivers and seas: of liquid methane.' },
  { id: 'enceladus', hours: 32.9, tilt: 0, name: 'Enceladus', icon: '❄️', parent: 'saturn', days: 1.37, L0: 0, gap: 4.3, au: 0.00159,
    around: 'About 238,000 km from Saturn, going round it every 1.4 days.', world: 'enceladus', width: 504, day: '1.4 Earth days', year: '1.4 days round Saturn',
    gravity: 0.012, temp: -198, look: { kind: 'ice', color: '#ffffff', cracks: '#7fb8e0' },
    facts: 'A small, dazzling white moon that sprays water from a hidden ocean out into space, through cracks called the tiger stripes.' },
  { id: 'uranus', hours: 17.2, tilt: 97.8, name: 'Uranus', icon: '💠', orbit: 'uranus', world: 'uranus', width: 51118, day: '17.2 hours', year: '84 years', gravity: 0.89, temp: -195,
    look: { kind: 'gas', color: '#a8e6ea', stripes: '#93d6dd', rings: '#c9e6f2' }, facts: 'An icy giant that rolls round the Sun on its side.' },
  { id: 'neptune', hours: 16.1, tilt: 28.3, name: 'Neptune', icon: '🔵', orbit: 'neptune', world: 'neptune', width: 49528, day: '16.1 hours', year: '164 years', gravity: 1.12, temp: -200,
    look: { kind: 'gas', color: '#3f6fe0', stripes: '#3359c4', spot: '#24398a' }, facts: 'The windiest planet: winds of over 2,000 km/h blow clouds of frozen methane round it.' },
  { id: 'triton', hours: 141, tilt: 0, name: 'Triton', icon: '⚪', parent: 'neptune', days: -5.877, L0: 0, gap: 4.5, au: 0.00237,
    around: 'About 355,000 km from Neptune, going round it every 5.9 days, the wrong way.', world: 'triton', width: 2707, day: '5.9 Earth days', year: '5.9 days round Neptune',
    gravity: 0.08, temp: -235, look: { kind: 'rock', color: '#ecd6cc', spots: '#a88a80' },
    facts: 'Neptune’s biggest moon goes round it the wrong way: probably a dwarf planet Neptune caught. Its geysers throw up dark plumes 8 km high.' },
  { id: 'pluto', hours: 153.3, tilt: 122.5, name: 'Pluto', icon: '🤍', orbit: 'pluto', world: 'pluto', width: 2376, day: '6.4 Earth days', year: '248 years', gravity: 0.063, temp: -225,
    look: { kind: 'rock', color: '#d9c3a5', spots: '#8a6a52', heart: '#f4ece0' }, facts: 'A dwarf planet out past Neptune, with a huge heart-shaped plain of ice.' },
  { id: 'charon', hours: 153.3, tilt: 0, name: 'Charon', icon: '🌘', parent: 'pluto', days: 6.387, L0: 0, gap: 4.5, au: 0.000131,
    around: 'About 19,600 km from Pluto: the two always keep the same faces to each other.', world: 'charon', width: 1212, day: '6.4 Earth days', year: '6.4 days round Pluto',
    gravity: 0.03, temp: -220, look: { kind: 'rock', color: '#b8ada4', spots: '#8a7a70', pole: '#8a4a3a' },
    facts: 'Pluto’s biggest moon, half as wide as Pluto: the two face each other all the time, and its north pole is stained red.' },
];

export const bodyOf = (id) => BODIES.find((b) => b.id === id) || null;
