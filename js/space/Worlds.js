import { EARTH_LAND } from './EarthLand.js';

/**
 * The real worlds you can visit, each always the same (a fixed seed), with its shape laid over the usual noise
 * (core/WorldShape.js: latitudes and longitudes are real, in degrees; r and width are degrees across the ground).
 * theme: the look (world/Themes.js or space/WorldThemes.js) · cities: how many towns · gravity: Earth = 1 (NASA) ·
 * day: seconds from one sunrise to the next (Earth's 150; a Moon day is 29.5 Earth days, squeezed to 7 minutes) ·
 * peaks: mountain cones on the real summits (s: size, hgt: height, in units) · landmarks: named places to find.
 */
export const WORLDS = {
  earth: {
    id: 'earth', name: 'Earth', icon: '🌍', theme: 'classic', seed: 1969, cities: 8, gravity: 1, day: 150,
    shape: {
      land: EARTH_LAND,
      features: [
        { kind: 'dome', lat: 33, lon: 88, r: 10, height: 0.35 }, // the Tibetan plateau…
        { kind: 'ridge', width: 3.5, height: 0.6, points: [[35.5, 73], [30, 81], [28, 86], [27.6, 92], [28.5, 97]] }, // …and the Himalaya
        { kind: 'ridge', width: 2.5, height: 0.55, points: [[10, -73], [0, -78], [-15, -72], [-23, -67], [-33, -70], [-45, -72], [-53, -73]] }, // the Andes
        { kind: 'ridge', width: 4, height: 0.4, points: [[62, -135], [55, -124], [50, -116], [43, -110], [37, -106], [32, -107]] }, // the Rockies
        { kind: 'ridge', width: 1.5, height: 0.35, points: [[44.2, 7], [46, 8], [46.6, 10.5], [47.2, 13.5]] }, // the Alps
        { kind: 'dome', lat: 73, lon: -40, r: 11, height: 0.5, pal: 'snow' }, // Greenland's ice
        { kind: 'cap', lat: -64, height: 0.45, pal: 'snow' }, // Antarctica
        { kind: 'cap', lat: 74, height: 0, pal: 'snow' }, // the Arctic's frozen coasts
        { kind: 'paint', lat: 23, lon: 12, r: 15, pal: 'sand' }, // the Sahara
        { kind: 'paint', lat: 23, lon: 47, r: 8, pal: 'sand' }, // Arabia
        { kind: 'paint', lat: 43, lon: 104, r: 7, pal: 'sand' }, // the Gobi
        { kind: 'paint', lat: -25, lon: 132, r: 10, pal: 'sand' }, // the Australian outback
      ],
    },
    peaks: [{ lat: 27.99, lon: 86.93, s: 0.45, hgt: 0.9 }, { lat: -3.07, lon: 37.35, s: 0.35, hgt: 0.6 }, { lat: 35.36, lon: 138.73, s: 0.25, hgt: 0.5 }],
    landmarks: [
      { name: 'Mount Everest', lat: 27.99, lon: 86.93, note: 'The highest mountain on Earth: 8,849 m' },
      { name: 'The Sahara', lat: 23, lon: 12, note: 'The biggest hot desert, nearly as big as the USA' },
      { name: 'The Amazon', lat: -3, lon: -60, note: 'The biggest rainforest on Earth' },
    ],
  },
  moon: {
    id: 'moon', name: 'The Moon', icon: '🌕', theme: 'moon', seed: 1110, cities: 4, gravity: 0.16, day: 420,
    shape: {
      lift: 0.42, relief: 0.55, floor: 0.04,
      craters: { count: 170, min: 0.01, max: 0.07, depth: 0.22 },
      features: [ // the dark "seas" (old lava plains) and the best-known craters, where they really are
        { kind: 'basin', lat: 18.4, lon: -57.4, r: 32, level: 0.12, pal: 'mare' }, // Oceanus Procellarum
        { kind: 'basin', lat: 32.8, lon: -15.6, r: 19, level: 0.1, pal: 'mare' }, // Mare Imbrium
        { kind: 'basin', lat: 28, lon: 17.5, r: 11.7, level: 0.11, pal: 'mare' }, // Mare Serenitatis
        { kind: 'basin', lat: 8.5, lon: 31.4, r: 14.4, level: 0.12, pal: 'mare' }, // Mare Tranquillitatis
        { kind: 'basin', lat: 17, lon: 59.1, r: 9.2, level: 0.1, pal: 'mare' }, // Mare Crisium
        { kind: 'basin', lat: -7.8, lon: 51.3, r: 15, level: 0.13, pal: 'mare' }, // Mare Fecunditatis
        { kind: 'basin', lat: -15.2, lon: 35.5, r: 5.5, level: 0.12, pal: 'mare' }, // Mare Nectaris
        { kind: 'basin', lat: -21.3, lon: -16.6, r: 11.8, level: 0.13, pal: 'mare' }, // Mare Nubium
        { kind: 'basin', lat: -24.4, lon: -38.6, r: 6.4, level: 0.12, pal: 'mare' }, // Mare Humorum
        { kind: 'basin', lat: 56, lon: 1.4, r: 8, level: 0.14, pal: 'mare' }, // Mare Frigoris
        { kind: 'bowl', lat: -53, lon: -169, r: 41, depth: 0.25 }, // the South Pole–Aitken basin, on the far side
        { kind: 'crater', lat: -43.3, lon: -11.2, r: 1.4, depth: 0.3 }, // Tycho
        { kind: 'crater', lat: 9.6, lon: -20.1, r: 1.5, depth: 0.3 }, // Copernicus
        { kind: 'crater', lat: 51.6, lon: -9.4, r: 1.7, depth: 0.25 }, // Plato
        { kind: 'crater', lat: -58.4, lon: -14.4, r: 3.8, depth: 0.3 }, // Clavius
        { kind: 'crater', lat: -20.4, lon: 129.1, r: 3, depth: 0.3 }, // Tsiolkovskiy
      ],
    },
    landmarks: [
      { name: 'Tranquility Base', lat: 0.674, lon: 23.473, model: 'lander', note: 'Where Apollo 11 landed: the first people on the Moon, 20 July 1969' },
      { name: 'Tycho', lat: -43.3, lon: -11.2, note: 'A young crater 85 km across, with bright rays you can see from Earth' },
      { name: 'Copernicus', lat: 9.6, lon: -20.1, note: 'A crater 93 km across and nearly 4 km deep' },
      { name: 'Mare Imbrium', lat: 32.8, lon: -15.6, note: 'The Sea of Rains: dark plains of old lava, and not a drop of water' },
      { name: 'The far side', lat: 10, lon: 180, note: 'Earth only ever sees the Moon\u2019s other face; this side is always turned away' },
    ],
  },
  mars: {
    id: 'mars', name: 'Mars', icon: '🔴', theme: 'mars', seed: 1976, cities: 5, gravity: 0.38, day: 154,
    shape: {
      lift: 0.42, relief: 0.5, floor: 0.04,
      craters: { count: 120, min: 0.01, max: 0.06, depth: 0.18 },
      features: [
        { kind: 'bowl', lat: 90, lon: 0, r: 70, depth: 0.2 }, // the low northern plains
        { kind: 'dome', lat: 0, lon: -110, r: 24, height: 0.3 }, // the Tharsis bulge…
        { kind: 'dome', lat: 18.65, lon: -133.8, r: 5.2, height: 1.05 }, // …Olympus Mons, the tallest volcano we know of…
        { kind: 'crater', lat: 18.65, lon: -133.8, r: 0.7, depth: 0.15 }, // …with its caldera on top
        { kind: 'dome', lat: -8.26, lon: -120.1, r: 3.6, height: 0.7 }, // Arsia Mons
        { kind: 'dome', lat: 1.48, lon: -113, r: 3.2, height: 0.62 }, // Pavonis Mons
        { kind: 'dome', lat: 11.92, lon: -104.1, r: 3.6, height: 0.75 }, // Ascraeus Mons
        { kind: 'dome', lat: 25.02, lon: 147.21, r: 3.6, height: 0.55 }, // Elysium Mons
        { kind: 'valley', width: 1.6, depth: 0.32, points: [[-7, -100], [-9, -80], [-11, -68], [-13, -58], [-11, -45], [-6, -38]] }, // Valles Marineris
        { kind: 'bowl', lat: -42.4, lon: 70.5, r: 19, depth: 0.32 }, // Hellas, a huge old impact basin…
        { kind: 'paint', lat: -42.4, lon: 70.5, r: 12, pal: 'sand' }, // …with a pale, dusty floor
        { kind: 'bowl', lat: -49.7, lon: -44, r: 13, depth: 0.22 }, // Argyre
        { kind: 'paint', lat: 8.4, lon: 69.5, r: 8, pal: 'mare' }, // Syrtis Major, the dark patch seen from Earth
        { kind: 'paint', lat: 46.7, lon: -22, r: 9, pal: 'mare' }, // Acidalia
        { kind: 'crater', lat: -5.4, lon: 137.8, r: 1.3, depth: 0.15 }, // Gale, where Curiosity drives
        { kind: 'crater', lat: 18.4, lon: 77.5, r: 0.7, depth: 0.12 }, // Jezero, where Perseverance drives
        { kind: 'cap', lat: 80, height: 0.08, pal: 'snow' }, // the polar ice caps
        { kind: 'cap', lat: -83, height: 0.08, pal: 'snow' },
      ],
    },
    peaks: [ // (big cones on top of the domes, so the volcanoes stand out)
      { lat: 18.65, lon: -133.8, s: 0.9, hgt: 1.5 }, { lat: 11.92, lon: -104.1, s: 0.55, hgt: 0.8 }, { lat: 1.48, lon: -113, s: 0.5, hgt: 0.7 },
      { lat: -8.26, lon: -120.1, s: 0.55, hgt: 0.8 }, { lat: 25.02, lon: 147.21, s: 0.45, hgt: 0.6 },
    ],
    landmarks: [
      { name: 'Olympus Mons', lat: 18.65, lon: -133.8, note: 'The tallest volcano known: about 22 km high, two and a half Everests' },
      { name: 'Valles Marineris', lat: -11, lon: -68, note: 'A canyon about 4,000 km long, as long as the USA is wide' },
      { name: 'Hellas Planitia', lat: -42.4, lon: 70.5, note: 'A huge old impact basin, 2,300 km across and over 7 km deep' },
      { name: 'Gale crater', lat: -5.4, lon: 137.8, note: 'Where NASA\u2019s Curiosity rover has been exploring since 2012' },
      { name: 'Jezero crater', lat: 18.4, lon: 77.5, note: 'An old lake bed, where NASA\u2019s Perseverance rover landed in 2021' },
    ],
  },
};

export const WORLD_IDS = Object.keys(WORLDS);

export const worldOf = (id) => WORLDS[id] || null;
