import { Overlay } from '../../ui/Overlay.js';
import { worldOf } from '../../space/Worlds.js';
import { clock } from '../../space/SpaceCourier.js';
import { CRAFT, styleFor } from '../vehicles/Plane.js';

/**
 * 🚀 The space courier's board: the parcel you're carrying (deliver it, fly on with it, or drop it), and three parcels
 * from here to other worlds with their pay, today's distance and the time allowed. Taking one launches the rocket.
 */
export class ParcelBoard extends Overlay {
  constructor(app, courier) {
    super({ id: 'parcels', html: `
      <button class="close" id="pClose" title="Close">✕</button>
      <h2>🚀 Space courier</h2>
      <p class="note">Parcels to other worlds, paid by how far they go today. The clock runs from lift-off until you hand
        the parcel over in its town: on time pays in full and builds a streak, late pays half.</p>
      <div id="pJob"></div>
      <div id="pList"></div>` });
    this.app = app;
    this.courier = courier;
    this.dom = { job: this.$('pJob'), list: this.$('pList') };
    this.on('pClose', 'click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-act]');
      if (!b || b.disabled) return;
      this.act(b.dataset.act, Number(b.dataset.i));
    });
  }

  show() {
    this.render();
    super.show();
  }

  act(what, i) {
    const c = this.courier, app = this.app;
    this.hide();
    if (what === 'take' && !c.take(c.currentOffers()[i])) app.hud.toast('🚀 The rocket can’t leave right now. Try again in a moment.');
    else if (what === 'resume' && !c.resume()) app.hud.toast('🚀 The rocket can’t leave right now. Try again in a moment.');
    else if (what === 'drive') app.game.start({ space: true, drive: 'car' });
    else if (what === 'fly') app.game.start({ space: true });
    else if (what === 'drop') { c.drop(); app.hud.toast('📦 Parcel dropped. Take another from the board any time.'); }
  }

  render() {
    const c = this.courier, job = c.job, air = this.app.planet?.theme.air, here = worldOf(c.here);
    const { job: jobEl, list } = this.dom;
    if (job) {
      const to = worldOf(job.to);
      const drive = this.app.planet?.world?.giant ? '' : `<button data-act="drive" class="big drive">${air ? '🚙 Rover' : '🚗 Car'}</button>`;
      const go = c.due ? `${drive}<button data-act="fly" class="big">${CRAFT[styleFor(this.app.planet)]}</button>`
        : '<button data-act="resume" class="big">🚀 Fly there</button>';
      jobEl.innerHTML = `<div class="mission job"><span class="icon">${job.cargo.icon}</span><div class="info">Your parcel → ${to.icon} ${to.name}
        <small></small></div>${go}<button data-act="drop" title="Give up on it">✖</button></div>`;
      jobEl.querySelector('small').textContent = `${job.what} · ${job.left > 0 ? `⏱ ${clock(job.left)} left` : '⏰ late: half pay'}${c.due ? ' · here now: take it to town!' : ''}`;
    } else jobEl.innerHTML = '';
    const offers = job ? [] : c.currentOffers();
    list.innerHTML = job ? '<p class="note">One parcel at a time: deliver this one first.</p>'
      : `<p class="note">From ${here ? `${here.icon} ${here.name}` : '🪐 this planet'}${c.streak ? ` · 🔥 on-time streak x${c.streak}` : ''}</p>`
        + offers.map((o, i) => {
          const to = worldOf(o.to), km = o.au * 149.6e6;
          const far = km >= 1e6 ? `${Math.round(km / 1e6).toLocaleString('en-GB')} million km` : `${(Math.round(km / 1000) * 1000).toLocaleString('en-GB')} km`;
          return `<div class="mission"><span class="icon">${o.cargo.icon}</span><div class="info"><span data-what="${i}"></span> → ${to.icon} ${to.name}
            <small>${o.cargo.name} (${o.cargo.tip.toLowerCase()}) · ${far} · ⏱ ${clock(o.limit)}</small></div>
            <button data-act="take" data-i="${i}" class="big">🚀 🪙 ${o.pay}</button></div>`;
        }).join('');
    offers.forEach((o, i) => { const el = list.querySelector(`[data-what="${i}"]`); if (el) el.textContent = o.what; });
  }
}
