import { Widget } from './Widget.js';
import { clock } from '../space/SpaceCourier.js';

/**
 * After a trip lands: welcome to the world, what's different about it, and a way to carry on in its own vehicle
 * (from the spaceport) or start a courier run there; with a space courier parcel aboard, the way to its town by road
 * or by air. Goes away by itself after a while (but not while a parcel's waiting).
 */
export class LandedCard extends Widget {
  constructor(app) {
    super({ id: 'landed', className: 'panel', html: `<div class="iHead"><span id="lIcon"></span><div><b id="lName"></b><small id="lNote"></small></div>
      <button id="lClose">✕</button></div><div class="row"><button id="lDrive" class="big drive"></button><button id="lFly" class="big"></button></div>` });
    this.app = app;
    this.on('lClose', 'click', () => this.hide());
    this.on('lDrive', 'click', () => {
      this.hide();
      if (this.parcel) app.game.start({ space: true, drive: 'car' });
      else app.game.launch({ drive: 'car', from: 'pad' });
    });
    this.on('lFly', 'click', () => {
      this.hide();
      if (this.parcel) app.game.start({ space: true });
      else app.game.launch();
    });
  }

  show(world) {
    const air = this.app.planet?.theme.air, $ = (id) => this.$(id);
    $('lIcon').textContent = world.icon;
    $('lName').textContent = `Welcome to ${world.name}!`;
    const courier = this.app.spaceCourier, job = courier?.due && courier.job;
    this.parcel = !!job;
    if (job) job.town = courier.townFor(this.app.planet).name;
    $('lNote').textContent = job ? `${job.what} for ${job.town}: ${job.left > 0 ? `${clock(job.left)} left` : 'late, but still wanted'}. Take it to town!`
      : world.welcome ?? '';
    $('lDrive').textContent = job ? (air ? '🚙 By rover' : '🚗 By car') : air ? '🚙 Drive the rover' : '🚗 Take a car';
    $('lFly').textContent = job ? ({ none: '🚀 By hopper', thin: '🪂 By glider' }[air] ?? '✈️ By plane') : air === 'none' ? '🚀 Hopper courier' : '✈️ Sky Courier';
    super.show();
    clearTimeout(this.timer);
    if (job) return;
    this.timer = setTimeout(() => this.hide(), 15000);
    this.timer?.unref?.(); // (tests under Node needn't wait for it)
  }
}
