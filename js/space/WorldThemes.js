/**
 * The looks of the real worlds that aren't Earth (Earth wears the Classic theme). Same format as THEMES in
 * world/Themes.js, plus: `air` ('none': no clouds, birds, balloons or planes; 'thin': a little haze and dust),
 * sea.none (no sea at all: no ocean, boats or whales), pal.mare (the dark plains), halo.strength (how much sky glow:
 * 0 is a black sky), and `moons` (what hangs in the sky instead of our Moon).
 */
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
    storms: 0, precip: { kind: 'none', color: '#e8a36c' },
    halo: { day: '#e8b583', night: '#4a5aa8', strength: 0.7 }, // butterscotch by day; Martian sunsets are blue
    volcanoes: 0,
    moons: [
      { name: 'Phobos', kind: 'rock', size: 0.7, dist: 17, color: '#8a7a70', speed: 0.11 },
      { name: 'Deimos', kind: 'rock', size: 0.45, dist: 30, color: '#a39486', speed: 0.03 },
    ],
  },
};
