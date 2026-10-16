import { Friends } from '../net/Friends.js';
import { Overlay } from './Overlay.js';
import { worldOf } from '../space/Worlds.js';

/**
 * 👥 Play with friends (the 👥 button): start a room or join one by its code, then share the invite link. In a room
 * it lists who's there and what they're up to, with 🌍 Go there for anyone on another planet, and Leave.
 */
export class FriendsMenu extends Overlay {
  constructor(app) {
    super({ id: 'friends', html: `
      <button class="close" id="frClose" title="Close">✕</button>
      <h2>👥 Play with friends</h2>
      <div id="frOut">
        <p>Fly and drive on the same planet as your friends: you'll see each other's planes, cars and boats with your
          names over them, and on the mini-map. Everyone plays their own game.</p>
        <label class="name">Your name<input id="frName" type="text" maxlength="16" placeholder="Type your name" autocomplete="nickname" enterkeyhint="done"></label>
        <button id="frStart" class="big">✨ Start a room</button>
        <div class="join"><input id="frCode" type="text" maxlength="40" placeholder="Room code" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="go"><button id="frJoin">Join</button></div>
      </div>
      <div id="frIn" class="hidden">
        <div class="room">Room <b id="frRoom"></b></div>
        <div class="pair"><button id="frCopy">🔗 Copy invite link</button><button id="frShare">📤 Share</button></div>
        <div id="frList"></div>
        <button id="frLeave" class="danger">🚪 Leave room</button>
      </div>
      <small class="note" id="frNote"></small>
      <button id="frDone" class="big">✔ Done</button>` });
    this.app = app;
    this.friends = app.friends;
    this.nameInput = this.$('frName');
    this.codeInput = this.$('frCode');
    this.list = this.$('frList');
    this.note = this.$('frNote');
    this.nameInput.addEventListener('change', () => { app.settings.setPlayerName(this.nameInput.value); this.nameInput.value = app.settings.playerName; });
    this.codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') this.join(); });
    this.on('frStart', 'click', () => this.start());
    this.on('frJoin', 'click', () => this.join());
    this.on('frCopy', 'click', () => this.copy());
    this.on('frShare', 'click', () => this.share());
    this.on('frLeave', 'click', () => this.friends.leave());
    this.on('frClose', 'click', () => this.hide());
    this.on('frDone', 'click', () => this.hide());
    this.list.addEventListener('click', (e) => {
      const peer = e.target.closest?.('button[data-go]')?.dataset.go;
      if (peer) { this.hide(); this.friends.goTo(peer); }
    });
    this.friends.onChange(() => this.render());
    this.render();
  }

  show() {
    this.nameInput.value = this.app.settings.playerName;
    this.render();
    super.show();
  }

  hide() {
    if (this.open) this.app.settings.setPlayerName(this.nameInput.value);
    super.hide();
  }

  /** A name first, so friends know who's who. */
  named() {
    this.app.settings.setPlayerName(this.nameInput.value);
    if (this.app.settings.playerName) return true;
    this.note.textContent = '✏️ Type your name first, so your friends know who you are.';
    this.nameInput.focus?.();
    return false;
  }

  async start() {
    if (!this.named()) return;
    this.note.textContent = '📡 Opening the room…';
    if (await this.friends.join(Friends.newCode())) this.share(true);
  }

  async join() {
    if (!this.named()) return;
    const code = Friends.cleanCode(this.codeInput.value);
    if (!code) { this.note.textContent = '🤔 That doesn’t look like a room code (it’s 6 letters and numbers).'; return; }
    this.note.textContent = '📡 Joining…';
    await this.friends.join(code);
  }

  async copy() {
    try {
      await navigator.clipboard.writeText(this.friends.inviteLink);
      this.note.textContent = '🔗 Invite link copied. Send it to your friends!';
    } catch {
      this.note.textContent = `Send your friends this link: ${this.friends.inviteLink}`;
    }
  }

  /** The phone's share sheet where there is one (or just copy the link). */
  async share(quiet = false) {
    const url = this.friends.inviteLink;
    if (!navigator.share) { if (!quiet) this.copy(); return; }
    try { await navigator.share({ title: 'Planet Pop', text: `Come and fly with me in Planet Pop! Room ${this.friends.code}`, url }); } catch { /* closed */ }
  }

  render() {
    const f = this.friends, inRoom = f.inRoom, $ = (id) => this.$(id);
    $('frOut').classList.toggle('hidden', inRoom);
    $('frIn').classList.toggle('hidden', !inRoom);
    this.app.hud.setFriends?.(inRoom ? f.people.length + 1 : 0);
    if (!inRoom) {
      if (!/^(📡|✏️|🤔)/.test(this.note.textContent)) this.note.textContent = 'Players connect straight to each other over the internet, so they can see each other’s IP address: best with friends. To try it on one computer, open the game in two tabs with ?net=tabs.';
      return;
    }
    $('frRoom').textContent = f.code;
    const people = f.people, mine = f.myKey;
    this.list.innerHTML = '';
    const row = (name, doing, go) => {
      const el = document.createElement('div'), who = document.createElement('span'), what = document.createElement('span');
      el.className = 'friend';
      who.className = 'who';
      who.textContent = name;
      what.className = 'doing';
      what.textContent = doing;
      el.append(who, what);
      if (go) {
        const b = document.createElement('button');
        b.dataset.go = go;
        b.textContent = '🌍 Go there';
        el.append(b);
      }
      this.list.append(el);
    };
    row(`${this.app.settings.playerName || 'You'} (you)`, this.app.game.active ? 'playing' : 'here', null);
    const where = (g) => (g.planet?.world ? `${worldOf(g.planet.world).icon} on ${worldOf(g.planet.world).name}` : '🪐 on another planet');
    for (const g of people) row(g.name, g.key === mine ? g.doing : where(g), g.key === mine ? null : g.id);
    this.note.textContent = people.length ? `${people.length + 1} in the room.` : '⏳ Waiting for friends… send them the invite link.';
  }
}
