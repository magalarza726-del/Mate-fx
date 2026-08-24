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

/**
 * Exact affine image of quarter ellipses in the local (input, output) basis.
 * Positive branch: +x -> f(x). Negative branch: -x -> f(x).
 */
export function affineEllipsePoints(g, branch = 1, samples = 34) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = (i / samples) * (Math.PI / 2);
    const u = branch * g.x * Math.cos(t);
    const v = g.fx * Math.sin(t);
    // local point u*e_x + v*e_f(theta)
    pts.push({ x: u + v * g.c, y: v * g.s });
  }
  return pts;
}

function semicircleBetween(a, b, side = 1, samples = 34) {
  // Parameterization of a semicircle with AB as diameter.
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return Array.from({ length: samples + 1 }, () => ({ ...a }));
  const ux = dx / chord;
  const uy = dy / chord;
  // left normal to A->B
  const nx = -uy * side;
  const ny = ux * side;
  const r = chord / 2;
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const along = -r * Math.cos(Math.PI * t); // -r -> +r
    const bulge = r * Math.sin(Math.PI * t);
    pts.push({ x: cx + ux * along + nx * bulge, y: cy + uy * along + ny * bulge });
  }
  return pts;
}

function blendPointSets(a, b, weightA) {
  const w = Math.max(0, Math.min(1, weightA));
  return a.map((p, i) => ({
    x: p.x * w + b[i].x * (1 - w),
    y: p.y * w + b[i].y * (1 - w),
  }));
}

/**
 * Curved connector honoring the original two anchor cases:
 *  - perpendicular axes: quarter ellipse in local coordinates;
 *  - coincident axes: semicircle convention (+x above, -x below).
 * Between them we use a smooth visual regularization. This affects only the path,
 * not the exact anchor points or the analytical invariants shown by the app.
 */
export function curvedPoints(g, branch = 1, samples = 40) {
  const ellipse = affineEllipsePoints(g, branch, samples);
  const a = branch > 0 ? g.pPlus : g.pMinus;
  const b = g.q;

  const nearParallel = Math.abs(g.s);
  // exact ellipse by ~20° away from a coincident-axis configuration.
  const ellipseWeight = smoothstep(0.04, 0.34, nearParallel);

  if (ellipseWeight >= 0.999) return ellipse;

  // At theta=0/360: + branch above, - branch below in the global drawing.
  // Choose the side by evaluating the midpoint candidate and flipping if needed.
  const desiredYSign = branch > 0 ? 1 : -1;
  let semi = semicircleBetween(a, b, 1, samples);
  const mid = semi[Math.floor(semi.length / 2)];
  const chordMidY = (a.y + b.y) / 2;
  if (Math.sign(mid.y - chordMidY || 1) !== desiredYSign) {
    semi = semicircleBetween(a, b, -1, samples);
  }
  return blendPointSets(ellipse, semi, ellipseWeight);
}

function smoothstep(edge0, edge1, x) {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  let t = (x - edge0) / (edge1 - edge0);
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

export function pointsToPath(points) {
  if (!points.length) return '';
  return points.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
}

export function makeCurvePath(g) {
  const plus = curvedPoints(g, 1);
  const minus = curvedPoints(g, -1);
  // Render as two independent connectors. Keep order so +x is conceptually first.
  return `${pointsToPath(plus)} ${pointsToPath(minus)}`;
}

export function geometryBounds(geometries, mode = 'lines') {
  const pts = [{ x: 0, y: 0 }];
  for (const g of geometries) {
    pts.push(g.pPlus, g.pMinus, g.q);
    if (mode === 'curves' && Number.isFinite(g.fx)) {
      pts.push(...curvedPoints(g, 1, 18), ...curvedPoints(g, -1, 18));
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
