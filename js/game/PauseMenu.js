/**
 * Sky Courier's pause screen (the ⏸ button, P, or Start on a controller): resume, switch tilt steering and
 * vibration on phones that have them, or leave the run.
 */
export class PauseMenu {
  constructor(game) {
    this.game = game;
    const app = game.app, tilt = game.tilt, haptics = app.haptics;
    const el = (this.el = document.createElement('div'));
    el.id = 'gPause';
    el.className = 'overlay hidden';
    el.innerHTML = `<div class="panel"><h2>⏸ Paused</h2>
      <div class="col">
        <button id="pResume" class="big">▶ Resume</button>
        <button id="pTilt" class="${tilt.supported && game.touch ? '' : 'hidden'}"></button>
        <button id="pBuzz" class="${haptics?.supported ? '' : 'hidden'}"></button>
        <button id="pQuit">🌍 Back to planet</button>
      </div></div>`;
    game.el.append(el);
    const $ = (id) => el.querySelector('#' + id);
    this.dom = { tilt: $('pTilt'), buzz: $('pBuzz') };
    $('pResume').addEventListener('click', () => { if (app.paused) app.togglePause(); });
    $('pQuit').addEventListener('click', () => { if (app.paused) app.togglePause(); game.stop(); });
    this.dom.tilt.addEventListener('click', async () => {
      if (tilt.on) tilt.disable();
      else if (!(await tilt.enable())) app.hud.toast('📱 Tilt steering needs motion access. Check your browser settings.');
      this.render();
    });
    this.dom.buzz.addEventListener('click', () => { haptics.setEnabled(!haptics.enabled); this.render(); });
  }

  render() {
    const tilt = this.game.tilt, haptics = this.game.app.haptics;
    this.dom.tilt.textContent = `📱 Tilt to steer: ${tilt.on ? 'on' : 'off'}`;
    this.dom.buzz.textContent = `📳 Vibration: ${haptics?.enabled ? 'on' : 'off'}`;
  }

  /** Shown whenever a run is paused. */
  sync() {
    const show = this.game.active && this.game.app.paused && !this.game.over;
    if (show) this.render();
    this.el.classList.toggle('hidden', !show);
  }
}
