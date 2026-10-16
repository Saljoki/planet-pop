# Planet Pop!

A cartoony, comic-book 3D planet built with Three.js: day/night cycle and seasons, cities with people
strolling the streets, trams and traffic with signals, airports where planes land and take off, harbours
with ferries, sightseeing helicopters, whales, a train with a tunnel, balloons, bird flocks, weather with
rainbows, an erupting volcano, midnight fireworks, meteor showers, auroras over the poles, the odd UFO,
a rocket pad, satellites, a space station, a moon and an ambient soundscape. Planets come in five kinds:
classic, ice, desert, candy and lava. Plus the **Sky Courier** mini-game with ten missions, a daily
challenge and free flight, **road trips** (drive any car or steer any boat, taxi, van courier and a race round
the world) with a 🗺️ mini-map, a 📍 Find menu, a hands-free 📺 tour, a photo mode and 42 trophies. It's built for
phones as much as laptops (touch gestures, a thumbstick, tilt steering), installs as an app and works offline.

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

- **Drag** to orbit, **scroll / pinch** to zoom — you can skim right down to the ground. **Two fingers** twist to
  turn the view and slide up or down to tilt it (on a computer: **right-drag**); **🧭** puts north back up.
  **Double-tap** swoops in on a spot.
- **Click / tap** anything (cars, people, trams, the train, planes, helicopters, boats, whales, balloons,
  birds, storms, airports, harbours, the volcano, the UFO, rocket, satellites, station, moon, or any spot on
  the ground) to fly there and follow it. People and trams can be picked once you've zoomed in on a town,
  whales while they're at the surface. **Esc** returns to orbit. **Press and hold** on something for a card
  saying what it is and what it's up to, with a Follow button, and for cars and boats **🚗 Drive** / **⛵ Steer**:
  take over that very car (it leaves the traffic) or boat and drive it about.
- **📍 Find** (or **F**): what's happening right now (an eruption, fireworks, a whale leaping, a plane about to
  take off…) and a button for every kind of thing (towns, the train, trams, planes, helicopters, whales…).
  Tap one to fly there; tapping a kind again visits the next one.
- **📺 Tour** (in Find, or **T**): the camera hops between whatever is happening, with a caption, until you
  touch the screen. It also starts by itself after a minute with no input (turn off **Idle tour** in the panel).
- **World** (panel): *Any* gives every new planet a theme picked from its seed (about a third are classic),
  or pick Classic, Ice, Desert, Candy or Lava to rebuild this planet in it. Lava worlds have three volcanoes
  and a glowing lava sea instead of boats.
- **📷 Photo mode** (or **C**): the interface steps aside and the world freezes. Pick a frame (comic,
  polaroid), a caption and a filter (Pop, Retro, Noir), then **Snap** to save or share the picture.
- **Events:** the volcano rumbles and erupts every minute or so, the rocket launches, and every couple
  of minutes a UFO drops in for a few seconds. Visit a pole at night for the aurora. Around local midnight
  most towns put on a firework show, meteor showers streak across the night side every couple of minutes,
  and rain clouds trail rainbows by day. Whales surface to blow, now and then leaping clear of the sea.
- **Seasons** (classic worlds): a year lasts eight days (20 minutes at 1x, faster with **Time speed**).
  The hemisphere in winter gets snow creeping down from the pole, sea ice and frosted trees while the
  other has summer; leaves turn in autumn and blossom in spring. The season where you are shows next to
  the world's name.
- **ℹ️ About** (bottom of the panel, with the version number): who made Planet Pop, the credits, and **your name**,
  which the game then shows over your plane, car or boat (like Rex's), on results cards, in the hangar, in the daily
  share and to say hello.
- **Sound** (panel) mutes everything; **Ambience** sets the volume of the soundscape (wind, surf, a
  town's murmur, birds by day, crickets by night, a hum out in space), which follows the camera.
- **P** pause · **N** new planet · **H** show/hide the control panel · **F** Find · **T** tour.
- **On a phone** the control panel and Find slide up from the bottom (drag the bar down to close them), or in
  from the right with the phone on its side. Buttons are finger-sized and keep clear of notches. The screen
  stays on while you fly or watch the tour, and **⛶** goes full screen where the browser allows it.
- **Quality** (panel): *Auto* picks the best level your machine runs smoothly and remembers it;
  *Crisp* forces full resolution; *Balanced* and *Fast* trade shadow detail and the edge-ink pass for speed.
  Resolution never drops below one pixel per CSS pixel. Check it in DevTools with `app.quality.name` / `app.quality.pr`.
  From high up, details smaller than a pixel (people, car lights, thin ink lines…) aren't drawn at all, and trees
  shrink away into forest-coloured ground (up close they're all there).
- Add `?debug` to the URL for a live overlay: FPS, frame time, quality level, draw calls, triangles and GPU resources.

### Sky Courier

Fly city to city and swoop low through the pink beacon to deliver. Blue rings add 5 s and refill
boost; fast deliveries build a combo up to x5; crashing costs 8 s.
Keyboard: arrows / WASD steer and climb, Space / Shift boost, P pause, Esc quit. **Phones:** put a thumb
anywhere on the left half and drag to steer and climb, hold the big **BOOST** button; **⏸** pauses, and the pause
menu's **⚙️ Options** switch on **tilt to steer** (hold the phone as you like when the run starts; tip it like a steering wheel,
tip the top away to dive) and **vibration** on deliveries, crashes and lightning (Android; iPhones don't allow
it). **Controllers** work too: left stick or d-pad steers and climbs, A / RB / RT boost, Start pauses (or opens
the hangar), A / B answer the end-of-run screen.

- **🗺️ Mini-map:** a round, heading-up map in the corner of every run shows where you are, the towns and roads, and
  where to go: the goal of the arrow, the delivery pin, pickups and drop-offs, rings, race checkpoints and Rex. Tap it
  to zoom out. **🗺️** (next to ⏸) or **M** hides it on small screens, and that's remembered (also in Options).
- **Briefing and Options:** before each run a briefing explains the goal and shows the controls for your
  device (keyboard, touch or controller), with **▶ Start**, **⚙️ Options** and **Back**; tick "Don't show this"
  to skip it. **⚙️ Options** (in the briefing, the hangar and the pause menu) has **your name**, **Invert Y axis** (up dives,
  down climbs, for keys, thumbstick, tilt and controller alike), steering sensitivity, tilt steering and
  vibration on phones, sound and ambience volume, the briefing and mini-map switches, and a two-tap **Reset Sky Courier
  progress** (trophies stay). Options are remembered.
- **📦 Courier run:** the classic timed game below. **🕊️ Free flight:** no clock, no parcels, no Rex, no coins:
  fly anywhere you like. Rings refill your boost and runways still refuel.
- **Health ❤️:** hitting the ground costs a quarter of your health and makes the engine splutter; lightning hurts
  too. Out of health is a wreck: KABOOM, and the run's over (free flight and free drive put a fresh one at the
  nearest town instead). Skimming a runway repairs the plane, every delivery patches it up a little, and the
  **🛡️ Armour** upgrade softens every knock.

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
- **🚗 Road trips** (in the hangar), in a car on the ground: ↑ / W to go, ↓ / S to brake and reverse (on phones,
  drag up and down on the left). Highways are quickest; grass, sand and snow are slower and hills slow you going up,
  and you get a little air over crests. Buildings, steep mountains and the sea are walls: glance off them and you
  scrape along, hit them square on and it hurts. Traffic keeps left, queues behind you and honks.
  - **Free drive** (or take over a car from its info card) and **⛵ free sail**: no clock, just roam.
  - **🚕 Taxi:** people wait on a green pad at the edge of town; pull in slowly to pick them up and take them to
    the next town. Quick rides tip and build a combo, bumpy ones pay less, and every fare adds time to the shift.
  - **🚐 Van courier:** the courier run by road, to a pad at one of the two nearest towns.
  - **🏁 Round the world:** race Rex once round the planet on a highway through 8 checkpoints, after a 3-2-1-GO.
    He keeps left, overtakes traffic and runs red lights. Your fastest win is kept.
- **📅 Daily challenge** (in the hangar): today's planet and parcel route, the same for everyone and
  changing at midnight UTC, flown in the stock plane so upgrades don't count. Your best daily score is
  kept separately, and **Share result** copies your score with a `?daily` link that opens the challenge.

## Structure

```
planet-pop/
├─ index.html                 page + import map (three.js from vendor/)
├─ manifest.webmanifest       app name, colours and icons for installing
├─ sw.js, precache.js         service worker and the generated list of files it caches
├─ css/                       comic UI styles by area: base, hud, game, cards, menus, photo, phone (loaded in that order)
├─ js/
│  ├─ main.js                 entry point, registers the service worker
│  ├─ App.js                  renderer, frame loop, planet swapping
│  ├─ core/                   Noise, Random, Geo (math helpers), Store (saved state), Entity + ObjectEntity,
│  │                          InstanceEntity, PointEntity (things you can click and follow), Version
│  ├─ render/                 Toon (halftone shading), Outline (ink hulls), PostFX (edge ink), Quality (adaptive
│  │                          resolution), Detail (skips sub-pixel things from high up), InstanceFade (trees that
│  │                          shrink away with distance), MapGlobe (the mini-map's planet)
│  ├─ sky/                    Sky (sun, shadows, atmosphere, stars), Weather (clouds, rain, lightning, snow), Aurora,
│  │                          Sparks (pooled glowing particles), Fireworks, Meteors, Rainbows
│  ├─ world/                  Planet (the module list), Themes, Terrain + TerrainCompute + terrain.worker,
│  │                          SurfaceIndex (exact ground height), Roads, Cities, Nature, TreeShapes, Railway, Airports,
│  │                          Harbours, Volcano, Glow, Seasons, ForestFloor (forest-coloured ground), Happenings
│  │                          (what's going on, for Find and the tour)
│  ├─ life/                   Trails, Traffic, People, Trams, Boats, Whales, Balloons, Planes, Helicopters, Birds,
│  │                          Ufo, Space
│  ├─ camera/                 CameraRig (modes and swoops), OrbitView, FollowView, ChaseView, Picker (what's under a
│  │                          tap), Gestures (touch and mouse)
│  ├─ ui/                     Widget + Overlay (UI building blocks), Hud, ControlPanel (☰), AboutCard, InfoCard, FindMenu,
│  │                          TourMode, PhotoMode, Sfx (bubbles + synthesized sound), Ambience (soundscape),
│  │                          Achievements + TrophyWatch, Haptics, WakeLock, DebugStats (?debug)
│  └─ game/                   CourierGame (runs the show), Rival + RoadRival (Rex in the air and on the road), Cargo,
│     │                       CourierProps (beacon, rings, pads, race arches), FlightHazards (storms, runways, ash),
│     │                       Progress, Settings, Daily, Missions
│     ├─ vehicles/            Vehicle (health, boost, smoke), Plane, GroundVehicle, Car, Boat, Ground (what's under a
│     │                       car or boat: roads, water, buildings, mountains, where to start and stop)
│     ├─ runs/                Run (the hooks), modes.js (which run for which options), DeliveryRun (courier run),
│     │                       DailyRun, MissionRun, FreeFlight, FreeDrive, TaxiRun, VanRun, RaceRun
│     ├─ screens/             CourierHud, MiniMap, ResultsScreen, Briefing, OptionsMenu, PauseMenu, Hangar, MissionBoard,
│     │                       RoadBoard
│     └─ input/               FlightControls (keys, stick, tilt, boost), TouchStick, TiltSteer, Gamepad
├─ vendor/three/, fonts/      three.js and the Bangers font (with their licences)
├─ icons/                     app icons (drawn by scripts/icons.mjs)
├─ scripts/                   vendor.mjs (copy three.js + font), icons.mjs, precache.mjs
├─ docs/EXTENDING.md          where new things go: world modules, game modes, missions, options, trophies…
├─ tests/
│  ├─ *.test.mjs              node:test suites: world (3 full planets simulated, camera, trophies), courier (Sky
│  │                          Courier and the daily on the same planets), health, drive (cars, boats, traffic), road
│  │                          (taxi, van, race), quality, progress, daily, ambience, themes,
│  │                          missions + controller, touch (gestures, stick, tilt, Find, tour, free flight), options
│  │                          (briefing, Invert Y, sensitivity, reset), offline files
│  ├─ helpers/                a fake DOM and a headless App so the game runs under Node
│  └─ browser/                screenshots.mjs + harness.mjs: headless Chrome (software WebGL) plays the scenes in
│                             scenes/ (one file per area) on a laptop-sized screen and a phone, upright and on its
│                             side, including an offline reload
└─ .github/workflows/ci.yml   tests + screenshots on every push and pull request
```

## Tests

```bash
npm install
npm test                  # unit + simulation tests, no browser needed (~80 s)
npm run lint              # ESLint
npm run screenshots       # renders scenes into ./screenshots and fails on page or shader errors
                          # (SCENES=photo,theme renders only the scenes whose names contain those words)
```

GitHub Actions runs both on every push and pull request, uploads the screenshots as an artifact, and
publishes them to the `ci-shots/<branch>` branch so they can be viewed on GitHub.
