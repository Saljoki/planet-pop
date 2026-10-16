# Planet Pop: notes for working on the code

- Plain ES modules, no build step; three.js 0.160 and Trystero (bundled by `npm run vendor`) are vendored in
  `vendor/` and mapped in `index.html`.
- One class per file. Small UI pieces extend `js/ui/Widget.js`; full-screen menus extend `js/ui/Overlay.js`.
- Saved state goes through `js/core/Store.js`. Never change the format of an existing `planetpop.*` key.
- `docs/EXTENDING.md` says where new things go (world modules, Sky Courier runs, missions, options, trophies,
  sounds, themes, styles, screenshot scenes).
- After adding, renaming or removing a served file: `npm run precache` (a test checks `precache.js` is current).
- Checks: `npm test` (node:test, fake DOM, ~80 s), `npm run lint`, and `npm run screenshots` for anything visible
  (slow in software WebGL; `SCENES=a,b` runs a subset, but scenes build on earlier ones in their area file).
- Keep what players see unchanged in refactors; regressions get a test that fails on the old code.
- Work on a branch, push it, and share the compare link; merge into `main` only when asked.
