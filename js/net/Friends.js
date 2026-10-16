import { makeHello, makeState, readHello, readState, planetOf, planetKey } from './Wire.js';
import { worldOf } from '../space/Worlds.js';
import { Ghost } from './Ghost.js';
import { TabLink } from './TabLink.js';
import { TrysteroLink } from './TrysteroLink.js';

const SEND = 1 / 15;   // seconds between position updates while driving or flying
const IDLE = 1;        // …and between "still here" updates while just looking round
const GONE = 20;       // seconds without a word before a friend counts as gone
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // (no 0/O or 1/I to mix up)

/**
 * 👥 Playing with friends: a room (a short code, or a link with it in) that everyone on it joins. Each player sends
 * who they are and which planet they're on ('hi'), and where their plane, car or boat is ('st'), straight to the
 * others; everyone on the same planet sees the others' vehicles with their names over them (Ghost), and on the
 * mini-map. Each plays their own game: nothing here changes anyone's score. Joined through the internet
 * (TrysteroLink), or between tabs of one browser with ?net=tabs (TabLink).
 */
export class Friends {
  constructor(app, { link = null } = {}) {
    this.app = app;
    const tabs = new URLSearchParams(globalThis.location?.search ?? '').get('net') === 'tabs';
    this.makeLink = link ?? (() => (tabs ? new TabLink() : new TrysteroLink()));
    this.tabs = tabs;
    this.code = null;
    this.link = null;
    this.ghosts = new Map();
    this.listeners = [];
    this.sendT = 0;
    this.said = '';
    addEventListener('pagehide', () => this.link?.leave());
  }

  get inRoom() { return !!this.code; }

  /** A fresh room code: six letters and digits. */
  static newCode() {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    return [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('');
  }

  /** A typed or pasted code (or a whole invite link), tidied; null if it can't be one. */
  static cleanCode(text) {
    const s = String(text ?? '').trim(), fromLink = s.match(/[?&]room=([A-Za-z0-9]+)/);
    const code = (fromLink ? fromLink[1] : s).toUpperCase().replace(/[^A-Z0-9]/g, '');
    return code.length >= 4 && code.length <= 12 ? code : null;
  }

  /** The invite: this page with the planet and the room in the address. */
  get inviteLink() {
    this.app.updateUrl?.();
    return globalThis.location?.href ?? `?room=${this.code}`;
  }

  /** Called with no arguments whenever the room or the people in it change (the menu redraws). */
  onChange(fn) { this.listeners.push(fn); }

  changed() { for (const fn of this.listeners) fn(); }

  async join(text) {
    const code = Friends.cleanCode(text);
    if (!code) return false;
    if (this.code === code) return true;
    this.leave(true);
    const link = this.makeLink();
    link.onJoin = (peer) => this.link === link && link.send('hi', makeHello(this.app), peer);
    link.onLeave = (peer) => this.link === link && this.drop(peer);
    link.onMessage = (peer, type, data) => this.link === link && this.receive(peer, type, data);
    this.link = link;
    this.code = code;
    try {
      await link.join(code);
    } catch (err) {
      console.warn('Could not join the room', err);
      this.link = null;
      this.code = null;
      this.app.hud.toast('📡 Couldn’t reach the internet to join the room. Check the connection and try again.');
      this.changed();
      return false;
    }
    if (this.link !== link) return false; // (left again while connecting)
    this.said = '';
    this.sayHello();
    this.app.updateUrl?.();
    this.app.hud.toast(`👥 You’re in room ${code}. Share the link and your friends will turn up here.`);
    this.changed();
    return true;
  }

  leave(quiet = false) {
    if (!this.link) return;
    this.link.leave();
    this.link = null;
    this.code = null;
    for (const g of this.ghosts.values()) g.dispose();
    this.ghosts.clear();
    this.app.updateUrl?.();
    if (!quiet) this.app.hud.toast('🚪 You left the room.');
    this.changed();
  }

  /** Tell everyone who we are and where (again, if the name or the planet changed). */
  sayHello() {
    const hello = makeHello(this.app), key = `${hello.name}|${planetKey(hello.planet)}`;
    if (key === this.said) return;
    this.said = key;
    this.link.send('hi', hello);
  }

  ghost(peer) {
    let g = this.ghosts.get(peer);
    if (!g) this.ghosts.set(peer, (g = new Ghost(peer, document.getElementById('ui'))));
    return g;
  }

  receive(peer, type, data) {
    const now = this.now;
    if (type === 'hi') {
      const info = readHello(data);
      if (!info) return;
      const g = this.ghost(peer), news = g.hello(info, now), here = info.key === this.myKey;
      if (news === 'new') this.app.hud.toast(`👋 ${info.name} joined${here ? '' : ' (on another planet: 👥 to go there)'}`);
      else if (news === 'planet') this.app.hud.toast(here ? `🌍 ${info.name} is on your planet now` : `🌍 ${info.name} went to another planet (👥 to follow)`);
      this.changed();
    } else if (type === 'st') {
      const g = this.ghosts.get(peer), state = readState(data);
      if (g?.name && state) {
        const was = g.kind;
        g.push(state, now);
        if (was !== g.kind) this.changed();
      }
    }
  }

  drop(peer) {
    const g = this.ghosts.get(peer);
    if (!g) return;
    if (g.name) this.app.hud.toast(`👋 ${g.name} left`);
    g.dispose();
    this.ghosts.delete(peer);
    this.changed();
  }

  get now() { return performance.now() / 1000; }

  get myKey() { return planetKey(planetOf(this.app.params)); }

  /** Everyone else in the room, for the menu and the mini-map. */
  get people() { return [...this.ghosts.values()].filter((g) => g.name); }

  /** Friends whose vehicles are on our planet right now. */
  get here() { return this.people.filter((g) => g.model?.group.visible); }

  /** Go to the planet a friend is on. */
  async goTo(peer) {
    const g = this.ghosts.get(peer), app = this.app;
    if (!g?.planet || g.key === this.myKey || app.building) return;
    if (g.planet.world) { // a real world: by rocket if we can, else straight there
      app.hud.toast(`🚀 Off to ${g.name} on ${worldOf(g.planet.world).name}…`);
      if (!app.trip?.go(g.planet.world)) await app.visitWorld?.(g.planet.world);
      return;
    }
    const { seed, land, cities, theme } = g.planet;
    Object.assign(app.params, { seed, land: land / 100, cities, theme });
    app.hud.panel.syncParams(app.params);
    app.hud.toast(`🌍 Off to ${g.name}’s planet…`);
    await app.newPlanet(seed, false, theme);
  }

  /** Each frame: send our news, move everyone's vehicles, forget anyone long gone. */
  update(dt) {
    if (!this.link) return;
    const now = this.now, game = this.app.game, pl = game.active && game.respawnT <= 0 ? game.player : null;
    this.sayHello();
    if ((this.sendT -= dt) <= 0 || !!pl !== this.driving) { // (straight away on getting in or out)
      this.sendT = pl ? SEND : IDLE;
      this.driving = !!pl;
      this.link.send('st', makeState(pl));
    }
    const planet = this.app.planet, mine = this.myKey;
    for (const [peer, g] of this.ghosts) {
      if (now - g.seen > GONE) { this.drop(peer); continue; }
      g.update(now, planet, !!planet && g.key === mine && !this.app.building, dt);
    }
  }

  /** After the camera has moved: everyone's name tags. */
  draw() {
    if (!this.link) return;
    const toScreen = (p) => this.app.sfx.toScreen(p);
    for (const g of this.ghosts.values()) g.placeTag(toScreen);
  }
}
