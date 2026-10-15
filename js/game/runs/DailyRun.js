import { mulberry32 } from '../../core/Noise.js';
import { BASE_STATS } from '../Progress.js';
import { todayKey, dailySeed } from '../Daily.js';
import { DeliveryRun, COURIER_TIPS } from './DeliveryRun.js';

/**
 * 📅 Today's challenge: a courier run in the stock plane, on a route seeded by the date, so everyone flies the same
 * run today. It keeps its own best (separate from the hangar best) and can be shared.
 */
export class DailyRun extends DeliveryRun {
  static briefing() {
    return { icon: '📅', title: 'Daily challenge', goal: 'Today’s planet and parcel route, the same for everyone, in the stock plane. Your best score today counts.',
      tips: COURIER_TIPS };
  }

  constructor(game, opts) {
    super(game, opts);
    this.date = todayKey();
    this.rand = mulberry32(dailySeed(this.date) ^ 0x9e3779b9);
    this.stats = BASE_STATS;
  }

  get layout() { return { ...super.layout, badge: 'daily' }; }

  get intro() { return '📅 Daily challenge: stock plane, same route as everyone today. Good luck!'; }

  get resultHead() { return `📅 Daily ${this.date}<br>`; }

  get shareable() { return true; }

  recordBest() {
    const p = this.game.progress, prev = p.dailyBest(this.date);
    const line = p.recordDaily(this.date, this.score) ? '🎉 New best today!' : `Today's best: ${prev}`;
    this.app.achievements.unlock('daily');
    return line;
  }

  /** Copy a short brag plus a link that opens today's challenge. */
  async share() {
    const url = `${location.origin}${location.pathname}?daily`;
    const text = `📅 Planet Pop daily ${this.date}: ⭐ ${this.score} with ${this.deliveries} deliveries. Can you beat it? ${url}`;
    try {
      await navigator.clipboard.writeText(text);
      this.app.hud.toast('🔗 Result copied! Paste it to challenge a friend.');
    } catch {
      prompt('Copy your result:', text);
    }
  }
}
