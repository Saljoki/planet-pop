# Planet Pop!

A cartoony, comic-book 3D planet built with Three.js: day/night cycle, cities, traffic with signals,
a train with a tunnel, boats, balloons, planes, bird flocks, weather, a rocket pad, satellites, a space
station, a moon — plus the **Sky Courier** mini-game and 15 trophies.

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
- **Click / tap** anything (cars, train, planes, boats, balloons, birds, storms, rocket, satellites,
  station, moon, or any spot on the ground) to fly there and follow it. **Esc** returns to orbit.
- **P** pause · **N** new planet · **H** show/hide the control panel.
- **Quality** (panel): *Auto* picks the best level your machine runs smoothly and remembers it;
  *Crisp* forces full resolution; *Balanced* and *Fast* trade shadow detail and the edge-ink pass for speed.
  Resolution never drops below one pixel per CSS pixel. Check it in DevTools with `app.quality.name` / `app.quality.pr`.

### Sky Courier

Fly city to city and swoop low through the pink beacon to deliver. Blue rings add 5 s and refill
boost; fast deliveries build a combo up to x5; crashing costs 8 s.
Keyboard: arrows / WASD steer and climb, Space / Shift boost, Esc quit. Touch screens get an on-screen pad.

## Structure

```
planet-pop/
├─ index.html              page + import map (three@0.160 from jsDelivr)
├─ css/style.css           comic UI styles
└─ js/
   ├─ main.js              entry point
   ├─ App.js               renderer, frame loop, planet swapping
   ├─ core/                Noise, Random, Geo (math helpers), Entity (focus targets)
   ├─ render/              Toon (halftone shading), Outline (ink hulls), PostFX (edge ink), Quality (adaptive resolution)
   ├─ sky/                 Sky (sun, shadows, atmosphere, stars), Weather (clouds, rain, lightning, snow)
   ├─ world/               Planet, Terrain + TerrainCompute + terrain.worker, Roads, Cities, Nature, Railway, Glow
   ├─ life/                Trails, Traffic, Boats, Balloons, Planes, Birds, Space
   ├─ ui/                  Hud, Sfx (bubbles + synthesized sound), Achievements
   ├─ camera/              CameraRig (orbit, fly-to, follow, chase, terrain collision)
   └─ game/                CourierGame, PlayerPlane
```
