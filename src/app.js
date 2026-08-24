import { compileExpression, prettyExpression, formatNumber } from './math.js';
import {
  svgEl, degToRad, evalGeometry, makeLinePath, makeCurvePath,
  geometryBounds, axisTickStep, readableTick,
} from './geometry.js';

const $ = (id) => document.getElementById(id);
const els = {
  functionInput: $('functionInput'), functionError: $('functionError'), prettyFunction: $('prettyFunction'),
  presetGrid: $('presetGrid'), morePresetsBtn: $('morePresetsBtn'), parameterSection: $('parameterSection'), parameterN: $('parameterN'),
  linesModeBtn: $('linesModeBtn'), curvesModeBtn: $('curvesModeBtn'), modeHint: $('modeHint'),
  angleSlider: $('angleSlider'), angleNumber: $('angleNumber'), angleBadge: $('angleBadge'),
  playBtn: $('playBtn'), speedSelect: $('speedSelect'),
  xMinInput: $('xMinInput'), xMaxInput: $('xMaxInput'), rangeLabel: $('rangeLabel'),
  stage: $('stage'), graph: $('graph'), viewport: $('viewport'), axisLayer: $('axisLayer'), geometryLayer: $('geometryLayer'),
  pointLayer: $('pointLayer'), labelLayer: $('labelLayer'),
  inspector: $('inspector'), inspectorToggle: $('inspectorToggle'), inspectorBody: $('inspectorBody'),
  selectedTitle: $('selectedTitle'), metricFx: $('metricFx'), metricTheta: $('metricTheta'), metricProduct: $('metricProduct'),
  metricQ: $('metricQ'), metricArea: $('metricArea'), metricCos: $('metricCos'), metricSin: $('metricSin'),
  metricDPlus: $('metricDPlus'), metricDMinus: $('metricDMinus'), metricDiff: $('metricDiff'), metricEllipse: $('metricEllipse'),
  fitBtn: $('fitBtn'), fitBtn2: $('fitBtn2'), resetBtn: $('resetBtn'), helpBtn: $('helpBtn'), helpDialog: $('helpDialog'),
  zoomInBtn: $('zoomInBtn'), zoomOutBtn: $('zoomOutBtn'), gestureTip: $('gestureTip'),
};

const DEFAULTS = {
  expression: 'x^2', parameterN: 3, mode: 'lines', angle: 90, xMin: 1, xMax: 8,
  selectedX: 4,
};

const state = {
  ...DEFAULTS,
  evaluator: compileExpression(DEFAULTS.expression),
  geometries: [], invalidXs: [],
  camera: { scale: 42, panX: 570, panY: 480 },
  autoFit: true,
  dragging: false, dragStart: null, cameraStart: null,
  animationId: null, lastAnimationTime: null,
};

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function updateExpression(raw, { keepPreset = false } = {}) {
  try {
    const evaluator = compileExpression(raw || '0');
    state.expression = raw || '0';
    state.evaluator = evaluator;
    els.functionError.textContent = '';
    els.functionInput.setAttribute('aria-invalid', 'false');
    els.parameterSection.hidden = !evaluator.usesN;
    els.prettyFunction.textContent = `f(x) = ${prettyExpression(state.expression)}`;
    if (!keepPreset) syncPresetActive();
    rebuild({ fit: true });
  } catch (err) {
    els.functionError.textContent = err.message;
    els.functionInput.setAttribute('aria-invalid', 'true');
  }
}

function syncPresetActive() {
  const norm = state.evaluator?.normalized;
  for (const btn of els.presetGrid.querySelectorAll('.preset')) {
    try {
      const pNorm = compileExpression(btn.dataset.expression).normalized;
      btn.classList.toggle('active', pNorm === norm);
    } catch { btn.classList.remove('active'); }
  }
}

function computeGeometries() {
  const out = [];
  const invalid = [];
  const nParam = Number(els.parameterN.value || state.parameterN);
  state.parameterN = Number.isFinite(nParam) ? nParam : 3;
  const start = Math.max(1, Math.floor(state.xMin));
  const end = Math.min(50, Math.floor(state.xMax));
  for (let x = start; x <= end; x++) {
    let fx;
    try { fx = state.evaluator(x, state.parameterN); } catch { fx = NaN; }
    if (!Number.isFinite(fx) || Math.abs(fx) > 1e12) {
      invalid.push(x);
      continue;
    }
    out.push(evalGeometry(x, fx, state.angle));
  }
  state.geometries = out;
  state.invalidXs = invalid;
  if (!out.some(g => g.x === state.selectedX)) state.selectedX = out.at(Math.min(3, Math.max(0, out.length - 1)))?.x ?? start;
}

function getSelectedGeometry() { return state.geometries.find(g => g.x === state.selectedX) || state.geometries[0]; }

function rebuild({ fit = false } = {}) {
  computeGeometries();
  if (fit || state.autoFit) fitView(false);
  render();
  updateInspector();
  updateLabels();
}

function updateLabels() {
  els.angleSlider.value = state.angle;
  els.angleNumber.value = stripZeros(state.angle);
  els.angleBadge.textContent = `θ = ${stripZeros(state.angle)}°`;
  els.metricTheta.textContent = `${stripZeros(state.angle)}°`;
  els.rangeLabel.textContent = `${state.xMin} ≤ x ≤ ${state.xMax}`;
  els.modeHint.textContent = state.mode === 'lines'
    ? 'Une −x y +x con f(x) mediante segmentos.'
    : 'Elipses en ejes separados; convención circular al coincidir.';
}

function stripZeros(v) {
  const n = Math.round(Number(v) * 10) / 10;
  return Number.isInteger(n) ? String(n) : String(n.toFixed(1));
}

function fitView(renderAfter = true) {
  const bounds = geometryBounds(state.geometries, state.mode);
  const stageRect = els.stage.getBoundingClientRect();
  const w = Math.max(stageRect.width || 1000, 320);
  const h = Math.max(stageRect.height || 700, 260);
  const inspectorReserve = stageRect.width > 800 ? 250 : 40;
  const pad = 90;
  let minX = bounds.minX, maxX = bounds.maxX, minY = bounds.minY, maxY = bounds.maxY;

  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  minX -= spanX * .12; maxX += spanX * .12;
  minY -= spanY * .15; maxY += spanY * .15;

  const usableW = Math.max(200, w - inspectorReserve - pad * 2);
  const usableH = Math.max(180, h - pad * 2);
  const scale = clamp(Math.min(usableW / (maxX - minX), usableH / (maxY - minY)), 0.00001, 240);
  const worldCx = (minX + maxX) / 2;
  const worldCy = (minY + maxY) / 2;
  const visualCx = pad + usableW / 2;
  const visualCy = h / 2;
  state.camera.scale = scale;
  state.camera.panX = visualCx - worldCx * scale;
  state.camera.panY = visualCy + worldCy * scale;
  state.autoFit = false;
  if (renderAfter) render();
}

function render() {
  const stageRect = els.stage.getBoundingClientRect();
  const width = Math.max(320, stageRect.width || 1200);
  const height = Math.max(260, stageRect.height || 800);
  els.graph.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const bg = els.graph.querySelector('.graph-bg');
  bg.setAttribute('width', width); bg.setAttribute('height', height);

  els.viewport.setAttribute('transform', `translate(${state.camera.panX} ${state.camera.panY}) scale(${state.camera.scale} ${-state.camera.scale})`);
  clear(els.axisLayer); clear(els.geometryLayer); clear(els.pointLayer); clear(els.labelLayer);
  renderAxes(width, height);
  renderGeometry();
  renderLabelsScreenSpace();
}

function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

function screenToWorld(sx, sy) {
  return {
    x: (sx - state.camera.panX) / state.camera.scale,
    y: -(sy - state.camera.panY) / state.camera.scale,
  };
}

function worldToScreen(x, y) {
  return { x: state.camera.panX + x * state.camera.scale, y: state.camera.panY - y * state.camera.scale };
}

function visibleWorldBounds(width, height) {
  const a = screenToWorld(0, height);
  const b = screenToWorld(width, 0);
  return { minX: a.x, maxX: b.x, minY: a.y, maxY: b.y };
}

function renderAxes(width, height) {
  const bounds = visibleWorldBounds(width, height);
  const strokeScale = 1 / state.camera.scale;
  const theta = degToRad(state.angle);
  const ef = { x: Math.cos(theta), y: Math.sin(theta) };
  const extent = Math.max(
    Math.abs(bounds.minX), Math.abs(bounds.maxX), Math.abs(bounds.minY), Math.abs(bounds.maxY), 10
  ) * 2.2;

  els.axisLayer.append(svgEl('line', {
    x1: -extent, y1: 0, x2: extent, y2: 0,
    class: 'axis-line',
  }));
  els.axisLayer.append(svgEl('line', {
    x1: -ef.x * extent, y1: -ef.y * extent, x2: ef.x * extent, y2: ef.y * extent,
    class: 'axis-output',
  }));

  const worldPerPixel = 1 / state.camera.scale;
  const step = axisTickStep(worldPerPixel);
  const tickLen = 5 * strokeScale;

  const firstX = Math.ceil(bounds.minX / step) * step;
  for (let x = firstX; x <= bounds.maxX + step * .5; x += step) {
    els.axisLayer.append(svgEl('line', { x1: x, y1: -tickLen, x2: x, y2: tickLen, class: 'axis-tick' }));
  }

  const tExtent = extent / 1.5;
  const normal = { x: -ef.y, y: ef.x };
  for (let t = -tExtent; t <= tExtent; t += step) {
    if (Math.abs(t) < step * .25) continue;
    const px = ef.x * t, py = ef.y * t;
    els.axisLayer.append(svgEl('line', {
      x1: px - normal.x * tickLen, y1: py - normal.y * tickLen,
      x2: px + normal.x * tickLen, y2: py + normal.y * tickLen, class: 'axis-tick', opacity: .65,
    }));
  }

  const r = 44 / state.camera.scale;
  const angle = ((state.angle % 360) + 360) % 360;
  const sweep = angle <= 180 ? angle : angle - 360;
  const endRad = degToRad(sweep);
  const start = { x: r, y: 0 };
  const end = { x: r * Math.cos(endRad), y: r * Math.sin(endRad) };
  const largeArc = Math.abs(sweep) > 180 ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 0 : 1;
  els.axisLayer.append(svgEl('path', {
    d: `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${end.x} ${end.y}`,
    class: 'angle-arc',
  }));
}

function renderGeometry() {
  const s = state.camera.scale;
  for (const g of state.geometries) {
    const group = svgEl('g', { class: `geom-object${g.x === state.selectedX ? ' selected' : ''}`, 'data-x': g.x, tabindex: 0 });
    if (state.mode === 'lines') {
      group.append(svgEl('path', { d: `${makeLinePath(g)} Z`, class: 'geom-fill' }));
      group.append(svgEl('path', { d: makeLinePath(g), class: 'geom-line' }));
    } else {
      group.append(svgEl('path', { d: makeCurvePath(g), class: 'geom-line' }));
    }
    group.addEventListener('click', (ev) => { ev.stopPropagation(); selectX(g.x); });
    group.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') selectX(g.x); });
    els.geometryLayer.append(group);

    const rr = 3.7 / s;
    for (const p of [g.pMinus, g.pPlus]) {
      els.pointLayer.append(svgEl('circle', { cx: p.x, cy: p.y, r: rr, class: 'geom-point' }));
    }
    els.pointLayer.append(svgEl('circle', {
      cx: g.q.x, cy: g.q.y, r: g.x === state.selectedX ? 5.2 / s : rr,
      class: `geom-point${g.x === state.selectedX ? ' selected-point' : ''}`,
    }));
  }
}

function renderLabelsScreenSpace() {
  const width = els.stage.clientWidth || 1200;
  const height = els.stage.clientHeight || 800;
  const bounds = visibleWorldBounds(width, height);
  const step = axisTickStep(1 / state.camera.scale);
  const firstX = Math.ceil(bounds.minX / step) * step;

  let overlay = els.graph.querySelector('#screenLabels');
  if (!overlay) { overlay = svgEl('g', { id: 'screenLabels' }); els.graph.append(overlay); }
  clear(overlay);

  const xAxisY = worldToScreen(0, 0).y;
  for (let x = firstX; x <= bounds.maxX + step * .5; x += step) {
    if (Math.abs(x) < step * .2) continue;
    const p = worldToScreen(x, 0);
    if (p.x < -20 || p.x > width + 20) continue;
    const t = svgEl('text', { x: p.x, y: xAxisY + 18, class: 'axis-label', 'text-anchor': 'middle' });
    t.textContent = readableTick(x); overlay.append(t);
  }

  const theta = degToRad(state.angle);
  const ef = { x: Math.cos(theta), y: Math.sin(theta) };
  const normal = { x: -ef.y, y: ef.x };
  const tMin = -Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const tMax = -tMin;
  const firstT = Math.ceil(tMin / step) * step;
  for (let tVal = firstT; tVal <= tMax; tVal += step) {
    if (Math.abs(tVal) < step * .2) continue;
    const wp = { x: ef.x * tVal, y: ef.y * tVal };
    const sp = worldToScreen(wp.x, wp.y);
    if (sp.x < 10 || sp.x > width - 10 || sp.y < 10 || sp.y > height - 10) continue;
    const offset = 10;
    const text = svgEl('text', {
      x: sp.x + normal.x * offset,
      y: sp.y - normal.y * offset,
      class: 'axis-label', 'text-anchor': 'middle', opacity: .72,
    });
    text.textContent = readableTick(tVal); overlay.append(text);
  }

  const exName = svgEl('text', { x: width - 28, y: xAxisY - 10, class: 'axis-name', 'text-anchor': 'end' });
  exName.textContent = '+x'; overlay.append(exName);
  const dist = Math.min(width, height) * .34 / state.camera.scale;
  const efSP = worldToScreen(ef.x * dist, ef.y * dist);
  const fName = svgEl('text', { x: clamp(efSP.x + 10, 16, width - 16), y: clamp(efSP.y - 10, 18, height - 18), class: 'axis-name' });
  fName.textContent = '+f(x)'; overlay.append(fName);

  const sorted = [...state.geometries];
  const labelStride = sorted.length > 12 ? 3 : sorted.length > 8 ? 2 : 1;
  sorted.forEach((g, idx) => {
    if (g.x !== state.selectedX && idx % labelStride !== 0) return;
    const p = worldToScreen(g.q.x, g.q.y);
    if (p.x < 0 || p.x > width || p.y < 0 || p.y > height) return;
    const t = svgEl('text', { x: p.x + 8, y: p.y - 8, class: `geom-label${g.x === state.selectedX ? '' : ' subtle'}` });
    t.textContent = `x=${g.x} · f=${formatNumber(g.fx, 3)}`;
    overlay.append(t);
  });

  if (state.invalidXs.length) {
    const t = svgEl('text', { x: 18, y: height - 18, class: 'invalid-label' });
    t.textContent = `Omitidos por valor no finito: x = ${state.invalidXs.slice(0, 8).join(', ')}${state.invalidXs.length > 8 ? '…' : ''}`;
    overlay.append(t);
  }
}

function updateInspector() {
  const g = getSelectedGeometry();
  if (!g) {
    els.selectedTitle.textContent = 'Sin valores';
    return;
  }
  els.selectedTitle.textContent = `x = ${g.x}`;
  els.metricFx.textContent = formatNumber(g.fx);
  els.metricTheta.textContent = `${stripZeros(state.angle)}°`;
  els.metricProduct.textContent = `x·f(x) = ${formatNumber(g.product)}`;
  els.metricQ.textContent = `Q = (${formatNumber(g.q.x, 3)}, ${formatNumber(g.q.y, 3)})`;
  els.metricArea.textContent = `A = ${formatNumber(g.area)}`;
  els.metricCos.textContent = formatNumber(g.cosComponent);
  els.metricSin.textContent = formatNumber(g.sinComponent);
  els.metricDPlus.textContent = formatNumber(g.dPlus2);
  els.metricDMinus.textContent = formatNumber(g.dMinus2);
  els.metricDiff.textContent = formatNumber(g.diff2);
  els.metricEllipse.textContent = formatNumber(g.ellipseQuarterOriented);
}

function selectX(x) {
  state.selectedX = x;
  render(); updateInspector();
}

function setMode(mode) {
  state.mode = mode;
  els.linesModeBtn.classList.toggle('active', mode === 'lines');
  els.curvesModeBtn.classList.toggle('active', mode === 'curves');
  rebuild({ fit: false });
}

function setAngle(value, { fit = false } = {}) {
  let a = Number(value);
  if (!Number.isFinite(a)) return;
  a = clamp(a, 0, 360);
  state.angle = a;
  rebuild({ fit });
}

function setRange() {
  let min = clamp(Math.floor(Number(els.xMinInput.value) || 1), 1, 50);
  let max = clamp(Math.floor(Number(els.xMaxInput.value) || 8), 1, 50);
  if (min > max) [min, max] = [max, min];
  state.xMin = min; state.xMax = max;
  els.xMinInput.value = min; els.xMaxInput.value = max;
  rebuild({ fit: true });
}

function zoomAt(screenX, screenY, factor) {
  const before = screenToWorld(screenX, screenY);
  state.camera.scale = clamp(state.camera.scale * factor, 0.00001, 800);
  state.camera.panX = screenX - before.x * state.camera.scale;
  state.camera.panY = screenY + before.y * state.camera.scale;
  state.autoFit = false;
  render();
}

function startAnimation() {
  if (state.animationId) { stopAnimation(); return; }
  els.playBtn.textContent = 'Ⅱ Pausar';
  state.lastAnimationTime = null;
  const tick = (time) => {
    if (state.lastAnimationTime == null) state.lastAnimationTime = time;
    const dt = Math.min((time - state.lastAnimationTime) / 1000, .1);
    state.lastAnimationTime = time;
    const speed = Number(els.speedSelect.value) || 18;
    let next = state.angle + speed * dt;
    if (next > 360) next -= 360;
    state.angle = next;
    computeGeometries(); render(); updateInspector(); updateLabels();
    state.animationId = requestAnimationFrame(tick);
  };
  state.animationId = requestAnimationFrame(tick);
}

function stopAnimation() {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.animationId = null; state.lastAnimationTime = null;
  els.playBtn.textContent = '▶ Animar';
}

let expressionTimer;
els.functionInput.addEventListener('input', () => {
  clearTimeout(expressionTimer);
  expressionTimer = setTimeout(() => updateExpression(els.functionInput.value), 120);
});
els.functionInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') updateExpression(els.functionInput.value); });

els.presetGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.preset'); if (!btn) return;
  els.functionInput.value = btn.dataset.expression;
  updateExpression(btn.dataset.expression, { keepPreset: true });
  syncPresetActive();
});
els.morePresetsBtn.addEventListener('click', () => {
  const expanded = els.presetGrid.classList.toggle('expanded');
  els.morePresetsBtn.textContent = expanded ? 'Menos' : 'Más';
});
els.parameterN.addEventListener('input', () => rebuild({ fit: true }));
els.linesModeBtn.addEventListener('click', () => setMode('lines'));
els.curvesModeBtn.addEventListener('click', () => setMode('curves'));

els.angleSlider.addEventListener('input', () => setAngle(els.angleSlider.value));
els.angleNumber.addEventListener('input', () => {
  const v = Number(els.angleNumber.value);
  if (Number.isFinite(v) && v >= 0 && v <= 360) setAngle(v);
});
els.angleNumber.addEventListener('change', () => {
  const v = clamp(Number(els.angleNumber.value) || 0, 0, 360);
  setAngle(v); els.angleNumber.value = stripZeros(v);
});
document.querySelector('.angle-ticks').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-angle]'); if (btn) setAngle(Number(btn.dataset.angle));
});
els.playBtn.addEventListener('click', startAnimation);

els.xMinInput.addEventListener('change', setRange);
els.xMaxInput.addEventListener('change', setRange);

els.fitBtn.addEventListener('click', () => fitView());
els.fitBtn2.addEventListener('click', () => fitView());
els.zoomInBtn.addEventListener('click', () => zoomAt(els.stage.clientWidth / 2, els.stage.clientHeight / 2, 1.2));
els.zoomOutBtn.addEventListener('click', () => zoomAt(els.stage.clientWidth / 2, els.stage.clientHeight / 2, 1 / 1.2));
els.resetBtn.addEventListener('click', () => {
  stopAnimation();
  state.expression = DEFAULTS.expression;
  state.parameterN = DEFAULTS.parameterN;
  state.mode = DEFAULTS.mode;
  state.angle = DEFAULTS.angle;
  state.xMin = DEFAULTS.xMin;
  state.xMax = DEFAULTS.xMax;
  state.selectedX = DEFAULTS.selectedX;
  state.evaluator = compileExpression(DEFAULTS.expression);
  els.functionInput.value = DEFAULTS.expression;
  els.parameterN.value = DEFAULTS.parameterN;
  els.xMinInput.value = DEFAULTS.xMin; els.xMaxInput.value = DEFAULTS.xMax;
  els.parameterSection.hidden = true;
  els.linesModeBtn.classList.add('active'); els.curvesModeBtn.classList.remove('active');
  syncPresetActive(); rebuild({ fit: true });
});
els.helpBtn.addEventListener('click', () => els.helpDialog.showModal());
els.inspectorToggle.addEventListener('click', () => {
  const collapsed = els.inspector.classList.toggle('collapsed');
  els.inspectorToggle.textContent = collapsed ? '⌃' : '⌄';
});

els.stage.addEventListener('wheel', (e) => {
  e.preventDefault();
  const rect = els.stage.getBoundingClientRect();
  const factor = Math.exp(-e.deltaY * .0011);
  zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
}, { passive: false });

els.stage.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest?.('.geom-object')) return;
  els.stage.setPointerCapture(e.pointerId);
  state.dragging = true;
  state.dragStart = { x: e.clientX, y: e.clientY };
  state.cameraStart = { ...state.camera };
  els.stage.classList.add('dragging');
});
els.stage.addEventListener('pointermove', (e) => {
  if (!state.dragging) return;
  state.camera.panX = state.cameraStart.panX + (e.clientX - state.dragStart.x);
  state.camera.panY = state.cameraStart.panY + (e.clientY - state.dragStart.y);
  state.autoFit = false; render();
});
const endDrag = () => { state.dragging = false; els.stage.classList.remove('dragging'); };
els.stage.addEventListener('pointerup', endDrag);
els.stage.addEventListener('pointercancel', endDrag);

window.addEventListener('resize', () => {
  window.clearTimeout(window.__mateFxResize);
  window.__mateFxResize = window.setTimeout(() => { if (state.autoFit) fitView(); else render(); }, 80);
});

els.stage.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const delta = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowRight' ? 1 : -1);
    let a = state.angle + delta;
    if (a < 0) a += 360; if (a > 360) a -= 360;
    setAngle(a);
  }
});

['pointerdown', 'wheel', 'keydown'].forEach(name => els.stage.addEventListener(name, () => { els.gestureTip.style.opacity = '0'; }, { once: true }));

requestAnimationFrame(() => {
  computeGeometries(); fitView(false); render(); updateInspector(); updateLabels(); syncPresetActive();
});
