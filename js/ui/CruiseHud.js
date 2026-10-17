import { Widget } from './Widget.js';
import { clock } from '../space/SpaceCourier.js';

/**
 * The screen during a trip's cruise: where from and to, how far along, the fuel stars caught, the boost tank, a BOOST
 * button for fingers, a hint, and a message line (waiting to land).
 */
export class CruiseHud extends Widget {
  constructor(cruise, touch) {
    super({ id: 'cruiseUi', html: `
      <div id="cBar" class="badge"><span id="cRoute"></span><div class="cMeter"><i id="cDone"></i></div><span id="cStars">⭐ 0</span><span id="cParcel" class="hidden"></span></div>
      <div id="cFuel" class="badge">🔥<div class="cMeter"><i id="cTank"></i></div></div>
      <button id="cBoost" class="big">🔥 Boost</button>
      <div id="cMsg" class="badge hidden"></div>
      <div id="cHint" class="badge">${touch ? 'Drag to steer · Hold Boost to go faster' : 'Steer with the arrow keys, WASD or a drag · Hold Space to boost'} · Catch ⭐ for fuel, miss the rocks</div>` });
    this.cruise = cruise;
    const boost = (on) => (e) => { e.preventDefault?.(); cruise.boosting = on; };
    this.on('cBoost', 'pointerdown', boost(true));
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) this.on('cBoost', t, boost(false));
    this.dom = { route: this.$('cRoute'), done: this.$('cDone'), stars: this.$('cStars'), tank: this.$('cTank'), msg: this.$('cMsg'), hint: this.$('cHint'), parcel: this.$('cParcel') };
  }

  begin(from, to) {
    this.dom.route.textContent = `${from.def.icon} ${from.def.name} → ${to.def.icon} ${to.def.name}`;
    this.say('');
    this.dom.hint.classList.remove('hidden');
    this.show();
  }

  say(text) {
    this.dom.msg.textContent = text;
    this.dom.msg.classList.toggle('hidden', !text);
  }

  update() {
    const c = this.cruise, d = this.dom;
    d.done.style.width = `${(Math.min(1, c.s / c.len) * 100).toFixed(1)}%`;
    d.tank.style.width = `${(c.fuel * 100).toFixed(1)}%`;
    d.stars.textContent = `⭐ ${c.stars}`;
    if (c.t > 6) d.hint.classList.add('hidden');
    const job = c.app.spaceCourier?.job; // (a parcel aboard: its clock)
    d.parcel.classList.toggle('hidden', !job);
    if (job) d.parcel.textContent = `${job.cargo.icon} ${job.left > 0 ? clock(job.left) : 'late'}`;
  }
}
