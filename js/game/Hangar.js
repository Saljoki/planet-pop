import { UPGRADES, SKINS } from './Progress.js';
import { todayKey } from './Daily.js';

/** Between-run screen: spend coins on upgrades and paint jobs, then take off (free flight or today's challenge). */
export class Hangar {
  constructor(app, progress, { onFly, onDaily }) {
    this.app = app;
    this.progress = progress;
    const el = (this.el = document.createElement('div'));
    el.id = 'hangar';
    el.className = 'overlay hidden';
    el.innerHTML = `<div class="panel">
      <button id="hClose" class="close" title="Close">✕</button>
      <h2>🛠️ Hangar</h2>
      <div class="coins" id="hCoins"></div>
      <div id="hUpgrades"></div>
      <h3>Paint jobs</h3>
      <div id="hSkins" class="skins"></div>
      <div class="hfoot">
        <div class="hrow"><button id="hGo" class="big">✈️ Free flight</button><button id="hDaily" class="big daily">📅 Daily challenge</button></div>
        <p class="note" id="hDailyNote"></p>
      </div>
    </div>`;
    document.getElementById('ui').append(el);
    const $ = (id) => el.querySelector('#' + id);
    this.dom = { coins: $('hCoins'), ups: $('hUpgrades'), skins: $('hSkins'), dailyNote: $('hDailyNote') };
    $('hGo').addEventListener('click', () => { this.hide(); onFly(); });
    $('hDaily').addEventListener('click', () => { this.hide(); onDaily(); });
    $('hClose').addEventListener('click', () => this.hide());
    el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-buy], button[data-skin]');
      if (!b || b.disabled) return;
      if (b.dataset.buy) this.buy(b.dataset.buy);
      else this.pickSkin(b.dataset.skin);
    });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.open) this.hide(); });
  }

  get open() { return !this.el.classList.contains('hidden'); }
  show() { this.render(); this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

  buy(id) {
    const ok = this.progress.buy(id);
    this.app.sfx.play(ok ? 'ring' : 'crash');
    if (ok) this.app.achievements.unlock('mechanic');
    this.render();
  }

  pickSkin(id) {
    const ok = this.progress.chooseSkin(id, this.app.achievements.done);
    this.app.sfx.play(ok ? 'ring' : 'crash');
    this.render();
  }

  render() {
    const p = this.progress, trophies = this.app.achievements.done, today = p.dailyBest(todayKey());
    this.dom.coins.innerHTML = `🪙 <b>${p.coins}</b> coins · best run ⭐ ${p.best}`;
    this.dom.dailyNote.textContent = `Daily: today's planet and route, same for everyone, flown in the stock plane. ${
      today === null ? 'Not flown yet today.' : `Your best today: ⭐ ${today}`}`;
    this.dom.ups.innerHTML = UPGRADES.map((u) => {
      const lvl = p.level(u.id), cost = p.nextCost(u.id);
      const pips = u.costs.map((_, i) => (i < lvl ? '●' : '○')).join('');
      const btn = cost == null
        ? '<button disabled>MAX</button>'
        : `<button data-buy="${u.id}" ${p.coins < cost ? 'disabled' : ''}>🪙 ${cost}</button>`;
      return `<div class="upg"><span class="icon">${u.icon}</span>
        <div class="info">${u.name} <span class="pips">${pips}</span><small>${u.desc}</small></div>${btn}</div>`;
    }).join('');
    this.dom.skins.innerHTML = SKINS.map((s) => {
      const state = p.skinState(s, trophies);
      const label = { equipped: '✔ Flying', owned: 'Equip', buy: `🪙 ${s.cost}`, locked: `🏆 ${s.trophyName}` }[state];
      const disabled = state === 'locked' || (state === 'buy' && p.coins < s.cost);
      return `<button class="skin ${state}" data-skin="${s.id}" ${disabled ? 'disabled' : ''}>
        <span class="swatch" style="background:${s.body};border-color:${s.trim}"></span>${s.name}<small>${label}</small></button>`;
    }).join('');
  }
}
