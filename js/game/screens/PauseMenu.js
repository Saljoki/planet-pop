import { Overlay } from '../../ui/Overlay.js';

/**
 * Sky Courier's pause screen (the ⏸ button, P, or Start on a controller): resume, options, or leave the run.
 * Esc is left to the game (it quits the run).
 */
export class PauseMenu extends Overlay {
  constructor(game) {
    super({ id: 'gPause', parent: game.el, escapes: false, html: `<h2>⏸ Paused</h2>
      <div class="col">
        <button id="pResume" class="big">▶ Resume</button>
        <button id="pOptions">⚙️ Options</button>
        <button id="pQuit">🌍 Back to planet</button>
      </div>` });
    this.game = game;
    const app = game.app;
    this.on('pResume', 'click', () => { if (app.paused) app.togglePause(); });
    this.on('pOptions', 'click', () => { this.hide(); game.options.show(() => this.sync()); });
    this.on('pQuit', 'click', () => { if (app.paused) app.togglePause(); game.stop(); });
  }

  /** Shown whenever a run is paused (and Options isn't open on top). */
  sync() {
    const g = this.game;
    this.toggle(g.active && g.app.paused && !g.over && !g.options?.open);
  }
}
