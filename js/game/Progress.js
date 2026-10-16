import { MISSIONS } from './Missions.js';
import { loadJson, saveJson, loadNumber, forget } from '../core/Store.js';

const KEY = 'planetpop.courier', OLD_BEST_KEY = 'planetpop.best';

/** Hangar upgrades (they work on every vehicle). Each entry in `costs` is one level. */
export const UPGRADES = [
  { id: 'engine', icon: '🚀', name: 'Engine', desc: '+8% speed per level', costs: [150, 350, 700, 1200] },
  { id: 'wings', icon: '🛩️', name: 'Wings', desc: '+12% turning per level', costs: [120, 300, 600] },
  { id: 'tank', icon: '⛽', name: 'Boost tank', desc: 'Boost lasts longer and refills faster', costs: [150, 400, 800] },
  { id: 'magnet', icon: '🧲', name: 'Ring magnet', desc: 'Grab rings from further away', costs: [200, 500] },
  { id: 'clock', icon: '⏱️', name: 'Head start', desc: '+10 s on the clock per level', costs: [250, 600, 1100] },
  { id: 'armour', icon: '🛡️', name: 'Armour', desc: 'Crashes and lightning do 20% less damage per level', costs: [200, 450, 900] },
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

/** Plane stats for the given upgrade levels. */
function statsFor(L) {
  return {
    speed: 1 + 0.08 * L('engine'),
    turn: 1 + 0.12 * L('wings'),
    drain: 0.35 * (1 - 0.15 * L('tank')),
    regen: 0.08 * (1 + 0.4 * L('tank')),
    magnet: 0.55 + 0.3 * L('magnet'),
    startTime: 90 + 10 * L('clock'),
    armour: 1 - 0.2 * L('armour'), // share of a knock's damage that gets through
  };
}

/** The stock plane, used for the daily challenge so everyone flies the same machine. */
export const BASE_STATS = statsFor(() => 0);

/** Coins, upgrade levels, paint jobs and best scores, saved in this browser. */
export class Progress {
  constructor() {
    const s = loadJson(KEY, {}), oldBest = loadNumber(OLD_BEST_KEY, 0);
    this.coins = s.coins | 0;
    this.best = Math.max(s.best | 0, oldBest); // carries over the best score from before the hangar existed
    this.levels = { ...(s.levels || {}) };
    this.owned = new Set(s.owned || ['classic']);
    this.skin = this.owned.has(s.skin) ? s.skin : 'classic';
    this.daily = s.daily || null; // { date, best } for the most recent daily challenge played
    this.missions = new Set(s.missions || []); // ids of completed missions
    this.bests = { ...(s.bests || {}) };       // the road trips' bests: taxi and van scores, the race's fastest time
  }

  save() {
    const data = { coins: this.coins, best: this.best, levels: this.levels, owned: [...this.owned], skin: this.skin, daily: this.daily,
      missions: [...this.missions], bests: this.bests };
    saveJson(KEY, data);
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

  /** Back to a brand-new pilot: no coins, upgrades, paint jobs, missions or best scores. */
  reset() {
    forget(KEY);
    forget(OLD_BEST_KEY);
    Object.assign(this, { coins: 0, best: 0, levels: {}, owned: new Set(['classic']), skin: 'classic', daily: null, missions: new Set(), bests: {} });
    this.save();
  }

  /** Returns true when this is a new best. */
  recordScore(score) {
    const record = score > this.best;
    if (record) this.best = score;
    this.save();
    return record;
  }

  /**
   * A road trip's best (`id` 'taxi', 'van' or 'race'): the highest score, or for the race the lowest time. Returns
   * the previous best (null if none) and whether this beat it.
   */
  recordBest(id, value, lowerWins = false) {
    const prev = this.bests[id] ?? null, record = prev === null || (lowerWins ? value < prev : value > prev);
    if (record) this.bests[id] = value;
    this.save();
    return { prev, record };
  }

  /** Today's best daily score, or null if today's challenge hasn't been flown. */
  dailyBest(date) { return this.daily?.date === date ? this.daily.best : null; }

  /** Returns true when this beats today's best daily score. */
  recordDaily(date, score) {
    const prev = this.dailyBest(date);
    const record = prev === null || score > prev;
    if (record) this.daily = { date, best: score };
    this.save();
    return record;
  }

  missionDone(id) { return this.missions.has(id); }

  /** Missions open up one at a time in two lists, the made-up planets' and the real worlds': each list's first, then each one after a completed one. */
  missionUnlocked(i) {
    const prev = MISSIONS[i - 1];
    return !prev || !prev.planet.world !== !MISSIONS[i].planet.world || this.missions.has(prev.id);
  }

  /** Marks a mission complete. Returns the coin reward: paid the first time only. */
  completeMission(def) {
    if (this.missions.has(def.id)) return 0;
    this.missions.add(def.id);
    this.coins += def.reward;
    this.save();
    return def.reward;
  }

  get skinDef() { return SKINS.find((s) => s.id === this.skin) || SKINS[0]; }

  /** Multipliers and values the player plane and the game use. */
  get stats() { return statsFor((id) => this.level(id)); }
}
