(() => {
  'use strict';

  if (!window.Desmos || !Desmos.GraphingCalculator) return;

  const originalGraphingCalculator = Desmos.GraphingCalculator;
  let calculator = null;

  Desmos.GraphingCalculator = function (...args) {
    calculator = originalGraphingCalculator.apply(this, args);
    window.__nPrimosCalculator = calculator;
    return calculator;
  };

  // Conserva propiedades estáticas por si la API las expone.
  Object.assign(Desmos.GraphingCalculator, originalGraphingCalculator);

  const helperCache = new Map();
  let renderTimer = null;
  let lastSignature = '';
  let tbodyObserver = null;

  function scheduleRender(delay = 160) {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(renderEnhancedTable, delay);
  }

  function getPrimeCount() {
    const input = document.getElementById('primeCountInput');
    const raw = Number.parseInt(input?.value || '25', 10);
    return Number.isFinite(raw) ? Math.min(10000, Math.max(0, raw)) : 0;
  }

  function getPrimeValues(count) {
    // Lee directamente la lista que nPrimos ya inyecta en Desmos.
    if (typeof window.__gmrPrimeValues === 'function') return window.__gmrPrimeValues(count);
    const helper = getHelper('__primes_source__', 'P_{primos}');
    return Array.isArray(helper?.listValue) ? helper.listValue.slice(0,count) : [];
  }

  function getFunctionDefinitions() {
    if (!calculator) return [];

    const list = calculator.getState()?.expressions?.list || [];
    const found = [];
    const seen = new Set();

    for (const item of list) {
      if (!item || item.type !== 'expression' || !item.latex || item.secret) continue;
      if (String(item.id || '').startsWith('__np_')) continue;

      const latex = String(item.latex).trim();
      const match = latex.match(/^\s*((?:[A-Za-z]|\\[A-Za-z]+)(?:_\{[^}]+\})?)\s*(?:\\left)?\(\s*x\s*(?:\\right)?\)\s*=/);
      if (!match) continue;

      const name = match[1];
      if (seen.has(name)) continue;
      seen.add(name);
      found.push({
        id: String(item.id || name),
        name,
        label: prettifyLatex(name),
        latex
      });
    }

    return found;
  }

  function prettifyLatex(value) {
    return String(value)
      .replace(/\\alpha/g, 'α').replace(/\\beta/g, 'β').replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ').replace(/\\phi/g, 'φ').replace(/\\theta/g, 'θ')
      .replace(/_\{([^}]+)\}/g, '₍$1₎')
      .replace(/\\/g, '');
  }

  function getHelper(key, latex) {
    let entry = helperCache.get(key);
    if (entry && entry.latex === latex) return entry.helper;

    if (entry?.helper?.unobserve) {
      try { entry.helper.unobserve('listValue'); } catch (_) {}
    }

    const helper = calculator.HelperExpression({ latex });
    try { helper.observe('listValue', () => scheduleRender(80)); } catch (_) {}
    try { helper.observe('numericValue', () => scheduleRender(80)); } catch (_) {}

    helperCache.set(key, { latex, helper });
    return helper;
  }

  function getFunctionValues(definitions, count) {
    return definitions.map(def => {
      // Los datos se distribuyen en tablas de 500 puntos. Sus columnas n_i
      // también son listas que Desmos evalúa por lotes: f(n_i), g(n_i), etc.
      // Esto evita recalcular una expresión descomunal con los 10 000 índices.
      if (count > 1000 && document.body.dataset.graphEngine === 'desmos') {
        const values=[];
        for(let chunk=0;chunk<Math.ceil(count/500);chunk++) {
          const length=Math.min(500,count-chunk*500);
          const helper=getHelper(`fn:${def.id}:${chunk}`,`${def.name}(n_{${chunk}})`);
          const partial=Array.isArray(helper?.listValue)?helper.listValue:[];
          for(let i=0;i<length;i++)values.push(partial[i]);
        }
        return {...def,values};
      }
      const helper = getHelper(`fn:${def.id}`, `${def.name}(N_{primos})`);
      const values = Array.isArray(helper?.listValue) ? helper.listValue.slice(0, count) : [];
      return { ...def, values };
    });
  }

  function numberCell(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    const abs = Math.abs(value);
    if ((abs >= 1e7) || (abs > 0 && abs < 1e-5)) return value.toExponential(5);
    if (Number.isInteger(value)) return value.toLocaleString('es-EC');
    return value.toLocaleString('es-EC', { maximumFractionDigits: 6 });
  }

  function percentCell(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value < 0.000001 && value !== 0) return `${value.toExponential(3)}%`;
    return `${value.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}%`;
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function ensureTableStyle() {
    if (document.getElementById('np-analysis-table-style')) return;
    const style = document.createElement('style');
    style.id = 'np-analysis-table-style';
    style.textContent = `
      .table-panel { width: min(1120px, calc(100% - 24px)) !important; }
      .table-wrap { overflow: auto !important; }
      .table-wrap table { width: max-content !important; min-width: 100%; }
      .table-wrap th, .table-wrap td { min-width: 105px; white-space: nowrap; }
      .table-wrap th:first-child, .table-wrap td:first-child { min-width: 58px; width: 58px; position: sticky; left: 0; z-index: 2; background: inherit; }
      .table-wrap th:nth-child(2), .table-wrap td:nth-child(2) { min-width: 90px; position: sticky; left: 58px; z-index: 2; background: inherit; box-shadow: 1px 0 0 #eceff1; }
      .table-wrap thead th:first-child, .table-wrap thead th:nth-child(2) { z-index: 4; background: #f8f9fa; }
      .table-wrap tbody tr:hover td:first-child, .table-wrap tbody tr:hover td:nth-child(2) { background: #f7f9fb; }
      .np-fn-head { color: #2d70b3; font-weight: 750; }
      .np-error-head { color: #c74440; }
      .np-percent-head { color: #8a5a00; }
      @media (max-width: 760px) {
        .table-panel { width: calc(100% - 16px) !important; right: 8px !important; }
        .table-wrap th, .table-wrap td { min-width: 96px; padding-inline: 10px; }
      }
    `;
    document.head.appendChild(style);
  }

  function renderEnhancedTable() {
    if (!calculator) calculator = window.__nPrimosCalculator || null;
    const panel = document.getElementById('primeTablePanel');
    const tbody = document.getElementById('primeTableBody');
    const table = tbody?.closest('table');
    const thead = table?.querySelector('thead');
    const subtitle = document.getElementById('tableSubtitle');

    if (!calculator || !tbody || !thead || !panel?.classList.contains('open')) return;
    if (document.body.dataset.primeProject === 'blank') {
      thead.innerHTML='<tr><th>Proyecto sin datos</th></tr>';
      tbody.replaceChildren();
      if (subtitle) subtitle.textContent='Importa un CSV/XLSX o añade primos para comenzar.';
      return;
    }

    ensureTableStyle();

    const count = getPrimeCount();
    const definitions = getFunctionDefinitions();
    const primes = getPrimeValues(count);
    const functions = getFunctionValues(definitions, count);

    // Si Desmos todavía está evaluando alguna lista, reintenta enseguida.
    if (primes.length < count) {
      scheduleRender(180);
      return;
    }

    const signature = `${count}|${definitions.map(d => `${d.id}:${d.latex}`).join('|')}|${functions.map(f => f.values.filter(Number.isFinite).length+':'+f.values.slice(0,4).join(',')+':'+f.values.slice(-4).join(',')).join('|')}`;
    const expectedCells = 2 + functions.length * 3;
    const currentCells = tbody.firstElementChild?.children?.length || 0;
    if (lastSignature === signature && currentCells === expectedCells) return;

    let head = '<tr><th>n</th><th>pₙ real</th>';
    for (const fn of functions) {
      const label = escapeHtml(fn.label);
      head += `<th class="np-fn-head">${label}(n)</th>`;
      head += `<th class="np-error-head">|Error| ${label}</th>`;
      head += `<th class="np-percent-head">Error % ${label}</th>`;
    }
    head += '</tr>';
    thead.innerHTML = head;

    const rows = new Array(count);
    for (let i = 0; i < count; i++) {
      const n = i + 1;
      const prime = primes[i];
      let cells = `<td>${n.toLocaleString('es-EC')}</td><td>${numberCell(prime)}</td>`;

      for (const fn of functions) {
        const estimate = fn.values[i];
        const valid = typeof estimate === 'number' && Number.isFinite(estimate);
        const absoluteError = valid ? Math.abs(estimate - prime) : NaN;
        const percentageError = valid && prime !== 0 ? (absoluteError / Math.abs(prime)) * 100 : NaN;
        cells += `<td>${numberCell(estimate)}</td><td>${numberCell(absoluteError)}</td><td>${percentCell(percentageError)}</td>`;
      }
      rows[i] = `<tr>${cells}</tr>`;
    }

    tbody.innerHTML = rows.join('');
    if (subtitle) {
      const suffix = functions.length
        ? ` · ${functions.length} función${functions.length === 1 ? '' : 'es'} analizada${functions.length === 1 ? '' : 's'}`
        : ' · agrega una función f(x) para calcular errores';
      subtitle.textContent = `Primeros ${count.toLocaleString('es-EC')} primos${suffix}`;
    }

    lastSignature = signature;
  }

  function start() {
    calculator = window.__nPrimosCalculator || calculator;
    const tbody = document.getElementById('primeTableBody');
    const panel = document.getElementById('primeTablePanel');
    if (!calculator || !tbody || !panel) {
      window.setTimeout(start, 80);
      return;
    }

    ensureTableStyle();

    calculator.observeEvent('change.nprimosAnalysis', () => scheduleRender(220));

    tbodyObserver = new MutationObserver(() => {
      const definitions = getFunctionDefinitions();
      const expectedCells = 2 + definitions.length * 3;
      const currentCells = tbody.firstElementChild?.children?.length || 0;
      if (panel.classList.contains('open') && currentCells !== expectedCells) scheduleRender(20);
    });
    tbodyObserver.observe(tbody, { childList: true });

    const panelObserver = new MutationObserver(() => {
      if (panel.classList.contains('open')) scheduleRender(40);
    });
    panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] });

    document.getElementById('primeCountInput')?.addEventListener('change', () => scheduleRender(80));
    document.getElementById('primeCountSlider')?.addEventListener('change', () => scheduleRender(80));

    scheduleRender(250);
  }

  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();