/** Exponential envelopes for strictly positive observations. Pure ES module. */
export const METHODS=['auto','arithmetic','geometric','harmonic'];
export const MODELS=['shared','independent'];
export const decimalLimit=d=>Math.max(0,Math.min(3,Number.isFinite(+d)?Math.trunc(+d):3));
export const magnitudeLimit=m=>[9,99,999,9999].includes(+m)?+m:9999;
const finite=v=>Number.isFinite(v)&&Math.abs(v)<1e125;
const safeExp=v=>v>-690&&v<690?Math.exp(v):v<=-690?0:Infinity;
const toDigits=(v,d)=>Math.pow(10,d)*v;
const q=(v,d)=>Math.round(toDigits(v,d))/Math.pow(10,d);
const down=(v,d)=>Math.floor(toDigits(v,d)+1e-9)/Math.pow(10,d);
const up=(v,d)=>Math.ceil(toDigits(v,d)-1e-9)/Math.pow(10,d);
const maxCoefficient=(m,d)=>m+1-10**(-d);
const sample=(xs,rand)=>xs[Math.min(xs.length-1,Math.floor(rand()*xs.length))];
export function prepareData(points){
  if(!Array.isArray(points))return [];
  return points.map(p=>[+p[0],+p[1]]).filter(p=>finite(p[0])&&finite(p[1])).sort((a,b)=>a[0]-b[0]);
}
export function logSlope(points){
  const data=prepareData(points).filter(p=>p[1]>0);
  if(data.length<2)return NaN;
  const x0=data[0][0],meanX=data.reduce((s,p)=>s+(p[0]-x0),0)/data.length;
  const meanL=data.reduce((s,p)=>s+Math.log(p[1]),0)/data.length;
  const cov=data.reduce((s,p)=>s+(p[0]-x0-meanX)*(Math.log(p[1])-meanL),0);
  const variance=data.reduce((s,p)=>s+(p[0]-x0-meanX)**2,0);
  return variance>0?cov/variance:NaN;
}
export function normalizedRate(target,scale,decimals,maxInteger,random=Math.random){
  const d=decimalLimit(decimals),cap=maxCoefficient(magnitudeLimit(maxInteger),d);
  const step=10**(-d),p=q(target*scale,d);
  if(!finite(p)||Math.abs(p)>cap)return null;
  if(p===0){const sign=target===0?(random()<0.5?-1:1):Math.sign(target);return sign*step}
  return p;
}
export function makeEnvelope(points,config={},random=Math.random){
  const data=prepareData(points);
  if(data.length<2||data.some(p=>p[1]<=0))return null;
  const d=decimalLimit(config.decimals),maxInt=magnitudeLimit(config.maxInteger),cap=maxCoefficient(maxInt,d);
  const shared=config.bounds==='shared';
  const scale=Math.max(1,maxInt); // Explicit integer divisor satisfies magnitude restriction.
  const trend=logSlope(data);
  if(!finite(trend))return null;
  const span=Math.max(1,data[data.length-1][0]-data[0][0]);
  const jitter= Math.max(0.6*Math.abs(trend),1.1/span);
  const slope1=trend + (random()*2-1)*jitter*(random()<0.7?1:3);
  const slope2=shared?slope1:trend + (random()*2-1)*jitter*(random()<0.7?1:3);
  const pL=normalizedRate(slope1,scale,d,maxInt,random),pU=normalizedRate(slope2,scale,d,maxInt,random);
  if(pL===null||pU===null)return null;
  const bL=pL/scale,bU=pU/scale;
  let minRatio=Infinity,maxRatio=-Infinity;
  for(const [x,y] of data){
    const rL=y*safeExp(-bL*x),rU=y*safeExp(-bU*x);
    if(!finite(rL)||!finite(rU))return null;
    if(rL<minRatio)minRatio=rL;
    if(rU>maxRatio)maxRatio=rU;
  }
  // Directed quantization guarantees data enclosure, never merely rounding to nearest.
  const aL=Math.max(0,down(minRatio,d)),aU=up(maxRatio,d);
  if(!finite(aL)||!finite(aU)||aL>cap||aU>cap||aU<=0)return null;
  const envelope={aL,aU,pL,pU,scale,decimals:d,maxInteger:maxInt,bounds:shared?'shared':'independent'};
  if(!encloses(envelope,data))return null;
  return envelope;
}
export function envelopeValues(model,x){
  const l=model.aL*safeExp(model.pL*x/model.scale),u=model.aU*safeExp(model.pU*x/model.scale);
  return [l,u];
}
export function encloses(model,points){
  return points.every(([x,y])=>{const [l,u]=envelopeValues(model,x);return finite(l)&&finite(u)&&l<=y+Math.abs(y)*1e-9+1e-9&&u>=y-Math.abs(y)*1e-9-1e-9;});
}
export function centerValue(l,u,method){
  if(!finite(l)||!finite(u))return NaN;
  if(method==='arithmetic')return (l+u)/2;
  if(method==='geometric')return l>=0&&u>=0?Math.sqrt(l*u):NaN;
  if(method==='harmonic')return l+u!==0?2*l*u/(l+u):NaN;
  return NaN;
}
export function evaluateEnvelope(envelope,points,preferred='auto'){
  const data=prepareData(points);
  if(!encloses(envelope,data))return null;
  const methods=preferred==='auto'?METHODS.slice(1):[preferred];
  let best=null;
  for(const method of methods){
    let sum=0,width=0,absolute=0,invalid=false;
    for(const [x,y] of data){
      const [l,u]=envelopeValues(envelope,x),v=centerValue(l,u,method);
      if(!finite(v)||!finite(l)||!finite(u)||y<=0){invalid=true;break}
      sum+=100*Math.abs(v-y)/y;
      absolute+=Math.abs(v-y);
      width+=100*(u-l)/y;
    }
    if(invalid)continue;
    const mape=sum/data.length,meanWidth=width/data.length;
    // Search both central accuracy and narrowness; expose MAPE independently.
    const rank=mape+0.07*meanWidth;
    if(!best||rank<best.rank)best={...envelope,method,mape,meanWidth,mae:absolute/data.length,rank,count:data.length};
  }
  return best;
}
export function expressionFor(result,type){
  const fmt=n=>String(n);
  const base=(a,p)=>`(${fmt(a)})e^{(${fmt(p)}\\cdot x/${fmt(result.scale)})}`;
  const l=base(result.aL,result.pL),u=base(result.aU,result.pU);
  if(type==='lower')return l;
  if(type==='upper')return u;
  if(result.method==='arithmetic')return `\\frac{${l}+${u}}{2}`;
  if(result.method==='geometric')return `\\sqrt{(${l})(${u})}`;
  return `\\frac{2(${l})(${u})}{(${l})+(${u})}`;
}
export const signature=r=>[r.aL,r.aU,r.pL,r.pU,r.scale,r.method].join(':');
export function takeBest(result,previous){return result&&(!previous||result.rank<previous.rank)?result:previous}