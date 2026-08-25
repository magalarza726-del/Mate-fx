import { formatNumber } from './math.js';

export const SVG_NS = 'http://www.w3.org/2000/svg';
const EPS = 1e-12;
const DEFAULT_CURVE_SAMPLES = 96;

export function svgEl(name, attrs = {}) {
  const el = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) {
    if (value !== undefined && value !== null) el.setAttribute(key, String(value));
  }
  return el;
}

export function degToRad(deg) {
  return Number(deg) * Math.PI / 180;
}

export function evalGeometry(x, fx, angleDeg) {
  const theta = degToRad(angleDeg);
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const product = x * fx;

  return {
    x,
    fx,
    angleDeg,
    theta,
    c,
    s,
    q: { x: fx * c, y: fx * s },
    pPlus: { x, y: 0 },
    pMinus: { x: -x, y: 0 },
    product,
    area: product * s,
    cosComponent: product * c,
    sinComponent: product * s,
    dPlus2: x * x + fx * fx - 2 * product * c,
    dMinus2: x * x + fx * fx + 2 * product * c,
    diff2: 4 * product * c,
    ellipseQuarterOriented: (Math.PI / 4) * product * s,
  };
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpPoint(a, b, t) {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

function cosineEase(t) {
  const u = clamp01(t);
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
}

function smootherstep(t) {
  const u = clamp01(t);
  return u * u * u * (u * (u * 6 - 15) + 10);
}

function normalizedAngle(deg) {
  let angle = Number(deg) % 360;
  if (angle < 0) angle += 360;
  return Math.abs(angle - 360) < 1e-9 ? 0 : angle;
}

function interpolatePointSets(from, to, amount, easing = cosineEase) {
  const t = easing(amount);
  const count = Math.min(from.length, to.length);
  return Array.from({ length: count }, (_, i) => lerpPoint(from[i], to[i], t));
}

/* --------------------------------------------------------------------------
 * RECTAS
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

export function straightTrianglePoints(g) {
  const angle = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);
  const keyframes = [lineKeyframe0(g), lineKeyframe90(g), lineKeyframe180(g), lineKeyframe270(g), lineKeyframe0(g)];
  const segment = Math.min(3, Math.floor(angle / 90));
  const local = (angle - segment * 90) / 90;
  return interpolatePointSets(keyframes[segment], keyframes[segment + 1], local);
}

export function makeLinePath(g) {
  const points = straightTrianglePoints(g);
  return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y} L ${points[2].x} ${points[2].y}`;
}

/* --------------------------------------------------------------------------
 * CURVAS
 *
 * 0°/180° son círculos exactos con diámetro |f(x)-x|.
 * 90°/270° son cuartos de elipse exactos.
 * Entre esos estados, Mate-fx muestra una interpolación visual continua.
 * -------------------------------------------------------------------------- */

function circleSemicircle(a, b, upper = true, samples = DEFAULT_CURVE_SAMPLES) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);

  if (chord < EPS) {
    return Array.from({ length: samples + 1 }, () => ({ ...a }));
  }

  const ux = dx / chord;
  const uy = dy / chord;
  let nx = -uy;
  let ny = ux;
  const radius = chord / 2;

  const testMidY = cy + ny * radius;
  if ((upper && testMidY < cy) || (!upper && testMidY > cy)) {
    nx = -nx;
    ny = -ny;
  }

  const points = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const along = -radius * Math.cos(Math.PI * t);
    const bulge = radius * Math.sin(Math.PI * t);
    points.push({
      x: cx + ux * along + nx * bulge,
      y: cy + uy * along + ny * bulge,
    });
  }
  return points;
}

function canonicalCircle(g, opposed = false, branch = 1, samples = DEFAULT_CURVE_SAMPLES) {
  const sign = opposed ? -1 : 1;
  return circleSemicircle(
    { x: sign * g.x, y: 0 },
    { x: sign * g.fx, y: 0 },
    branch > 0,
    samples,
  );
}

function quarterEllipse(g, branch = 1, downward = false, samples = DEFAULT_CURVE_SAMPLES) {
  const points = [];
  const verticalSign = downward ? -1 : 1;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * Math.PI / 2;
    points.push({
      x: branch * g.x * Math.cos(t),
      y: verticalSign * g.fx * Math.sin(t),
    });
  }
  return points;
}

function morphCanonical(fromPoints, toPoints, amount, trueOutputPoint) {
  const out = interpolatePointSets(fromPoints, toPoints, amount, smootherstep);
  if (!out.length) return out;

  // El extremo de salida debe permanecer exactamente sobre el eje f rotado.
  // La corrección se distribuye suavemente para evitar quiebres locales.
  const last = out[out.length - 1];
  const dx = trueOutputPoint.x - last.x;
  const dy = trueOutputPoint.y - last.y;
  const denominator = Math.max(1, out.length - 1);

  out.forEach((point, index) => {
    const weight = smootherstep(index / denominator);
    point.x += dx * weight;
    point.y += dy * weight;
  });

  return out;
}

export function curvedPoints(g, branch = 1, samples = DEFAULT_CURVE_SAMPLES) {
  const angle = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);
  const keyframes = [
    canonicalCircle(g, false, branch, samples),
    quarterEllipse(g, branch, false, samples),
    canonicalCircle(g, true, branch, samples),
    quarterEllipse(g, branch, true, samples),
    canonicalCircle(g, false, branch, samples),
  ];

  const segment = Math.min(3, Math.floor(angle / 90));
  const local = (angle - segment * 90) / 90;
  return morphCanonical(keyframes[segment], keyframes[segment + 1], local, g.q);
}

export function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((point, i) => `${i ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
}

export function makeCurvePath(g) {
  return `${pointsToPath(curvedPoints(g, 1))} ${pointsToPath(curvedPoints(g, -1))}`;
}

function dedupePoints(points, tolerance = 1e-8) {
  const unique = [];
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    if (!unique.some(other => Math.hypot(point.x - other.x, point.y - other.y) <= tolerance)) {
      unique.push(point);
    }
  }
  return unique;
}

/**
 * Visible construction anchors. This intentionally follows the geometry that
 * is actually drawn instead of always showing the fixed ±x points.
 */
export function geometryAnchorPoints(g, mode = 'lines') {
  if (mode === 'lines') return dedupePoints(straightTrianglePoints(g));

  const plus = curvedPoints(g, 1, 24);
  const minus = curvedPoints(g, -1, 24);
  return dedupePoints([
    plus[0], plus.at(-1),
    minus[0], minus.at(-1),
  ]);
}

export function geometryBounds(geometries, mode = 'lines') {
  const points = [{ x: 0, y: 0 }];
  for (const g of geometries) {
    points.push(g.q);
    if (mode === 'curves' && Number.isFinite(g.fx)) {
      points.push(...curvedPoints(g, 1, 36), ...curvedPoints(g, -1, 36));
    } else {
      points.push(...straightTrianglePoints(g));
    }
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) continue;
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
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
  const label = svgEl('text', { x, y, class: cls });
  label.textContent = text;
  return label;
}

export function readableTick(value) {
  return formatNumber(value, 3);
}
