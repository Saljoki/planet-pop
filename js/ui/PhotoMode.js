const FRAMES = [['none', 'No frame'], ['comic', 'Comic'], ['polaroid', 'Polaroid']];
const FILTERS = [['normal', 'Normal', 'none'], ['pop', 'Pop', 'saturate(1.6) contrast(1.1)'],
  ['retro', 'Retro', 'sepia(0.6) saturate(1.3) hue-rotate(-10deg)'], ['noir', 'Noir', 'grayscale(1) contrast(1.35)']];
const INK = '#1b1530', FONT = "'Bangers', Impact, sans-serif";

/**
 * Photo mode: the interface steps aside, the world can be frozen, and you frame a shot with a live preview of
 * the border, caption and colour filter. Snap renders the picture at full resolution for saving or sharing.
 */
export class PhotoMode {
  constructor(app) {
    this.app = app;
    this.active = false;
    this.opts = { frame: 'comic', filter: 'normal', caption: '' };
    this.buildDom();
    addEventListener('keydown', (e) => {
      if (['INPUT', 'SELECT'].includes(e.target.tagName)) return;
      if (e.code === 'KeyC' && !app.game.active) { this.active ? this.exit() : this.enter(); }
      else if (e.code === 'Escape' && this.active) { e.stopImmediatePropagation(); this.preview.classList.contains('hidden') ? this.exit() : this.closePreview(); }
    }, true); // capture: Esc leaves photo mode instead of letting go of the camera
  }

  buildDom() {
    const el = (this.el = document.createElement('div'));
    el.id = 'photo';
    el.className = 'hidden';
    const seg = (name, items) => `<div class="seg" data-opt="${name}">${items.map(([id, label]) => `<button data-v="${id}">${label}</button>`).join('')}</div>`;
    el.innerHTML = `
      <div id="photoFrame"></div>
      <div id="photoCaption" class="hidden"></div>
      <div id="photoBar" class="panel">
        ${seg('frame', FRAMES)}${seg('filter', FILTERS)}
        <input id="photoText" type="text" maxlength="60" placeholder="Add a caption…">
        <button id="photoFreeze">⏸ Frozen</button>
        <button id="photoSnap" class="big">📸 Snap</button>
        <button id="photoExit">✕</button>
        <small>Drag to frame the shot · click anything to fly to it · C or Esc to leave</small>
      </div>
      <div id="photoPreview" class="overlay hidden"><div class="panel">
        <img id="photoImg" alt="Your photo">
        <div class="hrow"><a id="photoSave" class="button big" download="planet-pop.png">⬇️ Save</a>
          <button id="photoShare">📤 Share</button><button id="photoBack">Back</button></div>
      </div></div>`;
    document.getElementById('ui').append(el);
    const $ = (id) => el.querySelector('#' + id);
    this.preview = $('photoPreview');
    this.dom = { frame: $('photoFrame'), caption: $('photoCaption'), text: $('photoText'), freeze: $('photoFreeze'), img: $('photoImg'), save: $('photoSave'), share: $('photoShare') };
    el.querySelectorAll('.seg').forEach((s) => s.addEventListener('click', (e) => {
      const b = e.target.closest?.('button');
      if (b) { this.opts[s.dataset.opt] = b.dataset.v; this.refresh(); }
    }));
    $('photoText').addEventListener('input', (e) => { this.opts.caption = e.target.value; this.refresh(); });
    $('photoFreeze').addEventListener('click', () => { this.app.togglePause(); this.refresh(); });
    $('photoSnap').addEventListener('click', () => this.snap());
    $('photoExit').addEventListener('click', () => this.exit());
    $('photoBack').addEventListener('click', () => this.closePreview());
    $('photoShare').addEventListener('click', () => this.share());
    this.refresh();
  }

  enter() {
    const app = this.app;
    if (this.active || app.game.active || !app.planet) return;
    this.active = true;
    this.wasPaused = app.paused;
    if (!app.paused) app.togglePause(); // freeze the moment; the Frozen button lets it run again
    document.body.classList.add('photo');
    this.el.classList.remove('hidden');
    app.hud.hideLabel();
    this.refresh();
  }

  exit() {
    const app = this.app;
    if (!this.active) return;
    this.active = false;
    this.closePreview();
    if (app.paused !== this.wasPaused) app.togglePause();
    document.body.classList.remove('photo');
    this.el.classList.add('hidden');
    app.renderer.domElement.style.filter = '';
  }

  /** Live preview of the border, caption and filter on top of the 3D view. */
  refresh() {
    const o = this.opts, d = this.dom;
    this.el.querySelectorAll('.seg').forEach((s) => s.querySelectorAll('button').forEach((b) => b.classList.toggle('on', o[s.dataset.opt] === b.dataset.v)));
    d.frame.className = `frame-${o.frame}`;
    d.caption.className = `cap-${o.frame}${o.caption.trim() ? '' : ' hidden'}`;
    d.caption.textContent = o.caption;
    if (document.activeElement !== d.text) d.text.value = o.caption;
    d.freeze.textContent = this.app.paused ? '⏸ Frozen' : '▶ Live';
    if (this.active) this.app.renderer.domElement.style.filter = FILTERS.find((f) => f[0] === o.filter)[2];
  }

  /** Grab the next rendered frame and turn it into the finished picture. */
  snap() {
    const app = this.app;
    app.sfx.play('shutter');
    app.hud.flash();
    app.onRendered = (canvas) => {
      const photo = this.compose(canvas);
      photo.toBlob((blob) => this.show(blob), 'image/png');
    };
  }

  compose(src) {
    const o = this.opts, W = src.width, H = src.height, u = Math.min(W, H) / 100; // u: 1% of the short side
    const pad = o.frame === 'comic' ? 3 * u : o.frame === 'polaroid' ? 4 * u : 0, bottom = o.frame === 'polaroid' ? 16 * u : pad;
    const out = document.createElement('canvas');
    out.width = W + pad * 2;
    out.height = H + pad + bottom;
    const g = out.getContext('2d');
    g.fillStyle = o.frame === 'polaroid' ? '#fffdf6' : '#ffffff';
    g.fillRect(0, 0, out.width, out.height);
    const css = FILTERS.find((f) => f[0] === o.filter)[2], shot = withSpace(src);
    g.filter = css;
    g.drawImage(shot, pad, pad);
    g.filter = 'none';
    if (css !== 'none' && !('filter' in CanvasRenderingContext2D.prototype)) applyFilterByHand(g, pad, pad, W, H, o.filter); // e.g. older Safari
    if (o.frame === 'comic') {
      g.lineWidth = 0.9 * u;
      g.strokeStyle = INK;
      g.strokeRect(pad, pad, W, H);
    }
    const text = o.caption.trim();
    if (text && o.frame === 'polaroid') {
      g.fillStyle = INK;
      g.font = `${7 * u}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text, out.width / 2, H + pad + bottom / 2, W * 0.9);
    } else if (text) {
      drawCaption(g, text, pad + 3 * u, pad + 3 * u, u, o.frame === 'comic');
    }
    const p = this.app.planet, tag = `PLANET POP! · ${p.theme.name.toUpperCase()} · SEED ${p.params.seed}`;
    g.font = `${2.8 * u}px ${FONT}`;
    g.textAlign = 'right';
    g.textBaseline = 'alphabetic';
    g.lineWidth = 0.35 * u;
    g.strokeStyle = o.frame === 'polaroid' ? 'transparent' : INK;
    g.fillStyle = o.frame === 'polaroid' ? '#8a7f9e' : '#ffd23f';
    const tx = out.width - pad - 2 * u, ty = o.frame === 'polaroid' ? out.height - 2 * u : pad + H - 2 * u;
    g.strokeText(tag, tx, ty);
    g.fillText(tag, tx, ty);
    return out;
  }

  show(blob) {
    if (!blob) return;
    URL.revokeObjectURL(this.url);
    this.blob = blob;
    this.url = URL.createObjectURL(blob);
    this.dom.img.src = this.url;
    this.dom.save.href = this.url;
    this.dom.save.download = `planet-pop-${this.app.planet.params.seed}.png`;
    this.dom.share.classList.toggle('hidden', !navigator.canShare?.({ files: [new File([blob], 'x.png', { type: 'image/png' })] }));
    this.preview.classList.remove('hidden');
    this.app.achievements.unlock('photographer');
  }

  async share() {
    const file = new File([this.blob], this.dom.save.download, { type: 'image/png' });
    try { await navigator.share({ files: [file], title: 'Planet Pop!' }); } catch { /* cancelled */ }
  }

  closePreview() { this.preview.classList.add('hidden'); }
}

/**
 * The 3D canvas is transparent where there's space: the starry purple backdrop is the page's own CSS.
 * Paint the same backdrop (gradient and dot screen) behind the render so the photo looks like the screen.
 */
function withSpace(src) {
  const W = src.width, H = src.height, c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d'), r = Math.hypot(W, H) * 0.75;
  const bg = g.createRadialGradient(W * 0.3, H * 0.25, 0, W * 0.3, H * 0.25, r);
  bg.addColorStop(0, '#5a35a8');
  bg.addColorStop(0.45, '#261659');
  bg.addColorStop(1, '#0c0824');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const step = Math.max(6, Math.round(H / 110));
  g.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) g.fillRect(x - 1, y - 1, 2, 2);
  g.drawImage(src, 0, 0);
  return c;
}

/** Speech bubble (or a comic narration box) with the caption, top left. */
function drawCaption(g, text, x, y, u, box) {
  g.font = `${5 * u}px ${FONT}`;
  const w = g.measureText(text).width + 6 * u, h = 9 * u;
  g.lineWidth = 0.7 * u;
  g.strokeStyle = INK;
  g.fillStyle = box ? '#ffd23f' : '#ffffff';
  g.beginPath();
  if (box) g.rect(x, y, w, h);
  else {
    g.roundRect(x, y, w, h, 4 * u);
    g.moveTo(x + 6 * u, y + h - 0.2 * u); // the bubble's tail
    g.lineTo(x + 5 * u, y + h + 4 * u);
    g.lineTo(x + 11 * u, y + h - 0.2 * u);
  }
  g.fill();
  g.stroke();
  if (!box) { g.fillRect(x + 6.4 * u, y + h - 1.2 * u, 4.2 * u, 1.4 * u); } // hide the seam between bubble and tail
  g.fillStyle = INK;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(text, x + 3 * u, y + h / 2 + 0.3 * u);
}

/** Pixel-by-pixel versions of the filters, for browsers whose canvas ignores ctx.filter. */
function applyFilterByHand(g, x, y, w, h, kind) {
  const img = g.getImageData(x, y, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i], gr = d[i + 1], b = d[i + 2];
    const l = 0.3 * r + 0.59 * gr + 0.11 * b;
    if (kind === 'noir') { const v = Math.min(255, Math.max(0, (l - 128) * 1.35 + 128)); r = gr = b = v; }
    else if (kind === 'retro') { r = 0.4 * r + 0.6 * Math.min(255, l * 1.07 + 20); gr = 0.4 * gr + 0.6 * l * 0.95; b = 0.4 * b + 0.6 * l * 0.75; }
    else if (kind === 'pop') { r = l + (r - l) * 1.6; gr = l + (gr - l) * 1.6; b = l + (b - l) * 1.6; }
    d[i] = r; d[i + 1] = gr; d[i + 2] = b;
  }
  g.putImageData(img, x, y);
}
