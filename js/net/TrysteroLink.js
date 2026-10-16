const APP_ID = 'planet-pop-2026';

/**
 * A room over the internet: browsers find each other through public Nostr relays (Trystero, vendored and only loaded
 * when someone joins a room), then talk directly, peer to peer, over WebRTC. The room code doubles as the password,
 * so only people with the code can join. Same shape as TabLink.
 */
export class TrysteroLink {
  constructor() {
    this.room = null;
    this.actions = {};
  }

  async join(code) {
    const { joinRoom, selfId } = await import('trystero');
    this.self = selfId;
    this.room = joinRoom({ appId: APP_ID, password: code }, code);
    for (const type of ['hi', 'st']) {
      const action = (this.actions[type] = this.room.makeAction(type));
      action.onMessage = (data, { peerId }) => this.onMessage?.(peerId, type, data);
    }
    this.room.onPeerJoin = (peer) => this.onJoin?.(peer);
    this.room.onPeerLeave = (peer) => this.onLeave?.(peer);
  }

  send(type, data, to = null) {
    this.actions[type]?.send(data, to ? { target: to } : undefined).catch(() => {}); // (a peer that just left)
  }

  leave() {
    this.room?.leave().catch(() => {});
    this.room = null;
    this.actions = {};
  }
}
