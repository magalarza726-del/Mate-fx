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
  const HISTORY_KEY = 'matefx:function-history:v2';
  let mathField = null;
  let mathlive = null;
  let syncing = false;

  function stripDefinition(expr) {
    return String(expr || '')
      .trim()
      .replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '')
      .replace(/^y\s*=\s*/i, '');
  }

  function asciiToMate(ascii) {
    let s = stripDefinition(ascii)
      .replaceAll('−', '-')
      .replaceAll('×', '*')
      .replaceAll('÷', '/')
      .replace(/\bmod\b/gi, '%')
      .replace(/\barcsin\b/gi, 'asin')
      .replace(/\barccos\b/gi, 'acos')
      .replace(/\barctan\b/gi, 'atan')
      .replace(/\bsignum\b/gi, 'sign')
      .replace(/\s+/g, '');

    // MathLive's ASCIIMath output is already very close to Mate-fx syntax:
    // x^2, sqrt(x), sin(x), (a)/(b), |x|, etc.
    return s || '0';
  }

  function mateToLatex(expr) {
    const raw = stripDefinition(expr) || '0';
    if (!mathlive) return raw;
    try {
      // Use MathLive itself as the canonical 1D -> 2D typesetting converter.
      return mathlive.convertAsciiMathToLatex(raw);
    } catch {
      return raw;
    }
  }

  function dispatchLinearInput() {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    updatePreview();
  }

  function syncLinearFromMath() {
    if (!mathField || syncing) return;
    syncing = true;
    try {
      const ascii = mathField.getValue('ascii-math');
      input.value = asciiToMate(ascii);
      dispatchLinearInput();
    } finally {
      syncing = false;
    }
  }

  function syncMathFromLinear({ focus = false } = {}) {
    if (!mathField || syncing) return;
    syncing = true;
    try {
      const latex = mateToLatex(input.value);
      if (mathField.value !== latex) {
        mathField.setValue(latex, {
          insertionMode: 'replaceAll',
          selectionMode: 'after',
          silenceNotifications: true,
        });
      }
      if (focus) mathField.focus();
    } finally {
      syncing = false;
    }
    updatePreview();
  }

  function insertMath(latex, selectionMode = 'placeholder') {
    if (!mathField) return;
    mathField.focus();
    mathField.insert(latex, {
      insertionMode: 'replaceSelection',
      selectionMode,
      focus: true,
    });
    // MathLive emits input for insert(), but keep sync deterministic.
    requestAnimationFrame(syncLinearFromMath);
  }

  function backspace() {
    if (!mathField) return;
    mathField.focus();
    mathField.executeCommand('deleteBackward');
    requestAnimationFrame(syncLinearFromMath);
  }

  function moveCaret(delta) {
    if (!mathField) return;
    mathField.focus();
    mathField.position = Math.max(0, Math.min(mathField.lastOffset, mathField.position + delta));
  }

  function toggleBuilder(force) {
    const open = force ?? builder.hidden;
    builder.hidden = !open;
    toggle?.classList.toggle('active', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(() => mathField?.focus());
  }

  function currentEvaluator() {
    return compileExpression(input.value || '0');
  }

  function updatePreview() {
    try {
      const evaluator = currentEvaluator();
      status.textContent = 'Expresión válida';
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
        dispatchLinearInput();
        syncMathFromLinear({ focus: true });
      });
      historyWrap.append(btn);
    }
  }

  function commandForKey(key) {
    const action = key.dataset.action;
    if (action) return { action };

    const ins = key.dataset.insert;
    if (ins !== undefined) {
      const map = {
        pi: '\\pi',
        '*': '\\cdot ',
        '/': '\\frac{#@}{#?}',
        '%': '\\bmod ',
      };
      return { latex: map[ins] ?? ins, selectionMode: ins === '/' ? 'placeholder' : 'after' };
    }

    const template = key.dataset.template;
    if (template === undefined) return null;
    const map = {
      '§^()': '#@^{#?}',
      '§^2': '#@^{2}',
      '§^n': '#@^{n}',
      'sqrt(§)': '\\sqrt{#0}',
      'abs(§)': '\\left|#0\\right|',
      'sin(§)': '\\sin\\left(#0\\right)',
      'cos(§)': '\\cos\\left(#0\\right)',
      'tan(§)': '\\tan\\left(#0\\right)',
      'ln(§)': '\\ln\\left(#0\\right)',
      'log(§)': '\\log\\left(#0\\right)',
      'exp(§)': 'e^{#0}',
      'min(§,)': '\\min\\left(#0,#?\\right)',
      'max(§,)': '\\max\\left(#0,#?\\right)',
      'asin(§)': '\\operatorname{asin}\\left(#0\\right)',
      'acos(§)': '\\operatorname{acos}\\left(#0\\right)',
      'atan(§)': '\\operatorname{atan}\\left(#0\\right)',
      'sign(§)': '\\operatorname{sign}\\left(#0\\right)',
      'floor(§)': '\\left\\lfloor #0\\right\\rfloor',
      'ceil(§)': '\\left\\lceil #0\\right\\rceil',
      'round(§)': '\\operatorname{round}\\left(#0\\right)',
    };
    return { latex: map[template] ?? mateToLatex(template.replace('§', 'x')), selectionMode: 'placeholder' };
  }

  async function mountMathField() {
    try {
      mathlive = await import('https://esm.run/mathlive@0.110.0');
      await customElements.whenDefined('math-field');

      mathField = document.createElement('math-field');
      mathField.id = 'mathFunctionInput';
      mathField.setAttribute('aria-label', 'Expresión matemática de f de x');
      mathField.setAttribute('placeholder', 'x^2');
      mathField.value = mateToLatex(input.value);
      mathField.smartFence = true;
      mathField.smartMode = true;
      mathField.removeExtraneousParentheses = false;
      mathField.menuItems = [];

      input.classList.add('linear-shadow-input');
      input.setAttribute('aria-hidden', 'true');
      input.tabIndex = -1;
      input.before(mathField);

      mathField.addEventListener('input', syncLinearFromMath);
      mathField.addEventListener('change', () => {
        syncLinearFromMath();
        saveHistory();
      });
      mathField.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') saveHistory();
        if (ev.key === 'Escape' && !builder.hidden) toggleBuilder(false);
      });

      // If another part of the app changes the hidden canonical expression
      // (preset, reset, history), mirror it back to the 2D math editor.
      input.addEventListener('input', () => {
        if (!syncing) syncMathFromLinear();
      });

      updatePreview();
    } catch (err) {
      console.warn('Mate-fx: MathLive could not load; keeping linear fallback.', err);
      input.classList.remove('linear-shadow-input');
      status.textContent = 'Editor lineal de respaldo';
    }
  }

  toggle?.addEventListener('click', () => toggleBuilder());
  closeBtn?.addEventListener('click', () => toggleBuilder(false));
  clearBtn?.addEventListener('click', () => {
    input.value = '0';
    dispatchLinearInput();
    if (mathField) {
      mathField.setValue('', { insertionMode: 'replaceAll', silenceNotifications: true });
      mathField.focus();
    }
  });

  builder.querySelectorAll('.math-builder-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      builder.querySelectorAll('.math-builder-tab').forEach(t => t.classList.toggle('active', t === tab));
      builder.querySelectorAll('.math-pad').forEach(pad => { pad.hidden = pad.dataset.pad !== target; });
      mathField?.focus();
    });
  });

  builder.querySelectorAll('.math-key').forEach(key => {
    key.addEventListener('pointerdown', ev => ev.preventDefault());
    key.addEventListener('click', () => {
      if (!mathField) return;
      const cmd = commandForKey(key);
      if (!cmd) return;
      if (cmd.action === 'backspace') return backspace();
      if (cmd.action === 'left') return moveCaret(-1);
      if (cmd.action === 'right') return moveCaret(1);
      if (cmd.action === 'clear') {
        mathField.setValue('', { insertionMode: 'replaceAll' });
        return syncLinearFromMath();
      }
      if (cmd.latex !== undefined) insertMath(cmd.latex, cmd.selectionMode || 'placeholder');
    });
  });

  parameterN?.addEventListener('input', updatePreview);
  xMinInput?.addEventListener('input', updatePreview);
  xMaxInput?.addEventListener('input', updatePreview);

  document.addEventListener('keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      toggleBuilder();
    }
  });

  document.querySelectorAll('.preset').forEach(btn => btn.addEventListener('click', () => {
    setTimeout(() => {
      syncMathFromLinear();
      updatePreview();
      saveHistory();
    }, 0);
  }));

  $('resetBtn')?.addEventListener('click', () => setTimeout(() => syncMathFromLinear(), 0));

  updatePreview();
  renderHistory();
  mountMathField();
}
