import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { makeWorld, run, assertFiniteInstances } from './helpers/world.mjs';
import { HALF } from '../js/world/Airports.js';
import { shared } from '../js/render/Toon.js';

const PLANETS = [
  { seed: 20261014, land: 0.45, cities: 5 },
  { seed: 12345, land: 0.3, cities: 8 },
  { seed: 42, land: 0.25, cities: 2 }, // small land: no room for a railway
];

for (const params of PLANETS) {
  describe(`planet ${params.seed} (land ${params.land * 100}%, ${params.cities} cities)`, () => {
    let app, planet;
    before(async () => {
      localStorage.clear();
      ({ app, planet } = await makeWorld(params));
    });
    after(() => planet.dispose());

    it('builds a populated world', () => {
      const kinds = new Set(planet.entities.map((e) => e.kind));
      for (const k of ['city', 'car', 'boat', 'balloon', 'plane', 'bird', 'moon', 'satellite', 'station', 'storm']) {
        assert.ok(kinds.has(k), `missing ${k}`);
      }
      assert.ok(planet.cities.sites.length >= 2);
      assert.ok(planet.nature.mountains.length > 10);
      assert.ok(planet.people.people.length > 20, 'hardly anyone in town');
      assert.ok(planet.volcano.d, 'no volcano');
      assert.ok(planet.airports.list.length + planet.harbours.list.length > 0, 'no airport or harbour anywhere');
    });

    it('airports sit on levelled ground, clear of towns and roads', () => {
      for (const ap of planet.airports.list) {
        for (let i = -4; i <= 4; i++) {
          const d = planet.airports.at(ap, (i / 4) * HALF, 0, new THREE.Vector3());
          assert.ok(planet.meshR(d) <= ap.top + 0.001, `${ap.name}: ground pokes through the runway`);
          assert.ok(ap.top - planet.meshR(d) < 0.15, `${ap.name}: runway floats ${(ap.top - planet.meshR(d)).toFixed(2)} above the ground`);
          assert.ok(!planet.cities.inCity(d) && !planet.roads.near(d, 0.012), `${ap.name}: runway overlaps a town or road`);
        }
      }
    });

    it('people stand on the rendered ground', () => {
      const m = new THREE.Matrix4(), pos = new THREE.Vector3();
      planet.people.people.forEach((_, i) => {
        planet.people.body.getMatrixAt(i, m);
        pos.setFromMatrixPosition(m);
        const gap = pos.length() - planet.meshR(pos.clone().normalize());
        assert.ok(gap > -0.004 && gap < 0.008, `person ${i} is ${gap.toFixed(3)} off the ground`);
      });
    });

    it('runs 80 s of life: traffic lights, train tunnel, rocket, landings, ferries, eruption, UFO', () => {
      let waited = false, exited = false, docked = false, bombs = false;
      const states = new Set(), volcano = new Set(), ufo = new Set();
      const start = planet.people.people.map((w) => w.from);
      run(app, 80, {
        each: () => {
          waited ||= planet.traffic.cars.some((c) => c.waiting);
          exited ||= planet.railway.justExited;
          docked ||= planet.boats.boats.some((_, i) => planet.boats.isDocked(i));
          bombs ||= planet.volcano.bombs.some((b) => b.live);
          if (planet.space.state) states.add(planet.space.state);
          volcano.add(planet.volcano.state);
          ufo.add(planet.ufo.state);
        },
      });
      assertFiniteInstances(planet.root, 'after simulation');
      assert.ok(waited, 'no car ever waited at a red light');
      if (planet.railway.tunnel) assert.ok(exited, 'train never left the tunnel');
      if (planet.padSite) assert.ok(states.has('flight'), `rocket never launched (${[...states]})`);
      if (planet.airports.list.length) assert.ok(planet.planes.list.some((p) => p.landed), 'no plane ever landed');
      if (planet.harbours.list.length) assert.ok(docked, 'no ferry ever docked');
      assert.ok(volcano.has('erupt') && bombs, `volcano never erupted (${[...volcano]})`);
      assert.ok(ufo.has('hover'), `the UFO never showed up (${[...ufo]})`);
      assert.ok(planet.people.people.some((w, i) => w.from !== start[i]), 'nobody walked anywhere');
    });

    it('sky events: midnight fireworks, meteor showers and rainbows by day', () => {
      const { sky } = app, sun = (d, offset) => { sky.angle = Math.atan2(d.dot(sky.sv), d.dot(sky.su)) + offset; sky.update(0); };
      const f = planet.fireworks, c = f.cities[0];
      sun(c.city.c, 0); // noon over the city
      f.update(0);
      assert.ok(c.armed, 'fireworks not ready by day');
      sun(c.city.c, Math.PI); // midnight
      f.update(0);
      assert.ok(!c.armed, 'midnight came and went without a decision on fireworks');
      f.start(c);
      let sparks = 0;
      run(app, 4, { each: () => { sparks = Math.max(sparks, f.sparks.live); } });
      assert.ok(sparks > 50, `hardly any sparks (${sparks})`);
      run(app, 12);
      assert.ok(f.showAt(c.city) <= 0, 'the show never ended');

      const m = planet.meteors;
      m.start();
      let streaks = 0;
      run(app, 4, { each: () => { streaks = Math.max(streaks, m.list.filter((x) => x.live).length); } });
      assert.ok(streaks > 0, 'a meteor shower with no meteors');
      run(app, 9);
      assert.ok(!m.active && m.list.every((x) => !x.live), 'the meteor shower never ended');
      assertFiniteInstances(planet.root, 'after sky events');

      const r = planet.rainbows.list[0];
      if (!r) return; // no rain on this world
      const storm = () => planet.weather.stormCenter(r.storm, new THREE.Vector3()).normalize();
      sun(storm(), -0.9); // morning sun off to one side of the storm
      r.t = 12;
      planet.rainbows.update(0);
      assert.ok(planet.rainbows.strength(0) > 0.5, 'no rainbow by day');
      const at = new THREE.Vector3().setFromMatrixPosition(r.mesh.matrix);
      assert.ok(at.clone().normalize().sub(storm()).dot(sky.sunDir) < 0, 'rainbow on the sunny side of the storm');
      assert.ok(Math.abs(at.length() - planet.surfR(at.clone().normalize())) < 0.1, 'rainbow not standing on the ground');
      sun(storm(), Math.PI);
      planet.rainbows.update(0);
      assert.equal(planet.rainbows.strength(0), 0, 'a rainbow at night');
    });

    it('whales blow and breach in deep water', () => {
      const ws = planet.whales, w = ws.list[0];
      assert.ok(ws.list.length > 0, 'no whales');
      for (const x of ws.list) assert.ok(planet.heightAt(x.c) < -0.4, 'a whale in the shallows');
      Object.assign(w, { state: 'blow', t: 0, dur: 3, spoutT: 0 });
      run(app, 1);
      assert.ok(ws.spray.mesh.count > 0, 'no spout');
      Object.assign(w, { state: 'breach', t: 0, dur: 1.8 });
      let top = -Infinity;
      run(app, 1.8, { each: () => { top = Math.max(top, ws.entities[0].getPos(new THREE.Vector3()).length() - 10); } });
      assert.ok(top > 0.2, `breach only reached ${top.toFixed(2)}`);
      assert.equal(w.state, 'dive');
      assert.ok(ws.entities[0].hidden() === false, 'a surfaced whale cannot be clicked');
      run(app, 2);
      assert.ok(w.state === 'swim' && ws.entities[0].hidden(), 'whale still clickable deep under water');
      assertFiniteInstances(planet.root, 'after whales');
    });

    it('trams shuttle along their lines with the buildings clear of the tracks', () => {
      const t = planet.trams, m = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
      assert.equal(t.lines.length, planet.cities.sites.length, 'a town without a tram line');
      const b = planet.cities.buildings;
      for (const l of t.lines) {
        for (let s = 0; s <= l.len; s += 0.03) {
          const d = t.point(l, s);
          for (let i = 0; i < b.count; i++) {
            b.getMatrixAt(i, m);
            m.decompose(pos, q, sc);
            const loc = d.clone().multiplyScalar(pos.length()).sub(pos).applyQuaternion(q.invert());
            assert.ok(Math.abs(loc.x) > sc.x / 2 + 0.025 || Math.abs(loc.z) > sc.z / 2 + 0.025, `${l.city.name}: a building on the tram tracks`);
          }
        }
      }
      const start = t.trams.map((x) => x.s), stops = t.trams.map(() => new Set());
      let ends = 0;
      run(app, 40, { each: () => t.trams.forEach((x, i) => { stops[i].add(x.stop); if (t.atEnd(i)) ends++; }) });
      t.trams.forEach((x, i) => {
        assert.ok(x.s !== start[i] || stops[i].size > 1, `${x.line.city.name} tram never moved`);
        assert.ok(x.s >= 0 && x.s <= x.line.len, 'tram ran off its line');
      });
      assert.ok(ends > 0, 'no tram ever reached the end of its line');
    });

    it('helicopters hop between towns, clear of the ground', () => {
      const hs = planet.helicopters, towns = new Set(), v = new THREE.Vector3();
      let clear = Infinity;
      for (const h of hs.list) h.wait = Math.min(h.wait, 1);
      run(app, 60, { each: () => hs.list.forEach((h, i) => {
        towns.add(h.at.name);
        hs.entities[i].getPos(v);
        clear = Math.min(clear, v.length() - planet.groundR(v.clone().normalize()));
      }) });
      assert.ok(towns.size >= 2, `helicopters only visited ${[...towns]}`);
      assert.ok(clear > 0.25, `a helicopter came within ${clear.toFixed(2)} of the ground`);
    });

    it('seasons: winter snow and sea ice in one hemisphere while the other has summer', () => {
      const s = planet.seasons, { sky } = app, north = sky.axis.clone(), south = north.clone().negate();
      assert.ok(s.on);
      const at = (angle) => { sky.angle = (angle - s.offset) * 8; sky.update(0); s.timer = 0; s.update(0); };
      at(Math.PI); // midwinter in the north
      assert.equal(s.snowAt(north), 1);
      assert.equal(s.snowAt(south), 0);
      assert.equal(shared.uWinter.value.x, 1);
      assert.match(s.nameAt(north), /Winter/);
      assert.match(s.nameAt(south), /Summer/);
      const c = new THREE.Color(), deciduous = s.trees.find((g) => g.deciduous);
      const pick = (test) => deciduous.list.findIndex((t) => test(t.d.dot(north)));
      const far = pick((lat) => lat > 0.75), mid = pick((lat) => lat > 0.45 && lat < 0.6);
      if (far >= 0) {
        deciduous.mesh.getColorAt(far, c);
        assert.ok(Math.min(c.r, c.g, c.b) > 0.6, 'trees near the pole not frosted in winter');
      }
      at(Math.PI / 2); // northern autumn
      assert.equal(s.snowAt(north), 0);
      assert.match(s.nameAt(north), /Autumn/);
      assert.match(s.nameAt(south), /Spring/);
      if (mid >= 0) {
        deciduous.mesh.getColorAt(mid, c);
        assert.ok(c.r > c.g && c.r > c.b, 'leaves did not turn in autumn');
      }
      at(0);
      assert.equal(shared.uWinter.value.y, 1, 'no winter in the south at northern midsummer');
    });

    it('rebuilds traffic from the slider', () => {
      planet.traffic.rebuild(0);
      run(app, 1);
      planet.traffic.rebuild(10);
      run(app, 2);
      assert.equal(planet.traffic.cars.length, planet.roads.list.length * 2 * 10);
      assertFiniteInstances(planet.root, 'after traffic rebuild');
    });

    it('camera flies to and follows every kind of thing without going underground', () => {
      const rig = app.rig, firstOfKind = {};
      for (const e of planet.entities) firstOfKind[e.kind] ??= e;
      for (const e of Object.values(firstOfKind)) {
        if (e.kind === 'ufo') { planet.ufo.arrive(); planet.ufo.update(3.01, app.simTime); } // hovering, so it won't fly off mid-test
        rig.focus(e);
        run(app, 2.5, { dt: 1 / 60, camera: true });
        assert.equal(rig.mode, 'local', `focus on ${e.kind}`);
        const pos = app.camera.position;
        assert.ok(Number.isFinite(pos.x), `camera NaN following ${e.kind}`);
        assert.ok(pos.length() >= rig.floorAt(pos.clone().normalize()) - 1e-6, `camera underground at ${e.kind}`);
      }
      rig.release();
      run(app, 2, { dt: 1 / 60, camera: true });
      assert.equal(rig.mode, 'orbit');
      rig.orbit.alt = 0.4; // zoomed all the way in
      run(app, 0.2, { dt: 1 / 60, camera: true });
      const dir = app.camera.position.clone().normalize();
      assert.ok(app.camera.position.length() >= planet.groundR(dir) + 0.49, 'orbit camera below ground');
      assert.ok(rig.picker.groundAt(640, 400), 'clicking the planet finds the ground');
    });

    it('trophies for watching things: arriving at a bird, the station or the moon; following a plane', () => {
      for (const id of ['birdwatcher', 'astronaut', 'moonwalker']) assert.ok(app.unlocked.includes(id), `no ${id} (the camera test visits every kind)`);
      app.rig.focus(planet.entities.find((e) => e.kind === 'plane'));
      run(app, 13, { camera: true, each: () => app.trophies.update() });
      assert.ok(app.unlocked.includes('copilot'), 'followed a plane for 10 s, but no trophy');
      app.rig.release(true);
    });
  });
}
