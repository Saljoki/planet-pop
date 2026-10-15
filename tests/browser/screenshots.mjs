// Opens the game in headless Chrome (software WebGL via SwiftShader), plays through key scenes and saves
// screenshots plus a report to ./screenshots. Exits non-zero on page errors or shader compile errors.
//   npm run screenshots            (SCENES=airport,photo renders just the scenes whose names contain those words)
// The scenes are in ./scenes, one file per area, run in this order (later ones carry on from earlier ones, so a
// filtered run may need the scenes a scene builds on). To add a scene, add it to the file for its area.
import { start } from './harness.mjs';
import world from './scenes/world.mjs';
import events from './scenes/events.mjs';
import views from './scenes/views.mjs';
import courier from './scenes/courier.mjs';
import themes from './scenes/themes.mjs';
import phone from './scenes/phone.mjs';
import offline from './scenes/offline.mjs';

const h = await start();
for (const area of [world, events, views, courier, themes, phone, offline]) await area(h);
await h.finish();
