/** Pure constrained function search for nPrimos. No eval, no Function(), no remote service. */
export const BASIS = Object.freeze([
  {kind:'x',uses:1},{kind:'power',uses:1},{kind:'ln',uses:1},
  {kind:'log1p',uses:1},{kind:'sqrt',uses:1},{kind:'exp',uses:1},
  {kind:'sin',uses:1},{kind:'cos',uses:1},{kind:'reciprocal',uses:1},
  {kind:'xln',uses:2},{kind:'xx',uses:2},{kind:'xexp',uses:2},
  {kind:'xover',uses:2},{kind:'xsin',uses:2}
]);
export const FAMILIES=Object.freeze({
  logarithmic:['ln','log1p','xln'],
  exponential:['exp','xexp','xx'],
  polynomial:['x','power'],
  trigonometric:['sin','cos','xsin']
});
export const COMPOSITIONS=Object.freeze(['sum','product','pair_plus']);
export const familyForKind=kind=>Object.keys(FAMILIES).find(k=>FAMILIES[k].includes(kind))||null;
export const chosenFamilies=config=>{
  const list=Array.isArray(config?.families)?config.families:Object.keys(FAMILIES);
  return [...new Set(list.filter(k=>Object.prototype.hasOwnProperty.call(FAMILIES,k)))];
};
export const compositionOf=config=>COMPOSITIONS.includes(config?.composition)?config.composition:'sum';
const params=[1,2,3,4]; // Polynómica: exponentes enteros positivos.

// Limite de decimales de los literales de cada funcion generada.
export function decimalLimit(value=3){
  const n=Number(value);
  return Number.isFinite(n)?Math.max(0,Math.min(3,Math.trunc(n))):3;
}
export function roundNumber(value,decimals=3){
  if(!Number.isFinite(value))return NaN;
  const rounded=Number(value.toFixed(decimalLimit(decimals)));
  return Object.is(rounded,-0)?0:rounded;
}
/** Maximum permitted integer part of every coefficient/parameter (sign ignored). */
export function integerLimit(value=9999){
  const n=Number(value);
  return [9,99,999,9999].includes(n)?n:9999;
}
/** Quantize first, then constrain the integer part. Fractional digits remain allowed. */
export function constrainNumber(value,decimals=3,maxInteger=9999){
  if(!Number.isFinite(value))return NaN;
  const d=decimalLimit(decimals),cap=integerLimit(maxInteger)+1-10**(-d);
  return roundNumber(Math.max(-cap,Math.min(cap,value)),d);
}
const fmt=(n,decimals=3)=>{
  const rounded=roundNumber(n,decimals);
  return Number.isFinite(rounded)?String(rounded):'NaN';
};
const choice=(items,rng)=>items[Math.floor(rng()*items.length)];
const rand=(a,b,rng)=>a+(b-a)*rng();
const bounded=n=>Number.isFinite(n)&&Math.abs(n)<1e140?n:NaN;
export function basisValue(term,x){
  const p=term.p;
  switch(term.kind){
    case 'x':return x;
    case 'power':return bounded(Math.pow(x,p));
    case 'ln':return x>0?Math.log(x):NaN;
    case 'log1p':return x>-1?Math.log1p(x):NaN;
    case 'sqrt':return x>=0?Math.sqrt(x):NaN;
    case 'exp':return bounded(Math.exp(p*x));
    case 'sin':return Math.sin(p*x);
    case 'cos':return Math.cos(p*x);
    case 'reciprocal':return x+p!==0?1/(x+p):NaN;
    case 'xln':return x>0?bounded(x*Math.log(x)):NaN;
    case 'xx':return x>0?bounded(Math.pow(x,x)):NaN;
    case 'xexp':return bounded(x*Math.exp(p*x));
    case 'xover':return x+p!==0?x/(x+p):NaN;
    case 'xsin':return bounded(x*Math.sin(p*x));
    default:return NaN;
  }
}
export function makeTerm(kind,maxAbsX,rng=Math.random,decimals=3,maxInteger=9999){
  const uses=BASIS.find(a=>a.kind===kind)?.uses;
  if(!uses)throw Error('Tipo de término desconocido');
  const scale=Math.max(1,maxAbsX);
  let p=0;
  if(kind==='power')p=choice(params,rng);
  if(['exp','xexp','sin','cos','xsin'].includes(kind))p=rand(-5,5,rng)/scale;
  if(['reciprocal','xover'].includes(kind))p=rand(.15,.85,rng)*scale*(rng()<.5?1:-1);
  p=constrainNumber(p,decimals,maxInteger);
  // x^0 deja de depender de x.
  if(kind==='power'&&p===0)p=1;
  return {kind,uses,p};
}
export function makeCandidate(config,maxAbsX,rng=Math.random,elite=null){
  const maxTerms=Math.max(1,Math.min(3,Math.floor(config.maxTerms)));
  const maxX=Math.max(1,Math.min(2,Math.floor(config.maxX)));
  const families=chosenFamilies(config);
  if(!families.length)throw Error('Selecciona al menos una tendencia matemática.');
  const options=BASIS.filter(k=>k.uses<=maxX&&families.includes(familyForKind(k.kind)));
  if(!options.length)throw Error('No hay términos compatibles con las tendencias y el límite de X.');
  const composition=compositionOf(config);
  if(composition==='pair_plus'&&maxTerms<3)throw Error('La forma f₁·f₂ + f₃ exige exactamente 3 términos.');
  const decimals=decimalLimit(config.decimals);
  const maxInteger=integerLimit(config.maxInteger);
  let terms;
  if(elite?.terms?.length&&rng()<.72){
    terms=elite.terms.filter(t=>options.some(o=>o.kind===t.kind)).map(t=>({...t})).slice(0,maxTerms);
    if(!terms.length)terms=[makeTerm(choice(options,rng).kind,maxAbsX,rng,decimals,maxInteger)];
    const pos=Math.floor(rng()*Math.max(1,terms.length));
    if(rng()<.5){terms[pos]=makeTerm(choice(options,rng).kind,maxAbsX,rng,decimals,maxInteger)}
    else if(terms[pos]){const old=terms[pos];terms[pos]=makeTerm(old.kind,maxAbsX,rng,decimals,maxInteger);terms[pos].p=constrainNumber(old.p*.75+terms[pos].p*.25,decimals,maxInteger)}
    if(rng()<.14&&terms.length<maxTerms)terms.push(makeTerm(choice(options,rng).kind,maxAbsX,rng,decimals,maxInteger));
    if(composition!=='pair_plus'&&rng()<.12&&terms.length>1)terms.splice(Math.floor(rng()*terms.length),1);
    if(composition==='pair_plus')while(terms.length<3)terms.push(makeTerm(choice(options,rng).kind,maxAbsX,rng,decimals,maxInteger));
  }else{
    const n=composition==='pair_plus'?3:1+Math.floor(rng()*maxTerms);
    terms=Array.from({length:n},()=>makeTerm(choice(options,rng).kind,maxAbsX,rng,decimals,maxInteger));
  }
  return {terms,constant:!!config.constant,composition};
}
export function validCandidate(candidate,config){
  const form=compositionOf(candidate),requested=compositionOf(config);
  const families=chosenFamilies(config);
  return (config.composition===undefined||requested===form)&&
    Array.isArray(candidate?.terms)&&candidate.terms.length>=1&&candidate.terms.length<=config.maxTerms&&
    (form!=='pair_plus'||candidate.terms.length===3)&&
    candidate.terms.every(t=>BASIS.some(b=>b.kind===t.kind&&b.uses===t.uses)&&t.uses>=1&&t.uses<=config.maxX&&
      (config.families===undefined||families.includes(familyForKind(t.kind))))&&
    (!candidate.constant||!!config.constant);
}
/** Adjust effective coefficients, because individual product factors are not identifiable. */
export function featureValues(candidate,x){
  if(!candidate?.terms?.length)return [];
  const values=candidate.terms.map(term=>basisValue(term,x));
  const form=compositionOf(candidate);
  if(form==='product')return [bounded(values.reduce((a,b)=>a*b,1))];
  if(form==='pair_plus'){
    if(values.length!==3)return [NaN];
    return [bounded(values[0]*values[1]),values[2]];
  }
  return values;
}
export function featureCount(candidate){
  return (compositionOf(candidate)==='sum'?candidate.terms.length:compositionOf(candidate)==='product'?1:2)+(candidate.constant?1:0);
}
function solve(A,b){
  const n=b.length,M=A.map((row,i)=>[...row,b[i]]);
  for(let col=0;col<n;col++){
    let pivot=col;for(let row=col+1;row<n;row++)if(Math.abs(M[row][col])>Math.abs(M[pivot][col]))pivot=row;
    if(Math.abs(M[pivot][col])<1e-12)return null;
    [M[pivot],M[col]]=[M[col],M[pivot]];
    const d=M[col][col];for(let c=col;c<=n;c++)M[col][c]/=d;
    for(let r=0;r<n;r++)if(r!==col){const f=M[r][col];for(let c=col;c<=n;c++)M[r][c]-=f*M[col][c]}
  }
  return M.map(row=>row[n]);
}
export function fitCandidate(candidate,points,decimals=3,maxInteger=9999){
  const n=featureCount(candidate);
  const rows=[];
  for(const [x,y] of points){
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const v=featureValues(candidate,x);
    if(v.some(k=>!Number.isFinite(k)))continue;
    if(candidate.constant)v.push(1);
    rows.push({v,y});
  }
  if(rows.length<n+1)return null;
  const scales=Array(n).fill(1).map((_,i)=>Math.max(1e-12,Math.sqrt(rows.reduce((sum,r)=>sum+r.v[i]**2,0)/rows.length)));
  const A=Array.from({length:n},()=>Array(n).fill(0)),b=Array(n).fill(0);
  for(const row of rows){
    const v=row.v.map((x,i)=>x/scales[i]);
    for(let i=0;i<n;i++){
      b[i]+=v[i]*row.y;
      for(let j=0;j<n;j++)A[i][j]+=v[i]*v[j];
    }
  }
  const trace=A.reduce((s,row,i)=>s+row[i],0);
  for(let i=0;i<n;i++)A[i][i]+=Math.max(1e-12,trace*1e-10);
  const result=solve(A,b);
  if(!result||result.some(v=>!Number.isFinite(v)))return null;
  const digits=decimalLimit(decimals);
  const cap=integerLimit(maxInteger);
  const coefs=result.map((v,i)=>constrainNumber(v/scales[i],digits,cap));
  if(coefs.some(v=>!Number.isFinite(v)||Math.abs(v)>=1e21))return null;
  return {...candidate,coefs,decimals:digits,maxInteger:cap};
}
export function predict(model,x){
  if(!model?.coefs)return NaN;
  const values=featureValues(model,x);
  let y=model.constant?model.coefs[values.length]:0;
  for(let i=0;i<values.length;i++)y+=model.coefs[i]*values[i];
  return bounded(y);
}
export function scoreModel(model,points,ranges){
  let total=0,valid=0,invalid=0;
  const intervals=ranges.map(range=>({min:Number(range.min),max:Number(range.max),total:0,count:0,invalid:0}));
  for(const [x,y] of points){
    const pred=predict(model,x),percent=Number.isFinite(pred)&&y!==0?100*Math.abs(pred-y)/Math.abs(y):NaN;
    const inside=intervals.filter(r=>x>=r.min&&x<=r.max);
    if(Number.isFinite(percent)){
      total+=percent;valid++;for(const range of inside){range.total+=percent;range.count++}
    }else if(!Number.isFinite(pred)){
      invalid++;for(const range of inside)range.invalid++;
    }
  }
  const coverage=(valid+invalid)>0?valid/(valid+invalid):0;
  const mape=valid?total/valid:Infinity;
  const perRange=intervals.map(r=>r.invalid>0||r.count===0?null:r.total/r.count);
  return {mape:invalid>0?Infinity:mape,coverage,perRange};
}
function latexTerm(term,decimals){
  const p=fmt(term.p,decimals);
  switch(term.kind){
    case 'x':return 'x';case 'power':return `x^{${p}}`;
    case 'ln':return '\\ln(x)';case 'log1p':return '\\ln(1+x)';
    case 'sqrt':return '\\sqrt{x}';case 'exp':return `e^{${p}x}`;
    case 'sin':return `\\sin(${p}x)`;case 'cos':return `\\cos(${p}x)`;
    case 'reciprocal':return `\\frac{1}{x+(${p})}`;
    case 'xln':return 'x\\cdot\\ln(x)';case 'xx':return 'x^{x}';
    case 'xexp':return `x\\cdot e^{${p}x}`;case 'xover':return `\\frac{x}{x+(${p})}`;
    case 'xsin':return `x\\cdot\\sin(${p}x)`;
    default:throw Error('Tipo inválido');
  }
}
export function modelToLatex(model){
  const decimals=decimalLimit(model?.decimals);
  if(!model?.coefs||!validCandidate(model,{maxTerms:3,maxX:2,constant:true}))return null;
  const wrap=(a,t)=>'('+fmt(a,decimals)+')\\cdot '+latexTerm(t,decimals);
  const form=compositionOf(model);
  let latex;
  if(form==='product'){
    latex=model.terms.map((t,i)=>wrap(i===0?model.coefs[0]:1,t)).join('\\cdot ');
  }else if(form==='pair_plus'){
    if(model.terms.length!==3)return null;
    latex='('+wrap(model.coefs[0],model.terms[0])+')\\cdot ('+wrap(1,model.terms[1])+')+'+wrap(model.coefs[1],model.terms[2]);
  }else{
    latex=model.terms.map((t,i)=>wrap(model.coefs[i],t)).join('+');
  }
  if(model.constant)latex+='+('+fmt(model.coefs[featureCount(model)-1],decimals)+')';
  return latex;
}
export function subsample(points,limit=350){
  if(points.length<=limit)return points;
  return Array.from({length:limit},(_,i)=>points[Math.round(i*(points.length-1)/(limit-1))]);
}
