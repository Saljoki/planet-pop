import { THEMES, THEME_IDS } from '../world/Themes.js';

const SPEEDS = [0.5, 1, 2, 4, 8];

/** All DOM UI: control panel, follow badge, hover labels, toasts, flash, loading and trophy overlays. */
export class Hud {
  constructor(app) {
    this.app = app;
    const p = app.params;
    const hint = matchMedia('(pointer: coarse)').matches
      ? 'Drag to orbit · Pinch to zoom · Tap anything to fly there'
      : 'Drag to orbit · Scroll to zoom · Click anything to fly there';
    document.getElementById('ui').innerHTML = `
      <div id="title" class="badge">Planet Pop!</div>
      <div id="hint" class="badge">${hint}</div>
      <div id="worldTag" class="badge"></div>
      <div id="topBtns"><button id="photoBtn" title="Photo mode (C)">📷</button><button id="panelToggle">☰ Controls</button></div>
      <div id="panel" class="panel">
        <div class="row"><button id="pauseBtn">⏸ Pause</button><button id="newBtn">🌍 New planet</button></div>
        <button id="shareBtn">🔗 Share this planet</button>
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
    if (innerWidth < 700) this.panel.classList.add('hidden');
    $('panelToggle').onclick = () => this.panel.classList.toggle('hidden');
    $('photoBtn').onclick = () => app.photo?.enter();
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
    $('sound').onchange = (e) => (app.sfx.enabled = e.target.checked);
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
    });
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
  setTheme(theme) { this.$('worldTag').textContent = `${theme.icon} ${theme.name}`; }

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
