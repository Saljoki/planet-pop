const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/**
 * Finds the radius of the rendered (flat-shaded) terrain mesh under a direction.
 * The noise heightfield is smooth while the mesh is made of flat facets, so they differ by a few hundredths:
 * enough to bury a tiny pedestrian. Triangles are bucketed on a longitude/latitude grid; a lookup ray-casts
 * from the planet centre against only the triangles in its bucket.
 */
export class SurfaceIndex {
  /** pos: non-indexed triangle soup (x, y, z per vertex, 3 vertices per triangle). */
  constructor(pos, cols = 128, rows = 64) {
    this.pos = pos;
    this.cols = cols;
    this.rows = rows;
    const tris = pos.length / 9, cells = cols * rows;
    const cellsOf = (t, out) => { // every cell the triangle's bounding box touches (wrapping at ±180°)
      out.length = 0;
      let r0 = rows, r1 = -1;
      const cs = [];
      for (let j = 0; j < 3; j++) {
        const o = t * 9 + j * 3, [col, row] = this.colRow(pos[o], pos[o + 1], pos[o + 2]);
        cs.push(col);
        r0 = Math.min(r0, row);
        r1 = Math.max(r1, row);
      }
      const lo = Math.min(...cs), hi = Math.max(...cs);
      let span = range(lo, hi);
      if (hi - lo > cols / 2) { // straddles the ±180° seam: cover both ends instead of the whole width
        const low = cs.filter((c) => c < cols / 2), high = cs.filter((c) => c >= cols / 2);
        span = [...range(Math.min(...high), cols - 1), ...range(0, Math.max(...low))];
      }
      for (let r = r0; r <= r1; r++) for (const c of span) out.push(r * cols + c);
      return out;
    };
    const tmp = [], start = new Uint32Array(cells + 1);
    for (let t = 0; t < tris; t++) for (const c of cellsOf(t, tmp)) start[c + 1]++;
    for (let c = 0; c < cells; c++) start[c + 1] += start[c];
    const fill = start.slice(0, cells), list = new Uint32Array(start[cells]);
    for (let t = 0; t < tris; t++) for (const c of cellsOf(t, tmp)) list[fill[c]++] = t;
    this.start = start;
    this.list = list;
  }

  colRow(x, y, z) {
    const l = Math.hypot(x, y, z) || 1;
    const col = Math.min(this.cols - 1, Math.floor(((Math.atan2(z, x) / Math.PI + 1) / 2) * this.cols));
    const row = Math.min(this.rows - 1, Math.floor((Math.asin(Math.max(-1, Math.min(1, y / l))) / Math.PI + 0.5) * this.rows));
    return [col, row];
  }

  cell(x, y, z) { const [col, row] = this.colRow(x, y, z); return row * this.cols + col; }

  /** Radius of the mesh along the unit direction d, or null if no facet was found (falls back to the heightfield). */
  radiusAt(d) {
    const P = this.pos, c = this.cell(d.x, d.y, d.z), dx = d.x, dy = d.y, dz = d.z;
    for (let i = this.start[c], end = this.start[c + 1]; i < end; i++) {
      const o = this.list[i] * 9;
      const ax = P[o], ay = P[o + 1], az = P[o + 2];
      const e1x = P[o + 3] - ax, e1y = P[o + 4] - ay, e1z = P[o + 5] - az;
      const e2x = P[o + 6] - ax, e2y = P[o + 7] - ay, e2z = P[o + 8] - az;
      const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x; // Möller–Trumbore, ray from the origin
      const det = e1x * px + e1y * py + e1z * pz;
      if (Math.abs(det) < 1e-12) continue;
      const tx = -ax, ty = -ay, tz = -az, inv = 1 / det;
      const u = (tx * px + ty * py + tz * pz) * inv;
      if (u < -1e-6 || u > 1 + 1e-6) continue;
      const qx = ty * e1z - tz * e1y, qy = tz * e1x - tx * e1z, qz = tx * e1y - ty * e1x;
      const v = (dx * qx + dy * qy + dz * qz) * inv;
      if (v < -1e-6 || u + v > 1 + 1e-6) continue;
      const t = (e2x * qx + e2y * qy + e2z * qz) * inv;
      if (t > 0) return t;
    }
    return null;
  }
}
