/**
 * World themes. Everything that makes an ice world look different from a candy world lives here as data:
 * terrain and sea colours, trees, mountains, buildings, clouds, what falls from storm clouds, and the sky glow.
 * Tree shapes are named here and built in Nature.
 */
export const THEMES = {
  classic: {
    id: 'classic', name: 'Classic', icon: '🌍',
    pal: { seabed: '#2c6fbf', sand: '#ffe08a', g1: '#a6e35d', g2: '#66c94e', g3: '#3f9f4d', rock: '#a28fd0', snow: '#ffffff', city: '#d9d2ea' },
    sea: { color: '#3ea2f2', shallow: '#7fe3ff', glow: null, boats: true },
    trees: {
      density: 1, trunk: '#8a5a3c', floor: '#2c8a4e', // floor: the ground under a forest, as it looks from afar
      a: { shape: 'pine', colors: ['#2f9e5a', '#23874d', '#3bb36a'] },
      b: { shape: 'round', colors: ['#55c95a', '#7fd65b', '#3daa4a'], odd: ['#ffb347', '#ff7a6b', '#ffd23f'] },
      useA: (h, r) => h > 0.5 || r < 0.3,
    },
    mountains: { colors: ['#9d86d6', '#8a79c9', '#b39ae0'], cap: '#ffffff', snow: true },
    buildings: ['#ff9fb1', '#ffd57a', '#9fd8ff', '#d4b8ff', '#ffbe8f', '#a8f0cf', '#f4f1ff', '#b8c8ff'],
    clouds: { fair: '#ffffff', fairGlow: '#5560b0', dark: '#8f88b8', darkGlow: '#2a2560' },
    storms: 3, precip: { kind: 'rain', color: '#c4e8ff' },
    halo: { day: '#9fdcff', night: '#5a4fc9' },
    volcanoes: 1,
    seasons: true,
  },
  ice: {
    id: 'ice', name: 'Ice world', icon: '❄️',
    pal: { seabed: '#5b8fc9', sand: '#eef8ff', g1: '#ffffff', g2: '#e6f2fb', g3: '#c9e0f1', rock: '#9fb4d8', snow: '#ffffff', city: '#d6e4f2' },
    sea: { color: '#7cc4f0', shallow: '#e8f8ff', glow: null, boats: true },
    trees: {
      density: 0.75, trunk: '#6b5a7a', floor: '#9cc7d6',
      a: { shape: 'pine', colors: ['#e8f4ff', '#bfe3f2', '#9cc9b8'] },
      b: { shape: 'crystal', colors: ['#bfe9ff', '#9fd8ff', '#e0f7ff', '#c9b8ff'] },
      useA: (h, r) => r < 0.7,
    },
    mountains: { colors: ['#bcd7f2', '#a9c6ea', '#cfe2f7'], cap: '#ffffff', snow: true },
    buildings: ['#ffffff', '#d9f0ff', '#bfe3ff', '#e8e0ff', '#cfe9f5', '#f4f1ff'],
    clouds: { fair: '#ffffff', fairGlow: '#6a7fd0', dark: '#a9b4d8', darkGlow: '#3a4580' },
    storms: 3, precip: { kind: 'snow', color: '#ffffff' },
    halo: { day: '#d9f4ff', night: '#6a7fd9' },
    volcanoes: 1,
  },
  desert: {
    id: 'desert', name: 'Desert world', icon: '🏜️',
    pal: { seabed: '#2b8f9e', sand: '#ffe7a8', g1: '#f6c978', g2: '#eeb25e', g3: '#dc9a52', rock: '#c0704a', snow: '#f4e3c3', city: '#f1dcc0' },
    sea: { color: '#2fc6c9', shallow: '#a8f5e6', glow: null, boats: true },
    trees: {
      density: 0.35, trunk: '#9a6a43', floor: '#6aa553',
      a: { shape: 'cactus', colors: ['#5fae5a', '#4c9a50', '#77c06a'] },
      b: { shape: 'palm', colors: ['#5ec45a', '#3faa4a', '#86d65f'] },
      useA: (h) => h > 0.18, // palms by the water, cacti inland
    },
    mountains: { colors: ['#d9824f', '#c96f45', '#e0965e'], cap: '#f2b77a', snow: false },
    buildings: ['#f1d2a6', '#e8b98a', '#f6e1c3', '#d99e74', '#ffd7a8', '#f0c9b0'],
    clouds: { fair: '#fff6e6', fairGlow: '#b07a55', dark: '#c9a88f', darkGlow: '#5a3a30' },
    storms: 1, precip: { kind: 'rain', color: '#d8f2ff' },
    halo: { day: '#ffd9a0', night: '#7a4fa9' },
    volcanoes: 1,
  },
  candy: {
    id: 'candy', name: 'Candy world', icon: '🍭',
    pal: { seabed: '#c25b9a', sand: '#fff1d6', g1: '#b8f2d0', g2: '#ffc4e1', g3: '#d9c2ff', rock: '#ffe08a', snow: '#ffffff', city: '#fde9f3' },
    sea: { color: '#ff8fc8', shallow: '#ffd6ec', foam: '#fff8fc', glow: null, boats: true },
    trees: {
      density: 0.9, trunk: '#fff8f0', floor: '#ff7fb2',
      a: { shape: 'lollipop', colors: ['#ff5fa2', '#3fa7ff', '#ffd23f', '#2ee59d', '#ff8c42', '#8f5cff'] },
      b: { shape: 'gumdrop', colors: ['#ff4d6d', '#2ee59d', '#ffd23f', '#8f5cff', '#3fa7ff'] },
      useA: (h, r) => r < 0.55,
    },
    mountains: { colors: ['#fff1d6', '#ffe4c4', '#fdd9b5'], cap: '#ff8fc8', snow: false }, // ice-cream cones, strawberry tops
    buildings: ['#ffc4e1', '#c8f7e1', '#fff1a8', '#d9c2ff', '#bfe3ff', '#ffd1b3'],
    clouds: { fair: '#ffe0f0', fairGlow: '#c060a0', dark: '#d9a8d0', darkGlow: '#6a3070' },
    storms: 3, precip: { kind: 'sprinkles', color: '#ff5fa2' },
    halo: { day: '#ffc4e8', night: '#9a5fd0' },
    volcanoes: 1,
  },
  lava: {
    id: 'lava', name: 'Lava world', icon: '🔥',
    pal: { seabed: '#7a1f12', sand: '#4a3a52', g1: '#5a4a62', g2: '#4a3d55', g3: '#3d3248', rock: '#6a5070', snow: '#ff9a3c', city: '#7a6a84' },
    sea: { color: '#ff5a1f', shallow: '#ffd23f', foam: '#fff2b0', glow: '#ff3d00', boats: false }, // a sea of lava: no boats
    trees: {
      density: 0.3, trunk: '#2a2433', floor: '#3a2f44',
      a: { shape: 'deadtree', colors: ['#2a2433', '#3a2f44', '#1f1a28'] },
      b: { shape: 'crystal', colors: ['#ff7a2e', '#ffb21f', '#ff4d4d'] },
      useA: (h, r) => r < 0.75,
    },
    mountains: { colors: ['#4a3d55', '#3d3248', '#5a4a62'], cap: '#ff7a2e', snow: false },
    buildings: ['#7a6a84', '#8a7a94', '#6a5a74', '#9a8aa4', '#5a4a64'],
    clouds: { fair: '#a39bb0', fairGlow: '#5a2a3a', dark: '#5a4f66', darkGlow: '#3a1a20' },
    storms: 3, precip: { kind: 'ash', color: '#4a4058' },
    halo: { day: '#ff9a5a', night: '#7a2a4a' },
    volcanoes: 3,
  },
};

export const THEME_IDS = Object.keys(THEMES);

/** The theme a "surprise me" planet gets: about a third classic, the rest shared among the others. */
export function pickTheme(seed) {
  const h = Math.imul((seed >>> 0) ^ 0x9e3779b9, 2654435761) >>> 0;
  const roll = (h % 1000) / 1000;
  if (roll < 0.36) return 'classic';
  const others = THEME_IDS.filter((t) => t !== 'classic');
  return others[Math.floor(((roll - 0.36) / 0.64) * others.length)];
}

export const themeOf = (id) => THEMES[id] || THEMES.classic;
