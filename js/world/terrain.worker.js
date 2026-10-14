import { computeTerrain } from './TerrainCompute.js';

self.onmessage = (e) => {
  const o = computeTerrain(e.data);
  self.postMessage(o, [o.pos.buffer, o.col.buffer, o.opos.buffer, o.onrm.buffer, o.index.buffer, o.hmap.buffer]);
};
