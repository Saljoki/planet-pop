import * as THREE from 'three';
import { LAYER_FX, clamp, ease } from '../core/Geo.js';

const PITCH = 1.48, FAR = 2600;
const _o = new THREE.Vector3();

/**
 * The system map's camera: it circles `target` at (yaw, pitch), `dist` away, and takes the same drags, pinches and
 * two-finger tilts as the planet view (CameraRig hands them over while the map is open). `focus` is the body it keeps
 * centred, even as it moves round the Sun; null for the Sun. glideTo() swoops to a new view.
 */
export class MapView {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 9000);
    this.camera.layers.enable(LAYER_FX);
    this.target = new THREE.Vector3();
    this.focus = null;
    this.yaw = 0.5;
    this.pitch = 0.9;
    this.dist = 300;
    this.glide = null;
    this.onZoomIn = null; // called when pinched in hard on the focus (the map uses it to go back down)
    this.push = 0;
    this.shift = { x: 0, y: 0, wantX: 0, wantY: 0 }; // CSS pixels the picture slides left and up (to clear a card)
  }

  /** The closest the camera comes to what it's looking at. */
  get minDist() { return this.focus ? this.focus.size * this.focus.scale * 2.4 : 14; }

  dragVelocity(dx, dy) { const s = 0.005; return [-dx * s, dy * s]; }
  spin(yaw, pitch) { this.yaw += yaw; this.pitch = clamp(this.pitch + pitch, -PITCH, PITCH); }
  twistBy() {}
  tiltBy(dy) { this.pitch = clamp(this.pitch + dy * 0.004, -PITCH, PITCH); }

  zoomBy(f) {
    this.stopGlide();
    const min = this.minDist;
    if (f < 1 && this.dist <= min * 1.001) { // pinched in on the focus: keep going and the map hands back to the world
      this.push += -Math.log(f);
      if (this.push > 0.35) { this.push = 0; this.onZoomIn?.(); }
      return;
    }
    this.push = 0;
    this.dist = clamp(this.dist * f, min, FAR);
  }

  /** Where the focus is now (the Sun's middle when there's none). */
  focusPos(out) { return this.focus ? out.copy(this.focus.pos) : out.set(0, 0, 0); }

  /** Swoop to look at `focus` (a body, or null for the Sun) from { dist, yaw, pitch } (any left out stay), over dur s. */
  glideTo(focus, to = {}, dur = 1.2, onDone = null) {
    const from = { dist: this.dist, yaw: this.yaw, pitch: this.pitch, target: this.target.clone() };
    if ('yaw' in to) to.yaw = from.yaw + ((((to.yaw - from.yaw + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
    this.focus = focus;
    this.glide = { from, to, t: 0, dur, onDone };
  }

  /** A pinch takes over from a glide (and whatever it was going to do at the end happens now). */
  stopGlide() {
    const g = this.glide;
    this.glide = null;
    g?.onDone?.();
  }

  /** Jump straight to a view. */
  set(focus, { dist, yaw = this.yaw, pitch = this.pitch }) {
    Object.assign(this, { focus, dist, yaw, pitch, glide: null });
    this.focusPos(this.target);
  }

  update(dt) {
    const g = this.glide;
    if (g) {
      g.t = Math.min(1, g.t + dt / g.dur);
      const e = ease(g.t), lerp = (a, b) => a + (b - a) * e;
      if ('dist' in g.to) this.dist = Math.exp(lerp(Math.log(g.from.dist), Math.log(g.to.dist))); // (even through big zooms)
      if ('yaw' in g.to) this.yaw = lerp(g.from.yaw, g.to.yaw);
      if ('pitch' in g.to) this.pitch = lerp(g.from.pitch, g.to.pitch);
      this.target.lerpVectors(g.from.target, this.focusPos(_o), e);
      if (g.t >= 1) { this.glide = null; g.onDone?.(); }
    } else {
      this.focusPos(this.target);
      this.dist = Math.max(this.dist, this.minDist);
    }
    const cam = this.camera, cp = Math.cos(this.pitch);
    cam.position.set(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.dist).add(this.target);
    cam.up.set(0, 1, 0);
    cam.lookAt(this.target);
    const aspect = innerWidth / innerHeight, near = clamp(this.dist * 0.01, 0.05, 20), s = this.shift, k = 1 - Math.exp(-dt * 6);
    const sx = s.x + (s.wantX - s.x) * k, sy = s.y + (s.wantY - s.y) * k, moved = Math.abs(sx - s.x) + Math.abs(sy - s.y) > 0.05;
    if (cam.aspect !== aspect || cam.near !== near || moved) {
      cam.aspect = aspect;
      cam.near = near;
      [s.x, s.y] = [sx, sy];
      if (Math.abs(sx) + Math.abs(sy) > 0.5) cam.setViewOffset(innerWidth, innerHeight, sx, sy, innerWidth, innerHeight);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
  }

  /** Keep what's in focus in the middle of the part of the screen a card leaves free (rect: the card's, or null). */
  clear(rect) {
    const s = this.shift;
    s.wantX = s.wantY = 0;
    if (!rect?.width) return;
    if (rect.left > innerWidth * 0.4) s.wantX = (innerWidth - rect.left) / 2; // a card down the right
    else s.wantY = (innerHeight - rect.top) / 2;                                // a card along the bottom
  }
}
