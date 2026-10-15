const TAP_MS = 450, TAP_MOVE = 8, DOUBLE_MS = 260, DOUBLE_DIST = 40, HOLD_MS = 520, LOCK = 14;

/** Signed smallest difference between two angles. */
const turnBetween = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

/**
 * Turns pointer events on the canvas into camera gestures and hands them to `h`:
 *   one finger / left mouse drag → h.drag(dx, dy)        pinch / wheel → h.zoom(factor)
 *   two-finger twist / right-drag sideways → h.twist(rad) two fingers dragged up/down / right-drag → h.tilt(dy)
 *   tap → h.tap(x, y)   double-tap (touch) → h.doubleTap(x, y)   press and hold → h.hold(x, y)
 *   mouse move → h.hover(x, y), leaving the canvas → h.leave(), any input → h.input()
 * A two-finger gesture locks to either pinch-and-twist or tilt once it has moved a little, so they don't mix.
 */
export class Gestures {
  constructor(el, h) {
    this.el = el;
    this.h = h;
    this.pointers = new Map();
    this.press = null;     // the first finger down, for taps and holds
    this.two = null;       // two-finger gesture state
    this.lastTap = null;   // a touch tap waiting to see if a second one follows
    this.mouseTilt = false;
    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e));
    el.addEventListener('pointerleave', () => h.leave?.());
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { e.preventDefault(); h.input?.(); h.zoom(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
  }

  /** Fingers (or mouse buttons) currently down. */
  get count() { return this.pointers.size; }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, type: e.pointerType });
    this.h.input?.();
    this.mouseTilt = e.pointerType === 'mouse' && e.button === 2;
    clearTimeout(this.holdTimer);
    if (this.count === 1) {
      this.press = { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, held: false, type: e.pointerType };
      this.holdTimer = setTimeout(() => this.fireHold(), HOLD_MS);
    } else {
      if (this.press) this.press.moved = true; // a second finger: no tap, no hold
      this.two = this.count === 2 ? this.startTwo() : null;
    }
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) { if (e.pointerType === 'mouse') this.h.hover?.(e.clientX, e.clientY); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.press && Math.hypot(e.clientX - this.press.x, e.clientY - this.press.y) > TAP_MOVE) {
      this.press.moved = true;
      clearTimeout(this.holdTimer);
    }
    if (this.count === 2 && this.two) { this.twoFinger(); return; }
    if (this.count !== 1) return;
    if (this.mouseTilt) { this.h.twist(dx * 0.006); this.h.tilt(dy); return; }
    this.h.drag(dx, dy);
  }

  up(e) {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    clearTimeout(this.holdTimer);
    const p = this.press;
    if (e.type === 'pointerup' && p && !p.moved && !p.held && this.count === 0 && performance.now() - p.t < TAP_MS) this.tapAt(e.clientX, e.clientY, p.type);
    if (this.count === 0) this.press = null;
    this.two = this.count === 2 ? this.startTwo() : null;
  }

  startTwo() {
    const s = this.shape();
    return { ...s, start: s, lock: null };
  }

  /** Mouse clicks act at once; touch taps wait a moment in case a second tap makes it a double-tap. */
  tapAt(x, y, type) {
    if (type === 'mouse') { this.h.tap(x, y); return; }
    const last = this.lastTap;
    if (last && performance.now() - last.t < DOUBLE_MS && Math.hypot(x - last.x, y - last.y) < DOUBLE_DIST) {
      clearTimeout(last.timer);
      this.lastTap = null;
      this.h.doubleTap?.(x, y);
      return;
    }
    const tap = { x, y, t: performance.now() };
    tap.timer = setTimeout(() => { if (this.lastTap === tap) this.lastTap = null; this.h.tap(x, y); }, DOUBLE_MS);
    this.lastTap = tap;
  }

  fireHold() {
    const p = this.press;
    if (!p || p.moved || this.count !== 1) return;
    p.held = true;
    this.h.hold?.(p.x, p.y);
  }

  /** Midpoint, spread and angle of the two fingers. */
  shape() {
    const [a, b] = [...this.pointers.values()];
    return { mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, ang: Math.atan2(b.y - a.y, b.x - a.x) };
  }

  twoFinger() {
    const s = this.shape(), t = this.two;
    const dAng = turnBetween(t.ang, s.ang), dMy = s.my - t.my;
    if (!t.lock) { // decide what this gesture is once the fingers have moved a little from where they started
      const s0 = t.start, pinchish = Math.abs(s.dist - s0.dist) + Math.abs(turnBetween(s0.ang, s.ang)) * s.dist * 0.5, tiltish = Math.abs(s.my - s0.my);
      if (pinchish + tiltish > LOCK) t.lock = tiltish > pinchish * 1.5 ? 'tilt' : 'pinch';
    }
    if (t.lock === 'pinch') {
      this.h.zoom(t.dist / s.dist);
      this.h.twist(dAng);
    } else if (t.lock === 'tilt') this.h.tilt(dMy);
    Object.assign(t, { mx: s.mx, my: s.my, dist: s.dist, ang: s.ang });
  }
}
