const DEAD = 0.35;

/**
 * A standard-layout controller as game inputs. Left stick or d-pad steers and climbs; A, RB or RT boosts; Y is the
 * horn; Start pauses; A / B answer the end-of-run screen.
 */
export function readPad(pad, dead = DEAD) {
  const ax = pad.axes || [], b = (i) => !!(pad.buttons?.[i]?.pressed || pad.buttons?.[i]?.value > 0.5);
  const x = ax[0] || 0, y = ax[1] || 0;
  return {
    left: x < -dead || b(14), right: x > dead || b(15), up: y < -dead || b(12), down: y > dead || b(13),
    boost: b(0) || b(5) || b(7), a: b(0), b: b(1), start: b(9), horn: b(3),
  };
}

/** Polls the first connected controller each frame and routes it to Sky Courier, the hangar and pause. */
export class Gamepad {
  constructor(app) {
    this.app = app;
    this.state = null;
    this.prev = {};
    addEventListener('gamepadconnected', (e) => app.hud.toast(`🎮 Controller connected (${e.gamepad.id.split('(')[0].trim() || 'gamepad'}). Press Start to play.`));
  }

  update() {
    const pads = navigator.getGamepads?.() || [], pad = [...pads].find((p) => p?.connected);
    const s = (this.state = pad ? readPad(pad) : null) || {};
    const edge = (k) => s[k] && !this.prev[k], { app } = this, game = app.game, hangar = game.hangar;
    if (game.options?.open) {
      if (edge('b') || edge('start')) game.options.hide();
    } else if (game.briefing?.open) {
      if (edge('a') || edge('start')) game.briefing.start();
      else if (edge('b')) game.briefing.back();
    } else if (game.active) {
      if (edge('start')) app.togglePause();
      if (game.over) {
        if (edge('a')) game.again();
        else if (edge('b')) game.stop();
      } else if (pad) game.controls.pad(s, this.prev);
    } else if (hangar.open) {
      if (edge('a')) { hangar.hide(); game.launch(); }
      else if (edge('b')) hangar.hide();
    } else if (game.roads?.open) {
      if (edge('b')) { game.roads.hide(); game.openHangar(); }
    } else if (edge('start') && !app.building && !game.board.open) game.openHangar();
    this.prev = s;
  }
}
