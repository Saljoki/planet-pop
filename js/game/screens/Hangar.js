import { UPGRADES, SKINS } from '../Progress.js';
import { todayKey, dailyPlace } from '../Daily.js';
import { Overlay } from '../../ui/Overlay.js';

/**
 * Between-run screen: spend coins on upgrades and paint jobs, then take off: a courier run, a mission, the daily or
 * free flight, hit the road (the road trips), or take parcels to other worlds (the space courier).
 */
export class Hangar extends Overlay {
  constructor(app, progress, { onFly, onFree, onDaily, onMissions, onRoads, onSpace, onOptions }) {
    super({ id: 'hangar', html: `
      <button id="hClose" class="close" title="Close">✕</button>
      <button id="hOptions" class="opts" title="Options">⚙️</button>
      <h2>🛠️ Hangar</h2>
      <label class="who" title="Your name, for your results and the daily share">🧑‍✈️<input id="hName" type="text" maxlength="16" placeholder="Your name?" autocomplete="nickname" enterkeyhint="done"></label>
      <div class="coins" id="hCoins"></div>
      <div id="hUpgrades"></div>
      <h3>Paint jobs</h3>
      <div id="hSkins" class="skins"></div>
      <div class="hfoot">
        <div class="hrow"><button id="hGo" class="big">📦 Courier run</button><button id="hMissions" class="big missions">🎯 Missions</button>
          <button id="hDaily" class="big daily">📅 Daily</button><button id="hFree" class="big free">🕊️ Free flight</button>
          <button id="hRoads" class="big roads">🚗 Road trips</button><button id="hSpace" class="big space">🚀 Space courier</button></div>
        <p class="note" id="hDailyNote"></p>
      </div>` });
    this.app = app;
    this.progress = progress;
    const $ = (id) => this.$(id);
    this.dom = { coins: $('hCoins'), ups: $('hUpgrades'), skins: $('hSkins'), dailyNote: $('hDailyNote') };
    const go = (fn) => () => { this.hide(); fn?.(); };
    this.on('hGo', 'click', go(onFly));
    this.on('hDaily', 'click', go(onDaily));
    this.on('hFree', 'click', go(onFree));
    this.on('hMissions', 'click', go(onMissions));
    this.on('hRoads', 'click', go(onRoads));
    this.on('hSpace', 'click', go(onSpace));
    this.on('hOptions', 'click', go(onOptions));
    this.on('hClose', 'click', () => this.hide());
    const name = (this.nameInput = $('hName')), s = app.settings;
    name.addEventListener('change', () => { s.setPlayerName(name.value); name.value = s.playerName; this.greet(); });
    name.addEventListener('keydown', (e) => { if (e.key === 'Enter') name.blur(); });
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-buy], button[data-skin]');
      if (!b || b.disabled) return;
      if (b.dataset.buy) this.buy(b.dataset.buy);
      else this.pickSkin(b.dataset.skin);
    });
  }

  show() {
    this.nameInput.value = this.app.settings.playerName;
    this.render();
    super.show();
  }

  hide() {
    if (this.open) this.app.settings.setPlayerName(this.nameInput.value); // (in case it's closed while typing)
    super.hide();
  }

  /** A hello when the player has just given their name. */
  greet() {
    const n = this.app.settings.playerName;
    if (n && n !== this.greeted) this.app.hud.toast(`👋 Hi, ${n}! Ready to fly?`);
    this.greeted = n;
  }

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
    this.dom.dailyNote.textContent = `Daily: today's planet (${dailyPlace()}) and route, same for everyone, flown in the stock plane. ${
      today === null ? 'Not flown yet today.' : `Your best today: ⭐ ${today}`} Free flight: no clock, no parcels, no coins.`;
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
