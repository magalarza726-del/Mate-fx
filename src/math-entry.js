import { compileExpression, prettyExpression, formatNumber } from './math.js';

const $ = (id) => document.getElementById(id);
const input = $('functionInput');
const toggle = $('mathKeyboardToggle');
const builder = $('mathBuilder');
const closeBtn = $('mathBuilderClose');
const status = $('builderStatus');
const samples = $('naturalSamplesList');
const historyWrap = $('functionHistory');
const clearBtn = $('clearExpressionBtn');
const parameterN = $('parameterN');
const xMinInput = $('xMinInput');
const xMaxInput = $('xMaxInput');

if (!input || !builder) {
  console.warn('Mate-fx: math entry assistant could not attach.');
} else {
  const HISTORY_KEY = 'matefx:function-history:v1';
  let lastValidExpression = input.value;

  function dispatchInput() {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    updatePreview();
  }

  function setCaret(pos) {
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(pos, pos);
    });
  }

  function replaceSelection(text, caretOffset = text.length) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(text, start, end, 'end');
    dispatchInput();
    setCaret(start + caretOffset);
  }

  function insertTemplate(template, fallback = '') {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const selected = input.value.slice(start, end);
    const marker = '§';
    const markerIndex = template.indexOf(marker);

    if (markerIndex < 0) {
      replaceSelection(template);
      return;
    }

    if (selected) {
      const rendered = template.replace(marker, selected);
      replaceSelection(rendered, rendered.length);
      return;
    }

    if (fallback) {
      const fallbackMarker = fallback.indexOf(marker);
      const rendered = fallback.replace(marker, '');
      input.setRangeText(rendered, start, end, 'end');
      dispatchInput();
      setCaret(start + (fallbackMarker >= 0 ? fallbackMarker : rendered.length));
      return;
    }

    const rendered = template.replace(marker, '');
    input.setRangeText(rendered, start, end, 'end');
    dispatchInput();
    setCaret(start + markerIndex);
  }

  function backspace() {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) {
      input.setRangeText('', start, end, 'end');
      dispatchInput();
      setCaret(start);
      return;
    }
    if (start <= 0) return;
    input.setRangeText('', start - 1, start, 'end');
    dispatchInput();
    setCaret(start - 1);
  }

  function moveCaret(delta) {
    const pos = input.selectionStart ?? input.value.length;
    setCaret(Math.max(0, Math.min(input.value.length, pos + delta)));
  }

  function toggleBuilder(force) {
    const open = force ?? builder.hidden;
    builder.hidden = !open;
    toggle?.classList.toggle('active', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => input.focus());
  }

  function currentEvaluator() {
    return compileExpression(input.value || '0');
  }

  function updatePreview() {
    try {
      const evaluator = currentEvaluator();
      lastValidExpression = input.value || '0';
      status.textContent = `f(x) = ${prettyExpression(lastValidExpression)}`;
      status.className = 'builder-status valid';

      const nValue = Number(parameterN?.value || 3);
      const min = Math.max(1, Math.floor(Number(xMinInput?.value || 1)));
      const max = Math.max(min, Math.floor(Number(xMaxInput?.value || min + 4)));
      const visible = [];
      const count = Math.min(5, max - min + 1);
      for (let i = 0; i < count; i++) {
        const x = min + i;
        let value = NaN;
        try { value = evaluator(x, Number.isFinite(nValue) ? nValue : 3); } catch { value = NaN; }
        visible.push({ x, value });
      }
      samples.innerHTML = visible.map(({ x, value }) => {
        const ok = Number.isFinite(value) && Math.abs(value) <= 1e12;
        return `<span class="sample-chip${ok ? '' : ' invalid'}">${x}↦${ok ? formatNumber(value, 3) : '—'}</span>`;
      }).join('');
    } catch (err) {
      status.textContent = err.message || 'Expresión incompleta';
      status.className = 'builder-status invalid';
      samples.innerHTML = '<span class="sample-chip invalid">corrige la expresión</span>';
    }
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(v => typeof v === 'string') : [];
    } catch { return []; }
  }

  function writeHistory(items) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 6))); } catch {}
  }

  function saveHistory() {
    try { currentEvaluator(); } catch { return; }
    const expr = (input.value || '0').trim();
    if (!expr) return;
    const items = readHistory().filter(v => v !== expr);
    items.unshift(expr);
    writeHistory(items);
    renderHistory();
  }

  function renderHistory() {
    if (!historyWrap) return;
    const items = readHistory();
    historyWrap.classList.toggle('visible', items.length > 0);
    historyWrap.querySelectorAll('.history-chip').forEach(el => el.remove());
    for (const expr of items.slice(0, 4)) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'history-chip';
      btn.textContent = prettyExpression(expr);
      btn.title = `Usar ${expr}`;
      btn.addEventListener('click', () => {
        input.value = expr;
        dispatchInput();
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      });
      historyWrap.append(btn);
    }
  }

  toggle?.addEventListener('click', () => toggleBuilder());
  closeBtn?.addEventListener('click', () => toggleBuilder(false));
  clearBtn?.addEventListener('click', () => {
    input.value = '';
    dispatchInput();
    input.focus();
  });

  builder.querySelectorAll('.math-builder-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      builder.querySelectorAll('.math-builder-tab').forEach(t => t.classList.toggle('active', t === tab));
      builder.querySelectorAll('.math-pad').forEach(pad => { pad.hidden = pad.dataset.pad !== target; });
      input.focus();
    });
  });

  builder.querySelectorAll('.math-key').forEach(key => {
    // Keep the caret/selection in the expression while pressing the virtual keyboard.
    key.addEventListener('pointerdown', ev => ev.preventDefault());
    key.addEventListener('click', () => {
      const action = key.dataset.action;
      if (action === 'backspace') return backspace();
      if (action === 'left') return moveCaret(-1);
      if (action === 'right') return moveCaret(1);
      if (action === 'clear') {
        input.value = '';
        dispatchInput();
        return setCaret(0);
      }
      if (key.dataset.template !== undefined) {
        return insertTemplate(key.dataset.template, key.dataset.fallback || '');
      }
      if (key.dataset.insert !== undefined) return replaceSelection(key.dataset.insert);
    });
  });

  input.addEventListener('input', updatePreview);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') {
      saveHistory();
      input.blur();
    }
    if (ev.key === 'Escape' && !builder.hidden) toggleBuilder(false);
  });
  input.addEventListener('blur', () => setTimeout(saveHistory, 120));

  parameterN?.addEventListener('input', updatePreview);
  xMinInput?.addEventListener('input', updatePreview);
  xMaxInput?.addEventListener('input', updatePreview);

  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      toggleBuilder();
    }
  });

  // Presets update the same input through app.js; refresh after their click.
  document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => {
    setTimeout(() => { updatePreview(); saveHistory(); }, 0);
  }));

  updatePreview();
  renderHistory();
}
