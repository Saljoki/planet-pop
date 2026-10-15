# Extending Planet Pop

How the code is laid out, and where a new feature goes. Everything is plain ES modules with one class per
file; there's no build step. After adding, renaming or removing any file under `css/`, `js/`, `vendor/`,
`fonts/` or `icons/`, run `npm run precache` (the tests fail until you do), then `npm test`.

## The big picture

- **`App`** (`js/App.js`) owns the renderer and the frame loop. Each frame it updates the sky and the planet
  (in fixed sub-steps), then the game, the camera, the HUD, sound and quality, and renders.
- **`Planet`** (`js/world/Planet.js`) is one generated world, built from a seed. It's a list of *modules*
  (terrain, roads, cities, traffic, whales, fireworks…), each kept as `planet.<name>`.
- **`CameraRig`** (`js/camera/`) moves the camera in one of four modes: `orbit` (OrbitView), `local`
  (following something, FollowView), `game` (the Sky Courier chase cam, ChaseView) and `fly` (a swoop between
  them). `Picker` finds what's under a tap.
- **`Hud`** (`js/ui/Hud.js`) is the planet view's screen furniture; the ☰ panel is `ControlPanel`.
  Small pieces of UI extend **`Widget`** (`js/ui/Widget.js`); full-screen menus extend **`Overlay`**,
  which handles Esc and the dimmed backdrop.
- **`CourierGame`** (`js/game/CourierGame.js`) runs Sky Courier and the road trips. What the player drives is a
  `Vehicle` (`js/game/vehicles/`: the plane, a car, a boat). The rules of each kind of run live in
  `js/game/runs/`, the menus in `js/game/screens/`, the controls in `js/game/input/`.
- Saved state goes through `js/core/Store.js` (localStorage, always with a fallback). Keys start with
  `planetpop.`; never change the format of an existing key, or players lose their progress.

## Add something to the world

1. Write a class in `js/world/`, `js/life/` or `js/sky/` that takes the planet: `constructor(planet)`.
   Build its meshes into `planet.root`. Optional methods:
   - `update(dt, t)`: called every frame (dt is 0 while paused).
   - `dispose()`: free anything `Planet.dispose()` can't find by walking `planet.root` (it already frees
     geometries, materials and textures there).
   - `entities`: things that can be clicked, followed and found. Use `ObjectEntity` (a mesh),
     `InstanceEntity` (one instance of an InstancedMesh) or `PointEntity` (a fixed spot) from `js/core/`.
2. Add it in `Planet.build()` with `this.add('name', new Thing(this))`, in the right phase:
   1. layout (claims land, before anything is built),
   2. heightfield only (most things),
   3. after the terrain mesh (anything that must sit exactly on the rendered ground).
3. If it has entities of a new kind, give the kind an icon and name in `KINDS` (`js/ui/InfoCard.js`), a line
   for `describe()` there, and a framing distance in `FRAME` (`js/camera/FollowView.js`).
4. If it's something happening (an event), add it to `happenings()` in `js/world/Happenings.js`, so Find and the
   tour show it.
5. Theme-specific looks go in `js/world/Themes.js` (each theme is a plain object of colours and switches).
   Lots of small instanced things that don't need to be seen from orbit can shrink away with distance like the trees
   (`InstanceFade` in `js/render/`, updated from the module's `update()`).
6. Test it in `tests/world.test.mjs` (the three test planets run 80 s of simulated life) and add a screenshot
   scene to `tests/browser/scenes/world.mjs` or `events.mjs`.

## Add a kind of run (a game mode)

1. Write a class in `js/game/runs/` that extends `Run` (or `DeliveryRun` for a variation on the courier
   run, like `DailyRun`, `MissionRun` and `VanRun`). `Run.js` documents every hook. The usual ones:
   - `static briefing(opts)`: `{ icon, title, goal, tips }` for the screen before it starts, and
     `static vehicleKind(opts)`: 'plane', 'car' or 'boat' (for the controls it shows).
   - `takeoff()`: set up before the vehicle exists; return `{ at, heading }`.
   - `vehicle(at, heading)`: what the player drives (the plane unless you say otherwise; see `TaxiRun`).
   - `begin()`: the vehicle and props exist; place things and say hello (`this.app.hud.toast(…)`).
   - `crashed()`, `zapped()`, `refuelled()`, `inAsh(dt)`, `caughtUfo()`, `ring(ring)`, `placeRing(ring)`:
     what happens, scored your way. The vehicle's own reaction (bounce, damage, shake) is already handled.
   - `update(dt)`: your rules; call `this.game.finish({ title, html, … })` when the run is over
     (see `ResultsScreen.show` for what the card can offer).
   - `wrecked()`: out of health (by default a fresh vehicle turns up; scored runs end instead).
   - `hud(hud)`: fill in `hud.dom.*` and point the arrow with `hud.pointAt(c)`.
   - `layout`, `rings`: which HUD pieces show and how many blue rings; `end()`: undo anything that outlives the run.
   The mini-map (`js/game/screens/MiniMap.js`) needs nothing from you: it marks wherever `hud.pointAt()` points, and
   the beacon, pad, rings, arches and Rex (`run.rival` or `run.rex`) from the props. Something new to mark goes in
   its `drawMarks()`; something new on the ground (a kind of road, say) in the shader in `js/render/MapGlobe.js`.
2. Add it to `runClass()` in `js/game/runs/modes.js`, keyed on an option (`{ road: 'taxi' }`, say).
3. Give it a way in: a line in `ROAD_TRIPS` (`js/game/screens/RoadBoard.js`) for something on the ground, or a
   hangar button (`js/game/screens/Hangar.js`); either calls `game.launch({ … })`.
4. Test it like `tests/road.test.mjs`: `game.start({ … })`, move `game.player` about, `game.update(dt)` (or
   `run(app, seconds, { game: true })`), then look at `game.run`.

Shared by every run: `CourierProps` (the beacon, rings, the pull-in pad with a waiting passenger, race arches),
`FlightHazards` (storms, runways, ash) and, for anything on the ground, `Ground` (`js/game/vehicles/Ground.js`:
road or not, water, buildings, mountains, and `parking(town)` / `stops(town)` for where to start and pull in).

## Add a vehicle

Extend `Vehicle` (`js/game/vehicles/Vehicle.js`), or `GroundVehicle` for anything that keeps to the surface: say
how it handles (`limits()`), what stops it (`blocked(d)`) and how high it sits (`surfaceR(d)`), build its model into
`this.group`, and move it in `update(dt)` from `this.input`. Set `chase` for how the camera follows it. Health,
damage, wrecks, boost and smoke come with `Vehicle`; `Car` and `Boat` are the examples.

## Add a mission

Add an entry to `MISSIONS` in `js/game/Missions.js`. `goal.stat` names one of the counters in
`DeliveryRun.tally` (deliveries, urgent, fragile, heavy, broken, rings, refuels, rexStreak, ufo, ash, night);
`failIf` names one that ends the mission when it goes above zero. Setup flags (`rival`, `night`, `ufoIn`,
`eruptions`, `cargo`) are applied in `MissionRun.setup()`; a new one goes there. Pick a planet that has what
the mission needs; `tests/missions.test.mjs` checks that.

## Add an option

1. Add it with its default to `DEFAULTS` in `js/game/Settings.js` (the type of the default is checked when loading).
2. Add a control in `js/game/screens/OptionsMenu.js`, calling `app.settings.set(key, value)`.
3. Read it with `app.settings.get(key)`, or listen with `app.settings.onChange((key, value) => …)`.

A planet-view setting (like Ink lines) goes in the ☰ panel instead: `js/ui/ControlPanel.js`. The player's name is
`app.settings.playerName` (always tidied by `cleanName()`; set it with `setPlayerName()`): show it with `textContent`.

The version is `VERSION` in `js/core/Version.js`; bump it with `package.json` (a test checks they match). The About
card (`js/ui/AboutCard.js`) shows it, with the credits.

## Add a trophy

1. Add `[id, icon, title, description]` to `DEFS` in `js/ui/Achievements.js`.
2. Unlock it where it's earned: `app.achievements.unlock(id)`. For "follow a … " trophies, add a rule to
   `js/ui/TrophyWatch.js` instead.

## Add a sound

Sounds are synthesized, not files. Add a `case` to `Sfx.play()` in `js/ui/Sfx.js` (tones and noise bursts),
then `app.sfx.play(name)`, or `app.sfx.pop(pos, 'TEXT!', colour, name)` for a comic bubble with the sound.

## Add a theme (a kind of world)

Add an object to `THEMES` in `js/world/Themes.js` (copy one and change it); the World menu and surprise
planets pick it up from there. Add its id to the list of worlds `tests/themes.test.mjs` builds and runs.

## Styles

`css/` is split by area and loaded in this order (later files win ties): `base.css` (fonts, colours, buttons,
overlays), `hud.css` (the planet view), `game.css` (Sky Courier's HUD and touch controls), `cards.css` (info
card, Find, tour), `menus.css` (briefing, Options, hangar, missions), `photo.css`, and `phone.css` (all the
small-screen and touch rules, last so they win).

## Tests and screenshots

- `npm test`: node:test suites with a fake DOM and a headless App (`tests/helpers/`), no browser needed.
- `npm run screenshots`: headless Chrome plays through the scenes in `tests/browser/scenes/` (one file per
  area, run in order) and saves pictures and a report to `screenshots/`. `SCENES=hangar,courier` runs only the
  scenes whose names contain those words; scenes carry on from earlier ones, so include the ones a scene builds on.
- `npm run lint`: ESLint.
