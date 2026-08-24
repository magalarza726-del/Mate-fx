// Small presentation layer. It deliberately does not alter the geometry formulas.
const $ = (id) => document.getElementById(id);

function compactInitialRange(){
  const max = $('xMaxInput');
  if (!max || max.dataset.polished) return;
  max.dataset.polished = '1';
  // A shorter default range makes fast-growing functions (x², exp, n^x) legible
  // without changing equal-axis scaling or the mathematical angle.
  if (Number(max.value) === 8) {
    max.value = '6';
    max.dispatchEvent(new Event('change', { bubbles:true }));
  }
}

function polishGraphLabels(){
  const overlay = document.querySelector('#screenLabels');
  if (!overlay) return;
  const labels = [...overlay.querySelectorAll('.geom-label')];
  for (const label of labels) {
    const m = label.textContent.match(/^x=([^·]+)·\s*f=(.+)$/);
    if (m) label.textContent = `${m[1].trim()} → ${m[2].trim()}`;
  }

  const subtle = labels.filter(el => el.classList.contains('subtle'));
  subtle.forEach(el => { el.style.display = ''; });
  // Preserve context while preventing a wall of tiny labels.
  if (subtle.length > 4) subtle.forEach((el,i) => { if (i % 2 === 1) el.style.display = 'none'; });

  const selected = labels.find(el => !el.classList.contains('subtle'));
  if (selected) selected.classList.add('polished-selected');
}

function syncModeLanguage(){
  const curves = $('curvesModeBtn')?.classList.contains('active');
  const hint = $('modeHint');
  if (hint) hint.textContent = curves
    ? 'Conecta ±x con f(x) mediante cuartos de elipse; al coincidir los ejes conserva la orientación superior/inferior.'
    : 'Conecta −x y +x con f(x) mediante segmentos rectos.';
}

function watchGraph(){
  const graph = $('graph');
  if (!graph) return;
  let queued = false;
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued=false; polishGraphLabels(); syncModeLanguage(); });
  };
  new MutationObserver(schedule).observe(graph,{subtree:true,childList:true,characterData:true});
  schedule();
}

requestAnimationFrame(() => {
  compactInitialRange();
  watchGraph();
  $('linesModeBtn')?.addEventListener('click', syncModeLanguage);
  $('curvesModeBtn')?.addEventListener('click', syncModeLanguage);
});
