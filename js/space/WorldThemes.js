/**
 * The looks of the real worlds that aren't Earth (Earth wears the Classic theme). Same format as THEMES in
 * world/Themes.js, plus: `air` ('none': no clouds, birds, balloons or planes; 'thin': a little haze and dust),
 * sea.none (no sea at all: no ocean, boats or whales), pal.mare (the dark plains), halo.strength (how much sky glow:
 * 0 is a black sky), `moons` (what hangs in the sky instead of our Moon: [] for none), `sun` (how big the Sun looks:
 * 1 from Earth), `wildlife: false` (no birds), `aurora: false` and `balloons: 'blimp'` (airships, not hot-air balloons).
 * The giants' cloud seas have stripes and storms: sea.bands (the stripes' colour and how many) and sea.spots (oval
 * storms, swirling: lat and lon of the middle, w and h across in degrees, colour and rim; hex: Saturn's six-sided
 * jet stream round a pole). `rafts` sets the balloons their stations hang from (how many, how big, what colours).
 */
const GIANT = { // what the four giants share: a cloud sea, stations on rafts, no trees or mountains, airships
  wildlife: false, balloons: 'blimp',
  pal: { seabed: '#6a6488', sand: '#d6d0ea', g1: '#e2def4', g2: '#d6d0ea', g3: '#c9c2e2', rock: '#a39bbd', snow: '#ffffff', city: '#efeaff' },
  trees: { density: 0, trunk: '#8a5a3c', a: { shape: 'pine', colors: ['#2f9e5a'] }, b: { shape: 'pine', colors: ['#2f9e5a'] }, useA: () => true },
  mountains: { colors: ['#c9c2e2', '#bdb6d4', '#d6d0ea'], cap: '#ffffff', snow: false, peaks: 0 },
  buildings: ['#f4f1ff', '#ffd57a', '#9fd8ff', '#ff9fb1', '#d4b8ff', '#a8f0cf', '#ffbe8f'],
  volcanoes: 0,
};

export const WORLD_THEMES = {
  moon: {
    id: 'moon', name: 'The Moon', icon: '🌕', air: 'none',
    pal: { seabed: '#6e6a88', sand: '#8f8ba8', g1: '#d6d3e6', g2: '#c6c2da', g3: '#b6b1cc', rock: '#a29cbd', snow: '#eeecf6', city: '#e9e7f4', mare: '#7b7898' },
    sea: { none: true, color: '#000000', shallow: '#000000', glow: null, boats: false },
    trees: { density: 0, trunk: '#9a96b2', a: { shape: 'pine', colors: ['#c6c2da'] }, b: { shape: 'pine', colors: ['#c6c2da'] }, useA: () => true },
    mountains: { colors: ['#b6b1cc', '#a8a2c2', '#c3bfd8'], cap: '#e7e4f2', snow: false, peaks: 4 },
    buildings: ['#f4f1ff', '#e2def4', '#ffd23f', '#9fd8ff', '#ff9fb1', '#d4b8ff'],
    clouds: { fair: '#ffffff', fairGlow: '#5560b0', dark: '#8f88b8', darkGlow: '#2a2560' },
    storms: 0, precip: { kind: 'none', color: '#ffffff' },
    halo: { day: '#20183a', night: '#120c26', strength: 0 },
    volcanoes: 0,
    moons: [{ name: 'Earth', kind: 'earth', size: 3.4, dist: 40, color: '#3ea2f2', land: '#66c94e' }],
  },
  mars: {
    id: 'mars', name: 'Mars', icon: '🔴', air: 'thin',
    pal: { seabed: '#7a3a2a', sand: '#e8a36c', g1: '#d98552', g2: '#c97046', g3: '#b65f3b', rock: '#93503a', snow: '#fff3ea', city: '#f3dcc4', mare: '#8a4430' },
    sea: { none: true, color: '#000000', shallow: '#000000', glow: null, boats: false },
    trees: { density: 0, trunk: '#93503a', a: { shape: 'pine', colors: ['#c97046'] }, b: { shape: 'pine', colors: ['#c97046'] }, useA: () => true },
    mountains: { colors: ['#b65f3b', '#a5553a', '#c76a44'], cap: '#f2c9a8', snow: false, peaks: 6 },
    buildings: ['#f4f1ff', '#ffd57a', '#9fd8ff', '#ffbe8f', '#a8f0cf', '#ff9fb1'],
    clouds: { fair: '#f3d6bd', fairGlow: '#b07a55', dark: '#c9a88f', darkGlow: '#5a3a30' },
    storms: 2, precip: { kind: 'dust', color: '#e8a36c' }, // (dust storms: no lightning)
    halo: { day: '#e8b583', night: '#4a5aa8', strength: 0.7 }, // butterscotch by day; Martian sunsets are blue
    volcanoes: 0,
    moons: [
      { name: 'Phobos', kind: 'rock', size: 0.7, dist: 17, color: '#8a7a70', speed: 0.11 },
      { name: 'Deimos', kind: 'rock', size: 0.45, dist: 30, color: '#a39486', speed: 0.03 },
    ],
    sun: 0.66,
  },
  venus: { // the cloud tops, 50 km up: the "sea" is cloud, and the towns float on rafts
    id: 'venus', name: 'Venus', icon: '🟡', wildlife: false, aurora: false, balloons: 'blimp',
    pal: { seabed: '#b07a2e', sand: '#d6d0ea', g1: '#e3def2', g2: '#d6d0ea', g3: '#c9c2e2', rock: '#a39bbd', snow: '#ffffff', city: '#efeaff' },
    sea: { color: '#f2c46b', shallow: '#ffe7a8', glow: null, boats: false },
    trees: { density: 0, trunk: '#8a5a3c', a: { shape: 'pine', colors: ['#2f9e5a'] }, b: { shape: 'pine', colors: ['#2f9e5a'] }, useA: () => true },
    mountains: { colors: ['#c9c2e2', '#bdb6d4', '#d6d0ea'], cap: '#ffffff', snow: false, peaks: 0 },
    buildings: ['#f4f1ff', '#ffd57a', '#9fd8ff', '#ff9fb1', '#d4b8ff', '#a8f0cf', '#ffbe8f'],
    clouds: { fair: '#fff1c9', fairGlow: '#c98f3d', dark: '#e0b768', darkGlow: '#a8782f' },
    storms: 4, precip: { kind: 'rain', color: '#d8f05a' }, // (sulphuric acid)
    halo: { day: '#f7c66b', night: '#6a3a70', strength: 1.4 },
    volcanoes: 0,
    moons: [],
    sun: 1.4,
  },
  mercury: {
    id: 'mercury', name: 'Mercury', icon: '🪨', air: 'none',
    pal: { seabed: '#6a625a', sand: '#cdc4b6', g1: '#a99f93', g2: '#9b9186', g3: '#8d847a', rock: '#7a7168', snow: '#eef0f6', city: '#ece6dc', mare: '#7d746a' },
    sea: { none: true, color: '#000000', shallow: '#000000', glow: null, boats: false },
    trees: { density: 0, trunk: '#7a7168', a: { shape: 'pine', colors: ['#9b9186'] }, b: { shape: 'pine', colors: ['#9b9186'] }, useA: () => true },
    mountains: { colors: ['#9b9186', '#8d847a', '#a99f93'], cap: '#d8d0c4', snow: false, peaks: 4 },
    buildings: ['#f4f1ff', '#ffd23f', '#9fd8ff', '#ff9fb1', '#ffbe8f', '#e2def4'],
    clouds: { fair: '#ffffff', fairGlow: '#5560b0', dark: '#8f88b8', darkGlow: '#2a2560' },
    storms: 0, precip: { kind: 'none', color: '#ffffff' },
    halo: { day: '#20183a', night: '#120c26', strength: 0 },
    volcanoes: 0,
    moons: [],
    sun: 2.5, // (from Mercury the Sun looks two and a half times as wide)
  },
  pluto: {
    id: 'pluto', name: 'Pluto', icon: '🤍', air: 'none',
    pal: { seabed: '#6a4a3c', sand: '#e8d2b4', g1: '#d9b99a', g2: '#c9a184', g3: '#b88a6e', rock: '#8a6a52', snow: '#f8f1e8', city: '#f4ece0', mare: '#6a3f30' },
    sea: { none: true, color: '#000000', shallow: '#000000', glow: null, boats: false },
    trees: { density: 0, trunk: '#8a6a52', a: { shape: 'pine', colors: ['#c9a184'] }, b: { shape: 'pine', colors: ['#c9a184'] }, useA: () => true },
    mountains: { colors: ['#eef2f8', '#dfe6f0', '#f6f0e8'], cap: '#ffffff', snow: false, peaks: 3 }, // (water ice, hard as rock)
    buildings: ['#e8f6ff', '#bfe3ff', '#ffd23f', '#ff9fb1', '#d4b8ff', '#f4f1ff'],
    clouds: { fair: '#ffffff', fairGlow: '#5560b0', dark: '#8f88b8', darkGlow: '#2a2560' },
    storms: 0, precip: { kind: 'none', color: '#ffffff' },
    halo: { day: '#6a8fd0', night: '#1a1840', strength: 0.35 }, // a thin blue haze
    volcanoes: 0,
    moons: [{ name: 'Charon', kind: 'rock', size: 5.5, dist: 36, color: '#b8ada4', speed: 0 }], // (always in the same spot in the sky)
    sun: 0.22,
  },
  jupiter: { // the cloud tops: no ground at all, so the stations hang from balloons
    ...GIANT, id: 'jupiter', name: 'Jupiter', icon: '🟠',
    sea: { color: '#f3e2c4', shallow: '#fff4de', glow: null, boats: false, bands: { color: '#c98f5a', count: 9 },
      spots: [{ lat: -22, lon: 60, w: 26, h: 12, color: '#d0593f', rim: '#fbe8cf' }] }, // the Great Red Spot
    clouds: { fair: '#fff6e6', fairGlow: '#c98f5a', dark: '#d8b48c', darkGlow: '#7a4a2c' },
    storms: 3, precip: { kind: 'rain', color: '#fff3d6' }, // (ammonia rain, and lightning)
    halo: { day: '#f2c79a', night: '#3a2a50', strength: 1.1 },
    rafts: { n: 3, size: 0.36, colors: ['#ff9fb1', '#ffd57a', '#ffffff'] },
    moons: [
      { name: 'Io', kind: 'rock', size: 2.2, dist: 30, color: '#f0d25a', speed: 0.06 },
      { name: 'Europa', kind: 'moon', size: 1.8, dist: 40, color: '#f2eee4', speed: 0.035 },
      { name: 'Ganymede', kind: 'moon', size: 2.6, dist: 52, color: '#b9b0a6', speed: 0.02 },
      { name: 'Callisto', kind: 'rock', size: 2.4, dist: 64, color: '#7d7268', speed: 0.01 },
    ],
    sun: 0.4,
  },
  saturn: {
    ...GIANT, id: 'saturn', name: 'Saturn', icon: '🪐',
    sea: { color: '#f2e2b0', shallow: '#fff6d8', glow: null, boats: false, bands: { color: '#dcbd7c', count: 11 },
      spots: [{ lat: 78, lon: 0, w: 24, h: 24, color: '#9fb0c9', rim: '#f4ead0', hex: true }] }, // the hexagon round the north pole
    clouds: { fair: '#fff8e2', fairGlow: '#c9a86a', dark: '#d9c08a', darkGlow: '#7a6034' },
    storms: 2, precip: { kind: 'rain', color: '#fff6dc' },
    halo: { day: '#f0d9a0', night: '#2e2a50', strength: 0.9 },
    rafts: { n: 3, size: 0.34, colors: ['#9fd8ff', '#ffd57a', '#ffffff'] },
    moons: [
      { name: 'Titan', kind: 'rock', size: 3, dist: 56, color: '#e8a64a', speed: 0.015 },
      { name: 'Enceladus', kind: 'moon', size: 1.1, dist: 34, color: '#ffffff', speed: 0.05 },
      { name: 'Rhea', kind: 'moon', size: 1.4, dist: 44, color: '#d8d2c8', speed: 0.03 },
    ],
    sun: 0.32,
  },
  uranus: {
    ...GIANT, id: 'uranus', name: 'Uranus', icon: '💠', aurora: false,
    sea: { color: '#b4ecee', shallow: '#e2fbfb', glow: null, boats: false, bands: { color: '#9edde2', count: 5 } },
    clouds: { fair: '#ffffff', fairGlow: '#7ac6cf', dark: '#a4d9de', darkGlow: '#3a6f80' },
    storms: 1, precip: { kind: 'snow', color: '#ffffff' }, // (methane ice)
    halo: { day: '#a8e6ea', night: '#1f3050', strength: 0.8 },
    rafts: { n: 3, size: 0.32, colors: ['#ffffff', '#ff9fb1', '#d4b8ff'] },
    moons: [
      { name: 'Titania', kind: 'moon', size: 1.4, dist: 46, color: '#c9c2bc', speed: 0.02 },
      { name: 'Miranda', kind: 'rock', size: 0.8, dist: 30, color: '#bdb6b0', speed: 0.06 },
    ],
    sun: 0.27,
  },
  neptune: {
    ...GIANT, id: 'neptune', name: 'Neptune', icon: '🔵', aurora: false,
    sea: { color: '#4a7ae6', shallow: '#9fc1ff', glow: null, boats: false, bands: { color: '#3a62cc', count: 6 },
      spots: [{ lat: -20, lon: 30, w: 20, h: 10, color: '#24398a', rim: '#ffffff' }] }, // the Great Dark Spot, with white clouds round it
    clouds: { fair: '#ffffff', fairGlow: '#5a7fd8', dark: '#8fa8e6', darkGlow: '#1f2f70' },
    storms: 2, precip: { kind: 'snow', color: '#ffffff' },
    halo: { day: '#5f8cf0', night: '#141c50', strength: 1 },
    rafts: { n: 3, size: 0.32, colors: ['#ffffff', '#ffd57a', '#ff9fb1'] },
    moons: [{ name: 'Triton', kind: 'moon', size: 2.2, dist: 44, color: '#f2d8d0', speed: -0.02 }], // (it goes round backwards)
    sun: 0.24,
  },
};
