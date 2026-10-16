import { VERSION, REPO } from '../core/Version.js';
import { Overlay } from './Overlay.js';

/** ℹ️ About Planet Pop: the version, who made it, the credits, and the player's name. */
export class AboutCard extends Overlay {
  constructor(app) {
    super({ id: 'about', html: `
      <button class="close" id="abClose" title="Close">✕</button>
      <h2>🌍 Planet Pop</h2>
      <p class="ver">Version ${VERSION}</p>
      <p>A little cartoon planet that lives its own life: towns, traffic, trains, weather and wildlife.
        Fly parcels round it in Sky Courier, or take to its roads and seas.</p>
      <h3>Made by</h3>
      <p class="who">🧑‍💻 <b>Ata Ur Rehman</b> (Saljoki): idea, design and testing</p>
      <p class="who">🤖 <b>Claude</b> by Anthropic: writing the code, with Ata</p>
      <h3>Your name</h3>
      <label class="opt name"><input id="abName" type="text" maxlength="16" placeholder="Type your name" autocomplete="nickname" enterkeyhint="done">
        <small>For your results, the hangar and the daily share. Only kept in this browser.</small></label>
      <h3>Thanks to</h3>
      <p class="credits">three.js (MIT licence) for the 3D · the Bangers font by Vernon Adams (SIL Open Font Licence)</p>
      <p class="credits">Earth's continents: Natural Earth (public domain) · where the planets are: NASA JPL's orbit elements ·
        the numbers on each world's card: NASA's planetary fact sheet</p>
      <p class="credits"><a href="${REPO}" target="_blank" rel="noopener">📂 The source on GitHub</a></p>
      <button id="abDone" class="big">✔ Done</button>` });
    this.app = app;
    const name = (this.nameInput = this.$('abName'));
    name.addEventListener('change', () => { app.settings.setPlayerName(name.value); name.value = app.settings.playerName; });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
    this.on('abClose', 'click', () => this.hide());
    this.on('abDone', 'click', () => this.hide());
  }

  show() {
    this.nameInput.value = this.app.settings.playerName;
    super.show();
  }

  hide() {
    if (this.open) this.app.settings.setPlayerName(this.nameInput.value); // (in case it's closed while typing)
    super.hide();
  }
}
