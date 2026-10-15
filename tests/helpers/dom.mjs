// Minimal browser stand-ins so the game modules run under Node (no real DOM or WebGL needed).
const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : (t[k] ?? (() => {}))),
  set: (t, k, v) => { t[k] = v; return true; },
});

export function fakeEl(tag = 'div') {
  const el = {
    tagName: tag.toUpperCase(), style: {}, children: [], dataset: {}, textContent: '', innerHTML: '', value: '1', checked: true,
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      toggle(c, on) { (on ?? !this._s.has(c)) ? this._s.add(c) : this._s.delete(c); },
      contains(c) { return this._s.has(c); },
    },
    addEventListener() {}, dispatchEvent() {}, setPointerCapture() {}, prepend() {}, insertAdjacentHTML(at, html) { this.innerHTML += html; },
    append(c) { c.parent = this; this.children.push(c); },
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((x) => x !== this); this.parent = null; } },
    querySelector: () => fakeEl(), querySelectorAll: () => [], _first: null,
    get firstElementChild() { return this.children[0] ?? (this._first ??= fakeEl()); },
    offsetWidth: 0, getContext: () => ctx2d, width: 0, height: 0,
  };
  Object.defineProperty(el, 'className', { // like the real thing: setting it replaces the class list
    get() { return [...el.classList._s].join(' '); },
    set(v) { el.classList._s = new Set(String(v).split(/\s+/).filter(Boolean)); },
  });
  return el;
}

const els = {};
const store = new Map();
globalThis.document = {
  createElement: (t) => fakeEl(t),
  getElementById: (id) => (els[id] ??= fakeEl()),
  querySelectorAll: () => [],
  body: fakeEl('body'),
};
globalThis.window = globalThis;
globalThis.innerWidth = 1280;
globalThis.innerHeight = 800;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.matchMedia = () => ({ matches: false });
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

// Node has no Web Workers, so the terrain build falls back to the main thread; that's expected here.
const warn = console.warn;
console.warn = (...a) => { if (!String(a[0]).includes('Terrain worker unavailable')) warn(...a); };
