/** Performance readout in the corner of the screen. Add ?debug to the URL to turn it on. */
export class DebugStats {
  constructor(app) {
    this.app = app;
    this.enabled = new URLSearchParams(location.search).has('debug');
    if (!this.enabled) return;
    this.el = document.createElement('div');
    this.el.id = 'debug';
    document.body.append(this.el);
    app.renderer.info.autoReset = false; // count every pass of a frame, not just the last one
    this.reset();
  }

  reset() { this.time = 0; this.frames = 0; this.calls = 0; this.tris = 0; this.worst = 0; }

  begin() { if (this.enabled) this.app.renderer.info.reset(); }

  end(dt) {
    if (!this.enabled) return;
    const info = this.app.renderer.info;
    this.time += dt;
    this.frames++;
    this.calls += info.render.calls;
    this.tris += info.render.triangles;
    this.worst = Math.max(this.worst, dt);
    if (this.time < 0.5) return;
    const q = this.app.quality, f = this.frames;
    this.el.textContent = [
      `${Math.round(f / this.time)} fps · ${((this.time / f) * 1000).toFixed(1)} ms (worst ${(this.worst * 1000).toFixed(0)})`,
      `${q.name} · pixel ratio ${q.pr} · ${Math.round(this.calls / f)} draws · ${Math.round(this.tris / f / 1000)}k triangles`,
      `${info.programs.length} shaders · ${info.memory.geometries} geometries · ${info.memory.textures} textures`,
    ].join('\n');
    this.reset();
  }
}
