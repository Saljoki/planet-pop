const KEY = 'planetpop.courier';

/** Hangar upgrades. Each entry in `costs` is one level. */
export const UPGRADES = [
  { id: 'engine', icon: '🚀', name: 'Engine', desc: '+8% speed per level', costs: [150, 350, 700, 1200] },
  { id: 'wings', icon: '🛩️', name: 'Wings', desc: '+12% turning per level', costs: [120, 300, 600] },
  { id: 'tank', icon: '⛽', name: 'Boost tank', desc: 'Boost lasts longer and refills faster', costs: [150, 400, 800] },
  { id: 'magnet', icon: '🧲', name: 'Ring magnet', desc: 'Grab rings from further away', costs: [200, 500] },
  { id: 'clock', icon: '⏱️', name: 'Head start', desc: '+10 s on the clock per level', costs: [250, 600, 1100] },
];

/** Plane paint jobs: bought with coins, or unlocked by a trophy. */
export const SKINS = [
  { id: 'classic', name: 'Classic', body: '#ffd23f', trim: '#ff4d4d', cost: 0 },
  { id: 'fire', name: 'Fireball', body: '#ff4d4d', trim: '#ffd23f', cost: 250 },
  { id: 'sky', name: 'Sky Blue', body: '#9fd8ff', trim: '#3f6fff', cost: 250 },
  { id: 'mint', name: 'Mint', body: '#a8f0cf', trim: '#2ee59d', cost: 400 },
  { id: 'midnight', name: 'Midnight', body: '#4a4f9e', trim: '#ff5fa2', cost: 600 },
  { id: 'gold', name: 'Golden Ace', body: '#ffcf33', trim: '#1b1530', trophy: 'ace', trophyName: 'Sky Ace' },
];

/** Coins, upgrade levels, paint jobs and best score, saved in this browser. */
export class Progress {
  constructor() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { /* storage unavailable */ }
    let oldBest = 0;
    try { oldBest = +localStorage.getItem('planetpop.best') || 0; } catch { /* storage unavailable */ }
    this.coins = s.coins | 0;
    this.best = Math.max(s.best | 0, oldBest); // carries over the best score from before the hangar existed
    this.levels = { ...(s.levels || {}) };
    this.owned = new Set(s.owned || ['classic']);
    this.skin = this.owned.has(s.skin) ? s.skin : 'classic';
  }

  save() {
    const data = { coins: this.coins, best: this.best, levels: this.levels, owned: [...this.owned], skin: this.skin };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage unavailable */ }
  }

  level(id) { return this.levels[id] | 0; }

  /** Price of the next level, or null when maxed. */
  nextCost(id) { return UPGRADES.find((u) => u.id === id)?.costs[this.level(id)] ?? null; }

  buy(id) {
    const cost = this.nextCost(id);
    if (cost == null || this.coins < cost) return false;
    this.coins -= cost;
    this.levels[id] = this.level(id) + 1;
    this.save();
    return true;
  }

  /** 'equipped' | 'owned' | 'buy' | 'locked' (trophy skins are owned once the trophy is earned). */
  skinState(skin, trophies) {
    if (this.skin === skin.id) return 'equipped';
    if (this.owned.has(skin.id) || (skin.trophy && trophies.has(skin.trophy))) return 'owned';
    return skin.trophy ? 'locked' : 'buy';
  }

  /** Equip a skin, buying it first if needed. Returns false if it can't be afforded or is locked. */
  chooseSkin(id, trophies) {
    const skin = SKINS.find((s) => s.id === id);
    if (!skin) return false;
    const state = this.skinState(skin, trophies);
    if (state === 'locked') return false;
    if (state === 'buy') {
      if (this.coins < skin.cost) return false;
      this.coins -= skin.cost;
    }
    this.owned.add(id);
    this.skin = id;
    this.save();
    return true;
  }

  addCoins(n) { this.coins += n; this.save(); }

  /** Returns true when this is a new best. */
  recordScore(score) {
    const record = score > this.best;
    if (record) this.best = score;
    this.save();
    return record;
  }

  get skinDef() { return SKINS.find((s) => s.id === this.skin) || SKINS[0]; }

  /** Multipliers and values the player plane and the game use. */
  get stats() {
    const L = (id) => this.level(id);
    return {
      speed: 1 + 0.08 * L('engine'),
      turn: 1 + 0.12 * L('wings'),
      drain: 0.35 * (1 - 0.15 * L('tank')),
      regen: 0.08 * (1 + 0.4 * L('tank')),
      magnet: 0.55 + 0.3 * L('magnet'),
      startTime: 90 + 10 * L('clock'),
    };
  }
}
