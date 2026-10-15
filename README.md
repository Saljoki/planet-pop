# Planet Pop!

A cartoony, comic-book 3D planet built with Three.js: day/night cycle, cities with people strolling the
streets, traffic with signals, airports where planes land and take off, harbours with ferries, a train
with a tunnel, balloons, bird flocks, weather, an erupting volcano, auroras over the poles, the odd UFO,
a rocket pad, satellites, a space station, a moon and an ambient soundscape — plus the **Sky Courier**
mini-game, a daily challenge and 24 trophies.

Every planet is generated from a seed. The address bar always holds the current planet
(`?seed=…&land=…&cities=…`), and **🔗 Share this planet** copies the link.

## Run it

ES modules and the terrain Web Worker don't load from `file://`, so serve the folder over HTTP:

```bash
cd planet-pop
npx serve .            # or: python -m http.server 8000
```

Open the printed URL (e.g. http://localhost:3000 or http://localhost:8000). Three.js 0.160 and the
Bangers font load from CDNs, so an internet connection is needed.

## Controls

- **Drag** to orbit, **scroll / pinch** to zoom — you can skim right down to the ground.
- **Click / tap** anything (cars, people, train, planes, boats, balloons, birds, storms, airports,
  harbours, the volcano, the UFO, rocket, satellites, station, moon, or any spot on the ground) to fly
  there and follow it. People can be picked once you've zoomed in on a town. **Esc** returns to orbit.
- **Events:** the volcano rumbles and erupts every minute or so, the rocket launches, and every couple
  of minutes a UFO drops in for a few seconds. Visit a pole at night for the aurora.
- **Sound** (panel) mutes everything; **Ambience** sets the volume of the soundscape (wind, surf, a
  town's murmur, birds by day, crickets by night, a hum out in space), which follows the camera.
- **P** pause · **N** new planet · **H** show/hide the control panel.
- **Quality** (panel): *Auto* picks the best level your machine runs smoothly and remembers it;
  *Crisp* forces full resolution; *Balanced* and *Fast* trade shadow detail and the edge-ink pass for speed.
  Resolution never drops below one pixel per CSS pixel. Check it in DevTools with `app.quality.name` / `app.quality.pr`.
- Add `?debug` to the URL for a live overlay: FPS, frame time, quality level, draw calls, triangles and GPU resources.

### Sky Courier

Fly city to city and swoop low through the pink beacon to deliver. Blue rings add 5 s and refill
boost; fast deliveries build a combo up to x5; crashing costs 8 s.
Keyboard: arrows / WASD steer and climb, Space / Shift boost, Esc quit. Touch screens get an on-screen pad.

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
- **📅 Daily challenge** (in the hangar): today's planet and parcel route, the same for everyone and
  changing at midnight UTC, flown in the stock plane so upgrades don't count. Your best daily score is
  kept separately, and **Share result** copies your score with a `?daily` link that opens the challenge.

## Structure

```
planet-pop/
├─ index.html                 page + import map (three@0.160 from jsDelivr)
├─ css/style.css              comic UI styles
├─ js/
│  ├─ main.js                 entry point
│  ├─ App.js                  renderer, frame loop, planet swapping
│  ├─ core/                   Noise, Random, Geo (math helpers), Entity (focus targets)
│  ├─ render/                 Toon (halftone shading), Outline (ink hulls), PostFX (edge ink), Quality (adaptive resolution)
│  ├─ sky/                    Sky (sun, shadows, atmosphere, stars), Weather (clouds, rain, lightning, snow), Aurora
│  ├─ world/                  Planet, Terrain + TerrainCompute + terrain.worker, SurfaceIndex (exact ground height),
│  │                          Roads, Cities, Nature, Railway, Airports, Harbours, Volcano, Glow
│  ├─ life/                   Trails, Traffic, People, Boats, Balloons, Planes, Birds, Ufo, Space
│  ├─ camera/                 CameraRig (orbit, fly-to, follow, chase, terrain collision)
│  ├─ ui/                     Hud, Sfx (bubbles + synthesized sound), Ambience (soundscape), Achievements,
│  │                          DebugStats (?debug overlay)
│  └─ game/                   CourierGame, PlayerPlane, Rival, Cargo, Progress (coins/upgrades), Hangar, Daily
├─ tests/
│  ├─ *.test.mjs              node:test suites: quality control, progress, daily challenge, ambience, 3 full planets simulated
│  ├─ helpers/                a fake DOM and a headless App so the game runs under Node
│  └─ browser/screenshots.mjs headless Chrome (software WebGL) plays key scenes and saves screenshots
└─ .github/workflows/ci.yml   tests + screenshots on every push and pull request
```

## Tests

```bash
npm install
npm test                  # unit + simulation tests, no browser needed (~20 s)
npm run screenshots       # renders scenes into ./screenshots and fails on page or shader errors
```

GitHub Actions runs both on every push and pull request, uploads the screenshots as an artifact, and
publishes them to the `ci-shots/<branch>` branch so they can be viewed on GitHub.
