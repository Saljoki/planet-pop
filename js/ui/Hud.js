import { InfoCard } from './InfoCard.js';
import { ControlPanel } from './ControlPanel.js';
import { AboutCard } from './AboutCard.js';

/**
 * The planet view's screen furniture: the title, hint and world tag, the buttons along the top, the ☰ Controls
 * panel (ControlPanel), the follow badge, hover labels, toasts, the camera flash, and the loading and trophy screens.
 * Also the keyboard shortcuts.
 */
export class Hud {
  constructor(app) {
    this.app = app;
    const touch = (this.touch = matchMedia('(pointer: coarse)').matches);
    const hint = touch
      ? 'Drag to orbit · Pinch to zoom · Two fingers to turn and tilt · Tap to fly there · Hold for info'
      : 'Drag to orbit · Scroll to zoom · Right-drag to turn and tilt · Click anything to fly there';
    const ui = document.getElementById('ui');
    ui.innerHTML = `
      <div id="title" class="badge">Planet Pop!</div>
      <div id="hint" class="badge">${hint}</div>
      <button id="worldTag" class="badge" title="Where this is: the solar system (M)"><span id="worldName"></span> <span class="mapGo">🪐</span></button>
      <div id="topBtns"><button id="compassBtn" class="hidden" title="Back to north-up">🧭</button><button id="installBtn" class="hidden" title="Install Planet Pop as an app">📲</button><button id="friendsBtn" title="Play with friends">👥</button><button id="mapBtn" title="The solar system (M)">🪐</button><button id="findBtn" title="Find things and events (F)">📍</button><button id="photoBtn" title="Photo mode (C)">📷</button><button id="panelToggle">☰<span class="wide"> Controls</span></button></div>`;
    this.panel = new ControlPanel(app);
    ui.insertAdjacentHTML('beforeend', `
      <div id="follow" class="badge hidden"><span id="followName"></span><button id="releaseBtn">✕ Release</button></div>
      <div id="hoverLabel" class="label hidden"></div>
      <div id="toasts"></div>
      <div id="flash"></div>
      <div id="loading" class="overlay hidden"><div class="panel"><h2>🌍 Building planet…</h2></div></div>
      <div id="trophyBox" class="overlay hidden"><div class="panel"><h2>🏆 Trophies</h2><div id="trophyList"></div><button id="trophyClose">Close</button></div></div>`);

    const $ = (this.$ = (id) => document.getElementById(id));
    this.info = new InfoCard(app);
    this.about = new AboutCard(app);
    $('panelToggle').onclick = () => {
      if (!this.panel.toggle()) return;
      app.find?.hide();
      this.info.hide();
    };
    $('findBtn').onclick = () => app.find?.toggle();
    $('mapBtn').onclick = () => app.map?.show();
    $('worldTag').onclick = () => app.map?.show();
    $('friendsBtn').onclick = () => app.friendsMenu?.show();
    $('compassBtn').onclick = () => app.rig.resetView();
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
    $('trophyClose').onclick = () => $('trophyBox').classList.add('hidden');
    $('releaseBtn').onclick = () => app.rig.release();

    addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'KeyP') app.togglePause();
      else if (e.code === 'KeyN' && !app.game.active && !app.trip?.active) app.newPlanet();
      else if (e.code === 'KeyH' && !app.game.active) this.panel.toggle();
      else if (e.code === 'KeyT' && !app.game.active) app.tour?.toggle();
      else if (e.code === 'KeyM' && !app.game.active) app.map?.toggle();
    });
  }

  /** Called every frame: the compass shows while the view is turned or tilted; an open info card stays current. */
  update(dt) {
    const rig = this.app.rig, turned = rig.turned, compass = this.$('compassBtn');
    compass.classList.toggle('hidden', !turned);
    if (turned) compass.style.transform = `rotate(${rig.orbit.heading}rad)`;
    if (this.info.open && (this.infoT = (this.infoT ?? 0) - dt) <= 0) { this.infoT = 0.5; this.info.refresh(); }
  }

  /** The tour is cinematic: the panel and the hint step aside (and come back after). */
  setTourMode(on) {
    if (on) this.tourPanel = this.panel.open;
    this.panel.toggle(!on && !!this.tourPanel);
    this.$('hint').classList.toggle('hidden', on);
    document.body.classList.toggle('touring', on); // the tour bar replaces the follow badge
    this.info.hide();
    this.app.find?.hide();
  }

  /** Sky Courier takes over the screen: the planet view's furniture steps aside (and comes back after). */
  setGameMode(on) {
    if (on) {
      this.panelOpen = this.panel.open;
      this.info.hide();
      this.app.find?.hide();
    }
    this.panel.toggle(!on && !!this.panelOpen);
    this.$('topBtns').classList.toggle('hidden', on);
    this.$('hint').classList.toggle('hidden', on);
    this.$('worldTag').classList.toggle('hidden', on);
    document.body.classList.toggle('in-game', on); // lets phones drop the title to make room for the game HUD
    this.hideLabel();
  }

  /** Names the current planet's theme in a tag under the title. */
  setTheme(theme) {
    this.themeText = `${theme.icon} ${theme.name}`;
    this.setSeason('');
  }

  /** Adds the season where the camera is ("🌍 Classic · 🍂 Autumn"), on worlds that have them. */
  setSeason(season) {
    if (this.themeText) this.$('worldName').textContent = season ? `${this.themeText} · ${season}` : this.themeText;
  }

  setLoading(on) { this.$('loading').classList.toggle('hidden', !on); }

  setFollow(e) {
    this.$('follow').classList.toggle('hidden', !e);
    if (e) this.$('followName').textContent = `👀 ${e.name}`;
  }

  /** The 👥 button shows how many are in the room (0: not in one). */
  setFriends(n) {
    const b = this.$('friendsBtn');
    b.textContent = n ? `👥 ${n}` : '👥';
    b.classList.toggle('on', n > 0);
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

  showTrophies(list) {
    this.$('trophyList').innerHTML = list.map((t) =>
      `<div class="trophy ${t.unlocked ? '' : 'locked'}"><span>${t.unlocked ? t.icon : '🔒'}</span><div>${t.title}<small>${t.desc}</small></div></div>`).join('');
    this.$('trophyBox').classList.remove('hidden');
  }
}
