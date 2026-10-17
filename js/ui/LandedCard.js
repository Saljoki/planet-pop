import { Widget } from './Widget.js';
import { clock } from '../space/SpaceCourier.js';
import { CRAFT, styleFor } from '../game/vehicles/Plane.js';

/**
 * After a trip lands: welcome to the world, what's different about it, and a way to carry on in its own vehicle
 * (from the spaceport) or start a courier run there; with a space courier parcel aboard, the way to its town by road
 * or by air (only by air on a giant: there's no ground). Goes away by itself after a while (but not while a parcel's waiting).
 */
export class LandedCard extends Widget {
  constructor(app) {
    super({ id: 'landed', className: 'panel', html: `<div class="iHead"><span id="lIcon"></span><div><b id="lName"></b><small id="lNote"></small></div>
      <button id="lClose">✕</button></div><div class="row"><button id="lDrive" class="big drive"></button><button id="lFly" class="big"></button></div>` });
    this.app = app;
    this.dom = { icon: this.$('lIcon'), name: this.$('lName'), note: this.$('lNote'), drive: this.$('lDrive'), fly: this.$('lFly') };
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
    const air = this.app.planet?.theme.air, d = this.dom;
    d.icon.textContent = world.icon;
    d.name.textContent = `Welcome to ${world.name}!`;
    const courier = this.app.spaceCourier, job = courier?.due && courier.job;
    this.parcel = !!job;
    if (job) job.town = courier.townFor(this.app.planet).name;
    const lead = job?.rex?.lead ?? 0, rex = !job?.rex ? '' : lead > 0.5 ? ` 😈 Rex is ${Math.round(lead)} s ahead!` : lead < -0.5 ? ` 😈 Rex is ${Math.round(-lead)} s behind.` : ' 😈 Rex is right with you!';
    d.note.textContent = job ? `${job.what} for ${job.town}: ${job.left > 0 ? `${clock(job.left)} left` : 'late, but still wanted'}. Take it to town!${rex}`
      : world.welcome ?? '';
    const style = styleFor(this.app.planet), [icon, name] = CRAFT[style].split(' ');
    d.drive.textContent = job ? (air ? '🚙 By rover' : '🚗 By car') : air ? '🚙 Drive the rover' : '🚗 Take a car';
    d.drive.classList.toggle('hidden', !!this.app.planet.world?.giant); // (no ground to drive on)
    d.fly.textContent = job ? `${icon} By ${name.toLowerCase()}` : style === 'hopper' || style === 'ship' ? `${icon} ${name} courier` : '✈️ Sky Courier';
    super.show();
    clearTimeout(this.timer);
    if (job) return;
    this.timer = setTimeout(() => this.hide(), 15000);
    this.timer?.unref?.(); // (tests under Node needn't wait for it)
  }
}
