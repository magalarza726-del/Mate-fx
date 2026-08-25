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
function smootherstep(t) {
  t = clamp01(t);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

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
 * CURVAS — volver a la definición original
 *
 * Los estados canónicos son exactamente los acordados en la conversación:
 *
 * 0°:
 *   círculo completo con
 *      centro = (f(x)+x)/2
 *      diámetro = |f(x)-x|
 *   es decir, extremos x y f(x) sobre el eje coincidente.
 *
 * 90°:
 *   dos cuartos de elipse exactos que unen ±x con (0,f(x)).
 *
 * 180°:
 *   el MISMO círculo de 0°, reflejado horizontalmente.
 *   Por tanto sus extremos son -x y -f(x), su centro es -(f+x)/2
 *   y su diámetro sigue siendo |f-x|.
 *
 * 270°:
 *   los cuartos de elipse de 90°, reflejados verticalmente.
 *
 * Importante: no usamos una cónica racional singular cerca de 0°/180°.
 * Esa fue la causa de los arcos altos que parecían elipses cuando deberían
 * estar convergiendo a círculos. En su lugar se interpola, punto a punto y
 * con parametrización compatible, entre las figuras canónicas exactas.
 * Así 179.4° es visualmente casi el círculo de 180°, como debe ocurrir.
 * -------------------------------------------------------------------------- */

function circleSemicircle(a, b, upper = true, samples = 96) {
  const cx = (a.x + b.x) / 2;
  const cy = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-12) return Array.from({ length: samples + 1 }, () => ({ ...a }));

  const ux = dx / chord;
  const uy = dy / chord;
  let nx = -uy;
  let ny = ux;
  const r = chord / 2;

  const testMidY = cy + ny * r;
  if ((upper && testMidY < cy) || (!upper && testMidY > cy)) {
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

function canonicalCircle(g, opposed = false, branch = 1, samples = 96) {
  const sign = opposed ? -1 : 1;
  const a = { x: sign * g.x, y: 0 };
  const b = { x: sign * g.fx, y: 0 };
  return circleSemicircle(a, b, branch > 0, samples);
}

function quarterEllipse(g, branch = 1, downward = false, samples = 96) {
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

function morphCanonical(fromPts, toPts, amount, trueOutputPoint) {
  const e = smootherstep(amount);
  const n = Math.min(fromPts.length, toPts.length);
  const out = new Array(n);

  for (let i = 0; i < n; i++) {
    out[i] = lerpPoint(fromPts[i], toPts[i], e);
  }

  // La salida debe seguir estando exactamente sobre el eje f rotado.
  // Corregimos la diferencia de forma distribuida a lo largo de TODA la rama,
  // no solo cerca del extremo; esto evita quiebres, rizos y falsas espirales.
  const last = out[n - 1];
  const dx = trueOutputPoint.x - last.x;
  const dy = trueOutputPoint.y - last.y;
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(1, n - 1);
    const w = smootherstep(u);
    out[i].x += dx * w;
    out[i].y += dy * w;
  }

  return out;
}

export function curvedPoints(g, branch = 1, samples = 96) {
  const a = normalizedAngle(g.angleDeg ?? g.theta * 180 / Math.PI);

  const circle0 = canonicalCircle(g, false, branch, samples);
  const ellipse90 = quarterEllipse(g, branch, false, samples);
  const circle180 = canonicalCircle(g, true, branch, samples);
  const ellipse270 = quarterEllipse(g, branch, true, samples);

  if (a <= 90) {
    return morphCanonical(circle0, ellipse90, a / 90, g.q);
  }
  if (a <= 180) {
    return morphCanonical(ellipse90, circle180, (a - 90) / 90, g.q);
  }
  if (a <= 270) {
    return morphCanonical(circle180, ellipse270, (a - 180) / 90, g.q);
  }
  return morphCanonical(ellipse270, circle0, (a - 270) / 90, g.q);
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
      pts.push(...curvedPoints(g, 1, 36), ...curvedPoints(g, -1, 36));
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
