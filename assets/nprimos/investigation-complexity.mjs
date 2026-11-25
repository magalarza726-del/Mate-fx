/* Índice de complejidad estructural v2: función pura, independiente del método. */
export const COMPLEXITY_WEIGHTS=Object.freeze({
 numeric:1,additive:1,product:2,division:2,power:2,transcendental:3,piecewise:4
});
const occurrences=(s,re)=>(s.match(re)||[]).length;
/** El índice refleja la sintaxis LaTeX, NO tiempos de cálculo ni error. */
export function equationComplexity(tex=''){
 const expression=String(tex||'').replace(/^.*?=/,'');
 // Numbers include constants, exponents and parameters explicitly printed.
 const numeric=occurrences(expression,/(?<![A-Za-z\\])(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?/g);
 const additive=occurrences(expression,/\+/g)+occurrences(expression,/(?<=[A-Za-z0-9})])-(?=[A-Za-z0-9({\\])/g);
 const product=occurrences(expression,/\\cdot|\\times|\*/g);
 const division=occurrences(expression,/\\frac|(?<!\\)\/|\\dfrac/g);
 const power=occurrences(expression,/\^/g);
 const transcendental=occurrences(expression,/\\(?:ln|log|sin|cos|tan|exp|sqrt|arctan|sinh|cosh)\b/g);
 const piecewise=occurrences(expression,/\\begin\{cases\}|\\operatorname\{(?:piecewise|if)\}/g);
 const terms={numeric,additive,product,division,power,transcendental,piecewise};
 const value=Object.entries(terms).reduce((sum,[key,n])=>sum+n*COMPLEXITY_WEIGHTS[key],0);
 return {version:2,value,terms,weights:{...COMPLEXITY_WEIGHTS},
  formula:'C = Nnum + Nsuma + 2Nprod + 2Ndiv + 2Npot + 3Ntrans + 4Ntramos'};
}
export function complexityExplanation(){
 return [
  ['Constantes explícitas (Nnum)',1,'Cada número escrito en la expresión; incluye exponentes y parámetros.'],
  ['Sumas y restas binarias (Nsuma)',1,'Operaciones aditivas identificadas; el signo de un número negativo no suma.'],
  ['Productos (Nprod)',2,'Cada \\cdot, \\times o multiplicación explícita *; la multiplicación implícita no cuenta.'],
  ['Divisiones (Ndiv)',2,'Cada \\frac, \\dfrac o división explícita /.'],
  ['Potencias (Npot)',2,'Cada operador ^, incluidos exponentes de e.'],
  ['Funciones especiales (Ntrans)',3,'ln, log, sin, cos, tan, exp, sqrt y afines.'],
  ['Expresiones por tramos (Ntramos)',4,'Cada bloque cases o función condicional explícita.']
 ];
}
