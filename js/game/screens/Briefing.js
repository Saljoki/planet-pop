import { Overlay } from '../../ui/Overlay.js';
import { runClass } from '../runs/modes.js';

/** What a run is about: { icon, title, goal, tips }, from its Run class. */
export function briefingFor(opts = {}) { return runClass(opts).briefing(opts); }

/** How to fly (or drive: vehicle 'car' or 'boat') with whatever is plugged in or touching the screen. */
export function controlsFor({ touch = false, pad = false, invertY = false, vehicle = 'plane' } = {}) {
  const lines = [];
  if (vehicle !== 'plane') {
    if (touch) lines.push('👆 Put a thumb on the left half and drag: sideways to steer, up to go, down to brake and reverse', '🔵 Hold BOOST to speed up, 📯 to honk', '⏸ Pause · 🗺️ shows or hides the map (tap the map to zoom)');
    else lines.push('⬅️➡️ Arrow keys or A / D to steer', '⬆️ Up or W to go, ⬇️ down or S to brake and reverse', '⚡ Space or Shift to boost · 📯 H honks', '⏸ P pauses, Esc quits · M shows or hides the map (click it to zoom)');
    if (pad) lines.push('🎮 Left stick steers, up to go and down to brake, A / RB / RT boost, Y honks, Start pauses');
    return lines;
  }
  const climb = invertY ? 'dive, down to climb (Invert Y is on)' : 'climb, down to dive';
  if (touch) {
    lines.push(`👆 Put a thumb on the left half and drag: sideways to steer, up to ${climb}`, '🔵 Hold BOOST to speed up', '⏸ Pause, with tilt steering in ⚙️ Options · 🗺️ the map');
  } else {
    lines.push('⬅️➡️ Arrow keys or A / D to steer', `⬆️⬇️ Arrow keys or W / S: up to ${climb}`, '⚡ Space or Shift to boost', '⏸ P pauses, Esc quits · M shows or hides the map');
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
    const vehicle = runClass(this.pending || {}).vehicleKind(this.pending || {});
    $('bControls').innerHTML = controlsFor({ touch: this.game.touch, pad: !!app.gamepad?.state, invertY: app.settings.get('invertY'), vehicle }).map(li).join('');
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

  /** Back to where the run was chosen: the mission board, the road trips, the planet (Drive this) or the hangar. */
  back() {
    if (!this.open) return;
    const opts = this.pending || {};
    this.hide();
    this.pending = null;
    if (opts.mission) this.game.board.show();
    else if (opts.take) return;
    else if (opts.drive || opts.road) this.game.roads.show();
    else this.game.openHangar();
  }
}
