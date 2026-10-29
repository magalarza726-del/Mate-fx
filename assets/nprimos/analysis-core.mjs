/** Pure numerical helpers shared by the Desmos research table and tests. */
import {compileExpression} from '../matefx/src/math.js';

export function readNumber(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  let s=String(input??'').trim().replace(/\s/g,'');
  if (!s) return NaN;
  if (/^[-+]?\d{1,3}(\.\d{3})+,\d+(?:[eE][-+]?\d+)?$/.test(s)) s=s.replaceAll('.','').replace(',','.');
  else if (/^[-+]?(?:\d+),\d+(?:[eE][-+]?\d+)?$/.test(s)) s=s.replace(',','.');
  if (!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(s)) return NaN;
  const n=Number(s);return Number.isFinite(n)?n:NaN;
}

function unwrapLatexFractions(s) {
  function group(t, start) {
    while (/\s/.test(t[start]||'')) start++;
    if (t[start] !== '{') return null;
    let depth=1;
    for (let i=start+1;i<t.length;i++) {
      if (t[i]==='{') depth++;
      if (t[i]==='}' && !--depth) return {text:t.slice(start+1,i),end:i+1};
    }
    return null;
  }
  for(let iter=0;iter<24;iter++) {
    const at=s.lastIndexOf('\\frac');
    if(at<0)break;
    const a=group(s,at+5),b=a&&group(s,a.end);
    if(!b)return null;
    s=s.slice(0,at)+'(('+a.text+')/('+b.text+'))'+s.slice(b.end);
  }
  return s;
}

export function desmosToNumeric(latex) {
  let s=String(latex||'').replace(/^\s*(?:(?:[a-zA-Z]|\\[a-zA-Z]+)(?:_\{[^}]+\})?\s*\(\s*x\s*\)|y)\s*=\s*/,'');
  s=s.replace(/\\left|\\right/g,'').replace(/\\operatorname\{([^{}]+)\}/g,'$1');
  s=unwrapLatexFractions(s);
  if(s===null)return null;
  s=s.replace(/\\(?:cdot|times)/g,'*').replace(/\\,/g,'')
    .replace(/\\(ln|log|sin|cos|tan|sqrt|pi|exp|abs)/g,'$1')
    .replace(/\\([a-zA-Z]+)/g,'$1')
    .replaceAll('{','(').replaceAll('}',')').replaceAll('−','-');
  return s;
}

export function numericFunction(latex) {
  try {const body=desmosToNumeric(latex);return body===null?null:compileExpression(body)}
  catch (_) {return null}
}
export function absoluteError(real, estimate) {
  return Number.isFinite(real)&&Number.isFinite(estimate)?Math.abs(real-estimate):NaN;
}
export function percentageError(real, estimate) {
  const e=absoluteError(real,estimate);
  return Number.isFinite(e)&&real!==0?100*e/Math.abs(real):NaN;
}
/** The closest real solution of f(x)=target near observed x, on a locally reachable branch. */
export function inverseClosest(fn, observedX, targetY) {
  if (!fn || !Number.isFinite(observedX) || !Number.isFinite(targetY)) return NaN;
  const value=x=>{try {const y=fn(x);return Number.isFinite(y)?y-targetY:NaN}catch{return NaN}};
  let x=observedX;
  const initial=value(x);
  if (!Number.isFinite(initial)) return NaN;
  if (Math.abs(initial)<=1e-10*(1+Math.abs(targetY))) return x;
  // Numerical Newton iteration: use a central derivative, safeguard divergent jumps.
  for(let i=0;i<32;i++) {
    const r=value(x);
    if(!Number.isFinite(r))break;
    if(Math.abs(r)<=1e-9*(1+Math.abs(targetY)))return x;
    const h=1e-5*(1+Math.abs(x));
    const l=value(x-h),u=value(x+h);
    const slope=(u-l)/(2*h);
    if(!Number.isFinite(slope)||Math.abs(slope)<1e-12)break;
    let change=r/slope;
    const limit= Math.max(10,Math.abs(x-observedX)*3+Math.abs(observedX)*.5+10);
    change=Math.max(-limit,Math.min(limit,change));
    const next=x-change;
    if(!Number.isFinite(next)||!Number.isFinite(value(next)))break;
    x=next;
  }
  // Expand both sides of the observed X; bisection isolates the nearest crossing.
  const candidates=[];
  for(const sign of [-1,1]) {
    let low=observedX, fLow=initial, step=Math.max(.05,Math.abs(observedX)*.025);
    for(let k=0;k<28;k++) {
      const high=observedX+sign*step,fHigh=value(high);
      if(Number.isFinite(fHigh)&&fLow*fHigh<=0) {
        let a=low,b=high,fa=fLow;
        for(let n=0;n<56;n++) {
          const mid=(a+b)/2,fmid=value(mid);
          if(!Number.isFinite(fmid))break;
          if(Math.abs(fmid)<=1e-11*(1+Math.abs(targetY))) {a=b=mid;break}
          if(fa*fmid<=0)b=mid;else{a=mid;fa=fmid}
        }
        const root=(a+b)/2;
        if(Math.abs(value(root))<=1e-6*(1+Math.abs(targetY)))candidates.push(root);
        break;
      }
      if(Number.isFinite(fHigh)){low=high;fLow=fHigh}
      step*=1.8;
      if(step>1e12)break;
    }
  }
  if(Number.isFinite(x)&&Math.abs(value(x))<=1e-6*(1+Math.abs(targetY)))candidates.push(x);
  candidates.sort((a,b)=>Math.abs(a-observedX)-Math.abs(b-observedX));
  return candidates[0]??NaN;
}
export function buildRows(points, functions, mode='y') {
  return points.map((point,i)=>{
    const [x,y]=point;
    const values=functions.map(fn=>{
      const v=mode==='x'?inverseClosest(fn.evaluate,x,y):Number.isFinite(fn.values?.[i])?fn.values[i]:(fn.evaluate?.(x)??NaN);
      const actual=mode==='x'?x:y;
      return {estimate:v,error:absoluteError(actual,v),percent:percentageError(actual,v)};
    });
    return {x,y,values,index:i+1};
  });
}