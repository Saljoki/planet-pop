// Offline: the service worker serves everything.
// One of the screenshot run's scene files (see ../screenshots.mjs); the helpers are described in ../harness.mjs.
import { PLANET } from '../harness.mjs';

export default async function offline({ page, frames, scene, open }) {
  await scene('offline', 'Reloaded with the network off: the service worker serves every file', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    await page.setOfflineMode(true);
    await open(PLANET);
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) throw new Error('the page was not served by the service worker');
    await frames(3);
  });
  await page.setOfflineMode(false);
}
