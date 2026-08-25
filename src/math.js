/**
 * Safe expression parser for Mate-fx.
 *
 * The public syntax is deliberately mathematical and friendly: f(x)=..., y=...,
 * x², x³, xⁿ, nˣ, √x, √(...), |x|, 2x and 2π are accepted. Internally the
 * parser uses a small AST; eval() and Function() are never used.
 */

const FUNCTION_SPECS = Object.freeze({
  sin: { fn: Math.sin, minArgs: 1, maxArgs: 1 },
  cos: { fn: Math.cos, minArgs: 1, maxArgs: 1 },
  tan: { fn: Math.tan, minArgs: 1, maxArgs: 1 },
  asin: { fn: Math.asin, minArgs: 1, maxArgs: 1 },
  acos: { fn: Math.acos, minArgs: 1, maxArgs: 1 },
  atan: { fn: Math.atan, minArgs: 1, maxArgs: 1 },
  sinh: { fn: Math.sinh, minArgs: 1, maxArgs: 1 },
  cosh: { fn: Math.cosh, minArgs: 1, maxArgs: 1 },
  tanh: { fn: Math.tanh, minArgs: 1, maxArgs: 1 },
  sqrt: { fn: Math.sqrt, minArgs: 1, maxArgs: 1 },
  abs: { fn: Math.abs, minArgs: 1, maxArgs: 1 },
  ln: { fn: Math.log, minArgs: 1, maxArgs: 1 },
  log: { fn: Math.log10, minArgs: 1, maxArgs: 1 },
  exp: { fn: Math.exp, minArgs: 1, maxArgs: 1 },
  floor: { fn: Math.floor, minArgs: 1, maxArgs: 1 },
  ceil: { fn: Math.ceil, minArgs: 1, maxArgs: 1 },
  round: { fn: Math.round, minArgs: 1, maxArgs: 1 },
  sign: { fn: Math.sign, minArgs: 1, maxArgs: 1 },
  min: { fn: Math.min, minArgs: 1, maxArgs: Infinity },
  max: { fn: Math.max, minArgs: 1, maxArgs: Infinity },
});

const CONSTANTS = Object.freeze({ pi: Math.PI, e: Math.E });
const SIMPLE_FUNCTIONS = 'sen|sin|cos|tan|asin|acos|atan|ln|log|exp|sqrt|abs';

function stripDefinition(input) {
  return String(input)
    .trim()
    .replace(/^\s*(?:f\s*\(\s*x\s*\)|y)\s*=\s*/i, '');
}

export function normalizeExpression(input) {
  let source = stripDefinition(input).toLowerCase();

  source = source
    // Parenthesizing pi preserves a token boundary in compact forms such as πx.
    .replaceAll('π', '(pi)')
    .replaceAll('−', '-')
    .replaceAll('×', '*')
    .replaceAll('·', '*')
    .replaceAll('÷', '/')
    .replaceAll('²', '^2')
    .replaceAll('³', '^3')
    .replaceAll('ⁿ', '^n')
    .replaceAll('ˣ', '^x');

  // √(...) is converted by replacing only the operator, not by trying to
  // regex-match the entire parenthesized body. This keeps nested expressions safe.
  source = source
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([a-z0-9_.]+)/g, 'sqrt($1)')
    .replace(new RegExp(`\\b(${SIMPLE_FUNCTIONS})\\s+([a-z0-9_.]+)`, 'g'), '$1($2)')
    .replace(/sen/g, 'sin')
    .replace(/\|([^|]+)\|/g, 'abs($1)')
    // Preserve intended multiplication between symbolic atoms before spaces vanish.
    .replace(/\b(pi|e|x|n)\s+(?=(?:pi|e|x|n)\b)/g, '$1*')
    .replace(/\s+/g, '');

  return source;
}

function tokenize(input) {
  const source = normalizeExpression(input);
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    const ch = source[i];

    if (/\d|\./.test(ch)) {
      let j = i + 1;
      while (j < source.length && /\d|\./.test(source[j])) j++;

      if (/[eE]/.test(source[j] || '') && /[+\-\d]/.test(source[j + 1] || '')) {
        j++;
        if (/[+\-]/.test(source[j])) j++;
        while (j < source.length && /\d/.test(source[j])) j++;
      }

      const raw = source.slice(i, j);
      const value = Number(raw);
      if (!Number.isFinite(value)) throw new Error(`Número inválido: ${raw}`);
      tokens.push({ type: 'number', value, raw });
      i = j;
      continue;
    }

    if (/[a-z_]/.test(ch)) {
      let j = i + 1;
      while (j < source.length && /[a-z0-9_]/.test(source[j])) j++;
      tokens.push({ type: 'ident', value: source.slice(i, j) });
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

  // Implicit multiplication: 2x, 2(x+1), x(x+1), 2pi, 2sin(x).
  const expanded = [];
  const canEnd = token => token && (token.type === 'number' || token.type === 'ident' || token.type === ')');
  const canStart = token => token && (token.type === 'number' || token.type === 'ident' || token.type === '(');

  for (const current of tokens) {
    const previous = expanded.at(-1);
    const previousIsFunction = previous?.type === 'ident' && Object.hasOwn(FUNCTION_SPECS, previous.value);
    if (canEnd(previous) && canStart(current) && !(previousIsFunction && current.type === '(')) {
      expanded.push({ type: '*', value: '*' });
    }
    expanded.push(current);
  }

  expanded.push({ type: 'eof', value: '' });
  return expanded;
}

function validateArity(name, count) {
  const spec = FUNCTION_SPECS[name];
  if (!spec) throw new Error(`Función desconocida: ${name}`);
  if (count < spec.minArgs || count > spec.maxArgs) {
    const expected = spec.minArgs === spec.maxArgs
      ? `${spec.minArgs}`
      : `${spec.minArgs} o más`;
    throw new Error(`${name} espera ${expected} argumento${spec.minArgs === 1 && spec.maxArgs === 1 ? '' : 's'}`);
  }
}

export function compileExpression(input) {
  const tokens = tokenize(input);
  let position = 0;
  const peek = () => tokens[position];
  const take = type => {
    const token = tokens[position];
    if (token.type !== type) throw new Error(`Se esperaba “${type}”`);
    position++;
    return token;
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

  // Exponentiation is right-associative and binds more tightly than unary minus.
  function parsePower() {
    let node = parsePrimary();
    if (peek().type === '^') {
      take('^');
      node = { type: 'binary', op: '^', left: node, right: parseUnary() };
    }
    return node;
  }

  function parsePrimary() {
    const token = peek();

    if (token.type === 'number') {
      take('number');
      return { type: 'number', value: token.value };
    }

    if (token.type === 'ident') {
      take('ident');
      const name = token.value;

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
        validateArity(name, args.length);
        return { type: 'call', name, args };
      }

      if (name === 'x' || name === 'n') return { type: 'variable', name };
      if (Object.hasOwn(CONSTANTS, name)) return { type: 'number', value: CONSTANTS[name] };
      throw new Error(`Nombre desconocido: ${name}`);
    }

    if (token.type === '(') {
      take('(');
      const node = parseExpression();
      take(')');
      return node;
    }

    throw new Error('Expresión incompleta');
  }

  const ast = parseExpression();
  if (peek().type !== 'eof') throw new Error('Hay texto sobrante en la expresión');

  function evaluate(node, variables) {
    switch (node.type) {
      case 'number':
        return node.value;
      case 'variable':
        return variables[node.name];
      case 'unary': {
        const value = evaluate(node.value, variables);
        return node.op === '-' ? -value : value;
      }
      case 'binary': {
        const left = evaluate(node.left, variables);
        const right = evaluate(node.right, variables);
        switch (node.op) {
          case '+': return left + right;
          case '-': return left - right;
          case '*': return left * right;
          case '/': return left / right;
          case '%': return left % right;
          case '^': return left ** right;
          default: return NaN;
        }
      }
      case 'call': {
        const spec = FUNCTION_SPECS[node.name];
        return spec.fn(...node.args.map(arg => evaluate(arg, variables)));
      }
      default:
        return NaN;
    }
  }

  const evaluator = (x, n = 3) => Number(evaluate(ast, { x, n }));
  evaluator.ast = ast;
  evaluator.normalized = normalizeExpression(input);
  evaluator.usesN = /(^|[^a-z])n([^a-z]|$)/.test(evaluator.normalized);
  return evaluator;
}

export function prettyExpression(input) {
  return stripDefinition(input)
    .replace(/\^2\b/g, '²')
    .replace(/\^3\b/g, '³')
    .replace(/\^n\b/g, 'ⁿ')
    .replace(/\^x\b/g, 'ˣ')
    .replace(/sin/g, 'sen')
    .replace(/exp\(x\)/g, 'eˣ')
    .replace(/sqrt\(([^()]*)\)/g, '√($1)')
    .replace(/abs\(([^()]*)\)/g, '|$1|')
    .replace(/\*/g, '·');
}

export function formatNumber(value, maxDigits = 4) {
  if (!Number.isFinite(value)) return '—';
  let number = Number(value);
  if (Math.abs(number) < 1e-12) number = 0;
  const abs = Math.abs(number);
  if (abs >= 1e6 || (abs > 0 && abs < 1e-4)) {
    return number.toExponential(3).replace('+', '');
  }
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: maxDigits }).format(number);
}
