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
function smoothstep(t) { t = clamp01(t); return t * t * (3 - 2 * t); }

function normalizedAngle(deg) {
  let a = Number(deg) % 360;
  if (a < 0) a += 360;
  if (Math.abs(a - 360) < 1e-9) a = 0;
  return a;
}

/* --------------------------------------------------------------------------
 * RECTAS
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
 * Canonical geometry taken directly from the sketches/conversation:
 *
 * 90° / 270°
 *   The two connections are quarters of the ellipse
 *       X²/x² + Y²/f(x)² = 1
 *   joining ±x to the output point.
 *
 * 0° / 180°
 *   The object is an EXACT circle, not a spiral and not two unrelated arcs.
 *   In scalar coordinates its diameter and centre are
 *       D = |f(x) - x|
 *       C = (f(x) + x) / 2
 *   so its radius is R = D/2.
 *   At 180° the same circle is simply mirrored horizontally because the
 *   output axis points in the opposite direction.
 *
 *   The upper semicircle represents the +x connection and the lower
 *   semicircle the -x connection, exactly as specified by the user.
 *
 * There is no unique mathematical theorem fixing the shapes between these
 * canonical angles.  We therefore use a conservative pointwise homotopy:
 * quarter-ellipse <-> exact semicircle.  The output endpoint is kept on the
 * true rotating f-axis, but we do NOT pin the other endpoint artificially;
 * it is allowed to move continuously from the perpendicular construction to
 * the coincident-circle construction.  This avoids the previous golden-spiral
 * appearance and removes accidental inner loops.
 * -------------------------------------------------------------------------- */

function quarterEllipseAt90(g, branch = 1, samples = 72, downward = false) {
  const pts = [];
  const signY = downward ? -1 : 1;
  const fy = g.fx;
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (Math.PI / 2);
    pts.push({
      x: branch * g.x * Math.cos(t),
      y: signY * fy * Math.sin(t),
    });
  }
  return pts;
}

function semicircleBetween(a, b, wantUpper, samples = 72) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return Array.from({ length: samples + 1 }, () => ({ ...a }));

  const ux = dx / chord;
  const uy = dy / chord;
  const r = chord / 2;

  // Two possible normals; choose the one that makes the midpoint globally
  // upper/lower. This keeps the user's +x-above / -x-below convention stable.
  let nx = -uy;
  let ny = ux;
  if ((wantUpper && ny < 0) || (!wantUpper && ny > 0)) {
    nx = -nx;
    ny = -ny;
  }

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

function exactCoincidentSemicircle(g, opposed, branch, samples = 72) {
  const sign = opposed ? -1 : 1;

  // These endpoints give exactly:
  // centre = sign*(f+x)/2, diameter = |f-x|.
  const a = { x: sign * g.x, y: 0 };
  const b = { x: sign * g.fx, y: 0 };
  const upper = branch > 0;
  return semicircleBetween(a, b, upper, samples);
}

function morphCanonicalCurves(fromPts, toPts, t, trueOutputPoint) {
  const e = cosineEase(t);
  const n = Math.min(fromPts.length, toPts.length);
  const out = new Array(n);

  for (let i = 0; i < n; i++) out[i] = lerpPoint(fromPts[i], toPts[i], e);

  // The canonical endpoint interpolation is not exactly the circular motion
  // Q=f(cosθ,sinθ). Correct only near that endpoint, with a smooth falloff,
  // so the body of the curve keeps its intended conic/circular character.
  const last = out[n - 1];
  const dx = trueOutputPoint.x - last.x;
  const dy = trueOutputPoint.y - last.y;
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    const w = smoothstep(Math.max(0, (u - 0.55) / 0.45));
    out[i].x += dx * w;
    out[i].y += dy * w;
  }

  return out;
}

export function curvedPoints(g, branch = 1, samples = 72) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);

  const ell90 = quarterEllipseAt90(g, branch, samples, false);
  const ell270 = quarterEllipseAt90(g, branch, samples, true);
  const circle0 = exactCoincidentSemicircle(g, false, branch, samples);
  const circle180 = exactCoincidentSemicircle(g, true, branch, samples);

  if (a <= 90) {
    return morphCanonicalCurves(circle0, ell90, a / 90, g.q);
  }
  if (a <= 180) {
    return morphCanonicalCurves(ell90, circle180, (a - 90) / 90, g.q);
  }
  if (a <= 270) {
    return morphCanonicalCurves(circle180, ell270, (a - 180) / 90, g.q);
  }
  return morphCanonicalCurves(ell270, circle0, (a - 270) / 90, g.q);
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
      pts.push(...curvedPoints(g, 1, 28), ...curvedPoints(g, -1, 28));
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
