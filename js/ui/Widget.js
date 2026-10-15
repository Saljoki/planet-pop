/**
 * A piece of DOM UI built from an HTML string: it finds its parts by id, wires up their events, and shows and hides.
 * Panels, cards and bars extend it; full-screen menus extend Overlay (which extends this).
 */
export class Widget {
  /**
   * id: the element's id; className: its classes; html: what goes inside; parent: where it goes (#ui by default);
   * hidden: start hidden (the default).
   */
  constructor({ id, className = '', html = '', parent = null, tag = 'div', hidden = true }) {
    const el = (this.el = document.createElement(tag));
    el.id = id;
    el.className = className;
    if (hidden) el.classList.add('hidden');
    el.innerHTML = html;
    (parent ?? document.getElementById('ui')).append(el);
  }

  /** The child element with this id. */
  $(id) { return this.el.querySelector(`#${id}`); }

  /** Listen for `type` events on the child with this id. */
  on(id, type, fn) { this.$(id)?.addEventListener(type, fn); }

  get open() { return !this.el.classList.contains('hidden'); }
  show() { this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }
}
