import { MISSIONS } from './Missions.js';
import { themeOf } from '../world/Themes.js';

/** The list of missions: done, next up, or locked until the one before it is done. */
export class MissionBoard {
  constructor(app, progress, onPlay) {
    this.app = app;
    this.progress = progress;
    const el = (this.el = document.createElement('div'));
    el.id = 'missions';
    el.className = 'overlay hidden';
    el.innerHTML = `<div class="panel">
      <button class="close" id="mClose" title="Close">✕</button>
      <h2>🎯 Missions</h2>
      <div class="coins" id="mCount"></div>
      <div id="mList"></div>
    </div>`;
    document.getElementById('ui').append(el);
    this.list = el.querySelector('#mList');
    this.count = el.querySelector('#mCount');
    el.querySelector('#mClose').addEventListener('click', () => this.hide());
    el.addEventListener('click', (e) => {
      const b = e.target.closest?.('button[data-play]');
      if (!b || b.disabled) return;
      this.hide();
      onPlay(MISSIONS.find((m) => m.id === b.dataset.play));
    });
    addEventListener('keydown', (e) => { if (e.code === 'Escape' && this.open) this.hide(); });
  }

  get open() { return !this.el.classList.contains('hidden'); }
  show() { this.render(); this.el.classList.remove('hidden'); }
  hide() { this.el.classList.add('hidden'); }

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
