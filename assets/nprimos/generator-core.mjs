/** Pure constrained function search for nPrimos. No eval, no Function(), no remote service. */
export const BASIS = Object.freeze([
  {kind:'x',uses:1},{kind:'power',uses:1},{kind:'ln',uses:1},
  {kind:'log1p',uses:1},{kind:'sqrt',uses:1},{kind:'exp',uses:1},
  {kind:'sin',uses:1},{kind:'cos',uses:1},{kind:'reciprocal',uses:1},
  {kind:'xln',uses:2},{kind:'xx',uses:2},{kind:'xexp',uses:2},
  {kind:'xover',uses:2},{kind:'xsin',uses:2}
]);
const params=[0.125,0.25,0.5,0.75,1,1.25,1.5,2,2.5,3];
const fmt=n=>Number(n.toPrecision(6)).toString();
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
export function makeTerm(kind,maxAbsX,rng=Math.random){
  const uses=BASIS.find(a=>a.kind===kind)?.uses;
  if(!uses)throw Error('Tipo de término desconocido');
  const scale=Math.max(1,maxAbsX);
  let p=0;
  if(kind==='power')p=choice(params,rng);
  if(['exp','xexp','sin','cos','xsin'].includes(kind))p=rand(-5,5,rng)/scale;
  if(['reciprocal','xover'].includes(kind))p=rand(.15,.85,rng)*scale*(rng()<.5?1:-1);
  return {kind,uses,p};
}
export function makeCandidate(config,maxAbsX,rng=Math.random,elite=null){
  const maxTerms=Math.max(1,Math.min(3,Math.floor(config.maxTerms)));
  const maxX=Math.max(1,Math.min(2,Math.floor(config.maxX)));
  const options=BASIS.filter(k=>k.uses<=maxX);
  let terms;
  if(elite?.terms?.length&&rng()<.72){
    terms=elite.terms.map(t=>({...t})).slice(0,maxTerms);
    const pos=Math.floor(rng()*Math.max(1,terms.length));
    if(rng()<.5){terms[pos]=makeTerm(choice(options,rng).kind,maxAbsX,rng)}
    else if(terms[pos]){const old=terms[pos];terms[pos]=makeTerm(old.kind,maxAbsX,rng);terms[pos].p=old.p*.75+terms[pos].p*.25}
    if(rng()<.14&&terms.length<maxTerms)terms.push(makeTerm(choice(options,rng).kind,maxAbsX,rng));
    if(rng()<.12&&terms.length>1)terms.splice(Math.floor(rng()*terms.length),1);
  }else{
    const n=1+Math.floor(rng()*maxTerms);
    terms=Array.from({length:n},()=>makeTerm(choice(options,rng).kind,maxAbsX,rng));
  }
  return {terms,constant:!!config.constant};
}
export function validCandidate(candidate,config){
  return Array.isArray(candidate?.terms)&&candidate.terms.length>=1&&candidate.terms.length<=config.maxTerms&&
    candidate.terms.every(t=>BASIS.some(b=>b.kind===t.kind&&b.uses===t.uses)&&t.uses>=1&&t.uses<=config.maxX)&&
    (!candidate.constant||!!config.constant);
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
export function fitCandidate(candidate,points){
  const n=candidate.terms.length+(candidate.constant?1:0);
  const rows=[];
  for(const [x,y] of points){
    if(!Number.isFinite(x)||!Number.isFinite(y))continue;
    const v=candidate.terms.map(t=>basisValue(t,x));
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
  const coefs=result.map((v,i)=>v/scales[i]);
  return {...candidate,coefs};
}
export function predict(model,x){
  if(!model?.coefs)return NaN;
  let y=model.constant?model.coefs[model.terms.length]:0;
  for(let i=0;i<model.terms.length;i++)y+=model.coefs[i]*basisValue(model.terms[i],x);
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
function latexTerm(term){
  const p=fmt(term.p);
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
  if(!model?.coefs||!validCandidate(model,{maxTerms:3,maxX:2,constant:true}))return null;
  const parts=model.terms.map((term,i)=>`(${fmt(model.coefs[i])})\\cdot ${latexTerm(term)}`);
  if(model.constant)parts.push(`(${fmt(model.coefs[model.terms.length])})`);
  return parts.join('+');
}
export function subsample(points,limit=350){
  if(points.length<=limit)return points;
  return Array.from({length:limit},(_,i)=>points[Math.round(i*(points.length-1)/(limit-1))]);
}
