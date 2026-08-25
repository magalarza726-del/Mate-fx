import { compileExpression, prettyExpression, formatNumber } from './math.js';

const MATHLIVE_URL = 'https://esm.run/mathlive@0.110.0';
const HISTORY_KEY = 'matefx:function-history:v2';
const $ = id => document.getElementById(id);

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
const functionLabel = document.querySelector('label[for="functionInput"]');

if (!input || !builder) {
  console.warn('Mate-fx: math entry assistant could not attach.');
} else {
  let mathField = null;
  let mathlive = null;
  let syncing = false;

  function stripDefinition(expression) {
    return String(expression || '')
      .trim()
      .replace(/^f\s*\(\s*x\s*\)\s*=\s*/i, '')
      .replace(/^y\s*=\s*/i, '');
  }

  function asciiToMate(ascii) {
    return stripDefinition(ascii)
      .replaceAll('−', '-')
      .replaceAll('×', '*')
      .replaceAll('÷', '/')
      .replace(/\bmod\b/gi, '%')
      .replace(/\barcsin\b/gi, 'asin')
      .replace(/\barccos\b/gi, 'acos')
      .replace(/\barctan\b/gi, 'atan')
      .replace(/\bsignum\b/gi, 'sign')
      .replace(/\s+/g, '') || '0';
  }

  function mateToLatex(expression) {
    const raw = stripDefinition(expression) || '0';
    if (!mathlive) return raw;
    try {
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

  function focusEditor() {
    (mathField || input).focus();
  }

  function syncLinearFromMath() {
    if (!mathField || syncing) return;
    syncing = true;
    try {
      input.value = asciiToMate(mathField.getValue('ascii-math'));
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
    requestAnimationFrame(syncLinearFromMath);
  }

  function linearReplaceSelection(text, caretOffset = text.length) {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    input.setRangeText(text, start, end, 'end');
    dispatchLinearInput();
    requestAnimationFrame(() => {
      input.focus();
      const position = start + caretOffset;
      input.setSelectionRange(position, position);
    });
  }

  function linearTemplate(template, fallback = '') {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    const selected = input.value.slice(start, end);
    const marker = '§';
    const markerIndex = template.indexOf(marker);

    if (markerIndex < 0) {
      linearReplaceSelection(template);
      return;
    }

    if (selected) {
      const rendered = template.replace(marker, selected);
      linearReplaceSelection(rendered, rendered.length);
      return;
    }

    const source = fallback || template;
    const caretIndex = source.indexOf(marker);
    const rendered = source.replace(marker, '');
    linearReplaceSelection(rendered, caretIndex >= 0 ? caretIndex : rendered.length);
  }

  function fallbackBackspace() {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? start;
    if (start !== end) {
      input.setRangeText('', start, end, 'end');
      dispatchLinearInput();
      input.focus();
      return;
    }
    if (start <= 0) return;
    input.setRangeText('', start - 1, start, 'end');
    dispatchLinearInput();
    input.focus();
    input.setSelectionRange(start - 1, start - 1);
  }

  function moveCaret(delta) {
    if (mathField) {
      mathField.focus();
      mathField.position = Math.max(0, Math.min(mathField.lastOffset, mathField.position + delta));
      return;
    }

    const position = input.selectionStart ?? input.value.length;
    const next = Math.max(0, Math.min(input.value.length, position + delta));
    input.focus();
    input.setSelectionRange(next, next);
  }

  function backspace() {
    if (!mathField) {
      fallbackBackspace();
      return;
    }
    mathField.focus();
    mathField.executeCommand('deleteBackward');
    requestAnimationFrame(syncLinearFromMath);
  }

  function toggleBuilder(force) {
    const open = force ?? builder.hidden;
    builder.hidden = !open;
    toggle?.classList.toggle('active', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) requestAnimationFrame(focusEditor);
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
      const count = Math.min(5, max - min + 1);
      const values = [];

      for (let offset = 0; offset < count; offset++) {
        const x = min + offset;
        let value = NaN;
        try {
          value = evaluator(x, Number.isFinite(nValue) ? nValue : 3);
        } catch {
          value = NaN;
        }
        values.push({ x, value });
      }

      samples.innerHTML = values.map(({ x, value }) => {
        const valid = Number.isFinite(value) && Math.abs(value) <= 1e12;
        return `<span class="sample-chip${valid ? '' : ' invalid'}">${x}↦${valid ? formatNumber(value, 3) : '—'}</span>`;
      }).join('');
    } catch (error) {
      status.textContent = error.message || 'Expresión incompleta';
      status.className = 'builder-status invalid';
      samples.innerHTML = '<span class="sample-chip invalid">corrige la expresión</span>';
    }
  }

  function readHistory() {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string') : [];
    } catch {
      return [];
    }
  }

  function writeHistory(items) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, 6)));
    } catch {
      // localStorage can be unavailable in private/restricted contexts.
    }
  }

  function saveHistory() {
    try {
      currentEvaluator();
    } catch {
      return;
    }

    const expression = (input.value || '0').trim();
    if (!expression) return;
    const items = readHistory().filter(value => value !== expression);
    items.unshift(expression);
    writeHistory(items);
    renderHistory();
  }

  function renderHistory() {
    if (!historyWrap) return;
    const items = readHistory();
    historyWrap.classList.toggle('visible', items.length > 0);
    historyWrap.querySelectorAll('.history-chip').forEach(element => element.remove());

    for (const expression of items.slice(0, 4)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'history-chip';
      button.textContent = prettyExpression(expression);
      button.title = `Usar ${expression}`;
      button.addEventListener('click', () => {
        input.value = expression;
        dispatchLinearInput();
        syncMathFromLinear({ focus: true });
      });
      historyWrap.append(button);
    }
  }

  function commandForKey(key) {
    const action = key.dataset.action;
    if (action) return { action };

    const insert = key.dataset.insert;
    if (insert !== undefined) {
      const latexMap = {
        pi: '\\pi',
        '*': '\\cdot ',
        '/': '\\frac{#@}{#?}',
        '%': '\\bmod ',
      };
      return {
        latex: latexMap[insert] ?? insert,
        selectionMode: insert === '/' ? 'placeholder' : 'after',
      };
    }

    const template = key.dataset.template;
    if (template === undefined) return null;
    const latexMap = {
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
    return {
      latex: latexMap[template] ?? mateToLatex(template.replace('§', 'x')),
      selectionMode: 'placeholder',
    };
  }

  function handleFallbackKey(key) {
    const action = key.dataset.action;
    if (action === 'backspace') return fallbackBackspace();
    if (action === 'left') return moveCaret(-1);
    if (action === 'right') return moveCaret(1);
    if (action === 'clear') {
      input.value = '';
      dispatchLinearInput();
      return input.focus();
    }

    if (key.dataset.template !== undefined) {
      return linearTemplate(key.dataset.template, key.dataset.fallback || '');
    }
    if (key.dataset.insert !== undefined) {
      return linearReplaceSelection(key.dataset.insert);
    }
  }

  async function mountMathField() {
    try {
      mathlive = await import(MATHLIVE_URL);
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
      mathField.addEventListener('keydown', event => {
        if (event.key === 'Enter') saveHistory();
        if (event.key === 'Escape' && !builder.hidden) toggleBuilder(false);
      });

      input.addEventListener('input', () => {
        if (!syncing) syncMathFromLinear();
      });

      updatePreview();
    } catch (error) {
      console.warn('Mate-fx: MathLive could not load; keeping linear fallback.', error);
      input.classList.remove('linear-shadow-input');
      input.removeAttribute('aria-hidden');
      input.tabIndex = 0;
      status.textContent = 'Editor lineal de respaldo';
      status.className = 'builder-status valid';
    }
  }

  toggle?.addEventListener('click', () => toggleBuilder());
  closeBtn?.addEventListener('click', () => toggleBuilder(false));

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    dispatchLinearInput();
    if (mathField) {
      mathField.setValue('', { insertionMode: 'replaceAll', silenceNotifications: true });
      mathField.focus();
    } else {
      input.focus();
    }
  });

  functionLabel?.addEventListener('click', event => {
    if (!mathField) return;
    event.preventDefault();
    mathField.focus();
  });

  builder.querySelectorAll('.math-builder-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      builder.querySelectorAll('.math-builder-tab').forEach(other => other.classList.toggle('active', other === tab));
      builder.querySelectorAll('.math-pad').forEach(pad => {
        pad.hidden = pad.dataset.pad !== target;
      });
      focusEditor();
    });
  });

  builder.querySelectorAll('.math-key').forEach(key => {
    key.addEventListener('pointerdown', event => event.preventDefault());
    key.addEventListener('click', () => {
      if (!mathField) {
        handleFallbackKey(key);
        return;
      }

      const command = commandForKey(key);
      if (!command) return;
      if (command.action === 'backspace') return backspace();
      if (command.action === 'left') return moveCaret(-1);
      if (command.action === 'right') return moveCaret(1);
      if (command.action === 'clear') {
        mathField.setValue('', { insertionMode: 'replaceAll' });
        return syncLinearFromMath();
      }
      if (command.latex !== undefined) insertMath(command.latex, command.selectionMode || 'placeholder');
    });
  });

  parameterN?.addEventListener('input', updatePreview);
  xMinInput?.addEventListener('input', updatePreview);
  xMaxInput?.addEventListener('input', updatePreview);

  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      toggleBuilder();
    }
  });

  document.querySelectorAll('.preset').forEach(button => {
    button.addEventListener('click', () => {
      setTimeout(() => {
        syncMathFromLinear();
        updatePreview();
        saveHistory();
      }, 0);
    });
  });

  $('resetBtn')?.addEventListener('click', () => {
    setTimeout(() => syncMathFromLinear(), 0);
  });

  updatePreview();
  renderHistory();
  mountMathField();
}
