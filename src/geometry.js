import './ui-fixes.js';
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
    x, fx, theta, c, s, q, pPlus, pMinus,
    product, area, cosComponent, sinComponent,
    dPlus2, dMinus2, diff2: dMinus2 - dPlus2,
    ellipseQuarterOriented: (Math.PI / 4) * product * s,
  };
}

export function makeLinePath(g) {
  return `M ${g.pMinus.x} ${g.pMinus.y} L ${g.q.x} ${g.q.y} L ${g.pPlus.x} ${g.pPlus.y}`;
}

function lerp(a, b, t) { return a + (b - a) * t; }
function lerpPoint(a, b, t) { return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }; }

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  let t = (x - edge0) / (edge1 - edge0);
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  return {
    x: uu * u * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + tt * t * p3.x,
    y: uu * u * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + tt * t * p3.y,
  };
}

function sampleCubic(p0, p1, p2, p3, samples = 42) {
  const pts = [];
  for (let i = 0; i <= samples; i++) pts.push(cubicPoint(p0, p1, p2, p3, i / samples));
  return pts;
}

function orientedNormal(a, b, desiredYSign) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-12) return { x: 0, y: desiredYSign, chord: 0 };
  let nx = -dy / d;
  let ny = dx / d;
  if (ny * desiredYSign < 0) { nx = -nx; ny = -ny; }
  return { x: nx, y: ny, chord: d };
}

/**
 * Canonical curved connector.
 *
 * The original sketches define two anchor geometries:
 *  - 90°/270°: quarter-ellipse connections from ±x to f(x);
 *  - 0°/180°/360°: coincident-axis circle, where the upper arc represents +x
 *    and the lower arc represents -x.
 *
 * There is no unique Euclidean ellipse whose semiaxes remain aligned to two
 * non-perpendicular axes. The previous affine-ellipse construction therefore
 * produced skewed, unintuitive shapes at intermediate angles. Here we instead
 * use a bounded cubic morph that preserves the original anchor cases and keeps
 * every intermediate curve smooth, local and visually readable.
 */
export function curvedPoints(g, branch = 1, samples = 42) {
  const kappa = 0.5522847498307936; // standard quarter-circle / quarter-ellipse cubic constant

  // How close are the two axes to being coincident (0/180/360)?
  // Keep most of the quadrant strongly ellipse-like, and only fold into the
  // coincident-axis circle near parallel configurations.
  const parallelness = Math.abs(g.c);
  const fold = smoothstep(0.76, 0.9995, parallelness);

  const originalA = branch > 0 ? g.pPlus : g.pMinus;

  // At a coincident axis both conceptual ±x branches meet the same magnitude x
  // on the common ray. Their distinction is carried by upper (+x) / lower (-x)
  // curvature, exactly as in the user's original circle sketch.
  const coincidentDirection = g.c >= 0 ? 1 : -1;
  const foldedA = { x: coincidentDirection * g.x, y: 0 };
  const a = lerpPoint(originalA, foldedA, fold);
  const b = g.q;

  // Quarter-ellipse style controls. At 90° these are the standard cubic
  // approximation of x²/a² + y²/b² = 1 between the corresponding axis points.
  const ellipseC1 = {
    x: a.x + kappa * b.x,
    y: a.y + kappa * b.y,
  };
  const ellipseC2 = {
    x: b.x + kappa * a.x,
    y: b.y + kappa * a.y,
  };

  // Coincident-axis circular controls. Two opposite branches share the same
  // endpoints but bulge to opposite sides, forming the intended closed circle.
  const desiredYSign = branch > 0 ? 1 : -1;
  const n = orientedNormal(a, b, desiredYSign);
  const h = (2 / 3) * n.chord; // cubic approximation of a semicircle
  const circleC1 = { x: a.x + n.x * h, y: a.y + n.y * h };
  const circleC2 = { x: b.x + n.x * h, y: b.y + n.y * h };

  const c1 = lerpPoint(ellipseC1, circleC1, fold);
  const c2 = lerpPoint(ellipseC2, circleC2, fold);
  return sampleCubic(a, c1, c2, b, samples);
}

export function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

export function makeCurvePath(g) {
  const plus = curvedPoints(g, 1);
  const minus = curvedPoints(g, -1);
  // Upper branch is the conceptual +x side; lower branch is -x.
  return `${pointsToPath(plus)} ${pointsToPath(minus)}`;
}

export function geometryBounds(geometries, mode = 'lines') {
  const pts = [{ x: 0, y: 0 }];
  for (const g of geometries) {
    pts.push(g.pPlus, g.pMinus, g.q);
    if (mode === 'curves' && Number.isFinite(g.fx)) {
      pts.push(...curvedPoints(g, 1, 20), ...curvedPoints(g, -1, 20));
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
