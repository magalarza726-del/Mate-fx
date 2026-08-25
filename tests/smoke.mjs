import assert from 'node:assert/strict';
import { compileExpression, normalizeExpression } from '../src/math.js';
import {
  evalGeometry,
  straightTrianglePoints,
  curvedPoints,
  geometryAnchorPoints,
} from '../src/geometry.js';

const EPS = 1e-8;
const approx = (actual, expected, epsilon = EPS, message = '') => {
  assert.ok(Number.isFinite(actual), `${message} expected finite value, got ${actual}`);
  assert.ok(Math.abs(actual - expected) <= epsilon, `${message} expected ${expected}, got ${actual}`);
};

function testParser() {
  assert.equal(compileExpression('x^2')(4), 16);
  assert.equal(compileExpression('f(x)=x²+x³')(2), 12);
  assert.equal(compileExpression('2x+√(x^2)')(3), 9);
  assert.equal(compileExpression('2(x+1)')(4), 10);
  assert.equal(compileExpression('-2^2')(0), -4);
  assert.equal(compileExpression('2^3^2')(0), 512);
  assert.equal(compileExpression('n^x')(3, 2), 8);
  assert.equal(compileExpression('|-x|')(5), 5);
  approx(compileExpression('ln(e)')(1), 1, 1e-12, 'ln(e)');

  const nested = compileExpression('√(x^2+sin(x)^2)')(2);
  approx(nested, Math.sqrt(4 + Math.sin(2) ** 2), 1e-12, 'nested square root');

  assert.equal(normalizeExpression('y = 2πx'), '2pix');
  assert.throws(() => compileExpression('sin()'), /espera 1 argumento/);
  assert.throws(() => compileExpression('sqrt(1,2)'), /espera 1 argumento/);
}

function testStraightGeometry() {
  const g90 = evalGeometry(4, 16, 90);
  approx(g90.q.x, 0, 1e-10, 'q.x at 90°');
  approx(g90.q.y, 16, 1e-10, 'q.y at 90°');
  assert.equal(g90.product, 64);
  approx(g90.area, 64, 1e-10, 'oriented area at 90°');
  approx(g90.diff2, 0, 1e-10, 'distance-square difference at 90°');

  const p90 = straightTrianglePoints(g90);
  assert.deepEqual(p90.map(p => [Math.round(p.x), Math.round(p.y)]), [[-4, 0], [0, 16], [4, 0]]);

  const g0 = evalGeometry(4, 16, 0);
  const p0 = straightTrianglePoints(g0);
  assert.deepEqual(p0, [{ x: 4, y: 0 }, { x: 10, y: 10 }, { x: 16, y: 0 }]);
}

function assertCircle(points, cx, cy, radius, label) {
  for (const point of points) {
    const value = (point.x - cx) ** 2 + (point.y - cy) ** 2;
    approx(value, radius ** 2, 1e-6, label);
  }
}

function testCurvedGeometry() {
  const g0 = evalGeometry(4, 16, 0);
  const upper0 = curvedPoints(g0, 1, 48);
  const lower0 = curvedPoints(g0, -1, 48);
  assertCircle(upper0, 10, 0, 6, '0° upper circle');
  assertCircle(lower0, 10, 0, 6, '0° lower circle');
  approx(upper0[0].x, 4, EPS, '0° circle start');
  approx(upper0.at(-1).x, 16, EPS, '0° circle end');
  assert.ok(upper0[24].y > 0, 'upper semicircle should be above the axis');
  assert.ok(lower0[24].y < 0, 'lower semicircle should be below the axis');

  const g180 = evalGeometry(4, 16, 180);
  const upper180 = curvedPoints(g180, 1, 48);
  const lower180 = curvedPoints(g180, -1, 48);
  assertCircle(upper180, -10, 0, 6, '180° upper circle');
  assertCircle(lower180, -10, 0, 6, '180° lower circle');
  approx(upper180[0].x, -4, EPS, '180° circle start');
  approx(upper180.at(-1).x, -16, EPS, '180° circle end');

  const g90 = evalGeometry(4, 16, 90);
  const plus90 = curvedPoints(g90, 1, 48);
  const minus90 = curvedPoints(g90, -1, 48);
  approx(plus90[0].x, 4, EPS, '90° plus start x');
  approx(plus90[0].y, 0, EPS, '90° plus start y');
  approx(minus90[0].x, -4, EPS, '90° minus start x');
  approx(plus90.at(-1).x, 0, 1e-10, '90° end x');
  approx(plus90.at(-1).y, 16, 1e-10, '90° end y');

  assert.equal(geometryAnchorPoints(g0, 'curves').length, 2, 'coincident circle has two distinct endpoints');
  assert.equal(geometryAnchorPoints(g90, 'curves').length, 3, 'perpendicular curves have ±x and common output');

  for (const angle of [1, 30, 89, 91, 120, 150, 179, 181, 225, 269, 271, 315, 359]) {
    const geometry = evalGeometry(7, 49, angle);
    for (const branch of [1, -1]) {
      for (const point of curvedPoints(geometry, branch, 32)) {
        assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), `finite curve point at ${angle}°`);
      }
    }
  }
}

testParser();
testStraightGeometry();
testCurvedGeometry();
console.log('Mate-fx smoke tests: OK');
