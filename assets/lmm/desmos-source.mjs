/**
 * Fuentes de la geometría: expresiones visibles del único editor Desmos.
 * No se traduce LaTeX a JavaScript ni se reevalúa con otro motor.
 */
const named=/^\s*((?:[A-Za-z]|\\[A-Za-z]+)(?:_\{[A-Za-z0-9]+\}|_[A-Za-z0-9])?)\s*(?:\\left\s*)?\(\s*(?:[A-Za-z]|\\[A-Za-z]+)(?:_\{[A-Za-z0-9]+\}|_[A-Za-z0-9])?\s*(?:\\right\s*)?\)\s*=/;
const independentX=/(^|[^A-Za-z0-9_\\])x([^A-Za-z0-9_]|$)/;
export function desmosSources(expressions){
 return (expressions||[]).flatMap(e=>{
  const id=String(e?.id||''),latex=String(e?.latex||'').trim();
  // Los IDs gmr_generated_* son funciones reales creadas desde Investigación.
  // Solo se excluyen los auxiliares propios y las expresiones no visibles.
  if(!id||id.startsWith('__lmm_')||e.secret||e.hidden||
    (e.type&&e.type!=='expression')||!latex)return [];
  const def=latex.match(named);
  if(def)return [{id,latex,name:def[1],color:e.color}];
  const explicit=latex.match(/^y\s*=\s*(.+)$/s);
  const body=explicit?.[1]||latex;
  // Las relaciones implícitas, tablas, puntos y parámetros no son funciones escalares y=f(x).
  const outsideRestrictions=body.replace(/\\left\\\{.*?\\right\\\}/g,'').replace(/\\\{.*?\\\}/g,'');
  if(/[=<>]|\\(?:le|ge|lt|gt|sim|to)\b/.test(outsideRestrictions)||
     /(^|[^A-Za-z0-9_\\])y([^A-Za-z0-9_]|$)/.test(body)||
     /^(?:\\left\s*)?[\[(]/.test(body)&&body.includes(',')&&!explicit||
     (!explicit&&!independentX.test(body)))return [];
  return [{id,latex,body,color:e.color}];
 });
}
export function latexNumber(value){
 return String(Number(value.toPrecision(12))).replace(/e([+-]?\d+)$/,'\\cdot10^{$1}');
}
export function helperLatex(source,xs){
 const list='\\left['+xs.map(latexNumber).join(',')+'\\right]';
 return source.name?source.name+'\\left('+list+'\\right)':
  '\\left('+source.body+'\\right)\\operatorname{with}x='+list;
}
export function helperValues(helper,count){
 if(Array.isArray(helper.listValue)&&helper.listValue.length===count)return helper.listValue.slice();
 if(Number.isFinite(helper.numericValue))return Array(count).fill(helper.numericValue);
 return Array(count).fill(NaN);
}
export function pathLatex(points){
 return '\\left['+points.map(([x,y])=>'\\left('+latexNumber(x)+','+latexNumber(y)+'\\right)').join(',')+'\\right]';
}
