/**
 * Tiny expression parser for Mate-fx.
 * Supports real-valued expressions in x, parameter n, constants pi/e,
 * operators + - * / ^ %, parentheses and common functions.
 * No eval / Function constructor is used.
 */

const FUNCTIONS = {
  sin: Math.sin,
  sen: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
};

const CONSTANTS = { pi: Math.PI, e: Math.E };

function normalize(input) {
  return String(input)
    .trim()
    .toLowerCase()
    .replaceAll('π', 'pi')
    .replaceAll('−', '-')
    .replaceAll('×', '*')
    .replaceAll('÷', '/')
    .replace(/sen/g, 'sin')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/\|([^|]+)\|/g, 'abs($1)')
    .replace(/\s+/g, '');
}

function tokenize(input) {
  const s = normalize(input);
  const tokens = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\d|\./.test(ch)) {
      let j = i + 1;
      while (j < s.length && /\d|\./.test(s[j])) j++;
      if (/[eE]/.test(s[j] || '') && /[+\-\d]/.test(s[j + 1] || '')) {
        j++;
        if (/[+\-]/.test(s[j])) j++;
        while (j < s.length && /\d/.test(s[j])) j++;
      }
      const raw = s.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Número inválido: ${raw}`);
      tokens.push({ type: 'number', value, raw });
      i = j;
      continue;
    }
    if (/[a-z_]/.test(ch)) {
      let j = i + 1;
      while (j < s.length && /[a-z0-9_]/.test(s[j])) j++;
      tokens.push({ type: 'ident', value: s.slice(i, j) });
      i = j;
      continue;
    }
    if ('+-*/^%(),'.includes(ch)) {
      tokens.push({ type: ch, value: ch });
      i++;
      continue;
    }
    throw new Error(`Símbolo no reconocido: ${ch}`);
  }
  // Insert implicit multiplication only where it is unambiguous after tokenization:
  // 2x, 2(x+1), x(x+1), 2pi. A known function followed by '(' is a call, not a product.
  const expanded = [];
  const canEnd = (t) => t && (t.type === 'number' || t.type === 'ident' || t.type === ')');
  const canStart = (t) => t && (t.type === 'number' || t.type === 'ident' || t.type === '(');
  for (let k = 0; k < tokens.length; k++) {
    const cur = tokens[k];
    const prev = expanded.at(-1);
    const prevIsFunction = prev?.type === 'ident' && Object.hasOwn(FUNCTIONS, prev.value);
    if (canEnd(prev) && canStart(cur) && !(prevIsFunction && cur.type === '(')) {
      expanded.push({ type: '*', value: '*' });
    }
    expanded.push(cur);
  }
  expanded.push({ type: 'eof', value: '' });
  return expanded;
}

export function compileExpression(input) {
  const tokens = tokenize(input);
  let pos = 0;
  const peek = () => tokens[pos];
  const take = (type) => {
    const t = tokens[pos];
    if (t.type !== type) throw new Error(`Se esperaba “${type}”`);
    pos++;
    return t;
  };

  function parseExpression() {
    let node = parseTerm();
    while (peek().type === '+' || peek().type === '-') {
      const op = take(peek().type).type;
      node = { type: 'binary', op, left: node, right: parseTerm() };
    }
    return node;
  }

  function parseTerm() {
    let node = parseUnary();
    while (peek().type === '*' || peek().type === '/' || peek().type === '%') {
      const op = take(peek().type).type;
      node = { type: 'binary', op, left: node, right: parseUnary() };
    }
    return node;
  }

  function parseUnary() {
    if (peek().type === '+' || peek().type === '-') {
      const op = take(peek().type).type;
      return { type: 'unary', op, value: parseUnary() };
    }
    return parsePower();
  }

  // Right-associative exponentiation; exponent binds more tightly than unary minus.
  function parsePower() {
    let node = parsePrimary();
    if (peek().type === '^') {
      take('^');
      node = { type: 'binary', op: '^', left: node, right: parseUnary() };
    }
    return node;
  }

  function parsePrimary() {
    const t = peek();
    if (t.type === 'number') {
      take('number');
      return { type: 'number', value: t.value };
    }
    if (t.type === 'ident') {
      take('ident');
      const name = t.value;
      if (peek().type === '(') {
        take('(');
        const args = [];
        if (peek().type !== ')') {
          args.push(parseExpression());
          while (peek().type === ',') {
            take(',');
            args.push(parseExpression());
          }
        }
        take(')');
        if (!FUNCTIONS[name]) throw new Error(`Función desconocida: ${name}`);
        return { type: 'call', name, args };
      }
      if (name === 'x' || name === 'n') return { type: 'variable', name };
      if (Object.hasOwn(CONSTANTS, name)) return { type: 'number', value: CONSTANTS[name] };
      throw new Error(`Nombre desconocido: ${name}`);
    }
    if (t.type === '(') {
      take('(');
      const node = parseExpression();
      take(')');
      return node;
    }
    throw new Error('Expresión incompleta');
  }

  const ast = parseExpression();
  if (peek().type !== 'eof') throw new Error('Hay texto sobrante en la expresión');

  const evalNode = (node, vars) => {
    switch (node.type) {
      case 'number': return node.value;
      case 'variable': return vars[node.name];
      case 'unary': {
        const v = evalNode(node.value, vars);
        return node.op === '-' ? -v : v;
      }
      case 'binary': {
        const a = evalNode(node.left, vars);
        const b = evalNode(node.right, vars);
        switch (node.op) {
          case '+': return a + b;
          case '-': return a - b;
          case '*': return a * b;
          case '/': return a / b;
          case '%': return a % b;
          case '^': return a ** b;
          default: return NaN;
        }
      }
      case 'call': {
        const fn = FUNCTIONS[node.name];
        return fn(...node.args.map(arg => evalNode(arg, vars)));
      }
      default: return NaN;
    }
  };

  const evaluator = (x, n = 3) => {
    const value = evalNode(ast, { x, n });
    return Number(value);
  };
  evaluator.ast = ast;
  evaluator.normalized = normalize(input);
  evaluator.usesN = /(^|[^a-z])n([^a-z]|$)/.test(evaluator.normalized);
  return evaluator;
}

export function prettyExpression(input) {
  return String(input)
    .trim()
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\^n\b/g, 'ⁿ')
    .replace(/\^x\b/g, 'ˣ')
    .replace(/sin/g, 'sen')
    .replace(/exp\(x\)/g, 'eˣ')
    .replace(/abs\(x\)/g, '|x|')
    .replace(/\*/g, '·');
}

export function formatNumber(value, maxDigits = 4) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-12) value = 0;
  const abs = Math.abs(value);
  if (abs >= 1e6 || (abs > 0 && abs < 1e-4)) return value.toExponential(3).replace('+', '');
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: maxDigits }).format(value);
}
