const RADIUS = 60, DEAD = 0.12;

/** Stick offset (px, screen y down) → { steer: -1 left … 1 right, climb: -1 down … 1 up }, with a small dead zone. */
export function stickAxes(dx, dy, radius = RADIUS) {
  const len = Math.hypot(dx, dy), k = len > radius ? radius / len : 1;
  const axis = (v) => {
    const a = (v * k) / radius;
    return Math.abs(a) < DEAD ? 0 : Math.sign(a) * (Math.abs(a) - DEAD) / (1 - DEAD);
  };
  return { steer: axis(dx) || 0, climb: -axis(dy) || 0 }; // (no -0)
}

/**
 * A floating thumbstick: put a thumb down anywhere in its zone (the left part of the screen) and drag to steer
 * and climb. The ring appears where the thumb landed; letting go recentres it.
 */
export class TouchStick {
  constructor(parent) {
    const zone = (this.zone = document.createElement('div'));
    zone.id = 'gStick';
    zone.innerHTML = '<div class="base hidden"><div class="knob"></div></div><div class="ghost">👆 Drag here to steer</div>';
    parent.append(zone);
    this.base = zone.querySelector('.base');
    this.knob = zone.querySelector('.knob');
    this.ghost = zone.querySelector('.ghost');
    this.id = null;
    this.steer = 0;
    this.climb = 0;
    zone.addEventListener('pointerdown', (e) => this.down(e));
    zone.addEventListener('pointermove', (e) => this.move(e));
    for (const ev of ['pointerup', 'pointercancel']) zone.addEventListener(ev, (e) => this.up(e));
  }

  down(e) {
    if (this.id !== null) return;
    e.preventDefault();
    this.zone.setPointerCapture?.(e.pointerId);
    this.id = e.pointerId;
    this.origin = { x: e.clientX, y: e.clientY };
    Object.assign(this.base.style, { left: `${e.clientX}px`, top: `${e.clientY}px` });
    this.base.classList.remove('hidden');
    this.ghost.classList.add('hidden'); // learnt: no need for the hint any more
    this.move(e);
  }

  move(e) {
    if (e.pointerId !== this.id) return;
    const dx = e.clientX - this.origin.x, dy = e.clientY - this.origin.y, len = Math.hypot(dx, dy), k = len > RADIUS ? RADIUS / len : 1;
    this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    Object.assign(this, stickAxes(dx, dy));
  }

  up(e) {
    if (e.pointerId !== this.id) return;
    this.reset();
  }

  reset() {
    this.id = null;
    this.steer = this.climb = 0;
    this.base.classList.add('hidden');
    this.knob.style.transform = '';
  }
}
