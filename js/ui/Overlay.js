import { Widget } from './Widget.js';

const stack = []; // open overlays, topmost last

// Esc goes to the topmost open overlay only (Options over the briefing closes Options, not both).
addEventListener('keydown', (e) => {
  const top = stack.at(-1);
  if (e.code !== 'Escape' || !top?.escapes) return;
  e.stopImmediatePropagation();
  top.escape();
}, true);

/**
 * A full-screen menu over everything (the hangar, the briefing, Options…): a dimmed backdrop with a panel in the
 * middle. Overlays always take clicks, even inside the click-through game layer. Esc calls escape(), which closes it
 * unless a subclass knows better; pass `escapes: false` to leave Esc to the game (the pause menu, results).
 */
export class Overlay extends Widget {
  constructor({ id, html, parent = null, escapes = true, panelClass = '' }) {
    super({ id, className: 'overlay', html: `<div class="panel ${panelClass}">${html}</div>`, parent });
    this.escapes = escapes;
  }

  show() {
    if (!stack.includes(this)) stack.push(this);
    super.show();
  }

  hide() {
    const i = stack.indexOf(this);
    if (i >= 0) stack.splice(i, 1);
    super.hide();
  }

  /** What Esc does while this is the topmost overlay. */
  escape() { this.hide(); }
}
