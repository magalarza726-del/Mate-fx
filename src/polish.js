// Presentation-only copy adjustments. Mathematical state and geometry live in app.js.
const $ = id => document.getElementById(id);

function applyInspectorCopy() {
  const triangleCard = $('triangleMetricCard');
  const triangleLabel = triangleCard?.querySelector(':scope > span');
  if (triangleLabel) triangleLabel.textContent = 'Área triangular orientada';

  const ellipseValue = $('metricEllipse');
  const ellipseRow = ellipseValue?.closest('div');
  const ellipseLabel = ellipseRow?.querySelector('span');
  if (ellipseLabel) {
    ellipseLabel.textContent = 'Referencia elíptica';
    ellipseLabel.title = 'Coincide con el área de un cuarto de elipse en 90°/270°.';
  }
}

requestAnimationFrame(applyInspectorCopy);
