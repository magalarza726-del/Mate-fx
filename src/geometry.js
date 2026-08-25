import { formatNumber } from './math.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  }
  return el;
}

export function degToRad(deg) { return deg * Math.PI / 180; }

export function evalGeometry(x, fx, angleDeg) {
  const theta = degToRad(angleDeg);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const q = { x: fx * c, y: fx * s };
  const pPlus = { x, y: 0 };
  const pMinus = { x: -x, y: 0 };
  const product = x * fx;
  const area = product * s;
  const cosComponent = product * c;
  const sinComponent = product * s;
  const dPlus2 = x * x + fx * fx - 2 * product * c;
  const dMinus2 = x * x + fx * fx + 2 * product * c;
  return {
    x, fx, angleDeg, theta, c, s, q, pPlus, pMinus,
    product, area, cosComponent, sinComponent,
    dPlus2, dMinus2, diff2: dMinus2 - dPlus2,
    ellipseQuarterOriented: (Math.PI / 4) * product * s,
  };
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPoint(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }
function cosineEase(t) { t = clamp01(t); return 0.5 - 0.5 * Math.cos(Math.PI * t); }

function normalizedAngle(deg) {
  let a = Number(deg) % 360;
  if (a < 0) a += 360;
  if (Math.abs(a - 360) < 1e-9) a = 0;
  return a;
}

/* --------------------------------------------------------------------------
 * RECTAS
 *
 * The two exact drawings supplied by the user are treated as canonical:
 *
 * 0°   (coincident axes):
 *   B = f(x) - x,  H = (f(x) + x)/2.
 *   The base endpoints are x and f(x); the apex sits above their midpoint
 *   at height H.  Only the two sloping sides are drawn.
 *
 * 90°  (perpendicular axes):
 *   (-x,0) -> (0,f(x)) -> (+x,0).
 *
 * 180° and 270° are the horizontal/vertical reflections of those same
 * constructions. Intermediate angles are a conservative cosine-eased morph
 * between exact keyframes. This fixes the previous 180° formula, which used
 * f(x)+x as the base and therefore did not match B=f(x)-x.
 * -------------------------------------------------------------------------- */

function lineKeyframe0(g) {
  const h = (g.fx + g.x) / 2;
  return [
    { x: g.x, y: 0 },
    { x: h, y: h },
    { x: g.fx, y: 0 },
  ];
}

function lineKeyframe90(g) {
  return [
    { x: -g.x, y: 0 },
    { x: 0, y: g.fx },
    { x: g.x, y: 0 },
  ];
}

function lineKeyframe180(g) {
  const h = (g.fx + g.x) / 2;
  return [
    { x: -g.x, y: 0 },
    { x: -h, y: h },
    { x: -g.fx, y: 0 },
  ];
}

function lineKeyframe270(g) {
  return [
    { x: g.x, y: 0 },
    { x: 0, y: -g.fx },
    { x: -g.x, y: 0 },
  ];
}

function morphTriangle(a, b, t) {
  const e = cosineEase(t);
  return a.map((p, i) => lerpPoint(p, b[i], e));
}

export function straightTrianglePoints(g) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);
  const k0 = lineKeyframe0(g);
  const k90 = lineKeyframe90(g);
  const k180 = lineKeyframe180(g);
  const k270 = lineKeyframe270(g);

  if (a <= 90) return morphTriangle(k0, k90, a / 90);
  if (a <= 180) return morphTriangle(k90, k180, (a - 90) / 90);
  if (a <= 270) return morphTriangle(k180, k270, (a - 180) / 90);
  return morphTriangle(k270, k0, (a - 270) / 90);
}

export function makeLinePath(g) {
  const pts = straightTrianglePoints(g);
  return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} L ${pts[2].x} ${pts[2].y}`;
}

/* --------------------------------------------------------------------------
 * CURVAS — conic interpolation, not a hand-drawn morph
 *
 * Exact canonical cases:
 *
 * 0° / 180°: circles.
 *   At 0° the circle has
 *      centre C=(f(x)+x)/2, diameter D=|f(x)-x|.
 *   The upper semicircle is the +x connection, the lower one is the -x
 *   connection. At 180° the construction is mirrored horizontally.
 *
 * 90° / 270°: quarter ellipses.
 *   X²/x² + Y²/f(x)² = 1, with the appropriate quadrant.
 *
 * Between the canonical positions we use rational quadratic conics. Their
 * endpoint tangents are perpendicular to the two axes, so the transition is
 * geometric and local: there is no point-cloud homotopy, no spiral-like
 * twisting and no late ellipse->circle jump.
 *
 * The second branch must change its x-anchor because at 0° both semicircles
 * share the endpoint x, while at 90° the left quarter-ellipse starts at -x.
 * The smooth periodic anchor x*cos(2θ) is the minimal cosine interpolation
 * satisfying exactly +x at 0/180/360 and -x at 90/270.
 * -------------------------------------------------------------------------- */

function circleSemicircle(a, b, upper = true, samples = 80) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return Array.from({ length: samples + 1 }, () => ({ ...a }));

  const ux = dx / chord;
  const uy = dy / chord;
  const nx0 = -uy;
  const ny0 = ux;
  let nx = nx0, ny = ny0;
  const midYIfPositive = cy + ny0 * chord / 2;
  if ((upper && midYIfPositive < cy) || (!upper && midYIfPositive > cy)) {
    nx = -nx; ny = -ny;
  }
  const r = chord / 2;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const along = -r * Math.cos(Math.PI * t);
    const bulge = r * Math.sin(Math.PI * t);
    pts.push({
      x: cx + ux * along + nx * bulge,
      y: cy + uy * along + ny * bulge,
    });
  }
  return pts;
}

function quarterEllipse(g, branch = 1, downward = false, samples = 80) {
  const pts = [];
  const sy = downward ? -1 : 1;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI / 2;
    pts.push({
      x: branch * g.x * Math.cos(t),
      y: sy * g.fx * Math.sin(t),
    });
  }
  return pts;
}

function effectiveSweepRad(theta) {
  return degToRad(180 - 90 * Math.abs(Math.sin(theta)));
}

function rationalConicBranch(g, angleDeg, branch = 1, samples = 80) {
  const theta = degToRad(angleDeg);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const q = { x: g.fx * c, y: g.fx * s };
  const sx = branch > 0 ? g.x : g.x * Math.cos(2 * theta);
  const p0 = { x: sx, y: 0 };

  if (Math.abs(s) < 1e-8) {
    const upper = branch > 0;
    return circleSemicircle(p0, q, upper, samples);
  }

  const p1 = {
    x: sx,
    y: (g.fx - sx * c) / s,
  };

  const delta = effectiveSweepRad(theta);
  let w = Math.cos(delta / 2);
  if (branch < 0) w *= -Math.cos(2 * theta);

  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const b0 = (1 - t) * (1 - t);
    const b1 = 2 * (1 - t) * t;
    const b2 = t * t;
    const den = b0 + b1 * w + b2;
    const safeDen = Math.abs(den) < 1e-10 ? (den < 0 ? -1e-10 : 1e-10) : den;
    pts.push({
      x: (b0 * p0.x + b1 * w * p1.x + b2 * q.x) / safeDen,
      y: (b0 * p0.y + b1 * w * p1.y + b2 * q.y) / safeDen,
    });
  }
  return pts;
}

function curvedPointsHalfTurn(g, a, branch, samples) {
  if (Math.abs(a) < 1e-9) {
    const p0 = { x: g.x, y: 0 };
    const q = { x: g.fx, y: 0 };
    return circleSemicircle(p0, q, branch > 0, samples);
  }
  if (Math.abs(a - 90) < 1e-9) return quarterEllipse(g, branch, false, samples);
  if (Math.abs(a - 180) < 1e-9) {
    const p0 = { x: g.x, y: 0 };
    const q = { x: -g.fx, y: 0 };
    return circleSemicircle(p0, q, branch > 0, samples);
  }
  return rationalConicBranch(g, a, branch, samples);
}

export function curvedPoints(g, branch = 1, samples = 80) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);

  if (a <= 180) return curvedPointsHalfTurn(g, a, branch, samples);

  const mirrorAngle = 360 - a;
  const mirrored = curvedPointsHalfTurn(g, mirrorAngle, -branch, samples);
  return mirrored.map(p => ({ x: p.x, y: -p.y }));
}

export function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

export function makeCurvePath(g) {
  const plus = curvedPoints(g, 1);
  const minus = curvedPoints(g, -1);
  return `${pointsToPath(plus)} ${pointsToPath(minus)}`;
}

export function geometryBounds(geometries, mode = 'lines') {
  const pts = [{ x: 0, y: 0 }];
  for (const g of geometries) {
    pts.push(g.pPlus, g.pMinus, g.q);
    if (mode === 'curves' && Number.isFinite(g.fx)) {
      pts.push(...curvedPoints(g, 1, 32), ...curvedPoints(g, -1, 32));
    } else {
      pts.push(...straightTrianglePoints(g));
    }
  }

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  }
  if (!Number.isFinite(minX)) return { minX: -5, maxX: 5, minY: -5, maxY: 5 };
  return { minX, maxX, minY, maxY };
}

export function axisTickStep(worldPerPixel, targetPixels = 74) {
  const raw = worldPerPixel * targetPixels;
  const power = 10 ** Math.floor(Math.log10(Math.max(raw, 1e-12)));
  const norm = raw / power;
  const factor = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return factor * power;
}

export function createAxisLabel(text, x, y, cls = 'axis-label') {
  const t = svgEl('text', { x, y, class: cls });
  t.textContent = text;
  return t;
}

export function readableTick(value) {
  return formatNumber(value, 3);
}
