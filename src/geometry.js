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
 * 90° is the original perpendicular triangle.
 * 180° is the coincident/opposed triangle from the later sketch.
 * Intermediate angles are a smooth vertex morph between those exact pictures.
 * -------------------------------------------------------------------------- */

function lineKeyframe0(g) {
  return [
    { ...g.pMinus },
    { x: g.fx, y: 0 },
    { ...g.pPlus },
  ];
}

function lineKeyframe90(g) {
  return [
    { ...g.pMinus },
    { x: 0, y: g.fx },
    { ...g.pPlus },
  ];
}

function lineKeyframe180(g) {
  const left = { x: -g.fx, y: 0 };
  const right = { ...g.pPlus };
  const midX = (right.x + left.x) / 2;
  const halfBase = Math.abs(right.x - left.x) / 2;
  const side = g.fx < 0 ? -1 : 1;
  const apex = { x: midX, y: side * halfBase };
  return [left, apex, right];
}

function lineKeyframe270(g) {
  return [
    { ...g.pMinus },
    { x: 0, y: -g.fx },
    { ...g.pPlus },
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
 * CURVAS
 *
 * The important rule is that the two branches NEVER lose their identity:
 *
 *   + branch always starts at (+x, 0) and is the upper connection at a
 *     coincident-axis keyframe.
 *   - branch always starts at (-x, 0) and is the lower connection.
 *
 * This is exactly the convention in the original sketches.  The old build
 * moved the negative branch toward +x while approaching 180°.  Both branches
 * then shared the same two endpoints and unintentionally formed a full inner
 * circle.  That circle was not part of the intended construction.
 *
 * Canonical curved keyframes:
 *
 *   90°  : quarter ellipses from ±x to (0, f(x)).
 *   180° : +x connects to -f(x) by the upper semicircle; -x connects to
 *          -f(x) by the lower semicircle.
 *   270° : reflected quarter ellipses below the x axis.
 *   0°   : +x connects to +f(x) above; -x connects to +f(x) below.
 *
 * Note the 0° positive branch: its diameter is |f(x)-x| and its centre is
 * (f(x)+x)/2, matching the original circle formula exactly.
 *
 * Between keyframes we morph sampled points with cosine easing, while keeping
 * the two anchors ±x fixed and the other endpoint glued to the true rotating
 * output point Q. This gives a continuous deformation without a topological
 * jump or an artificial closed loop in the middle of the rotation.
 * -------------------------------------------------------------------------- */

function quarterEllipseAt90(g, branch = 1, samples = 56, downward = false) {
  const pts = [];
  const signY = downward ? -1 : 1;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (Math.PI / 2);
    pts.push({
      x: branch * g.x * Math.cos(t),
      y: signY * g.fx * Math.sin(t),
    });
  }
  return pts;
}

function semicircleBetween(a, b, side = 1, samples = 56) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return Array.from({ length: samples + 1 }, () => ({ ...a }));

  const ux = dx / chord;
  const uy = dy / chord;
  const nx = -uy * side;
  const ny = ux * side;
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

function semicircleByGlobalY(a, b, wantUpper, samples = 56) {
  let pts = semicircleBetween(a, b, 1, samples);
  const mid = pts[Math.floor(pts.length / 2)];
  const chordMidY = (a.y + b.y) / 2;
  const isUpper = mid.y >= chordMidY;
  if (isUpper !== wantUpper) pts = semicircleBetween(a, b, -1, samples);
  return pts;
}

function morphPointSets(a, b, t, desiredStart, desiredEnd) {
  const e = cosineEase(t);
  const n = Math.min(a.length, b.length);
  const out = [];
  for (let i = 0; i < n; i++) out.push(lerpPoint(a[i], b[i], e));

  // Keep both physical anchors exact during the whole morph.
  const first = out[0];
  const last = out[out.length - 1];
  const ds = { x: desiredStart.x - first.x, y: desiredStart.y - first.y };
  const de = { x: desiredEnd.x - last.x, y: desiredEnd.y - last.y };

  for (let i = 0; i < out.length; i++) {
    const u = i / Math.max(1, out.length - 1);
    out[i].x += ds.x * (1 - u) + de.x * u;
    out[i].y += ds.y * (1 - u) + de.y * u;
  }
  return out;
}

function coincidentSemicircle(g, opposed, branch, samples = 56) {
  const start = branch > 0 ? g.pPlus : g.pMinus;
  const q = { x: opposed ? -g.fx : g.fx, y: 0 };
  return semicircleByGlobalY(start, q, branch > 0, samples);
}

export function curvedPoints(g, branch = 1, samples = 56) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);
  const start = branch > 0 ? g.pPlus : g.pMinus;

  const ell90 = quarterEllipseAt90(g, branch, samples, false);
  const ell270 = quarterEllipseAt90(g, branch, samples, true);
  const c0 = coincidentSemicircle(g, false, branch, samples);
  const c180 = coincidentSemicircle(g, true, branch, samples);

  if (a <= 90) {
    return morphPointSets(c0, ell90, a / 90, start, g.q);
  }

  if (a <= 180) {
    return morphPointSets(ell90, c180, (a - 90) / 90, start, g.q);
  }

  if (a <= 270) {
    return morphPointSets(c180, ell270, (a - 180) / 90, start, g.q);
  }

  return morphPointSets(ell270, c0, (a - 270) / 90, start, g.q);
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
      pts.push(...curvedPoints(g, 1, 24), ...curvedPoints(g, -1, 24));
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
