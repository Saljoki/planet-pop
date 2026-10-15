# Planet Pop!

A cartoony, comic-book 3D planet built with Three.js: day/night cycle, cities with people strolling the
streets, traffic with signals, airports where planes land and take off, harbours with ferries, a train
with a tunnel, balloons, bird flocks, weather, an erupting volcano, auroras over the poles, the odd UFO,
a rocket pad, satellites, a space station, a moon and an ambient soundscape. Planets come in five kinds:
classic, ice, desert, candy and lava. Plus the **Sky Courier** mini-game with ten missions, a daily
challenge, a photo mode and 27 trophies. It installs as an app and works offline.

Every planet is generated from a seed. The address bar always holds the current planet
(`?seed=…&land=…&cities=…&theme=…`), and **🔗 Share this planet** copies the link.

## Run it

ES modules, the terrain Web Worker and the service worker don't load from `file://`, so serve the folder over HTTP:

```bash
cd planet-pop
npx serve .            # or: python -m http.server 8000
```

Open the printed URL (e.g. http://localhost:3000 or http://localhost:8000). Everything it needs is in the
folder (three.js 0.160 in `vendor/`, the Bangers font in `fonts/`), so no internet connection is needed.

### Install it

On a secure page (https, or localhost) a service worker caches every game file, so after the first visit
Planet Pop also works offline. Browsers that can install web apps show a **📲** button next to the camera;
on iPhone use Share → Add to Home Screen. After changing any game file, run `npm run precache` so the
service worker picks up the new version (the tests check this).

## Controls

- **Drag** to orbit, **scroll / pinch** to zoom — you can skim right down to the ground.
- **Click / tap** anything (cars, people, train, planes, boats, balloons, birds, storms, airports,
  harbours, the volcano, the UFO, rocket, satellites, station, moon, or any spot on the ground) to fly
  there and follow it. People can be picked once you've zoomed in on a town. **Esc** returns to orbit.
- **World** (panel): *Any* gives every new planet a theme picked from its seed (about a third are classic),
  or pick Classic, Ice, Desert, Candy or Lava to rebuild this planet in it. Lava worlds have three volcanoes
  and a glowing lava sea instead of boats.
- **📷 Photo mode** (or **C**): the interface steps aside and the world freezes. Pick a frame (comic,
  polaroid), a caption and a filter (Pop, Retro, Noir), then **Snap** to save or share the picture.
- **Events:** the volcano rumbles and erupts every minute or so, the rocket launches, and every couple
  of minutes a UFO drops in for a few seconds. Visit a pole at night for the aurora.
- **Sound** (panel) mutes everything; **Ambience** sets the volume of the soundscape (wind, surf, a
  town's murmur, birds by day, crickets by night, a hum out in space), which follows the camera.
- **P** pause · **N** new planet · **H** show/hide the control panel.
- **Quality** (panel): *Auto* picks the best level your machine runs smoothly and remembers it;
  *Crisp* forces full resolution; *Balanced* and *Fast* trade shadow detail and the edge-ink pass for speed.
  Resolution never drops below one pixel per CSS pixel. Check it in DevTools with `app.quality.name` / `app.quality.pr`.
  From high up, details smaller than a pixel (people, car lights, thin ink lines…) aren't drawn at all.
- Add `?debug` to the URL for a live overlay: FPS, frame time, quality level, draw calls, triangles and GPU resources.

### Sky Courier

Fly city to city and swoop low through the pink beacon to deliver. Blue rings add 5 s and refill
boost; fast deliveries build a combo up to x5; crashing costs 8 s.
Keyboard: arrows / WASD steer and climb, Space / Shift boost, P pause, Esc quit. Touch screens get an
on-screen pad. **Controllers** work too: left stick or d-pad steers and climbs, A / RB / RT boost,
Start pauses (or opens the hangar), A / B answer the end-of-run screen.

- **Cargo:** 📦 parcels, ⚡ urgent (tight timer, double pay), 🥚 fragile (a crash breaks it: no pay),
  🏋️ heavy (slower plane, 1.5× pay).
- **Thunderstorms:** flying through a dark cloud shakes the plane, and lightning can hit you
  (−5 s, empty boost tank).
- **The world joins in:** skim low along an airport runway to refuel your boost; an erupting volcano's
  ash plume chokes the engine and drains the boost; fly through a hovering UFO for +300 points.
- **Rival Rex:** after your first delivery a purple rival courier races you for every parcel. He has to
  collect it from the pickup city first, never boosts, and gets a little faster each delivery. If he
  swoops over the destination before you, he steals it (no pay, combo lost). Beat him 5 times in a row for a trophy.
- **Hangar:** coins from deliveries and rings buy engine, wings, boost tank, ring magnet and head-start
  upgrades, plus six paint jobs. Progress is saved in your browser.
- **🎯 Missions** (in the hangar): ten goals played in order, each on its own planet: First Flight, Rush
  Hour, Ring Master, Handle With Care, Pit Stop, Heavy Lifter, Outrun Rex, Night Shift, Close Encounter
  and Ash Dodger. The arrow points where a mission needs you (a runway, the next ring, the UFO), and
  each pays coins the first time you complete it.
- **📅 Daily challenge** (in the hangar): today's planet and parcel route, the same for everyone and
  changing at midnight UTC, flown in the stock plane so upgrades don't count. Your best daily score is
  kept separately, and **Share result** copies your score with a `?daily` link that opens the challenge.

## Structure

```
planet-pop/
├─ index.html                 page + import map (three.js from vendor/)
├─ manifest.webmanifest       app name, colours and icons for installing
├─ sw.js, precache.js         service worker and the generated list of files it caches
├─ css/style.css              comic UI styles
├─ js/
│  ├─ main.js                 entry point, registers the service worker
│  ├─ App.js                  renderer, frame loop, planet swapping
│  ├─ core/                   Noise, Random, Geo (math helpers), Entity (focus targets)
│  ├─ render/                 Toon (halftone shading), Outline (ink hulls), PostFX (edge ink), Quality (adaptive
│  │                          resolution), Detail (skips sub-pixel things from high up)
│  ├─ sky/                    Sky (sun, shadows, atmosphere, stars), Weather (clouds, rain, lightning, snow), Aurora
│  ├─ world/                  Planet, Themes, Terrain + TerrainCompute + terrain.worker, SurfaceIndex (exact ground
│  │                          height), Roads, Cities, Nature, TreeShapes, Railway, Airports, Harbours, Volcano, Glow
│  ├─ life/                   Trails, Traffic, People, Boats, Balloons, Planes, Birds, Ufo, Space
│  ├─ camera/                 CameraRig (orbit, fly-to, follow, chase, terrain collision)
│  ├─ ui/                     Hud, Sfx (bubbles + synthesized sound), Ambience (soundscape), PhotoMode,
│  │                          Achievements, DebugStats (?debug overlay)
│  └─ game/                   CourierGame, PlayerPlane, Rival, Cargo, Progress (coins/upgrades), Hangar, Daily,
│                             Missions + MissionRun + MissionBoard, Gamepad
├─ vendor/three/, fonts/      three.js and the Bangers font (with their licences)
├─ icons/                     app icons (drawn by scripts/icons.mjs)
├─ scripts/                   vendor.mjs (copy three.js + font), icons.mjs, precache.mjs
├─ tests/
│  ├─ *.test.mjs              node:test suites: quality, progress, daily, ambience, themes, missions + controller,
│  │                          offline files, and 3 full planets simulated
│  ├─ helpers/                a fake DOM and a headless App so the game runs under Node
│  └─ browser/screenshots.mjs headless Chrome (software WebGL) plays key scenes, including an offline reload
└─ .github/workflows/ci.yml   tests + screenshots on every push and pull request
```

## Tests

```bash
npm install
npm test                  # unit + simulation tests, no browser needed (~40 s)
npm run screenshots       # renders scenes into ./screenshots and fails on page or shader errors
                          # (SCENES=photo,theme renders only the scenes whose names contain those words)
```

GitHub Actions runs both on every push and pull request, uploads the screenshots as an artifact, and
publishes them to the `ci-shots/<branch>` branch so they can be viewed on GitHub.
