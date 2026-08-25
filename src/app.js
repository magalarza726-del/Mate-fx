import { compileExpression, prettyExpression, formatNumber } from './math.js';
import {
  svgEl,
  degToRad,
  evalGeometry,
  makeLinePath,
  makeCurvePath,
  geometryAnchorPoints,
  geometryBounds,
  axisTickStep,
  readableTick,
} from './geometry.js';

const $ = id => document.getElementById(id);
const MAX_X = 50;
const MAX_ABS_FX = 1e12;
const POINT_RADIUS_PX = 3.7;

const els = {
  functionInput: $('functionInput'),
  functionError: $('functionError'),
  prettyFunction: $('prettyFunction'),
  presetGrid: $('presetGrid'),
  morePresetsBtn: $('morePresetsBtn'),
  parameterSection: $('parameterSection'),
  parameterN: $('parameterN'),
  linesModeBtn: $('linesModeBtn'),
  curvesModeBtn: $('curvesModeBtn'),
  modeHint: $('modeHint'),
  angleSlider: $('angleSlider'),
  angleNumber: $('angleNumber'),
  angleBadge: $('angleBadge'),
  playBtn: $('playBtn'),
  speedSelect: $('speedSelect'),
  xMinInput: $('xMinInput'),
  xMaxInput: $('xMaxInput'),
  rangeLabel: $('rangeLabel'),
  stage: $('stage'),
  graph: $('graph'),
  viewport: $('viewport'),
  axisLayer: $('axisLayer'),
  geometryLayer: $('geometryLayer'),
  pointLayer: $('pointLayer'),
  labelLayer: $('labelLayer'),
  inspector: $('inspector'),
  inspectorToggle: $('inspectorToggle'),
  inspectorBody: $('inspectorBody'),
  selectedTitle: $('selectedTitle'),
  metricFx: $('metricFx'),
  metricTheta: $('metricTheta'),
  metricProduct: $('metricProduct'),
  metricQ: $('metricQ'),
  metricArea: $('metricArea'),
  metricCos: $('metricCos'),
  metricSin: $('metricSin'),
  metricDPlus: $('metricDPlus'),
  metricDMinus: $('metricDMinus'),
  metricDiff: $('metricDiff'),
  metricEllipse: $('metricEllipse'),
  fitBtn: $('fitBtn'),
  fitBtn2: $('fitBtn2'),
  resetBtn: $('resetBtn'),
  helpBtn: $('helpBtn'),
  helpDialog: $('helpDialog'),
  zoomInBtn: $('zoomInBtn'),
  zoomOutBtn: $('zoomOutBtn'),
  gestureTip: $('gestureTip'),
};

const DEFAULTS = Object.freeze({
  expression: 'x^2',
  parameterN: 3,
  mode: 'lines',
  angle: 90,
  xMin: 1,
  xMax: 6,
  selectedX: 4,
});

const state = {
  ...DEFAULTS,
  evaluator: compileExpression(DEFAULTS.expression),
  geometries: [],
  invalidXs: [],
  camera: { scale: 42, panX: 570, panY: 480 },
  autoFit: true,
  dragging: false,
  dragStart: null,
  cameraStart: null,
  animationId: null,
  lastAnimationTime: null,
};

let expressionTimer = null;
let resizeTimer = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function stripZeros(value) {
  const rounded = Math.round(Number(value) * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function currentParameterN() {
  const value = Number(els.parameterN.value);
  return Number.isFinite(value) ? value : DEFAULTS.parameterN;
}

function updateExpression(raw, { keepPreset = false } = {}) {
  const expression = raw || '0';
  try {
    const evaluator = compileExpression(expression);
    state.expression = expression;
    state.evaluator = evaluator;
    els.functionError.textContent = '';
    els.functionInput.setAttribute('aria-invalid', 'false');
    els.parameterSection.hidden = !evaluator.usesN;
    els.prettyFunction.textContent = `f(x) = ${prettyExpression(expression)}`;
    if (!keepPreset) syncPresetActive();
    rebuild({ fit: true });
  } catch (error) {
    els.functionError.textContent = error.message;
    els.functionInput.setAttribute('aria-invalid', 'true');
  }
}

function syncPresetActive() {
  const normalized = state.evaluator?.normalized;
  for (const button of els.presetGrid.querySelectorAll('.preset')) {
    try {
      const preset = compileExpression(button.dataset.expression).normalized;
      button.classList.toggle('active', preset === normalized);
    } catch {
      button.classList.remove('active');
    }
  }
}

function normalizedRange() {
  let min = clamp(Math.floor(Number(state.xMin) || DEFAULTS.xMin), 1, MAX_X);
  let max = clamp(Math.floor(Number(state.xMax) || DEFAULTS.xMax), 1, MAX_X);
  if (min > max) [min, max] = [max, min];
  return { min, max };
}

function computeGeometries() {
  state.parameterN = currentParameterN();
  const { min, max } = normalizedRange();
  const geometries = [];
  const invalidXs = [];

  for (let x = min; x <= max; x++) {
    let fx = NaN;
    try {
      fx = state.evaluator(x, state.parameterN);
    } catch {
      fx = NaN;
    }

    if (!Number.isFinite(fx) || Math.abs(fx) > MAX_ABS_FX) {
      invalidXs.push(x);
      continue;
    }
    geometries.push(evalGeometry(x, fx, state.angle));
  }

  state.geometries = geometries;
  state.invalidXs = invalidXs;

  if (!geometries.some(g => g.x === state.selectedX)) {
    const preferredIndex = Math.min(3, Math.max(0, geometries.length - 1));
    state.selectedX = geometries.at(preferredIndex)?.x ?? min;
  }
}

function getSelectedGeometry() {
  return state.geometries.find(g => g.x === state.selectedX) || state.geometries[0];
}

function rebuild({ fit = false } = {}) {
  computeGeometries();
  if (fit || state.autoFit) fitView(false);
  render();
  updateInspector();
  updateLabels();
}

function updateLabels() {
  const angleText = stripZeros(state.angle);
  els.angleSlider.value = state.angle;
  els.angleNumber.value = angleText;
  els.angleBadge.textContent = `θ = ${angleText}°`;
  els.metricTheta.textContent = `${angleText}°`;
  els.rangeLabel.textContent = `${state.xMin} ≤ x ≤ ${state.xMax}`;
  els.modeHint.textContent = state.mode === 'lines'
    ? 'Une los puntos definidos por el modelo mediante segmentos rectos.'
    : 'Círculos en ejes coincidentes; cuartos de elipse en los estados perpendiculares.';
}

function fitView(renderAfter = true) {
  const bounds = geometryBounds(state.geometries, state.mode);
  const stageRect = els.stage.getBoundingClientRect();
  const width = Math.max(stageRect.width || 1000, 320);
  const height = Math.max(stageRect.height || 700, 260);
  const inspectorReserve = stageRect.width > 800 ? 250 : 40;
  const padding = 90;

  let { minX, maxX, minY, maxY } = bounds;
  const spanX = Math.max(maxX - minX, 2);
  const spanY = Math.max(maxY - minY, 2);
  minX -= spanX * 0.12;
  maxX += spanX * 0.12;
  minY -= spanY * 0.15;
  maxY += spanY * 0.15;

  const usableWidth = Math.max(200, width - inspectorReserve - padding * 2);
  const usableHeight = Math.max(180, height - padding * 2);
  const scale = clamp(
    Math.min(usableWidth / (maxX - minX), usableHeight / (maxY - minY)),
    0.00001,
    240,
  );

  const worldCenterX = (minX + maxX) / 2;
  const worldCenterY = (minY + maxY) / 2;
  const visualCenterX = padding + usableWidth / 2;
  const visualCenterY = height / 2;

  state.camera.scale = scale;
  state.camera.panX = visualCenterX - worldCenterX * scale;
  state.camera.panY = visualCenterY + worldCenterY * scale;
  state.autoFit = false;

  if (renderAfter) render();
}

function render() {
  const stageRect = els.stage.getBoundingClientRect();
  const width = Math.max(320, stageRect.width || 1200);
  const height = Math.max(260, stageRect.height || 800);

  els.graph.setAttribute('viewBox', `0 0 ${width} ${height}`);
  const background = els.graph.querySelector('.graph-bg');
  background?.setAttribute('width', width);
  background?.setAttribute('height', height);

  els.viewport.setAttribute(
    'transform',
    `translate(${state.camera.panX} ${state.camera.panY}) scale(${state.camera.scale} ${-state.camera.scale})`,
  );

  clear(els.axisLayer);
  clear(els.geometryLayer);
  clear(els.pointLayer);
  clear(els.labelLayer);

  renderAxes(width, height);
  renderGeometry();
  renderLabelsScreenSpace();
}

function clear(element) {
  while (element.firstChild) element.removeChild(element.firstChild);
}

function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - state.camera.panX) / state.camera.scale,
    y: -(screenY - state.camera.panY) / state.camera.scale,
  };
}

function worldToScreen(x, y) {
  return {
    x: state.camera.panX + x * state.camera.scale,
    y: state.camera.panY - y * state.camera.scale,
  };
}

function visibleWorldBounds(width, height) {
  const bottomLeft = screenToWorld(0, height);
  const topRight = screenToWorld(width, 0);
  return {
    minX: bottomLeft.x,
    maxX: topRight.x,
    minY: bottomLeft.y,
    maxY: topRight.y,
  };
}

function renderAxes(width, height) {
  const bounds = visibleWorldBounds(width, height);
  const strokeScale = 1 / state.camera.scale;
  const theta = degToRad(state.angle);
  const outputAxis = { x: Math.cos(theta), y: Math.sin(theta) };
  const axesCoincident = Math.abs(outputAxis.y) < 1e-10;
  const extent = Math.max(
    Math.abs(bounds.minX),
    Math.abs(bounds.maxX),
    Math.abs(bounds.minY),
    Math.abs(bounds.maxY),
    10,
  ) * 2.2;

  els.axisLayer.append(svgEl('line', {
    x1: -extent,
    y1: 0,
    x2: extent,
    y2: 0,
    class: 'axis-line',
  }));

  if (!axesCoincident) {
    els.axisLayer.append(svgEl('line', {
      x1: -outputAxis.x * extent,
      y1: -outputAxis.y * extent,
      x2: outputAxis.x * extent,
      y2: outputAxis.y * extent,
      class: 'axis-output',
    }));
  }

  const step = axisTickStep(1 / state.camera.scale);
  const tickLength = 5 * strokeScale;
  const firstX = Math.ceil(bounds.minX / step) * step;

  for (let x = firstX; x <= bounds.maxX + step * 0.5; x += step) {
    els.axisLayer.append(svgEl('line', {
      x1: x,
      y1: -tickLength,
      x2: x,
      y2: tickLength,
      class: 'axis-tick',
    }));
  }

  if (!axesCoincident) {
    const normal = { x: -outputAxis.y, y: outputAxis.x };
    const tickExtent = extent / 1.5;
    for (let t = -tickExtent; t <= tickExtent; t += step) {
      if (Math.abs(t) < step * 0.25) continue;
      const px = outputAxis.x * t;
      const py = outputAxis.y * t;
      els.axisLayer.append(svgEl('line', {
        x1: px - normal.x * tickLength,
        y1: py - normal.y * tickLength,
        x2: px + normal.x * tickLength,
        y2: py + normal.y * tickLength,
        class: 'axis-tick',
        opacity: 0.65,
      }));
    }
  }
}

function renderGeometry() {
  const markerRadius = POINT_RADIUS_PX / state.camera.scale;

  for (const geometry of state.geometries) {
    const selected = geometry.x === state.selectedX;
    const group = svgEl('g', {
      class: `geom-object${selected ? ' selected' : ''}`,
      'data-x': geometry.x,
      tabindex: 0,
    });

    if (state.mode === 'lines') {
      const path = makeLinePath(geometry);
      group.append(svgEl('path', { d: `${path} Z`, class: 'geom-fill' }));
      group.append(svgEl('path', { d: path, class: 'geom-line' }));
    } else {
      group.append(svgEl('path', { d: makeCurvePath(geometry), class: 'geom-line' }));
    }

    group.addEventListener('click', event => {
      event.stopPropagation();
      selectX(geometry.x);
    });
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectX(geometry.x);
      }
    });
    els.geometryLayer.append(group);

    const anchors = geometryAnchorPoints(geometry, state.mode);
    anchors.forEach(point => {
      els.pointLayer.append(svgEl('circle', {
        cx: point.x,
        cy: point.y,
        r: markerRadius,
        class: 'geom-point',
      }));
    });
  }
}

function renderLabelsScreenSpace() {
  const width = els.stage.clientWidth || 1200;
  const height = els.stage.clientHeight || 800;
  const bounds = visibleWorldBounds(width, height);
  const step = axisTickStep(1 / state.camera.scale);
  const firstX = Math.ceil(bounds.minX / step) * step;

  let overlay = els.graph.querySelector('#screenLabels');
  if (!overlay) {
    overlay = svgEl('g', { id: 'screenLabels' });
    els.graph.append(overlay);
  }
  clear(overlay);

  const xAxisY = worldToScreen(0, 0).y;
  for (let x = firstX; x <= bounds.maxX + step * 0.5; x += step) {
    if (Math.abs(x) < step * 0.2) continue;
    const point = worldToScreen(x, 0);
    if (point.x < -20 || point.x > width + 20) continue;
    const label = svgEl('text', {
      x: point.x,
      y: xAxisY + 18,
      class: 'axis-label',
      'text-anchor': 'middle',
    });
    label.textContent = readableTick(x);
    overlay.append(label);
  }

  const theta = degToRad(state.angle);
  const outputAxis = { x: Math.cos(theta), y: Math.sin(theta) };
  const axesCoincident = Math.abs(outputAxis.y) < 1e-10;

  if (!axesCoincident) {
    const normal = { x: -outputAxis.y, y: outputAxis.x };
    const tExtent = Math.hypot(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
    const firstT = Math.ceil(-tExtent / step) * step;

    for (let t = firstT; t <= tExtent; t += step) {
      if (Math.abs(t) < step * 0.2) continue;
      const worldPoint = { x: outputAxis.x * t, y: outputAxis.y * t };
      const screenPoint = worldToScreen(worldPoint.x, worldPoint.y);
      if (screenPoint.x < 10 || screenPoint.x > width - 10 || screenPoint.y < 10 || screenPoint.y > height - 10) continue;

      const label = svgEl('text', {
        x: screenPoint.x + normal.x * 10,
        y: screenPoint.y - normal.y * 10,
        class: 'axis-label',
        'text-anchor': 'middle',
        opacity: 0.72,
      });
      label.textContent = readableTick(t);
      overlay.append(label);
    }
  }

  const xName = svgEl('text', {
    x: width - 28,
    y: xAxisY - 10,
    class: 'axis-name',
    'text-anchor': 'end',
  });
  xName.textContent = '+x';
  overlay.append(xName);

  const distance = Math.min(width, height) * 0.34 / state.camera.scale;
  const outputNamePoint = worldToScreen(outputAxis.x * distance, outputAxis.y * distance);
  const outputName = svgEl('text', {
    x: clamp(outputNamePoint.x + 10, 16, width - 16),
    y: clamp(outputNamePoint.y - 10, 18, height - 18),
    class: 'axis-name',
  });
  outputName.textContent = '+f(x)';
  overlay.append(outputName);

  const labelStride = state.geometries.length > 12 ? 3 : state.geometries.length > 8 ? 2 : 1;
  state.geometries.forEach((geometry, index) => {
    if (geometry.x !== state.selectedX && index % labelStride !== 0) return;
    const point = worldToScreen(geometry.q.x, geometry.q.y);
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return;

    const label = svgEl('text', {
      x: point.x + 8,
      y: point.y - 8,
      class: `geom-label${geometry.x === state.selectedX ? '' : ' subtle'}`,
    });
    label.textContent = `${geometry.x} → ${formatNumber(geometry.fx, 3)}`;
    overlay.append(label);
  });

  if (state.invalidXs.length) {
    const label = svgEl('text', { x: 18, y: height - 18, class: 'invalid-label' });
    label.textContent = `Omitidos por valor no finito: x = ${state.invalidXs.slice(0, 8).join(', ')}${state.invalidXs.length > 8 ? '…' : ''}`;
    overlay.append(label);
  }
}

function updateInspector() {
  const geometry = getSelectedGeometry();
  if (!geometry) {
    els.selectedTitle.textContent = 'Sin valores';
    return;
  }

  els.selectedTitle.textContent = `x = ${geometry.x}`;
  els.metricFx.textContent = formatNumber(geometry.fx);
  els.metricTheta.textContent = `${stripZeros(state.angle)}°`;
  els.metricProduct.textContent = `x·f(x) = ${formatNumber(geometry.product)}`;
  els.metricQ.textContent = `Q = (${formatNumber(geometry.q.x, 3)}, ${formatNumber(geometry.q.y, 3)})`;
  els.metricArea.textContent = `A = ${formatNumber(geometry.area)}`;
  els.metricCos.textContent = formatNumber(geometry.cosComponent);
  els.metricSin.textContent = formatNumber(geometry.sinComponent);
  els.metricDPlus.textContent = formatNumber(geometry.dPlus2);
  els.metricDMinus.textContent = formatNumber(geometry.dMinus2);
  els.metricDiff.textContent = formatNumber(geometry.diff2);
  els.metricEllipse.textContent = formatNumber(geometry.ellipseQuarterOriented);
}

function selectX(x) {
  state.selectedX = x;
  render();
  updateInspector();
}

function setMode(mode) {
  if (mode !== 'lines' && mode !== 'curves') return;
  state.mode = mode;
  els.linesModeBtn.classList.toggle('active', mode === 'lines');
  els.curvesModeBtn.classList.toggle('active', mode === 'curves');
  rebuild({ fit: false });
}

function setAngle(value, { fit = false } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) return;
  state.angle = clamp(number, 0, 360);
  rebuild({ fit });
}

function setRange() {
  let min = clamp(Math.floor(Number(els.xMinInput.value) || DEFAULTS.xMin), 1, MAX_X);
  let max = clamp(Math.floor(Number(els.xMaxInput.value) || DEFAULTS.xMax), 1, MAX_X);
  if (min > max) [min, max] = [max, min];

  state.xMin = min;
  state.xMax = max;
  els.xMinInput.value = min;
  els.xMaxInput.value = max;
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
  if (state.animationId) {
    stopAnimation();
    return;
  }

  els.playBtn.textContent = 'Ⅱ Pausar';
  state.lastAnimationTime = null;

  const tick = time => {
    if (state.lastAnimationTime == null) state.lastAnimationTime = time;
    const dt = Math.min((time - state.lastAnimationTime) / 1000, 0.1);
    state.lastAnimationTime = time;
    const speed = Number(els.speedSelect.value) || 18;
    state.angle = (state.angle + speed * dt) % 360;

    computeGeometries();
    render();
    updateInspector();
    updateLabels();
    state.animationId = requestAnimationFrame(tick);
  };

  state.animationId = requestAnimationFrame(tick);
}

function stopAnimation() {
  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.animationId = null;
  state.lastAnimationTime = null;
  els.playBtn.textContent = '▶ Animar';
}

function resetApp() {
  stopAnimation();
  Object.assign(state, {
    expression: DEFAULTS.expression,
    parameterN: DEFAULTS.parameterN,
    mode: DEFAULTS.mode,
    angle: DEFAULTS.angle,
    xMin: DEFAULTS.xMin,
    xMax: DEFAULTS.xMax,
    selectedX: DEFAULTS.selectedX,
    evaluator: compileExpression(DEFAULTS.expression),
  });

  els.functionInput.value = DEFAULTS.expression;
  els.parameterN.value = DEFAULTS.parameterN;
  els.xMinInput.value = DEFAULTS.xMin;
  els.xMaxInput.value = DEFAULTS.xMax;
  els.parameterSection.hidden = true;
  els.linesModeBtn.classList.add('active');
  els.curvesModeBtn.classList.remove('active');
  syncPresetActive();
  rebuild({ fit: true });
}

els.functionInput.addEventListener('input', () => {
  clearTimeout(expressionTimer);
  expressionTimer = setTimeout(() => updateExpression(els.functionInput.value), 70);
});

els.functionInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') updateExpression(els.functionInput.value);
});

els.presetGrid.addEventListener('click', event => {
  const button = event.target.closest('.preset');
  if (!button) return;
  els.functionInput.value = button.dataset.expression;
  updateExpression(button.dataset.expression, { keepPreset: true });
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
  const value = Number(els.angleNumber.value);
  if (Number.isFinite(value) && value >= 0 && value <= 360) setAngle(value);
});

els.angleNumber.addEventListener('change', () => {
  const value = clamp(Number(els.angleNumber.value) || 0, 0, 360);
  setAngle(value);
  els.angleNumber.value = stripZeros(value);
});

document.querySelector('.angle-ticks')?.addEventListener('click', event => {
  const button = event.target.closest('[data-angle]');
  if (button) setAngle(Number(button.dataset.angle));
});

els.playBtn.addEventListener('click', startAnimation);
els.xMinInput.addEventListener('change', setRange);
els.xMaxInput.addEventListener('change', setRange);
els.fitBtn.addEventListener('click', () => fitView());
els.fitBtn2.addEventListener('click', () => fitView());
els.zoomInBtn.addEventListener('click', () => zoomAt(els.stage.clientWidth / 2, els.stage.clientHeight / 2, 1.2));
els.zoomOutBtn.addEventListener('click', () => zoomAt(els.stage.clientWidth / 2, els.stage.clientHeight / 2, 1 / 1.2));
els.resetBtn.addEventListener('click', resetApp);
els.helpBtn.addEventListener('click', () => els.helpDialog.showModal());

els.inspectorToggle.addEventListener('click', () => {
  const collapsed = els.inspector.classList.toggle('collapsed');
  els.inspectorToggle.textContent = collapsed ? '⌃' : '⌄';
});

els.stage.addEventListener('wheel', event => {
  event.preventDefault();
  const rect = els.stage.getBoundingClientRect();
  const factor = Math.exp(-event.deltaY * 0.0011);
  zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
}, { passive: false });

els.stage.addEventListener('pointerdown', event => {
  if (event.button !== 0 || event.target.closest?.('.geom-object')) return;
  els.stage.setPointerCapture(event.pointerId);
  state.dragging = true;
  state.dragStart = { x: event.clientX, y: event.clientY };
  state.cameraStart = { ...state.camera };
  els.stage.classList.add('dragging');
});

els.stage.addEventListener('pointermove', event => {
  if (!state.dragging) return;
  state.camera.panX = state.cameraStart.panX + (event.clientX - state.dragStart.x);
  state.camera.panY = state.cameraStart.panY + (event.clientY - state.dragStart.y);
  state.autoFit = false;
  render();
});

function endDrag(event) {
  if (state.dragging && event?.pointerId != null && els.stage.hasPointerCapture?.(event.pointerId)) {
    els.stage.releasePointerCapture(event.pointerId);
  }
  state.dragging = false;
  els.stage.classList.remove('dragging');
}

els.stage.addEventListener('pointerup', endDrag);
els.stage.addEventListener('pointercancel', endDrag);

window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (state.autoFit) fitView();
    else render();
  }, 80);
});

els.stage.addEventListener('keydown', event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  event.preventDefault();
  const direction = event.key === 'ArrowRight' ? 1 : -1;
  const delta = (event.shiftKey ? 10 : 1) * direction;
  let angle = (state.angle + delta) % 360;
  if (angle < 0) angle += 360;
  setAngle(angle);
});

['pointerdown', 'wheel', 'keydown'].forEach(name => {
  els.stage.addEventListener(name, () => {
    els.gestureTip.style.opacity = '0';
  }, { once: true });
});

requestAnimationFrame(() => {
  computeGeometries();
  fitView(false);
  render();
  updateInspector();
  updateLabels();
  syncPresetActive();
});
