import { THEMES, THEME_IDS } from '../world/Themes.js';
import { VERSION } from '../core/Version.js';
import { Widget } from './Widget.js';

const SPEEDS = [0.5, 1, 2, 4, 8];

/**
 * The ☰ Controls panel (a bottom sheet on phones): pause, new planet, share, the world sliders, quality and
 * looks, sound, the Sky Courier and trophies buttons, and About (with the version). To add a setting: put its input
 * in the HTML below and wire it up in the constructor (slider() for ranges).
 */
export class ControlPanel extends Widget {
  constructor(app) {
    const p = app.params, canFull = !!document.fullscreenEnabled && !matchMedia('(display-mode: standalone)').matches;
    super({ id: 'panel', className: 'panel sheet', hidden: false, html: `
        <div class="grab"></div>
        <div class="row"><button id="pauseBtn">⏸ Pause</button><button id="newBtn">🌍 New planet</button></div>
        <div class="row"><button id="shareBtn">🔗 Share this planet</button>${canFull ? '<button id="fullBtn" title="Full screen">⛶</button>' : ''}</div>
        <label>Time speed <b id="speedVal"></b><input id="speed" type="range" min="0" max="4" step="1" value="1"></label>
        <label>Land <b id="landVal"></b><input id="land" type="range" min="25" max="70" step="5" value="${Math.round(p.land * 100)}"></label>
        <label>Cities <b id="citiesVal"></b><input id="cities" type="range" min="2" max="8" step="1" value="${p.cities}"></label>
        <label>Traffic <b id="trafficVal"></b><input id="traffic" type="range" min="0" max="10" step="1" value="${p.traffic}"></label>
        <div class="pair">
          <label>World<select id="world">
            <option value="random">🎲 Any</option>${THEME_IDS.map((t) => `<option value="${t}">${THEMES[t].icon} ${THEMES[t].name.replace(' world', '')}</option>`).join('')}
          </select></label>
          <label>Quality<select id="quality">
            <option value="auto">Auto</option><option value="crisp">Crisp</option>
            <option value="balanced">Balanced</option><option value="fast">Fast</option>
          </select></label>
        </div>
        <div class="checks">
          <label class="check"><input id="ink" type="checkbox" checked> Ink lines</label>
          <label class="check"><input id="shadows" type="checkbox" checked> Shadows</label>
          <label class="check"><input id="sound" type="checkbox" checked> Sound</label>
          <label class="check" title="Start the tour after a minute with no input"><input id="autoTour" type="checkbox" checked> Idle tour</label>
          ${app.haptics?.supported ? '<label class="check"><input id="buzz" type="checkbox" checked> Vibration</label>' : ''}
        </div>
        <label>Ambience <b id="ambienceVal"></b><input id="ambience" type="range" min="0" max="100" step="5" value="${Math.round((app.ambience?.volume ?? 0.5) * 100)}"></label>
        <button id="playBtn" class="big">✈️ Play Sky Courier</button>
        <div id="trophies">🏆 0 trophies</div>
        <button id="aboutBtn" class="about" title="About Planet Pop, and your name">ℹ️ About · v${VERSION}</button>
      ` });
    this.app = app;
    const $ = (id) => this.$(id);
    if (innerWidth < 700) this.hide();
    this.swipeToClose();
    this.on('pauseBtn', 'click', () => app.togglePause());
    this.on('newBtn', 'click', () => app.newPlanet());
    this.on('shareBtn', 'click', () => app.sharePlanet());
    this.on('fullBtn', 'click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}));
    this.slider('speed', (v) => `${SPEEDS[v]}x`, (v) => app.setTimeScale(SPEEDS[v]), true);
    this.slider('land', (v) => `${v}%`, (v) => app.setWorldParam('land', v / 100));
    this.slider('cities', (v) => `${v}`, (v) => app.setWorldParam('cities', v));
    this.slider('traffic', (v) => `${v} / lane`, (v) => app.setTraffic(v), true);
    this.on('quality', 'change', (e) => app.setQuality(e.target.value));
    this.on('world', 'change', (e) => app.setWorld(e.target.value));
    this.on('ink', 'change', (e) => app.setInk(e.target.checked));
    this.on('shadows', 'change', (e) => app.setShadows(e.target.checked));
    $('sound').checked = app.settings?.get('sound') ?? true;
    this.on('sound', 'change', (e) => app.settings?.set('sound', e.target.checked));
    this.on('autoTour', 'change', (e) => app.tour?.setAuto(e.target.checked));
    if (app.haptics?.supported) {
      $('buzz').checked = app.haptics.enabled;
      this.on('buzz', 'change', (e) => app.haptics.setEnabled(e.target.checked));
    }
    this.slider('ambience', (v) => (v ? `${v}%` : 'off'), (v) => app.ambience?.setVolume(v / 100), true);
    this.on('playBtn', 'click', () => app.game.openHangar());
    this.on('trophies', 'click', () => app.hud.showTrophies(app.achievements.list()));
    this.on('aboutBtn', 'click', () => app.hud.about.show());
  }

  /** A range input with its value shown next to its name. live = apply on every move; otherwise only when the
   * slider is let go (for ones that rebuild the planet). */
  slider(id, fmt, apply, live = false) {
    const input = this.$(id), label = this.$(`${id}Val`);
    const show = () => (label.textContent = fmt(+input.value));
    input.addEventListener('input', () => { show(); if (live) apply(+input.value); });
    if (!live) input.addEventListener('change', () => apply(+input.value));
    show();
  }

  /** Phones: the sheet closes when dragged down by its grab bar. */
  swipeToClose() {
    const sheet = this.el, grab = sheet.querySelector?.('.grab');
    if (!grab) return;
    let start = null;
    grab.addEventListener('pointerdown', (e) => { start = e.clientY; grab.setPointerCapture?.(e.pointerId); });
    grab.addEventListener('pointermove', (e) => {
      if (start === null) return;
      sheet.style.transform = `translateY(${Math.max(0, e.clientY - start)}px)`;
    });
    const end = (e) => {
      if (start === null) return;
      const dy = e.clientY - start;
      start = null;
      sheet.style.transform = '';
      if (dy > 60) this.hide();
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  /** On small screens the panel and the Find sheet take turns. */
  makeRoom() { if (innerWidth < 700 || innerHeight < 500) this.hide(); }

  /** Keep the Sound switch and Ambience slider in step with the Options menu. */
  syncSound() { this.$('sound').checked = this.app.sfx.enabled; }

  syncAmbience() {
    const v = Math.round((this.app.ambience?.volume ?? 0) * 100);
    this.$('ambience').value = v;
    this.$('ambienceVal').textContent = v ? `${v}%` : 'off';
  }

  /** Move the world sliders to match params changed from code (e.g. the daily challenge planet). */
  syncParams(p) {
    for (const [id, v] of [['land', Math.round(p.land * 100)], ['cities', p.cities]]) {
      const input = this.$(id);
      input.value = v;
      input.dispatchEvent(new Event('input'));
    }
  }

  setPaused(paused) { this.$('pauseBtn').textContent = paused ? '▶ Play' : '⏸ Pause'; }

  /** Shows the chosen quality mode; in Auto it also names the level currently in use. */
  setQuality(mode, levelName) {
    const q = this.$('quality');
    q.value = mode;
    q.options[0].textContent = mode === 'auto' && levelName ? `Auto (${levelName})` : 'Auto';
  }

  updateTrophies(n, total) { this.$('trophies').textContent = `🏆 ${n} / ${total} trophies`; }
}
