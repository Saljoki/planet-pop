import { MISSIONS } from '../Missions.js';
import { themeOf } from '../../world/Themes.js';
import { Overlay } from '../../ui/Overlay.js';

/** The list of missions: done, next up, or locked until the one before it is done. */
export class MissionBoard extends Overlay {
  constructor(app, progress, onPlay) {
    super({ id: 'missions', html: `
      <button class="close" id="mClose" title="Close">✕</button>
      <h2>🎯 Missions</h2>
      <div class="coins" id="mCount"></div>
      <div id="mList"></div>` });
    this.app = app;
    this.progress = progress;
    this.list = this.$('mList');
    this.count = this.$('mCount');
    this.on('mClose', 'click', () => this.hide());
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-play]');
      if (!b || b.disabled) return;
      this.hide();
      onPlay(MISSIONS.find((m) => m.id === b.dataset.play));
    });
  }

  show() { this.render(); super.show(); }

  render() {
    const p = this.progress, done = MISSIONS.filter((m) => p.missionDone(m.id)).length;
    this.count.textContent = `${done} of ${MISSIONS.length} complete`;
    this.list.innerHTML = MISSIONS.map((m, i) => {
      const state = p.missionDone(m.id) ? 'done' : p.missionUnlocked(i) ? 'open' : 'locked', world = themeOf(m.planet.theme);
      const btn = state === 'locked' ? '<button disabled>🔒</button>'
        : `<button data-play="${m.id}" class="${state === 'open' ? 'big' : ''}">${state === 'done' ? '↻ Again' : '▶ Fly'}</button>`;
      return `<div class="mission ${state}"><span class="icon">${state === 'done' ? '✅' : m.icon}</span>
        <div class="info">${i + 1}. ${m.name}<small>${m.brief} · ${world.icon} ${world.name} · 🪙 ${m.reward}${
          state === 'done' ? ' (earned)' : ''}</small></div>${btn}</div>`;
    }).join('');
  }
}
