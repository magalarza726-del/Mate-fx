// Small UI corrections kept separate from the mathematical renderer.
// This module is imported by geometry.js, so it runs automatically with the app.

function scrubDecorations() {
  // The selected point used to receive a CSS radius in world units, which became
  // a giant red circle after zooming. Keep the radius calculated by app.js instead.
  document.querySelectorAll('circle.selected-point').forEach((el) => {
    el.classList.remove('selected-point');
  });

  // The angle is already shown by the slider and badge. The large SVG angle arc
  // looked like an extra mathematical circle near 180°, so remove it from canvas.
  document.querySelectorAll('.angle-arc').forEach((el) => el.remove());
}

function initializeUiFixes() {
  scrubDecorations();

  const graph = document.getElementById('graph');
  if (graph) {
    const observer = new MutationObserver(scrubDecorations);
    observer.observe(graph, { childList: true, subtree: true });
  }

  // Keep the visual default and the internal state in sync. The HTML starts at 6
  // visible naturals to avoid crushing fast-growing functions such as x^2.
  const maxInput = document.getElementById('xMaxInput');
  if (maxInput && maxInput.value === '6') {
    maxInput.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

// app.js registers its event listeners during the same module evaluation turn.
// Defer once so those listeners are ready before syncing the default range.
setTimeout(initializeUiFixes, 0);
