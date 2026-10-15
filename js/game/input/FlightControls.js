import { TouchStick } from './TouchStick.js';
import { TiltSteer } from './TiltSteer.js';

const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down', Space: 'boost', ShiftLeft: 'boost', ShiftRight: 'boost',
};
const clamp = (v) => Math.max(-1, Math.min(1, v));

/**
 * Everything that flies the player's plane: keys, a controller (fed in by Gamepad), and on phones the thumbstick,
 * the BOOST button and tilt steering. Keys and buttons are on/off; the stick and tilt are analog and add up.
 */
export class FlightControls {
  constructor(game) {
    this.game = game;
    this.tilt = new TiltSteer();
    this.stick = game.touch ? new TouchStick(game.el) : null; // a floating thumbstick on the left of the screen
    this.onKeyDown = (e) => this.key(e, true);
    this.onKeyUp = (e) => this.key(e, false);
  }

  /** The big round BOOST button (phones): hold to boost. */
  bindBoost(btn) {
    const boost = (on) => (e) => {
      e.preventDefault();
      const pl = this.game.player;
      if (pl && !this.game.over) pl.input.boost = on;
    };
    btn.addEventListener('pointerdown', boost(true));
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) btn.addEventListener(ev, boost(false));
  }

  /** A run is starting. */
  attach() {
    this.stick?.reset();
    if (this.tilt.wanted) this.tilt.start();
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
  }

  /** The run is over and gone. */
  detach() {
    removeEventListener('keydown', this.onKeyDown);
    removeEventListener('keyup', this.onKeyUp);
    this.tilt.stop();
    this.stick?.reset();
  }

  key(e, down) {
    const g = this.game;
    if (e.code === 'Escape' && down) { g.stop(); return; }
    const k = KEYMAP[e.code];
    if (!k || !g.player || g.over) return;
    e.preventDefault();
    g.player.input[k] = down;
  }

  /** Controller input arrives as on/off states; only changes are applied, so the keyboard still works alongside. */
  pad(s, prev) {
    const inp = this.game.player.input;
    for (const k of ['left', 'right', 'up', 'down', 'boost']) if (s[k] !== !!prev[k]) inp[k] = s[k];
  }

  /** Once a frame: thumbstick and tilt add up, so either (or both) can steer. (Tilt only climbs and dives a plane.) */
  update() {
    const pl = this.game.player, inp = pl.input, t = this.tilt;
    inp.steer = clamp((this.stick?.steer ?? 0) + (t.on ? t.steer : 0));
    inp.climb = clamp((this.stick?.climb ?? 0) + (t.on && pl.tiltClimbs ? t.climb : 0));
  }

  /** Let go of everything (the run just ended). */
  release() {
    const inp = this.game.player.input;
    for (const k in inp) inp[k] = false;
  }
}
