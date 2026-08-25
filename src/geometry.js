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
 * The original drawings define two genuinely different canonical pictures:
 *
 * 90°  : (-x,0) -> (0,f(x)) -> (+x,0)
 * 180° : the +f axis is coincident/opposed to +x.  The point f(x) becomes
 *        the left end of the base, and we erect the right-isosceles triangle
 *        seen in the user's sketch.  For f>0 its vertices are
 *        (-f,0), ((x-f)/2,(x+f)/2), (x,0).
 *
 * There is no unique theorem that dictates the intermediate drawings, so the
 * simulator performs a smooth vertex morph between these exact keyframes.
 * This is much closer to the original hypothesis than merely rotating the
 * apex and letting the triangle collapse into a line at 180°.
 * -------------------------------------------------------------------------- */

function lineKeyframe0(g) {
  // Same-direction coincident axes: intentionally degenerate. This makes
  // 0° and 360° meet continuously without inventing an extra canonical mode.
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
 * Canonical keyframes:
 *  - 90° / 270°: two quarter ellipses, exactly as requested.
 *  - 180°: one circle made from upper/lower semicircles with diameter joining
 *          +x to the f(x) point on the opposed coincident axis.
 *  - 0° / 360°: analogous same-direction coincident circle.
 *
 * The previous build stayed as an oblique affine ellipse until very close to
 * 180° and then abruptly switched to a circle. Here the entire 90° quadrant
 * participates in a cosine-eased morph, so 150° is already substantially on
 * its way toward the circle and there is no sudden last-moment change.
 * -------------------------------------------------------------------------- */

function quarterEllipseAt90(g, branch = 1, samples = 48, downward = false) {
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

function semicircleBetween(a, b, side = 1, samples = 48) {
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
    pts.push({ x: cx + ux * along + nx * bulge, y: cy + uy * along + ny * bulge });
  }
  return pts;
}

function semicircleByGlobalY(a, b, wantUpper, samples = 48) {
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

  // Endpoint correction keeps every intermediate connector attached to the
  // actual rotating f-axis point Q, rather than to the straight chord between
  // the two keyframes.
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

function circleKeyframe(g, opposed, upper, samples = 48) {
  const q = { x: opposed ? -g.fx : g.fx, y: 0 };
  return semicircleByGlobalY(g.pPlus, q, upper, samples);
}

export function curvedPoints(g, branch = 1, samples = 48) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);
  const ell90 = quarterEllipseAt90(g, branch, samples, false);
  const ell270 = quarterEllipseAt90(g, branch, samples, true);
  const c0 = circleKeyframe(g, false, branch > 0, samples);
  const c180 = circleKeyframe(g, true, branch > 0, samples);

  if (a <= 90) {
    const t = a / 90;
    const start = branch > 0
      ? g.pPlus
      : lerpPoint(g.pPlus, g.pMinus, cosineEase(t));
    return morphPointSets(c0, ell90, t, start, g.q);
  }

  if (a <= 180) {
    const t = (a - 90) / 90;
    const start = branch > 0
      ? g.pPlus
      : lerpPoint(g.pMinus, g.pPlus, cosineEase(t));
    return morphPointSets(ell90, c180, t, start, g.q);
  }

  if (a <= 270) {
    const t = (a - 180) / 90;
    const start = branch > 0
      ? g.pPlus
      : lerpPoint(g.pPlus, g.pMinus, cosineEase(t));
    return morphPointSets(c180, ell270, t, start, g.q);
  }

  const t = (a - 270) / 90;
  const start = branch > 0
    ? g.pPlus
    : lerpPoint(g.pMinus, g.pPlus, cosineEase(t));
  return morphPointSets(ell270, c0, t, start, g.q);
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
