import * as THREE from 'three';

const _t = new THREE.Vector3(), _s = new THREE.Vector3();

/**
 * Sky Courier's heads-up display, in the game layer: the badges along the top (score, time, combo, coins and a mode
 * badge), the arrow, the goal line, the boost bar, the ⏸ button, Rex's name tag and the help line. The run fills in
 * what they say each frame (Run.hud); this shows the right pieces for the run and does the common bits.
 */
export class CourierHud {
  constructor(game) {
    this.game = game;
    game.el.insertAdjacentHTML('beforeend', `
      <div id="gStats"><div class="badge hidden" id="gDaily">📅<span class="wide"> Daily</span></div><div class="badge hidden" id="gMission"></div><div class="badge hidden" id="gFree"></div><div class="badge" id="gScore"></div><div class="badge" id="gTime"></div><div class="badge" id="gCombo"></div><div class="badge" id="gCoins"></div></div>
      <button id="gPauseBtn" title="Pause (P)">⏸</button>
      <div id="gRival" class="tag hidden">😈 Rex</div>
      <svg id="gArrow" viewBox="0 0 70 70"><polygon points="35,5 61,58 35,45 9,58" fill="#ff5fa2" stroke="#1b1530" stroke-width="5" stroke-linejoin="round"/></svg>
      <div id="gGoal" class="badge"></div>
      <div id="gBoost" class="badge"><div></div></div>
      <div id="gHelp" class="badge">←/→ steer · ↑/↓ climb · Space boost · P pause · Esc quit</div>
      <button id="gBoostBtn">BOOST</button>`);
    const $ = (id) => game.el.querySelector(`#${id}`);
    this.dom = {
      daily: $('gDaily'), mission: $('gMission'), free: $('gFree'), rival: $('gRival'),
      score: $('gScore'), time: $('gTime'), combo: $('gCombo'), coins: $('gCoins'), arrow: $('gArrow'), goal: $('gGoal'),
      boost: $('gBoost').firstElementChild, help: $('gHelp'), boostBtn: $('gBoostBtn'),
    };
    this.dom.stats = [this.dom.score, this.dom.time, this.dom.combo, this.dom.coins];
    // phones get the BOOST button instead of the keyboard help
    this.dom.boostBtn.classList.toggle('hidden', !game.touch);
    this.dom.help.classList.toggle('hidden', game.touch);
    $('gPauseBtn').addEventListener('click', () => { if (!game.over && !game.app.paused) game.app.togglePause(); });
  }

  /** Show the pieces this run uses (see Run.layout). */
  setLayout({ badge, stats, arrow }) {
    const d = this.dom, invert = this.game.app.settings?.get('invertY');
    for (const k of ['daily', 'mission', 'free']) d[k].classList.toggle('hidden', badge !== k);
    for (const b of d.stats) b.classList.toggle('hidden', !stats);
    d.arrow.classList.toggle('hidden', !arrow);
    d.help.textContent = `←/→ steer · ↑/↓ ${invert ? 'dive / climb (inverted)' : 'climb / dive'} · Space boost · P pause · Esc quit`;
  }

  update() {
    const g = this.game;
    this.dom.boost.style.width = `${Math.round(g.player.boost * 100)}%`;
    g.run.hud(this);
  }

  /** Turn the arrow toward a point on the planet (a unit vector), as seen from the plane. */
  pointAt(c) {
    const pl = this.game.player;
    _t.copy(c).addScaledVector(pl.up, -c.dot(pl.up)); // direction to the target along the ground
    _s.crossVectors(pl.up, pl.fwd);                    // the plane's left
    this.dom.arrow.style.transform = `rotate(${-Math.atan2(_t.dot(_s), _t.dot(pl.fwd))}rad)`;
  }
}
