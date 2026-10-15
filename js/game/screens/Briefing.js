import { themeOf } from '../../world/Themes.js';
import { Overlay } from '../../ui/Overlay.js';

const COURIER = [
  'Follow the pink arrow to the town, then swoop down low through the pink beacon to deliver.',
  'Deliver fast to build a combo, up to x5. Blue rings add 5 seconds and refill your boost.',
  'Crashing costs 8 seconds. Thunderclouds zap you, and volcanic ash chokes the engine.',
  'After your first delivery, Rival Rex races you for every parcel.',
];

/** What a run is about: { icon, title, goal, tips } for a courier run, the daily, a mission or free flight. */
export function briefingFor({ daily = false, mission = null, free = false } = {}) {
  if (free) {
    return { icon: '🕊️', title: 'Free flight', goal: 'No clock, no parcels, no Rex. Fly anywhere you like.',
      tips: ['Rings refill your boost, and skimming low along a runway refuels it.', 'Spot the UFO? Fly right through it.',
        'Pause and pick Back to planet when you’re done. No score or coins in free flight.'] };
  }
  if (mission) {
    const world = themeOf(mission.planet.theme);
    return { icon: mission.icon, title: mission.name, goal: mission.brief,
      tips: [`🪙 ${mission.reward} coins the first time you complete it.`, `Flown on a ${world.name.toLowerCase()} (${world.icon}), the same every time.`,
        mission.failIf ? 'One slip ends the mission, so take it steady.' : 'Run out of time and you can try again straight away.'] };
  }
  if (daily) {
    return { icon: '📅', title: 'Daily challenge', goal: 'Today’s planet and parcel route, the same for everyone, in the stock plane. Your best score today counts.',
      tips: COURIER };
  }
  return { icon: '📦', title: 'Courier run', goal: 'Deliver as many parcels as you can before the clock runs out.',
    tips: [...COURIER, 'Coins from deliveries and rings buy upgrades in the hangar.'] };
}

/** How to fly with whatever is plugged in or touching the screen. */
export function controlsFor({ touch = false, pad = false, invertY = false } = {}) {
  const climb = invertY ? 'dive, down to climb (Invert Y is on)' : 'climb, down to dive';
  const lines = [];
  if (touch) {
    lines.push(`👆 Put a thumb on the left half and drag: sideways to steer, up to ${climb}`, '🔵 Hold BOOST to speed up', '⏸ Pause, with tilt steering in ⚙️ Options');
  } else {
    lines.push('⬅️➡️ Arrow keys or A / D to steer', `⬆️⬇️ Arrow keys or W / S: up to ${climb}`, '⚡ Space or Shift to boost', '⏸ P pauses, Esc quits');
  }
  if (pad) lines.push(`🎮 Left stick steers (up to ${climb}), A / RB / RT boost, Start pauses`);
  return lines;
}

/**
 * The start screen before a Sky Courier run: the goal, a few tips, the controls for this device, and Start / Options /
 * Back. "Don't show this again" turns it off (it can be turned back on in Options). Enter starts, Esc goes back.
 */
export class Briefing extends Overlay {
  constructor(app, game) {
    super({ id: 'briefing', html: `
      <h2><span id="bIcon"></span> <span id="bTitle"></span></h2>
      <p id="bGoal" class="goal"></p>
      <ul id="bTips" class="tips"></ul>
      <h3>Controls</h3>
      <ul id="bControls" class="tips controls"></ul>
      <label class="skip"><input id="bSkip" type="checkbox"> Don’t show this before every run</label>
      <div class="hrow"><button id="bStart" class="big">▶ Start</button><button id="bOptions">⚙️ Options</button><button id="bBack">✕ Back</button></div>` });
    this.app = app;
    this.game = game;
    this.pending = null;
    this.on('bStart', 'click', () => this.start());
    this.on('bOptions', 'click', () => this.options());
    this.on('bBack', 'click', () => this.back());
    this.on('bSkip', 'change', (e) => app.settings.set('briefing', !e.target.checked));
    addEventListener('keydown', (e) => {
      if (this.open && !this.game.options.open && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); this.start(); }
    });
    app.settings.onChange((k) => { if (k === 'invertY' && this.open) this.render(); });
  }

  /** Show the briefing for a run with these options; Start begins it. */
  show(opts) {
    this.pending = opts;
    this.render();
    super.show();
  }

  render() {
    const b = briefingFor(this.pending || {}), $ = (id) => this.$(id), app = this.app;
    $('bIcon').textContent = b.icon;
    $('bTitle').textContent = b.title;
    $('bGoal').textContent = b.goal;
    const li = (t) => `<li>${t}</li>`;
    $('bTips').innerHTML = b.tips.map(li).join('');
    $('bControls').innerHTML = controlsFor({ touch: this.game.touch, pad: !!app.gamepad?.state, invertY: app.settings.get('invertY') }).map(li).join('');
    $('bSkip').checked = !app.settings.get('briefing');
  }

  escape() { this.back(); }

  start() {
    if (!this.open) return;
    const opts = this.pending;
    this.hide();
    this.pending = null;
    this.game.start(opts || {});
  }

  options() { this.game.options.show(() => this.open && this.render()); }

  /** Back to where the run was chosen: the mission board for missions, the hangar otherwise. */
  back() {
    if (!this.open) return;
    const opts = this.pending || {};
    this.hide();
    this.pending = null;
    if (opts.mission) this.game.board.show();
    else this.game.openHangar();
  }
}
