// Playing with friends: the 👥 menu, a room with a second player (another page of the same browser, joined through
// ?net=tabs), and their plane flying alongside with their name over it and a dot on the mini-map.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.
import { PLANET } from '../harness.mjs';

const ROOM = `${PLANET}&theme=classic&net=tabs&room=SHOTS1`;

export default async function friends({ page, frames, until, scene, open, second }) {
  await page.evaluate(() => { app.game.stop(); app.rig.release(true); });

  await scene('friends-menu', 'The 👥 button: play with friends, by starting a room or joining one with its code', async () => {
    await page.click('#friendsBtn');
    await until(() => app.friendsMenu.open);
    await frames(2);
  });
  await page.evaluate(() => app.friendsMenu.hide());

  let sam = null;
  await scene('friends-room', 'In a room: the code, the invite link, and who else is here (Sam, flying)', async () => {
    await open(ROOM); // (this browser's other tabs are the "internet" here)
    await page.evaluate(() => { app.settings.values.playerName ||= 'Ata'; });
    sam = await second(ROOM);
    await sam.evaluate(() => {
      app.settings.values.playerName = 'Sam'; // (not saved: both pages share this browser's storage)
      app.tour.setAuto(false);
      app.game.start({ free: true });
    });
    await until(() => app.friends.people.some((g) => g.name === 'Sam' && g.kind === 'plane'));
    await page.click('#friendsBtn');
    await until(() => app.friendsMenu.open);
    await frames(2);
  });
  await page.evaluate(() => app.friendsMenu.hide());

  await scene('friends-flying', 'Flying with a friend: Sam’s plane just ahead with Sam’s name over it, and a green S on the mini-map', async () => {
    await sam.evaluate(() => app.togglePause()); // (Sam holds still, still in the room)
    await page.evaluate(() => app.game.start({ free: true }));
    const behindSam = () => page.evaluate(() => { // (a plane can't stop, so keep putting ours just behind Sam's)
      const friend = app.friends.people.find((p) => p.name === 'Sam').model, pl = app.game.player;
      pl.place(friend.up.clone().addScaledVector(friend.fwd, -0.1).normalize(), friend.fwd);
      pl.alt = friend.alt - 0.06;
      pl.sync();
    });
    await behindSam();
    await until(() => app.rig.mode === 'game');
    for (let i = 0; i < 8; i++) {
      await behindSam();
      await frames(1);
    }
  });

  await sam?.close();
  await page.evaluate(() => { app.game.stop(); app.friends.leave(true); });
}
