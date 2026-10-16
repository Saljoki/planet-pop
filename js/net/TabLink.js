/**
 * A room shared by tabs of this browser on this device (BroadcastChannel), for trying multiplayer without a second
 * phone or the internet: open the game twice with ?net=tabs. Same shape as TrysteroLink: join(code), send(type, data,
 * to), leave(), and the callbacks onJoin(peer), onLeave(peer), onMessage(peer, type, data).
 */
export class TabLink {
  constructor() {
    this.self = Math.random().toString(36).slice(2, 10);
    this.peers = new Set();
    this.channel = null;
  }

  async join(code) {
    this.channel = new BroadcastChannel(`planetpop-room-${code}`);
    this.channel.onmessage = (e) => this.receive(e.data);
    this.post({ type: 'knock' }); // (anyone already here hears from someone new and says hello)
  }

  receive(m) {
    if (!m || typeof m !== 'object' || m.from === this.self || (m.to && m.to !== this.self) || typeof m.from !== 'string') return;
    if (m.type === 'bye') {
      if (this.peers.delete(m.from)) this.onLeave?.(m.from);
      return;
    }
    if (!this.peers.has(m.from)) {
      this.peers.add(m.from);
      this.onJoin?.(m.from);
    }
    if (m.type !== 'knock') this.onMessage?.(m.from, m.type, m.data);
  }

  post(m) { this.channel?.postMessage({ ...m, from: this.self }); }

  send(type, data, to = null) { this.post({ type, data, to }); }

  leave() {
    this.post({ type: 'bye' });
    this.channel?.close();
    this.channel = null;
    this.peers.clear();
  }
}
