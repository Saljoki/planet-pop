import { Widget } from './Widget.js';

/**
 * After a trip lands: welcome to the world, what's different about it, and a way to carry on in its own vehicle
 * (from the spaceport) or start a courier run there. Goes away by itself after a while.
 */
export class LandedCard extends Widget {
  constructor(app) {
    super({ id: 'landed', className: 'panel', html: `<div class="iHead"><span id="lIcon"></span><div><b id="lName"></b><small id="lNote"></small></div>
      <button id="lClose">✕</button></div><div class="row"><button id="lDrive" class="big drive"></button><button id="lFly" class="big"></button></div>` });
    this.app = app;
    this.on('lClose', 'click', () => this.hide());
    this.on('lDrive', 'click', () => { this.hide(); app.game.launch({ drive: 'car', from: 'pad' }); });
    this.on('lFly', 'click', () => { this.hide(); app.game.launch(); });
  }

  show(world) {
    const air = this.app.planet?.theme.air, $ = (id) => this.$(id);
    $('lIcon').textContent = world.icon;
    $('lName').textContent = `Welcome to ${world.name}!`;
    $('lNote').textContent = world.gravity === 1 ? 'Home sweet home.'
      : `Gravity here is ${world.gravity} of Earth’s: everything falls slower, so crests send you flying.`;
    $('lDrive').textContent = air ? '🚙 Drive the rover' : '🚗 Take a car';
    $('lFly').textContent = air === 'none' ? '🚀 Hopper courier' : '✈️ Sky Courier';
    super.show();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.hide(), 15000);
    this.timer?.unref?.(); // (tests under Node needn't wait for it)
  }
}
