import { happenings } from '../world/Happenings.js';
import { KINDS, describe } from './InfoCard.js';

const STAY = 12, EVENT_STAY = 16, IDLE_START = 60, RECENT = 6, POTATO = 180;
const FILLERS = ['train', 'whale', 'helicopter', 'tram', 'plane', 'balloon', 'boat', 'city', 'station', 'bird', 'moon'];
const KEY = 'planetpop.autotour';

/**
 * Hands-free sightseeing: the camera hops between whatever is happening (an eruption, fireworks, a whale leaping)
 * and, in between, drops in on the train, a tram, a helicopter… with a caption for each. Starts from the Find menu
 * or by itself after a minute with no input; any touch, click or key hands control back.
 */
export class TourMode {
  constructor(app) {
    this.app = app;
    this.on = false;
    this.idle = 0;
    this.recent = [];
    this.watched = 0;
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
    this.auto = saved !== '0';
    const el = (this.el = document.createElement('div'));
    el.id = 'tourBar';
    el.className = 'badge hidden';
    el.innerHTML = '<span id="tourText"></span><button id="tourStop">✕ Stop tour</button>';
    document.getElementById('ui').append(el);
    this.text = el.querySelector('#tourText');
    el.querySelector('#tourStop').addEventListener('click', () => this.stop());
    for (const ev of ['pointerdown', 'keydown', 'wheel']) addEventListener(ev, (e) => this.input(e), { capture: true, passive: true });
  }

  setAuto(on) {
    this.auto = on;
    try { localStorage.setItem(KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
  }

  /** Any input: the user is back. (The tour bar's own button stops it through its click.) */
  input(e) {
    this.idle = 0;
    if (this.on && !e?.target?.closest?.('#tourBar')) this.stop();
  }

  /** Nothing else is going on (no game, photo or menu), so a tour may start. */
  get free() {
    const a = this.app;
    return !!a.planet && !a.building && !a.game.active && !a.photo?.active && !a.game.hangar.open && !a.paused
      && (typeof document.visibilityState !== 'string' || document.visibilityState === 'visible');
  }

  start(auto = false) {
    if (this.on || !this.free) return;
    this.on = true;
    this.recent = [];
    if (auto) this.app.hud.toast('📺 Taking you on a tour. Touch anything to take over.');
    this.app.hud.setTourMode(true);
    this.app.wakeLock?.want('tour', true);
    this.el.classList.remove('hidden');
    this.next();
  }

  stop() {
    if (!this.on) return;
    this.on = false;
    this.item = null;
    this.el.classList.add('hidden');
    this.app.hud.setTourMode(false);
    this.app.wakeLock?.want('tour', false);
  }

  toggle() { if (this.on) this.stop(); else this.start(); }

  update(dt) {
    if (!this.on) {
      this.idle += dt;
      if (this.auto && this.idle > IDLE_START && this.free) this.start(true);
      return;
    }
    if (!this.free) { this.stop(); return; }
    const rig = this.app.rig;
    this.t += dt;
    this.watched += dt;
    if (this.watched > POTATO) this.app.achievements.unlock('couchpotato');
    if (rig.mode === 'local' && rig.idle > 0.5) rig.local.yaw += dt * 0.12; // a slow drift around the subject
    if ((this.checkT -= dt) <= 0) { // is the event still going on?
      this.checkT = 1;
      this.live = !this.item?.event || happenings(this.app.planet).some((h) => h.id === this.item.id);
    }
    if (this.t > this.stay || (!this.live && this.t > 8)) this.next();
    else if (this.item?.entity && !this.item.event) this.caption(this.item); // keep "what it's doing" current
  }

  /** The best thing going on that hasn't just been shown, or else a visit to something on the planet. */
  next() {
    const p = this.app.planet, rig = this.app.rig;
    const live = happenings(p).filter((h) => !this.recent.includes(h.id));
    let item = live[0] && (live[0].score >= 6 || Math.random() < 0.5) ? { ...live[0], event: true } : this.filler();
    item ??= live[0] && { ...live[0], event: true };
    if (!item) return;
    this.item = item;
    this.recent = [item.id, ...this.recent].slice(0, RECENT);
    this.t = 0;
    this.checkT = 1;
    this.live = true;
    this.stay = item.event ? EVENT_STAY : STAY;
    if (item.view) rig.orbitTo(item.view);
    else rig.focus(item.entity);
    if (item.whale !== undefined) p.whales.showOff(item.whale);
    this.caption(item);
  }

  /** Something to drop in on: a kind not seen recently, then one of its members at random. */
  filler() {
    const p = this.app.planet;
    const kinds = FILLERS.filter((k) => !this.recent.includes(`kind:${k}`));
    for (const k of kinds.sort(() => Math.random() - 0.5)) {
      const list = p.entities.filter((e) => e.kind === k);
      if (!list.length) continue;
      const entity = list[Math.floor(Math.random() * list.length)], [icon] = KINDS[k] ?? ['📺'];
      const item = { id: `kind:${k}`, icon, entity, event: false };
      if (k === 'whale') item.whale = p.whales.entities.indexOf(entity);
      return item;
    }
    return null;
  }

  caption(item) {
    const text = item.event ? item.text : `${item.entity.name}: ${describe(item.entity, this.app.planet)}`;
    this.text.textContent = `📺 ${item.icon} ${text}`;
  }
}
