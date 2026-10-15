import { Overlay } from '../../ui/Overlay.js';

/**
 * ⚙️ Options, from the briefing, the hangar or the pause menu: Invert Y and steering sensitivity, tilt steering and
 * vibration on phones, sound and ambience volume, whether to show the briefing, and resetting Sky Courier progress.
 * Every change applies straight away and is remembered.
 */
export class OptionsMenu extends Overlay {
  constructor(app, game) {
    const s = app.settings, tilt = game.controls.tilt, haptics = app.haptics, phone = game.touch;
    super({ id: 'options', html: `
      <button class="close" id="oClose" title="Close">✕</button>
      <h2>⚙️ Options</h2>
      <h3>Controls</h3>
      <label class="opt"><input id="oInvert" type="checkbox"><span>Invert Y axis<small id="oInvertNote"></small></span></label>
      <label class="opt slider"><span>Steering sensitivity <b id="oSensVal"></b></span><input id="oSens" type="range" min="50" max="150" step="10"></label>
      <label class="opt ${tilt.supported && phone ? '' : 'hidden'}"><input id="oTilt" type="checkbox"><span>Tilt to steer<small>Tip the phone like a steering wheel. Level is however you hold it when a run starts.</small></span></label>
      <label class="opt ${haptics?.supported ? '' : 'hidden'}"><input id="oBuzz" type="checkbox"><span>Vibration<small>Buzz on deliveries, crashes and lightning</small></span></label>
      <h3>Sound</h3>
      <label class="opt"><input id="oSound" type="checkbox"><span>Sound</span></label>
      <label class="opt slider"><span>Effects volume <b id="oSfxVal"></b></span><input id="oSfx" type="range" min="0" max="100" step="5"></label>
      <label class="opt slider"><span>Ambience <b id="oAmbVal"></b></span><input id="oAmb" type="range" min="0" max="100" step="5"></label>
      <h3>Game</h3>
      <label class="opt"><input id="oBrief" type="checkbox"><span>Show the briefing before each run</span></label>
      <button id="oReset" class="danger">🗑️ Reset Sky Courier progress</button>
      <small class="note" id="oResetNote">Coins, upgrades, paint jobs, missions and best scores. Trophies stay.</small>
      <button id="oDone" class="big">✔ Done</button>` });
    this.app = app;
    this.game = game;
    const $ = (id) => this.$(id), pct = (v) => `${Math.round(v)}%`;
    this.bind('oInvert', 'change', (e) => s.set('invertY', e.target.checked));
    this.bind('oSens', 'input', (e) => { s.set('sensitivity', +e.target.value / 100); $('oSensVal').textContent = pct(+e.target.value); });
    this.bind('oSfx', 'input', (e) => { s.set('sfxVolume', +e.target.value / 100); $('oSfxVal').textContent = pct(+e.target.value); });
    this.bind('oSfx', 'change', () => app.sfx.play('ring')); // a sample at the new volume
    this.bind('oAmb', 'input', (e) => { app.ambience?.setVolume(+e.target.value / 100); $('oAmbVal').textContent = pct(+e.target.value); app.hud.panel.syncAmbience(); });
    this.bind('oSound', 'change', (e) => { s.set('sound', e.target.checked); app.hud.panel.syncSound(); });
    this.bind('oBrief', 'change', (e) => s.set('briefing', e.target.checked));
    this.bind('oBuzz', 'change', (e) => haptics?.setEnabled(e.target.checked));
    this.bind('oTilt', 'change', async (e) => {
      if (!e.target.checked) tilt.disable();
      else if (!(await tilt.enable())) app.hud.toast('📱 Tilt steering needs motion access. Check your browser settings.');
      this.render();
    });
    this.bind('oReset', 'click', () => this.reset());
    this.bind('oDone', 'click', () => this.hide());
    this.bind('oClose', 'click', () => this.hide());
    s.onChange(() => this.renderInvert());
  }

  bind(id, ev, fn) { this.on(id, ev, fn); }

  /** `onClose` runs when the menu is closed (e.g. back to the briefing). */
  show(onClose = null) {
    this.onClose = onClose;
    this.armed = false;
    this.render();
    super.show();
  }

  hide() {
    if (!this.open) return;
    super.hide();
    const done = this.onClose;
    this.onClose = null;
    done?.();
  }

  render() {
    const s = this.app.settings, $ = (id) => this.$(id), app = this.app;
    $('oInvert').checked = s.get('invertY');
    $('oSens').value = Math.round(s.get('sensitivity') * 100);
    $('oSensVal').textContent = `${$('oSens').value}%`;
    $('oSfx').value = Math.round(s.get('sfxVolume') * 100);
    $('oSfxVal').textContent = `${$('oSfx').value}%`;
    $('oAmb').value = Math.round((app.ambience?.volume ?? 0.5) * 100);
    $('oAmbVal').textContent = `${$('oAmb').value}%`;
    $('oSound').checked = app.sfx.enabled;
    $('oBrief').checked = s.get('briefing');
    $('oTilt').checked = this.game.controls.tilt.wanted;
    $('oBuzz').checked = !!app.haptics?.enabled;
    $('oReset').textContent = '🗑️ Reset Sky Courier progress';
    this.renderInvert();
  }

  renderInvert() {
    this.$('oInvertNote').textContent = this.app.settings.get('invertY')
      ? 'On: up (↑, W, thumbstick or stick up) dives, down climbs'
      : 'Off: up (↑, W, thumbstick or stick up) climbs, down dives';
  }

  /** Two taps, so it can't happen by accident. */
  reset() {
    const b = this.$('oReset');
    if (!this.armed) {
      this.armed = true;
      b.textContent = '⚠️ Tap again to reset everything';
      clearTimeout(this.armT);
      this.armT = setTimeout(() => { this.armed = false; b.textContent = '🗑️ Reset Sky Courier progress'; }, 3500);
      return;
    }
    this.armed = false;
    clearTimeout(this.armT);
    this.game.progress.reset();
    b.textContent = '✔ Progress reset';
    this.app.hud.toast('🗑️ Sky Courier progress reset: a fresh start in the hangar.');
    if (this.game.hangar.open) this.game.hangar.render();
  }
}
