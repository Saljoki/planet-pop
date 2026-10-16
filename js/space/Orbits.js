// Where the planets really are on a given date, and where that puts them on the (squeezed) system map.
// Elements: NASA JPL, "Approximate Positions of the Planets", Table 1 (valid 1800–2050): for each, a (au), e,
// I, L, long. of perihelion, long. of ascending node (degrees), then their rates per century. Earth is the
// Earth–Moon barycentre. Pluto's are from the same source's older table. https://ssd.jpl.nasa.gov/planets/approx_pos.html

const DEG = Math.PI / 180;
export const ORBITS = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
  pluto: [[39.48211675, 0.24882730, 17.14001206, 238.92903833, 224.06891629, 110.30393684], [-0.00031596, 0.00005170, 0.00004818, 145.20780515, -0.04062942, -0.01183482]],
};
const J2000 = Date.UTC(2000, 0, 1, 12); // (noon, 1 January 2000)

/** Centuries since J2000 at a time in milliseconds (Date.now() style). */
export const centuries = (ms) => (ms - J2000) / (36525 * 86400000);

/**
 * Heliocentric ecliptic position in au, [x, y, z] (x toward the March equinox, z toward ecliptic north), of the
 * body named `id` in ORBITS at time `ms`. `meanAnomaly` overrides the date's, to trace the whole orbit.
 */
export function position(id, ms, meanAnomaly = null) {
  const [el, rate] = ORBITS[id], T = centuries(ms);
  const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
  const w = (peri - node) * DEG, O = node * DEG, inc = I * DEG;
  let M = meanAnomaly ?? (((L - peri) % 360) + 540) % 360 - 180;
  M *= meanAnomaly === null ? DEG : 1;
  let E = M + e * Math.sin(M);
  for (let k = 0; k < 8; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E)); // Kepler's equation
  const xp = a * (Math.cos(E) - e), yp = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), cI = Math.cos(inc), sI = Math.sin(inc);
  return [
    (cw * cO - sw * sO * cI) * xp + (-sw * cO - cw * sO * cI) * yp,
    (cw * sO + sw * cO * cI) * xp + (-sw * sO + cw * cO * cI) * yp,
    sw * sI * xp + cw * sI * yp,
  ];
}

/** The Moon's mean longitude round Earth (radians) at time `ms`: good enough for where it is in its month. */
export function moonAngle(ms) { return ((218.316 + 13.176396 * ((ms - J2000) / 86400000)) % 360) * DEG; }

/**
 * Where a heliocentric position goes on the system map: the same direction, 100 × √(distance in au) out, so the
 * whole system fits a phone. The map's ground plane is the ecliptic (three.js x, -z), north up (+y), squashed.
 */
export function mapPosition([x, y, z], out = [0, 0, 0]) {
  const r = Math.hypot(x, y, z) || 1, k = (100 * Math.sqrt(r)) / r;
  out[0] = x * k;
  out[1] = z * k * 0.5;
  out[2] = -y * k;
  return out;
}
