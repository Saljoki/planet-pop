import * as THREE from 'three';

const DEG = Math.PI / 180;
const f = (x) => (Number.isInteger(x) ? `${x}.0` : String(x));
const vec3 = (hex) => { const c = new THREE.Color(hex); return `vec3(${f(+c.r.toFixed(4))}, ${f(+c.g.toFixed(4))}, ${f(+c.b.toFixed(4))})`; };

/** One oval storm, swirling: the Great Red Spot, the Great Dark Spot. */
function oval(s) {
  const lat = f(+(s.lat * DEG).toFixed(4)), lon = f(+(s.lon * DEG).toFixed(4));
  const w = f(+((s.w / 2) * DEG).toFixed(4)), h = f(+((s.h / 2) * DEG).toFixed(4)), turn = s.lat < 0 ? '1.0' : '-1.0';
  return `{
    vec2 e = vec2((mod(lon - ${lon} + 3.1415927, 6.2831853) - 3.1415927) * cos(${lat}) / ${w}, (lat - ${lat}) / ${h});
    float r = length(e), a = atan(e.y, e.x);
    float arms = step(0.2, sin(r * 10.0 + a * 2.0 + uTime * 0.8 * ${turn})) * (1.0 - r);
    vec3 c = mix(${vec3(s.color)}, ${vec3(s.color)} * 1.35, arms);
    diffuseColor.rgb = mix(diffuseColor.rgb, c, 1.0 - smoothstep(0.72, 0.95, r));
    diffuseColor.rgb = mix(diffuseColor.rgb, ${vec3(s.rim)}, smoothstep(0.75, 0.95, r) * (1.0 - smoothstep(0.98, 1.3, r)) * 0.85);
  }`;
}

/** A six-sided jet stream round a pole (Saturn's hexagon): the hexagon at s.lat, turning slowly. */
function hexagon(s) {
  const pole = s.lat > 0 ? '1.0' : '-1.0', r0 = f(+((90 - Math.abs(s.lat)) * DEG).toFixed(4));
  return `{
    float co = 1.5707963 - lat * ${pole};
    float side = mod(lon + uTime * 0.01, 1.0471976) - 0.5235988;
    float edge = ${r0} * 0.866 / cos(side);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${vec3(s.color)}, (1.0 - smoothstep(edge - 0.03, edge, co)) * 0.8);
    diffuseColor.rgb = mix(diffuseColor.rgb, ${vec3(s.rim)}, smoothstep(edge - 0.035, edge - 0.01, co) * (1.0 - smoothstep(edge + 0.01, edge + 0.04, co)));
  }`;
}

/**
 * GLSL for a giant's cloud sea (theme.sea.bands and spots), spliced into the ocean's fragment shader after the
 * ocean's own colour: stripes by latitude that wave and flow (neighbouring stripes opposite ways), then each storm.
 * Expects `od` (the unit direction of the fragment), `diffuseColor` and `uTime`. Empty for a sea without stripes.
 */
export function cloudBandsGlsl(sea) {
  if (!sea.bands) return '';
  const n = f(sea.bands.count);
  return `{ // the cloud stripes and storms
    float lat = asin(clamp(od.y, -1.0, 1.0)), lon = atan(-od.z, od.x);
    float flow = sign(sin(lat * ${n} * 2.0 + 0.5));
    float wav = sin(lon * 7.0 + lat * 23.0 + uTime * 0.12 * flow) * 0.25 + sin(lon * 13.0 - lat * 17.0 - uTime * 0.07 * flow) * 0.12;
    diffuseColor.rgb = mix(diffuseColor.rgb, ${vec3(sea.bands.color)}, smoothstep(-0.1, 0.35, sin(lat * ${n} + wav)) * 0.8);
    ${(sea.spots || []).map((s) => (s.hex ? hexagon(s) : oval(s))).join('\n')}
  }`;
}
