/**
 * Identificación y nombres de funciones de Desmos.
 * Esta capa no modifica estados opacos de getState(); usa getExpressions() y setExpression().
 */
const DEFINITION = /^\s*((?:[a-zA-Z]|\\[a-zA-Z]+)(?:_\{\d+\}|_\d+)?)\s*(?:\\left\s*)?\(\s*x\s*(?:\\right\s*)?\)\s*=/;
const SUBSCRIPTS = '₀₁₂₃₄₅₆₇₈₉';

export function getFunctionDefinition(latex) {
  const match = String(latex || '').match(DEFINITION);
  if (!match) return null;
  const name = match[1];
  return {
    name,
    label: name.replace(/_\{(\d+)\}|_(\d+)/g, (_, a, b) => [...(a || b)].map(d => SUBSCRIPTS[Number(d)]).join('')).replaceAll('\\', ''),
  };
}

function hasIndependentX(s) {
  // Only the independent x, not the x in e.g. "max" or "exp".
  return /(^|[^a-zA-Z])x([^a-zA-Z]|$)/.test(s);
}
function isPotentialFunction(input) {
  const latex = String(input || '').trim();
  if (!latex || getFunctionDefinition(latex)) return null;
  // A y=f(x) equation is an ordinary graphable function, too.
  const explicitY = latex.match(/^y\s*=\s*(.+)$/s);
  if (latex.includes('=') && !explicitY) return null; // constraints, regressions, parameters...
  const body = (explicitY ? explicitY[1] : latex).trim();
  if (!body || /(?:[+*/^=,-]|\\frac\s*\{)\s*$/.test(body)) return null;
  if (!hasIndependentX(body) && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(body)) return null;
  // Point lists and parametric points aren't y=f(x) functions.
  if (/^\\?\s*(?:\\left\s*)?\(/.test(body) && body.includes(',')) return null;
  return body;
}

/** Returns a minimal list of safe setExpression edits; IDs remain unchanged. */
export function planAutomaticNames(expressions) {
  if (!Array.isArray(expressions)) return [];
  const used = new Set();
  for (const e of expressions) {
    const def = getFunctionDefinition(e?.latex);
    const match = def?.name.match(/^f_(?:\{(\d+)\}|(\d+))$/);
    if (match) used.add(Number(match[1] || match[2]));
  }
  const changes = [];
  let next = 1;
  for (const e of expressions) {
    const id = String(e?.id || '');
    if (!id || id.startsWith('__') || id.startsWith('gmr_') || e?.secret || (e?.type && e.type !== 'expression')) continue;
    const body = isPotentialFunction(e.latex);
    if (!body) continue;
    while (used.has(next)) next++;
    const latex = 'f_{' + next + '}(x)=' + body;
    changes.push({id, latex});
    used.add(next++);
  }
  return changes;
}
