import { THEMES, THEME_IDS } from '../world/Themes.js';
import { InfoCard } from './InfoCard.js';

const SPEEDS = [0.5, 1, 2, 4, 8];

/** All DOM UI: control panel, follow badge, hover labels, toasts, flash, loading and trophy overlays. */
export class Hud {
  constructor(app) {
    this.app = app;
    const p = app.params;
    const touch = (this.touch = matchMedia('(pointer: coarse)').matches);
    const hint = touch
      ? 'Drag to orbit · Pinch to zoom · Two fingers to turn and tilt · Tap to fly there · Hold for info'
      : 'Drag to orbit · Scroll to zoom · Right-drag to turn and tilt · Click anything to fly there';
    const canFull = !!document.fullscreenEnabled && !matchMedia('(display-mode: standalone)').matches;
    document.getElementById('ui').innerHTML = `
      <div id="title" class="badge">Planet Pop!</div>
      <div id="hint" class="badge">${hint}</div>
      <div id="worldTag" class="badge"></div>
      <div id="topBtns"><button id="compassBtn" class="hidden" title="Back to north-up">🧭</button><button id="installBtn" class="hidden" title="Install Planet Pop as an app">📲</button><button id="findBtn" title="Find things and events (F)">📍</button><button id="photoBtn" title="Photo mode (C)">📷</button><button id="panelToggle">☰<span class="wide"> Controls</span></button></div>
      <div id="panel" class="panel sheet">
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
      </div>
      <div id="follow" class="badge hidden"><span id="followName"></span><button id="releaseBtn">✕ Release</button></div>
      <div id="hoverLabel" class="label hidden"></div>
      <div id="toasts"></div>
      <div id="flash"></div>
      <div id="loading" class="overlay hidden"><div class="panel"><h2>🌍 Building planet…</h2></div></div>
      <div id="trophyBox" class="overlay hidden"><div class="panel"><h2>🏆 Trophies</h2><div id="trophyList"></div><button id="trophyClose">Close</button></div></div>`;

    const $ = (this.$ = (id) => document.getElementById(id));
    this.panel = $('panel');
    this.info = new InfoCard(app);
    if (innerWidth < 700) this.panel.classList.add('hidden');
    $('panelToggle').onclick = () => { if (this.panel.classList.toggle('hidden')) return; app.find?.hide(); this.info.hide(); };
    $('findBtn').onclick = () => app.find?.toggle();
    $('compassBtn').onclick = () => app.rig.resetView();
    $('fullBtn')?.addEventListener('click', () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {}));
    if (app.haptics?.supported) {
      $('buzz').checked = app.haptics.enabled;
      $('buzz').onchange = (e) => app.haptics.setEnabled(e.target.checked);
    }
    $('autoTour').onchange = (e) => app.tour?.setAuto(e.target.checked);
    this.swipeToClose(this.panel, () => this.panel.classList.add('hidden'));
    $('photoBtn').onclick = () => app.photo?.enter();
    addEventListener('beforeinstallprompt', (e) => { // browsers that can install web apps offer it here
      e.preventDefault();
      this.installPrompt = e;
      $('installBtn').classList.remove('hidden');
    });
    $('installBtn').onclick = async () => {
      this.installPrompt?.prompt();
      const choice = await this.installPrompt?.userChoice;
      if (choice?.outcome === 'accepted') $('installBtn').classList.add('hidden');
    };
    $('pauseBtn').onclick = () => app.togglePause();
    $('newBtn').onclick = () => app.newPlanet();
    $('shareBtn').onclick = () => app.sharePlanet();
    this.slider('speed', (v) => `${SPEEDS[v]}x`, (v) => app.setTimeScale(SPEEDS[v]), true);
    this.slider('land', (v) => `${v}%`, (v) => app.setWorldParam('land', v / 100));
    this.slider('cities', (v) => `${v}`, (v) => app.setWorldParam('cities', v));
    this.slider('traffic', (v) => `${v} / lane`, (v) => app.setTraffic(v), true);
    $('quality').onchange = (e) => app.setQuality(e.target.value);
    $('world').onchange = (e) => app.setWorld(e.target.value);
    $('ink').onchange = (e) => app.setInk(e.target.checked);
    $('shadows').onchange = (e) => app.setShadows(e.target.checked);
    $('sound').checked = app.settings?.get('sound') ?? true;
    $('sound').onchange = (e) => app.settings?.set('sound', e.target.checked);
    this.slider('ambience', (v) => (v ? `${v}%` : 'off'), (v) => app.ambience?.setVolume(v / 100), true);
    $('playBtn').onclick = () => app.game.openHangar();
    $('trophies').onclick = () => this.showTrophies(app.achievements.list());
    $('trophyClose').onclick = () => $('trophyBox').classList.add('hidden');
    $('releaseBtn').onclick = () => app.rig.release();

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'KeyP') app.togglePause();
      else if (e.code === 'KeyN' && !app.game.active) app.newPlanet();
      else if (e.code === 'KeyH' && !app.game.active) this.panel.classList.toggle('hidden');
      else if (e.code === 'KeyT' && !app.game.active) app.tour?.toggle();
    });
  }

  /** Keep the panel's Sound switch and Ambience slider in step with the Options menu. */
  syncSound() { this.$('sound').checked = this.app.sfx.enabled; }
  syncAmbience() {
    const v = Math.round((this.app.ambience?.volume ?? 0) * 100);
    this.$('ambience').value = v;
    this.$('ambienceVal').textContent = v ? `${v}%` : 'off';
  }

  /** Phones: a sheet closes when dragged down by its grab bar. */
  swipeToClose(sheet, close) {
    const grab = sheet.querySelector?.('.grab');
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
      if (dy > 60) close();
    };
    grab.addEventListener('pointerup', end);
    grab.addEventListener('pointercancel', end);
  }

  /** On phones the controls sheet and the Find sheet take turns. */
  closePanel() { if (innerWidth < 700 || innerHeight < 500) this.panel.classList.add('hidden'); }

  /** Called every frame: the compass shows while the view is turned or tilted; an open info card stays current. */
  update(dt) {
    const rig = this.app.rig, turned = rig.turned;
    this.$('compassBtn').classList.toggle('hidden', !turned);
    if (turned) this.$('compassBtn').style.transform = `rotate(${rig.orbit.heading}rad)`;
    if (this.info.open && (this.infoT = (this.infoT ?? 0) - dt) <= 0) { this.infoT = 0.5; this.info.refresh(); }
  }

  /** The tour is cinematic: the panel and the hint step aside (and come back after). */
  setTourMode(on) {
    if (on) this.tourPanel = !this.panel.classList.contains('hidden');
    this.panel.classList.toggle('hidden', on || !this.tourPanel);
    this.$('hint').classList.toggle('hidden', on);
    document.body.classList.toggle('touring', on); // the tour bar replaces the follow badge
    this.info.hide();
    this.app.find?.hide();
  }

  /** live = apply on every move; otherwise only when the slider is released (planet rebuilds). */
  slider(id, fmt, apply, live = false) {
    const input = this.$(id), label = this.$(id + 'Val');
    const show = () => (label.textContent = fmt(+input.value));
    input.addEventListener('input', () => { show(); if (live) apply(+input.value); });
    if (!live) input.addEventListener('change', () => apply(+input.value));
    show();
  }

  /** Move the world sliders to match params changed from code (e.g. the daily challenge planet). */
  syncParams(p) {
    for (const [id, v] of [['land', Math.round(p.land * 100)], ['cities', p.cities]]) {
      this.$(id).value = v;
      this.$(id).dispatchEvent(new Event('input'));
    }
  }

  /** Names the current planet's theme in a tag under the title. */
  setTheme(theme) {
    this.themeText = `${theme.icon} ${theme.name}`;
    this.setSeason('');
  }

  /** Adds the season where the camera is ("🌍 Classic · 🍂 Autumn"), on worlds that have them. */
  setSeason(season) {
    if (this.themeText) this.$('worldTag').textContent = season ? `${this.themeText} · ${season}` : this.themeText;
  }

  setLoading(on) { this.$('loading').classList.toggle('hidden', !on); }
  setPaused(p) { this.$('pauseBtn').textContent = p ? '▶ Play' : '⏸ Pause'; }
  setInk(on) { this.$('ink').checked = on; }

  /** Shows the chosen mode; in Auto it also names the level currently in use. */
  setQuality(mode, levelName) {
    this.$('quality').value = mode;
    this.$('quality').options[0].textContent = mode === 'auto' && levelName ? `Auto (${levelName})` : 'Auto';
  }

  setFollow(e) {
    this.$('follow').classList.toggle('hidden', !e);
    if (e) this.$('followName').textContent = `👀 ${e.name}`;
  }

  setGameMode(on) {
    if (on) this.panelOpen = !this.panel.classList.contains('hidden');
    if (on) { this.info.hide(); this.app.find?.hide(); }
    this.panel.classList.toggle('hidden', on || !this.panelOpen);
    this.$('topBtns').classList.toggle('hidden', on);
    this.$('hint').classList.toggle('hidden', on);
    this.$('worldTag').classList.toggle('hidden', on);
    document.body.classList.toggle('in-game', on); // lets phones drop the title to make room for the game HUD
    this.hideLabel();
  }

  toast(text) {
    const box = this.$('toasts');
    while (box.children.length >= 4) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    box.append(el);
    setTimeout(() => el.remove(), 4100);
  }

  flash() {
    const f = this.$('flash');
    f.style.transition = 'none';
    f.style.opacity = '0.85';
    void f.offsetWidth;
    clearTimeout(this.flashT);
    this.flashT = setTimeout(() => { f.style.transition = ''; f.style.opacity = '0'; }, 60);
  }

  showLabel(text, x, y) {
    const el = this.$('hoverLabel');
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.classList.remove('hidden');
  }
  hideLabel() { this.$('hoverLabel')?.classList.add('hidden'); }

  updateTrophies(n, total) { this.$('trophies').textContent = `🏆 ${n} / ${total} trophies`; }

  showTrophies(list) {
    this.$('trophyList').innerHTML = list.map((t) =>
      `<div class="trophy ${t.unlocked ? '' : 'locked'}"><span>${t.unlocked ? t.icon : '🔒'}</span><div>${t.title}<small>${t.desc}</small></div></div>`).join('');
    this.$('trophyBox').classList.remove('hidden');
  }
}
