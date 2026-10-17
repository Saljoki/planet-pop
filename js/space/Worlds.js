import { EARTH_LAND } from './EarthLand.js';

/**
 * The real worlds you can visit, each always the same (a fixed seed), with its shape laid over the usual noise
 * (core/WorldShape.js: latitudes and longitudes are real, in degrees; r and width are degrees across the ground).
 * theme: the look (world/Themes.js or space/WorldThemes.js) · cities: how many towns · gravity: Earth = 1 (NASA) ·
 * day: seconds from one sunrise to the next (Earth's 150; a Moon day is 29.5 Earth days, squeezed to 7 minutes; below 0
 * the Sun rises in the west) · welcome: a line for the card on landing · peaks: mountain cones on the real summits
 * (s: size, hgt: height, in units) · landmarks: named places to find (model: something built there).
 * Some worlds also set: pad (where the spaceport's launch pad is), roads (the highways' great circles, by their
 * normals, when the map needs them in set places), heat (sunshine overheats vehicles), rolling (a town on rails that
 * keeps ahead of the sunrise: world/RollingTown.js) and floating (towns on rafts held up by balloons: world/Rafts.js).
 * The giants (giant: true) have no ground at all: their towns are cloud stations on rafts, with no roads, so you get
 * about by ship; rings (world/Rings.js: inner and outer radius, in units) and wind (how hard it pushes a ship along,
 * in units a second) are theirs too, and towns (where each town goes, [lat, lon], and its name if it has a real one:
 * Earth's are real cities). A landmark with pin: false is a
 * place in the clouds, with no flag; loop names the trophy for flying a loop round it (game/Feats.js).
 * volcanoes: where a world's volcanoes really are, with their names (Io's; Europa's plume of water), instead of
 * made-up ones on the highest ground.
 */

/** Europa's long cracks (lineae), stained reddish-brown: ridges of ice criss-crossing the whole moon. */
const LINEAE = [
  [[-55, -175], [-25, -140], [5, -105], [35, -60], [55, -10]],
  [[60, -150], [30, -110], [0, -70], [-30, -25], [-50, 30]],
  [[-40, 60], [-10, 95], [20, 130], [45, 175]],
  [[50, 40], [20, 75], [-15, 115], [-45, 160]],
  [[10, -180], [15, -150], [12, -120], [5, -90]],
  [[-20, 0], [-5, 30], [8, 60], [25, 100]],
  [[70, -60], [45, -30], [25, 10], [5, 40]],
  [[-65, -100], [-35, -60], [-15, -20], [0, 15]],
  [[35, -175], [40, -140], [30, -100]],
  [[-30, -175], [-50, -130], [-60, -80]],
];

/**
 * A giant's cloud sea, with a raft for each station and a smaller one for the spaceport: towns (where the stations go,
 * [lat, lon]), the pad, no roads, and the shape.
 */
const stations = (towns, pad) => ({
  towns, pad, roads: [],
  shape: {
    lift: -0.45, relief: 0.08,
    features: [
      ...towns.map(([lat, lon]) => ({ kind: 'basin', lat, lon, r: 14, level: 0.18 })),
      { kind: 'basin', lat: pad.lat, lon: pad.lon, r: 7, level: 0.18 },
    ],
  },
});

export const WORLDS = {
  earth: {
    id: 'earth', name: 'Earth', icon: '🌍', theme: 'classic', seed: 1969, cities: 7, gravity: 1, day: 150,
    // the towns are big (about 1,800 km across), so they're the great cities far enough inland to fit
    towns: [[55.8, 37.6, 'Moscow'], [39.9, 116.4, 'Beijing'], [41.9, -87.6, 'Chicago'], [-15.8, -47.9, 'Brasília'],
      [12, 8.5, 'Kano'], [-15.4, 28.3, 'Lusaka'], [-23.7, 133.9, 'Alice Springs']],
    welcome: 'Home sweet home.',
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
    welcome: 'Gravity here is a sixth of Earth’s: hit a crest and you’ll fly.',
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
    welcome: 'Gravity here is about a third of Earth’s, and the air is far too thin to breathe.',
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
  venus: {
    id: 'venus', name: 'Venus', icon: '🟡', theme: 'venus', seed: 1961, cities: 6, gravity: 0.91, day: -600, floating: true,
    welcome: 'You’re 50 km up: the ground is 464°C, so everyone lives on rafts in the clouds.',
    // fixed highways, so the rafts can sit on them: the towns are 67° apart and well clear of the crossings
    roads: [[0.25, 1, 0.15], [1, 0.2, -0.45], [-0.4, 0.35, 1]],
    pad: { lat: 5.69, lon: 65.72 },
    shape: {
      lift: -0.45, relief: 0.08, // (all cloud, but for the rafts)
      features: [
        ...[[11, -162.8], [-11, 17.2], [-28.74, 108.49], [28.74, -71.51], [-67.37, -150.6], [67.37, 29.4]]
          .map(([lat, lon]) => ({ kind: 'basin', lat, lon, r: 14, level: 0.18 })), // a raft for each town
        { kind: 'basin', lat: 2.23, lon: 66.72, r: 7, level: 0.18 }, // the spaceport's raft
      ],
    },
    landmarks: [],
  },
  mercury: {
    id: 'mercury', name: 'Mercury', icon: '🪨', theme: 'mercury', seed: 1974, cities: 4, gravity: 0.38, day: 720, heat: true,
    welcome: 'It’s 430°C in the sunshine: keep to the night side, or you’ll overheat.',
    rolling: { name: 'Terminus', note: 'A town on rails that rolls round Mercury at walking pace, staying just ahead of the sunrise, where it’s neither 430°C nor −180°C' },
    pad: { lat: 48, lon: -95 },
    shape: {
      lift: 0.42, relief: 0.5, floor: 0.04,
      craters: { count: 210, min: 0.01, max: 0.07, depth: 0.22 },
      features: [ // Mercury's big basins are named after artists, writers and composers
        { kind: 'crater', lat: 31.5, lon: 162.7, r: 18, depth: 0.2 }, // Caloris: its ring of mountains…
        { kind: 'basin', lat: 31.5, lon: 162.7, r: 15, level: 0.14, pal: 'sand' }, // …and its smooth, pale floor
        { kind: 'crater', lat: -43.3, lon: 75.4, r: 8.4, depth: 0.25 }, // Rembrandt
        { kind: 'crater', lat: -20.8, lon: -123.6, r: 7.4, depth: 0.25 }, // Beethoven
        { kind: 'crater', lat: -16.3, lon: -161.6, r: 4.1, depth: 0.22 }, // Tolstoj
        { kind: 'crater', lat: 27.6, lon: 57.6, r: 3.4, depth: 0.25 }, // Rachmaninoff
        { kind: 'paint', lat: 57.8, lon: 16.8, r: 7, pal: 'sand' }, // Hokusai's bright rays…
        { kind: 'crater', lat: 57.8, lon: 16.8, r: 1.4, depth: 0.25 }, // …round a young crater
        { kind: 'cap', lat: 84, height: 0.02, pal: 'snow' }, // ice in craters the Sun never shines into
        { kind: 'cap', lat: -86, height: 0.02, pal: 'snow' },
      ],
    },
    landmarks: [
      { name: 'Caloris Planitia', lat: 31.5, lon: 162.7, note: 'An impact basin 1,550 km across: the crash shook up the ground on the far side of Mercury' },
      { name: 'Rembrandt', lat: -43.3, lon: 75.4, note: 'A basin 715 km across; Mercury’s craters are named after artists, writers and musicians' },
      { name: 'Beethoven', lat: -20.8, lon: -123.6, note: 'A crater 630 km across, named after the composer' },
      { name: 'Hokusai', lat: 57.8, lon: 16.8, note: 'A young crater with bright rays splashed far across the ground' },
      { name: 'Prokofiev', lat: 85.8, lon: -62.9, note: 'Its floor never sees the Sun, so it holds ice: on the planet closest to the Sun' },
    ],
  },
  pluto: {
    id: 'pluto', name: 'Pluto', icon: '🤍', theme: 'pluto', seed: 2015, cities: 3, gravity: 0.063, day: -280,
    welcome: 'Gravity here is a sixteenth of Earth’s: the longest jumps in the solar system.',
    pad: { lat: 30, lon: -175 },
    shape: {
      lift: 0.4, relief: 0.45, floor: 0.04,
      craters: { count: 70, min: 0.01, max: 0.05, depth: 0.18 },
      features: [
        ...[30, 65, 100, 135].map((lon) => ({ kind: 'paint', lat: 0, lon, r: 17, pal: 'mare' })), // Belton Regio, the long dark "whale"
        { kind: 'basin', lat: 19.5, lon: 178.7, r: 24, level: 0.1, pal: 'snow' }, // Sputnik Planitia: the heart's left lobe, smooth ice
        { kind: 'paint', lat: 5, lon: -155, r: 20, pal: 'snow' }, // the heart's right lobe, bright frost
        { kind: 'dome', lat: -15.6, lon: 177.4, r: 6, height: 0.55 }, // Tenzing Montes
        { kind: 'dome', lat: 3.3, lon: 169.6, r: 6, height: 0.45 }, // Hillary Montes
        { kind: 'dome', lat: -21.4, lon: 173.2, r: 4, height: 0.4 }, // Wright Mons, an ice volcano…
        { kind: 'crater', lat: -21.4, lon: 173.2, r: 1.2, depth: 0.3 }, // …with a great hole on top
      ],
    },
    peaks: [{ lat: -15.6, lon: 177.4, s: 0.5, hgt: 0.9 }, { lat: 3.3, lon: 169.6, s: 0.45, hgt: 0.7 }],
    landmarks: [
      { name: 'The Ice Hotel', lat: 22, lon: 170, model: 'hotel', note: 'The only hotel on Pluto, on the frozen plain of the heart: rooms from −230°C' },
      { name: 'Sputnik Planitia', lat: 19.5, lon: 178.7, note: 'The left half of Pluto’s heart: a plain of frozen nitrogen 1,000 km across, slowly churning like a lava lamp' },
      { name: 'Tenzing Montes', lat: -15.6, lon: 177.4, note: 'Mountains of water ice up to 6 km high (at −230°C, ice is as hard as rock)' },
      { name: 'Wright Mons', lat: -21.4, lon: 173.2, note: 'Probably an ice volcano: about 4 km high, with a huge hole on top' },
      { name: 'Belton Regio', lat: 0, lon: 90, note: 'A dark stripe 3,000 km long round the equator, stained red-brown by haze falling from the sky' },
    ],
  },
  jupiter: {
    id: 'jupiter', name: 'Jupiter', icon: '🟠', theme: 'jupiter', seed: 1610, cities: 5, gravity: 2.36, day: 115, floating: true, giant: true,
    welcome: 'There’s no ground at all, just cloud thousands of km deep, so the stations hang from balloons.',
    ...stations([[22, -150], [-8, -80], [38, 10], [-45, 150], [10, 110]], { lat: 8, lon: -30 }),
    landmarks: [
      { name: 'The Great Red Spot', lat: -22, lon: 60, pin: false, loop: 'redspot', note: 'A storm wider than Earth that has been blowing for at least 190 years' },
    ],
  },
  saturn: {
    id: 'saturn', name: 'Saturn', icon: '🪐', theme: 'saturn', seed: 1655, cities: 4, gravity: 0.92, day: 118, floating: true, giant: true,
    welcome: 'Look up: the rings fill the sky. They’re billions of chunks of ice, so mind the inner edge.',
    ...stations([[28, -120], [-32, -30], [12, 85], [-18, 165]], { lat: -4, lon: 20 }),
    rings: { inner: 13.2, outer: 21 },
    landmarks: [
      { name: 'The Hexagon', lat: 78, lon: 0, pin: false, note: 'A six-sided jet stream round Saturn’s north pole: each side is wider than Earth' },
    ],
  },
  uranus: {
    id: 'uranus', name: 'Uranus', icon: '💠', theme: 'uranus', seed: 1781, cities: 3, gravity: 0.89, day: -136, floating: true, giant: true,
    welcome: 'Uranus rolls round the Sun on its side, and it’s −195°C up here. Wrap up warm.',
    ...stations([[30, -110], [-22, 30], [18, 150]], { lat: -5, lon: -40 }),
    rings: { inner: 14, outer: 15.4, faint: true },
    landmarks: [],
  },
  io: {
    id: 'io', name: 'Io', icon: '🌋', theme: 'io', seed: 1979, cities: 3, gravity: 0.18, day: 178,
    welcome: 'Over 400 volcanoes, and Jupiter hanging huge overhead. Keep clear of the sulphur plumes!',
    pad: { lat: 20, lon: -20 },
    volcanoes: [{ name: 'Pele', lat: -18.7, lon: 104.7 }, { name: 'Prometheus', lat: -1.6, lon: -153 }, { name: 'Tvashtar', lat: 63, lon: -124 }],
    shape: {
      lift: 0.35, relief: 0.25, floor: 0.04,
      features: [
        { kind: 'bowl', lat: 13, lon: 51, r: 3, depth: 0.25, pal: 'mare' }, // Loki Patera: a lake of lava
        { kind: 'paint', lat: -18.7, lon: 104.7, r: 10, pal: 'rust' }, // Pele's red ring of fallen sulphur
        { kind: 'paint', lat: -1.6, lon: -153, r: 6, pal: 'snow' }, // Prometheus's white frost
        { kind: 'paint', lat: 63, lon: -124, r: 7, pal: 'rust' }, // Tvashtar's
        { kind: 'dome', lat: -5, lon: 90, r: 4, height: 0.55 }, // Boösaule Montes
        ...[[30, -60], [-40, -20], [-30, 170], [40, 140], [-60, 60]].map(([lat, lon]) => ({ kind: 'paint', lat, lon, r: 4, pal: 'mare' })), // more dark lava
      ],
    },
    peaks: [{ lat: -5, lon: 90, s: 0.5, hgt: 0.9 }],
    landmarks: [
      { name: 'Loki Patera', lat: 13, lon: 51, note: 'A lake of lava 200 km across: the most powerful volcano in the solar system' },
      { name: 'Boösaule Montes', lat: -5, lon: 90, note: 'Io’s highest mountain, 17.5 km: twice as high as Everest' },
    ],
  },
  europa: {
    id: 'europa', name: 'Europa', icon: '🧊', theme: 'europa', seed: 1995, cities: 3, gravity: 0.13, day: 219,
    welcome: 'Under this ice is an ocean with more water than all of Earth’s. Jupiter fills the sky.',
    pad: { lat: 10, lon: 20 },
    volcanoes: [{ name: 'The south plume', lat: -62, lon: -175 }],
    shape: {
      lift: 0.25, relief: 0.12, floor: 0.05,
      craters: { count: 10, min: 0.01, max: 0.03, depth: 0.12 }, // (very few: the ice is young)
      features: [
        ...LINEAE.map((points) => ({ kind: 'ridge', width: 0.55, height: 0.06, pal: 'mare', points })),
        { kind: 'paint', lat: 9.7, lon: 86.7, r: 4, pal: 'mare' }, // Conamara Chaos: rafts of jumbled ice
        { kind: 'crater', lat: -25.2, lon: 88.6, r: 1.5, depth: 0.2 }, // Pwyll…
        { kind: 'paint', lat: -25.2, lon: 88.6, r: 6, pal: 'snow' }, // …and its bright rays
        { kind: 'bowl', lat: -47, lon: 179, r: 3, depth: 0.12, pal: 'mare' }, // Thera Macula, where the ice is melting through
      ],
    },
    landmarks: [
      { name: 'Conamara Chaos', lat: 9.7, lon: 86.7, note: 'Rafts of ice that broke up and froze again: the ocean below may come close to the top here' },
      { name: 'Pwyll', lat: -25.2, lon: 88.6, note: 'A young crater 26 km across, splashed with bright rays of fresh ice' },
      { name: 'Thera Macula', lat: -47, lon: 179, note: 'A dark patch where a lake of water may lie just under the ice' },
    ],
  },
  titan: {
    id: 'titan', name: 'Titan', icon: '🟤', theme: 'titan', seed: 2005, cities: 5, gravity: 0.14, day: 344,
    welcome: 'Thick orange air and low gravity: perfect for flying. The lakes are liquid methane, at −179°C.',
    pad: { lat: -5, lon: -150 },
    shape: {
      lift: 0.3, relief: 0.25,
      features: [
        { kind: 'bowl', lat: 68, lon: -50, r: 13, depth: 0.75 }, // Kraken Mare, the biggest sea
        { kind: 'bowl', lat: 79, lon: -112, r: 7, depth: 0.7 }, // Ligeia Mare
        { kind: 'bowl', lat: 85, lon: 21, r: 4, depth: 0.6 }, // Punga Mare
        { kind: 'bowl', lat: -72, lon: -177, r: 4, depth: 0.6 }, // Ontario Lacus, in the south
        { kind: 'paint', lat: -10, lon: -165, r: 22, pal: 'mare' }, // Shangri-La: dark dunes
        { kind: 'paint', lat: -8, lon: 105, r: 20, pal: 'mare' }, // Belet: more dunes
        { kind: 'dome', lat: -10, lon: -100, r: 20, height: 0.2 }, // Xanadu: bright, rugged highlands…
        { kind: 'paint', lat: -10, lon: -100, r: 20, pal: 'snow' }, // …the colour of washed-out ice
      ],
    },
    landmarks: [
      { name: 'The Huygens landing site', lat: -10.6, lon: -167.6, model: 'lander', note: 'Where ESA’s Huygens probe landed in 2005: the furthest landing ever, on pebbles of ice' },
      { name: 'Kraken Mare', lat: 68, lon: -50, note: 'A sea of liquid methane bigger than the Caspian Sea, and hundreds of metres deep' },
      { name: 'Ligeia Mare', lat: 79, lon: -112, note: 'A methane sea so calm that radar sees it like a mirror' },
      { name: 'Xanadu', lat: -10, lon: -100, note: 'Bright highlands the size of Australia, criss-crossed by methane rivers' },
    ],
  },
  neptune: {
    id: 'neptune', name: 'Neptune', icon: '🔵', theme: 'neptune', seed: 1846, cities: 3, gravity: 1.12, day: 133, floating: true, giant: true,
    welcome: 'The windiest place in the solar system: hold on tight, the wind pushes you along.',
    ...stations([[28, -95], [-48, -150], [22, 120]], { lat: 5, lon: -25 }),
    wind: 0.5,
    landmarks: [
      { name: 'The Great Dark Spot', lat: -20, lon: 30, pin: false, note: 'A storm as wide as Earth, found by Voyager 2 in 1989, with white methane clouds round it' },
    ],
  },
};

export const WORLD_IDS = Object.keys(WORLDS);

export const worldOf = (id) => WORLDS[id] || null;
