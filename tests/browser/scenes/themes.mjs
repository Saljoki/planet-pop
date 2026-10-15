// The other worlds.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.
import { PLANET } from '../harness.mjs';

export default async function themes({ page, frames, scene, open }) {
  for (const theme of ['ice', 'desert', 'candy', 'lava']) {
    await scene(`theme-${theme}`, `The ${theme} world`, async () => {
      await page.evaluate(() => app.game.stop());
      await open(`${PLANET}&theme=${theme}`);
      await page.evaluate(() => { app.rig.orbit.alt = 13; app.rig.orbit.pitch = 0.35; });
      await frames(4);
    });
  }
}
