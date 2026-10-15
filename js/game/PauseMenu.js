/** Sky Courier's pause screen (the ⏸ button, P, or Start on a controller): resume, options, or leave the run. */
export class PauseMenu {
  constructor(game) {
    this.game = game;
    const app = game.app;
    const el = (this.el = document.createElement('div'));
    el.id = 'gPause';
    el.className = 'overlay hidden';
    el.innerHTML = `<div class="panel"><h2>⏸ Paused</h2>
      <div class="col">
        <button id="pResume" class="big">▶ Resume</button>
        <button id="pOptions">⚙️ Options</button>
        <button id="pQuit">🌍 Back to planet</button>
      </div></div>`;
    game.el.append(el);
    const $ = (id) => el.querySelector('#' + id);
    $('pResume').addEventListener('click', () => { if (app.paused) app.togglePause(); });
    $('pOptions').addEventListener('click', () => { this.el.classList.add('hidden'); game.options.show(() => this.sync()); });
    $('pQuit').addEventListener('click', () => { if (app.paused) app.togglePause(); game.stop(); });
  }

  /** Shown whenever a run is paused (and Options isn't open on top). */
  sync() {
    const show = this.game.active && this.game.app.paused && !this.game.over && !this.game.options?.open;
    this.el.classList.toggle('hidden', !show);
  }
}
