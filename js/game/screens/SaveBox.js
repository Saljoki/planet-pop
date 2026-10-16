import { makeSaveCode, readSaveCode, applySave } from '../../core/SaveCode.js';
import { keepSaves } from '../../core/Store.js';
import { Widget } from '../../ui/Widget.js';

const LOADED = 'planetpop.justLoaded'; // (sessionStorage: says "save loaded" once the page has reloaded)

/**
 * 💾 Your progress, in Options: copy a save code or save a file, and load one from another phone or browser (which
 * replaces the progress here, after a second tap, then reloads the game). Progress already saves itself in this
 * browser; this is for moving it, or keeping a copy.
 */
export class SaveBox extends Widget {
  constructor(app, parent) {
    super({ id: 'saveBox', className: 'saves', parent, hidden: false, html: `
      <div class="pair"><button id="svCopy">📋 Copy save code</button><button id="svFile">💾 Save to a file</button></div>
      <textarea id="svCode" rows="2" placeholder="Paste a save code here to load it" spellcheck="false" autocomplete="off"></textarea>
      <div class="pair"><button id="svLoad">📥 Load this code</button><button id="svOpen">📂 Load a file</button></div>
      <input id="svPick" type="file" accept=".txt,text/plain" class="hidden">
      <small class="note" id="svNote">Your progress saves itself in this browser. Use a save code or file to move it to another phone or browser.</small>` });
    this.app = app;
    this.reload = () => location.reload();
    this.code = this.$('svCode');
    this.note = this.$('svNote');
    this.on('svCopy', 'click', () => this.copy());
    this.on('svFile', 'click', () => this.download());
    this.on('svLoad', 'click', () => this.load(this.code.value));
    this.on('svOpen', 'click', () => this.$('svPick').click());
    this.on('svPick', 'change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (file) this.load(await file.text(), true);
    });
    this.on('svCode', 'input', () => this.disarm());
  }

  say(text) { this.note.textContent = text; }

  disarm() {
    this.pending = null;
    this.$('svLoad').textContent = '📥 Load this code';
  }

  async copy() {
    const code = await makeSaveCode();
    keepSaves();
    try {
      await navigator.clipboard.writeText(code);
      this.say('📋 Save code copied. Paste it into Options → Load on the other phone or browser.');
    } catch {
      this.code.value = code; // no clipboard: show it to copy by hand
      this.say('Here’s your save code: copy it from the box above.');
    }
  }

  async download() {
    const code = await makeSaveCode(), a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([code], { type: 'text/plain' }));
    a.download = `planet-pop-save-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    keepSaves();
    this.say('💾 Saved. Load that file in Options on the other phone or browser.');
  }

  /** Check a code; a second tap (or a file, which is chosen on purpose) replaces the progress here and reloads. */
  async load(text, sure = false) {
    let data;
    try { data = await readSaveCode(text); } catch (err) { this.disarm(); this.say(`⚠️ ${err.message}`); return false; }
    if (!sure && this.pending !== text) {
      this.pending = text;
      this.$('svLoad').textContent = '⚠️ Tap again to replace your progress';
      this.say('Loading this save replaces the coins, upgrades, missions, trophies and options here.');
      return false;
    }
    applySave(data);
    await keepSaves();
    try { sessionStorage.setItem(LOADED, '1'); } catch { /* fine without the toast */ }
    this.reload();
    return true;
  }

  /** After the reload: say the save was loaded (once). */
  static welcome(hud) {
    try {
      if (sessionStorage.getItem(LOADED) !== '1') return;
      sessionStorage.removeItem(LOADED);
      hud.toast('💾 Save loaded. Welcome back!');
    } catch { /* no session storage */ }
  }
}
