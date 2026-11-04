/* Mate-fx · Investigación: motores numéricos locales, sin eval. */
import {makeCandidate,fitCandidate,predict as predictSymbolic,modelToLatex,inferTrend} from './generator-core.mjs';
import {makeEnvelope, evaluateEnvelope, envelopeValues, centerValue, expressionFor} from './envelope-core.mjs';

export const METHODS=[
 {id:'linear',name:'Regresión lineal',group:'Regresiones',type:'direct'},
 {id:'polynomial',name:'Regresión polinómica',group:'Regresiones',type:'direct'},
 {id:'exponential',name:'Regresión exponencial',group:'Regresiones',type:'direct'},
 {id:'logarithmic',name:'Regresión logarítmica',group:'Regresiones',type:'direct'},
 {id:'power',name:'Regresión potencial',group:'Regresiones',type:'direct'},
 {id:'rational',name:'Regresión racional',group:'Regresiones',type:'direct'},
 {id:'pade',name:'Aproximación racional tipo Padé',group:'Regresiones',type:'direct'},
 {id:'reciprocal',name:'Regresión recíproca',group:'Regresiones',type:'direct'},
 {id:'sqrt',name:'Regresión de raíz cuadrada',group:'Regresiones',type:'direct'},
 {id:'correction_poly',name:'Exponencial con corrección polinómica',group:'Correcciones',type:'direct'},
 {id:'correction_exp',name:'Doble exponencial',group:'Correcciones',type:'search'},
 {id:'correction_power',name:'Exponencial con corrección potencial',group:'Correcciones',type:'search'},
 {id:'correction_rational',name:'Exponencial con corrección racional',group:'Correcciones',type:'search'},
 {id:'correction_sigmoid',name:'Corrección sigmoidal',group:'Correcciones',type:'search'},
 {id:'linear_interp',name:'Interpolación lineal',group:'Interpolación',type:'direct'},
 {id:'lagrange',name:'Interpolación de Lagrange',group:'Interpolación',type:'direct'},
 {id:'newton',name:'Interpolación de Newton',group:'Interpolación',type:'direct'},
 {id:'hermite',name:'Interpolación cúbica de Hermite',group:'Interpolación',type:'direct'},
 {id:'pchip',name:'PCHIP monótona',group:'Interpolación',type:'direct'},
 {id:'spline',name:'Spline cúbico natural',group:'Interpolación',type:'direct'},
 {id:'chebyshev',name:'Polinomios de Chebyshev',group:'Aproximación avanzada',type:'direct'},
 {id:'minimax',name:'Minimax aproximado (IRLS)',group:'Aproximación avanzada',type:'direct'},
 {id:'quantile',name:'Regresión cuantílica (IRLS)',group:'Aproximación avanzada',type:'direct'},
 {id:'fourier',name:'Serie de Fourier',group:'Aproximación avanzada',type:'direct'},
 {id:'rbf',name:'Funciones radiales gaussianas (RBF)',group:'Aproximación avanzada',type:'direct'},
 {id:'symbolic',name:'Regresión simbólica evolutiva',group:'Búsqueda estocástica',type:'search'},
 {id:'differential',name:'Evolución diferencial',group:'Búsqueda estocástica',type:'search'},
 {id:'genetic',name:'Algoritmo genético',group:'Búsqueda estocástica',type:'search'},
 {id:'annealing',name:'Recocido simulado',group:'Búsqueda estocástica',type:'search'},
 {id:'levenberg',name:'Levenberg–Marquardt',group:'Optimización no lineal',type:'search'},
 {id:'envelope',name:'Acotación exponencial',group:'Optimización no lineal',type:'search'}
];
export const methodById=id=>METHODS.find(m=>m.id===id);
const cap=(n,a,b)=>Math.min(b,Math.max(a,n));
const clean=v=>Number.isFinite(v)&&Math.abs(v)<1e160?v:NaN;
const fix=(v,d=3,m=9999)=>{
 if(!Number.isFinite(v))return NaN;
 const k=cap(Math.trunc(+d||0),0,6),max=Math.max(1,Math.abs(+m||9999));
 const r=Number(cap(v,-max,max).toFixed(k));
 return Object.is(r,-0)?0:r;
};
const fmt=v=>Number.isFinite(v)?String(Number(v.toPrecision(9))):'NaN';
export const escapeTex=v=>String(v??'').replace(/\\/g,'\\textbackslash ').replace(/[{}%&#_$]/g,'');
export function cleanData(input){
 const rows=(input||[]).map(p=>[+p[0],+p[1]]).filter(p=>p.every(Number.isFinite)).sort((a,b)=>a[0]-b[0]);
 const grouped=[];for(const p of rows){const last=grouped[grouped.length-1];if(last&&last[0]===p[0]){last[1]+=p[1];last[2]++}else grouped.push([p[0],p[1],1])}
 return grouped.map(p=>[p[0],p[1]/p[2]]);
}
export function splitData(points,validation=20){
 const rows=cleanData(points),rate=cap(+validation||0,0,40);
 if(rows.length<8||rate===0)return {train:rows,validation:[],all:rows};
 const step=Math.max(3,Math.round(100/rate)),train=[],hold=[];
 rows.forEach((p,i)=>(i%step===Math.floor(step/2)?hold:train).push(p));
 return {train,validation:hold,all:rows};
}
export function statistics(points,estimates){
 let sumAbs=0,sumSq=0,maxAbs=0,sumPct=0,maxPct=0,pctCount=0,valid=0;const percent=[];
 for(let i=0;i<points.length;i++){
  const p=points[i],y=estimates[i];if(!Number.isFinite(y))continue;
  const e=Math.abs(y-p[1]);sumAbs+=e;sumSq+=e*e;maxAbs=Math.max(maxAbs,e);valid++;
  if(p[1]!==0){const pe=100*e/Math.abs(p[1]);sumPct+=pe;maxPct=Math.max(maxPct,pe);pctCount++;percent.push(pe)}
 }
 percent.sort((a,b)=>a-b);const meanAbs=valid?sumAbs/valid:Infinity;
 const yrange=Math.max(1e-12,...points.map(p=>Math.abs(p[1])));
 return {mae:meanAbs,rmse:valid?Math.sqrt(sumSq/valid):Infinity,maxAbs, mape:pctCount?sumPct/pctCount:null,maxape:pctCount?maxPct:null,p95:percent.length?percent[Math.ceil(.95*percent.length)-1]:null,nmae:meanAbs/yrange*100,valid,invalid:points.length-valid,zeroY:points.length-pctCount};
}
export function objective(metrics,kind='mape'){
 if(metrics.invalid||!metrics.valid)return Infinity;
 if(kind==='max')return metrics.maxape??metrics.maxAbs;
 if(kind==='mae')return metrics.mae;
 if(kind==='rmse')return metrics.rmse;
 if(kind==='balanced')return (metrics.mape??metrics.nmae)+.4*(metrics.maxape??metrics.nmae);
 return metrics.mape??metrics.nmae;
}
function solver(A,b){
 const n=b.length,M=A.map((r,i)=>[...r,b[i]]);
 for(let c=0;c<n;c++){let k=c;for(let j=c+1;j<n;j++)if(Math.abs(M[j][c])>Math.abs(M[k][c]))k=j;
  if(Math.abs(M[k][c])<1e-15)return null;
  [M[k],M[c]]=[M[c],M[k]];const a=M[c][c];for(let j=c;j<=n;j++)M[c][j]/=a;
  for(let i=0;i<n;i++)if(i!==c){const t=M[i][c];for(let j=c;j<=n;j++)M[i][j]-=t*M[c][j]}}
 return M.map(r=>r[n]);
}
function ridgeFit(points,features,opt={},response=null,weights=null){
 const data=[];
 for(let i=0;i<points.length;i++){const f=features(points[i][0]),y=response?response(points[i]):points[i][1];
  if(f.length&&!f.some(v=>!Number.isFinite(v)||Math.abs(v)>1e90)&&Number.isFinite(y))data.push({f,y,w:weights?weights(i,points[i]):1})}
 const count=features(points[0][0]).length;if(data.length<count+1)return null;
 const scale=Array.from({length:count},(_,j)=>Math.max(1e-9,Math.sqrt(data.reduce((s,v)=>s+v.f[j]*v.f[j],0)/data.length)));
 const A=Array.from({length:count},()=>Array(count).fill(0)),b=Array(count).fill(0);
 for(const row of data){const f=row.f.map((v,j)=>v/scale[j]),w=Math.max(1e-12,row.w);for(let i=0;i<count;i++){b[i]+=w*f[i]*row.y;for(let j=0;j<count;j++)A[i][j]+=w*f[i]*f[j]}}
 const trace=A.reduce((a,r,i)=>a+Math.abs(r[i]),0);
 for(let i=0;i<count;i++)A[i][i]+=Math.max(1e-12,trace*(opt.ridge??1e-10));
 const c=solver(A,b);if(!c)return null;
 return c.map((v,j)=>fix(v/scale[j],opt.decimals,opt.magnitude));
}
function normalized(points){
 const min=points[0][0],max=points[points.length-1][0],center=(min+max)/2,scale=Math.max(1e-9,(max-min)/2);
 return {center,scale,z:x=>(x-center)/scale,tex:'\\frac{x-('+fmt(center)+')}{'+fmt(scale)+'}'};
}
function basisModel(points,bases,terms,opt,pre=null,weights=null){
 const xnorm=normalized(points),features=x=>bases.map(f=>f(xnorm.z(x),x));
 const c=ridgeFit(points,features,opt,pre,weights);if(!c||c.some(v=>!Number.isFinite(v)))return null;
 return {latex:'f(x)='+c.map((v,i)=>'('+fmt(v)+')'+(i?'\\cdot ':'')+(terms[i]||'')).join('+'),predict:x=>clean(features(x).reduce((s,v,i)=>s+v*c[i],0)),ztex:xnorm.tex,complexity:bases.length+terms.reduce((s,t)=>s+(t.match(/\\cdot|\\exp|\\sin|\\cos|\\ln|\\frac|\^/g)||[]).length,0)};
}
function powerBasis(n){return Array.from({length:n+1},(_,k)=>z=>Math.pow(z,k))}
function powerLabels(n){return Array.from({length:n+1},(_,k)=>k?'z^{'+k+'}':'')}
function polynomial(points,opt,degree){return basisModel(points,powerBasis(degree),powerLabels(degree),opt)}
function linearized(points,features,labels,opt,transform,untransform){
 const selected=points.filter(([x,y])=>transform(y,x)!==null);
 if(selected.length<features.length+2)return null;
 const data=selected.map(([x,y])=>[x,transform(y,x)]);
 const result=basisModel(data,features,labels,opt);
 if(!result)return null;
 const core=result.predict;
 return {...result,latex:'f(x)='+untransform.latex(result.latex.slice(5)),predict:x=>clean(untransform.fn(core(x)))};
}
function rational(points,opt,numerator=2,denominator=2){
 const norm=normalized(points),N=cap(numerator,0,4),D=cap(denominator,1,4);
 const features=(x,y)=>{const z=norm.z(x);return [...Array.from({length:N+1},(_,k)=>z**k),...Array.from({length:D},(_,k)=>-y*z**(k+1))]};
 const count=N+D+1;
 const data=points.map(p=>({p,vec:features(...p)})).filter(o=>o.vec.every(Number.isFinite));
 if(data.length<count+1)return null;
 const scales=Array.from({length:count},(_,j)=>Math.max(1e-10,Math.sqrt(data.reduce((a,o)=>a+o.vec[j]**2,0)/data.length)));
 const A=Array.from({length:count},()=>Array(count).fill(0)),b=Array(count).fill(0);
 for(const o of data){const v=o.vec.map((a,j)=>a/scales[j]);const w=1/Math.max(1,Math.abs(o.p[1]))**2;
  for(let i=0;i<count;i++){b[i]+=w*v[i]*o.p[1];for(let j=0;j<count;j++)A[i][j]+=w*v[i]*v[j]}}
 for(let i=0;i<count;i++)A[i][i]+=Math.max(1e-11,Math.abs(A[i][i])*1e-8);
 const sol=solver(A,b);if(!sol)return null;
 const c=sol.map((v,i)=>fix(v/scales[i],opt.decimals,opt.magnitude));
 const num=c.slice(0,N+1),den=[1,...c.slice(N+1)];
 const formula=a=>a.map((v,k)=>'('+fmt(v)+')'+(k?'z^{'+k+'}':'')).join('+');
 return {latex:'f(x)=\\frac{'+formula(num)+'}{'+formula(den)+'}',ztex:norm.tex,complexity:count+4,predict:x=>{const z=norm.z(x);const d=den.reduce((s,v,k)=>s+v*z**k,0);return Math.abs(d)<1e-10?NaN:clean(num.reduce((s,v,k)=>s+v*z**k,0)/d)}};
}
function sampleKnots(points,count){
 const n=cap(Math.trunc(count||8),3,Math.min(16,points.length)),index=new Set(Array.from({length:n},(_,i)=>Math.round(i*(points.length-1)/(n-1))));
 return [...index].map(i=>points[i]);
}
function interpolation(points,opt,id){
 const knots=sampleKnots(points,opt.knots),N=knots.length-1;
 if(!N||knots.some((p,i)=>i&&p[0]===knots[i-1][0]))return null;
 if(id==='lagrange'||id==='newton'){
  if(id==='lagrange'){
   const w=knots.map(([xi],i)=>1/knots.reduce((prod,[xj],j)=>j===i?prod:prod*(xi-xj),1));
   const formula=knots.map(([x,y],i)=>'('+fmt(y)+')\\prod_{j\\ne '+i+'}\\frac{x-x_j}{x_'+i+'-x_j}').join('+');
   return {latex:'f(x)='+formula+'\\quad (x_j\\text{ son los nodos indicados})',complexity:knots.length*4,predict:x=>{
     let top=0,bot=0;for(let i=0;i<knots.length;i++){if(Math.abs(x-knots[i][0])<1e-12)return knots[i][1];const t=w[i]/(x-knots[i][0]);top+=t*knots[i][1];bot+=t}return clean(top/bot)}};
  }
  const dd=knots.map(p=>p[1]),coef=[dd[0]];
  for(let j=1;j<knots.length;j++){for(let i=0;i<knots.length-j;i++)dd[i]=(dd[i+1]-dd[i])/(knots[i+j][0]-knots[i][0]);coef.push(dd[0])}
  return {latex:'f(x)='+coef.map((c,j)=>'('+fmt(c)+')'+knots.slice(0,j).map(p=>'\\left(x-('+fmt(p[0])+')\\right)').join('')).join('+'),complexity:N*3,predict:x=>{let v=coef[N];for(let j=N-1;j>=0;j--)v=coef[j]+(x-knots[j][0])*v;return clean(v)}};
 }
 const x=knots.map(v=>v[0]),y=knots.map(v=>v[1]),h=Array.from({length:N},(_,i)=>x[i+1]-x[i]),delta=h.map((d,i)=>(y[i+1]-y[i])/d),m=Array(N+1).fill(0);
 if(id==='pchip'){
  for(let i=1;i<N;i++){const a=delta[i-1],b=delta[i];m[i]=a*b<=0?0:(2*h[i]+h[i-1]+h[i]+2*h[i-1])/((2*h[i]+h[i-1])/a+(h[i]+2*h[i-1])/b)}
  const edge=(a,b,h0,h1)=>{let v=((2*h0+h1)*a-h0*b)/(h0+h1);if(v*a<=0)return 0;if(a*b<0&&Math.abs(v)>3*Math.abs(a))return 3*a;return v};
  m[0]=edge(delta[0],delta[1]??delta[0],h[0],h[1]??h[0]);m[N]=edge(delta[N-1],delta[N-2]??delta[N-1],h[N-1],h[N-2]??h[N-1]);
 }else if(id==='spline'){
  const A=Array.from({length:N+1},()=>Array(N+1).fill(0)),rhs=Array(N+1).fill(0);A[0][0]=1;A[N][N]=1;
  for(let i=1;i<N;i++){A[i][i-1]=h[i-1];A[i][i]=2*(h[i-1]+h[i]);A[i][i+1]=h[i];rhs[i]=6*(delta[i]-delta[i-1])}
  const M=solver(A,rhs);if(!M)return null;
  for(let i=0;i<=N;i++)m[i]=i===0?delta[0]-h[0]*(2*M[0]+M[1])/6:i===N?delta[N-1]+h[N-1]*(M[N-1]+2*M[N])/6:delta[i-1]+h[i-1]*(M[i-1]+2*M[i])/6;
 }else{
  m[0]=delta[0];m[N]=delta[N-1];for(let i=1;i<N;i++)m[i]=(h[i]*delta[i-1]+h[i-1]*delta[i])/(h[i-1]+h[i]);
 }
 const pieces=[];for(let i=0;i<N;i++){
  if(id==='linear_interp'){pieces.push({a:y[i],b:delta[i],c:0,d:0})}
  else {const a=y[i],b=m[i],c=(3*delta[i]-2*m[i]-m[i+1])/h[i],d=(m[i]+m[i+1]-2*delta[i])/(h[i]*h[i]);pieces.push({a,b,c,d})}
 }
 const latex='f(x)=\\begin{cases}'+pieces.map((v,i)=>['('+fmt(v.a)+')','('+fmt(v.b)+')t','('+fmt(v.c)+')t^2','('+fmt(v.d)+')t^3'].join('+')+',\\ t=x-('+fmt(x[i])+'),\\ '+fmt(x[i])+'\\le x'+(i===N-1?'\\le':'<')+fmt(x[i+1])).join('\\\\')+'\\end{cases}';
 return {latex,complexity:pieces.length*(id==='linear_interp'?2:4),domain:[x[0],x[N]],predict:value=>{
  if(value<x[0]||value>x[N])return NaN;
  let k=N-1;for(let i=0;i<N;i++)if(value<=x[i+1]){k=i;break}
  const t=value-x[k],p=pieces[k];return clean(p.a+p.b*t+p.c*t*t+p.d*t*t*t)}};
}
function customBasis(id,points,opt,seed=0){
 const norm=normalized(points),basis=[],labels=[],push=(fn,latex)=>{basis.push(fn);labels.push(latex)};
 const z=x=>norm.z(x);
 if(id==='linear'){push(()=>1,'');push(v=>v,'z')}
 if(id==='polynomial'||id==='minimax'||id==='quantile'){for(let k=0;k<=opt.degree;k++)push(v=>v**k,k?'z^{'+k+'}':'')}
 if(id==='chebyshev'){push(()=>1,'');if(opt.degree>=1)push(v=>v,'z');let prev=(v)=>1,current=v=>v;for(let k=2;k<=opt.degree;k++){const oldPrev=prev,oldCurrent=current;const next=v=>2*v*oldCurrent(v)-oldPrev(v);push(next,'T_{'+k+'}(z)');prev=current;current=next}}
 if(id==='logarithmic'){push(()=>1,'');push((v,x)=>x>0?Math.log(x):NaN,'\\ln(x)')}
 if(id==='sqrt'){push(()=>1,'');push((v,x)=>x>=0?Math.sqrt(x):NaN,'\\sqrt{x}')}
 if(id==='reciprocal'){push(()=>1,'');push(v=>1/(v+2),'\\frac{1}{z+2}')}
 if(id==='fourier'){push(()=>1,'');for(let k=1;k<=opt.harmonics;k++){push(v=>Math.sin(Math.PI*k*v),'\\sin('+k+'\\pi z)');push(v=>Math.cos(Math.PI*k*v),'\\cos('+k+'\\pi z)')}}
 if(id==='correction_poly'){push(()=>1,'');push(v=>v,'z');push(v=>Math.exp(v),'e^z');push(v=>v*v,'z^2')}
 if(id==='rbf'){push(()=>1,'');for(let k=0;k<opt.knots;k++){const center=-1+2*k/Math.max(1,opt.knots-1),width=opt.width;push(v=>Math.exp(-((v-center)/width)**2),'e^{-((z-('+fmt(center)+'))/'+fmt(width)+')^2}')}}
 if(id.startsWith('correction_')&&id!=='correction_poly'){
  const t=seed,rate=Math.max(.05,Math.abs(t));
  push(()=>1,'');push(v=>Math.exp(cap(t*v,-60,60)),'e^{('+fmt(t)+')z}');
  if(id==='correction_exp')push(v=>Math.exp(cap(-rate*v,-60,60)),'e^{(-'+fmt(rate)+')z}');
  if(id==='correction_power')push(v=>(v+1.1)**(1+rate),'(z+1.1)^{'+fmt(1+rate)+'}');
  if(id==='correction_rational')push(v=>v/(2+rate*v),'\\frac{z}{2+('+fmt(rate)+')z}');
  if(id==='correction_sigmoid')push(v=>1/(1+Math.exp(-cap(t*v,-60,60))),'\\frac{1}{1+e^{-('+fmt(t)+')z}}');
 }
 return {norm,basis,labels};
}
function linearMethod(id,points,opt,seed){
 if(id==='exponential'){
  const valid=points.filter(p=>p[1]>0);if(valid.length<points.length)return null;
  const norm=normalized(points),z=x=>norm.z(x);
  const coef=ridgeFit(points,x=>[1,z(x)],opt,p=>Math.log(p[1]));
  if(!coef)return null;const a=fix(Math.exp(coef[0]),opt.decimals,opt.magnitude),b=coef[1];
  return {latex:'f(x)=('+fmt(a)+')e^{('+fmt(b)+')z}',ztex:norm.tex,complexity:4,predict:x=>clean(a*Math.exp(b*z(x)))};
 }
 if(id==='power'){
  if(points.some(p=>p[0]<=0||p[1]<=0))return null;
  const c=ridgeFit(points,x=>[1,Math.log(x)],opt,p=>Math.log(p[1]));if(!c)return null;
  const a=fix(Math.exp(c[0]),opt.decimals,opt.magnitude);
  return {latex:'f(x)=('+fmt(a)+')x^{('+fmt(c[1])+')}',complexity:4,predict:x=>x>0?clean(a*x**c[1]):NaN};
 }
 if(id==='rational')return rational(points,opt,opt.degree,Math.max(1,opt.denominator));
 if(id==='pade')return rational(points,opt,opt.degree,opt.denominator);
 if(['linear_interp','lagrange','newton','hermite','pchip','spline'].includes(id))return interpolation(points,opt,id);
 if(id==='quantile'||id==='minimax'){
  const {basis,labels,norm}=customBasis(id,points,opt),feature=x=>basis.map(fn=>fn(norm.z(x),x));
  let weights=Array(points.length).fill(1),model=null;
  for(let k=0;k<Math.min(25,Math.max(6,opt.degree*4));k++){
   model=basisModel(points,basis,labels,opt,null,(_,p)=>weights[points.indexOf(p)]||1);if(!model)return null;
   const e=points.map(p=>p[1]-model.predict(p[0]));
   const scale=Math.max(1e-8,e.reduce((s,v)=>s+Math.abs(v),0)/e.length*.01);
   weights=e.map(v=>id==='minimax'?Math.min(1e6,(Math.abs(v)+scale)**Math.min(3,1+k/5)):Math.min(1e6,(v>=0?opt.quantile:1-opt.quantile)/Math.max(scale,Math.abs(v))));
  }return model;
 }
 const {basis,labels}=customBasis(id,points,opt,seed);
 return basis.length?basisModel(points,basis,labels,opt):null;
}
function predictorModel(id,points,opt,rng,step,session){
 if(id==='symbolic'){
  const config={maxTerms:opt.maxTerms,maxX:opt.maxX,constant:opt.constant,composition:opt.composition,families:opt.families,trendRate:inferTrend(points).rate};
  const shape=makeCandidate(config,Math.max(1,...points.map(p=>Math.abs(p[0]))),rng,session?.elite?.model||null);
  const model=fitCandidate(shape,points,Math.min(3,opt.decimals),Math.min(9999,opt.magnitude));if(!model)return null;
  const formula=modelToLatex(model);if(!formula)return null;
  return {latex:'f(x)='+formula,complexity:shape.terms.length*4+(shape.constant?1:0),predict:x=>predictSymbolic(model,x),model};
 }
 if(id==='envelope'){
  if(points.some(p=>p[1]<=0))return null;
  const envelope=makeEnvelope(points,{bounds:opt.bounds,center:opt.center,decimals:Math.min(3,opt.decimals),maxInteger:[9,99,999,9999].includes(+opt.magnitude)?+opt.magnitude:9999},rng);
  if(!envelope)return null;const evaluated=evaluateEnvelope(envelope,points,opt.center);
  if(!evaluated)return null;
  const latex=expressionFor(evaluated,'center');
  return {latex:'f(x)='+latex,complexity:7,predict:x=>{const [lo,hi]=envelopeValues(evaluated,x);return centerValue(lo,hi,evaluated.method)}};
 }
 if(id==='levenberg'){
  const norm=normalized(points),z=x=>norm.z(x);
  let v=session?.params?.slice()||[1,1,0],damp=1e-2;
  const calc=(c,x)=>c[0]*Math.exp(cap(c[1]*z(x),-50,50))+c[2];
  for(let it=0;it<6;it++){
   const residual=points.map(p=>p[1]-calc(v,p[0]));
   const jac=points.map(p=>{const a=Math.exp(cap(v[1]*z(p[0]),-50,50));return [a,v[0]*z(p[0])*a,1]});
   const A=Array.from({length:3},()=>Array(3).fill(0)),b=Array(3).fill(0);
   for(let r=0;r<points.length;r++)for(let i=0;i<3;i++){b[i]+=jac[r][i]*residual[r];for(let j=0;j<3;j++)A[i][j]+=jac[r][i]*jac[r][j]}
   for(let i=0;i<3;i++)A[i][i]+=damp;const move=solver(A,b);if(!move)break;
   const trial=v.map((a,i)=>fix(a+move[i],opt.decimals,opt.magnitude));
   const loss=c=>points.reduce((a,p)=>a+(p[1]-calc(c,p[0]))**2,0);
   if(loss(trial)<loss(v)){v=trial;damp=Math.max(1e-8,damp/3)}else damp*=5;
  }
  if(session)session.params=v;
  return {latex:'f(x)=('+fmt(v[0])+')e^{('+fmt(v[1])+')z}+('+fmt(v[2])+')',ztex:norm.tex,complexity:6,predict:x=>clean(calc(v,x))};
 }
 if(['differential','genetic','annealing'].includes(id)){
  const norm=normalized(points),z=x=>norm.z(x),n=4;
  const get=coeff=>({latex:'f(x)=('+fmt(coeff[0])+')+('+fmt(coeff[1])+')z+('+fmt(coeff[2])+')z^2+('+fmt(coeff[3])+')e^z',ztex:norm.tex,complexity:8,predict:x=>clean(coeff[0]+coeff[1]*z(x)+coeff[2]*z(x)**2+coeff[3]*Math.exp(z(x)))});
  const score=c=>objective(statistics(points,points.map(p=>get(c).predict(p[0]))),opt.objective);
  const fresh=()=>Array.from({length:n},()=>fix((rng()*2-1)*opt.magnitude*.15,opt.decimals,opt.magnitude));
  const s=session||{},pop=s.pop||(s.pop=Array.from({length:16},fresh)),scores=s.scores||(s.scores=pop.map(score));
  const bestIndex=()=>scores.indexOf(Math.min(...scores));
  const best=bestIndex(),selectIndex=()=>Math.floor(rng()*pop.length);
  let trial;
  if(id==='differential'){
   const a=selectIndex(),b=selectIndex(),c=selectIndex(),target=step%pop.length;
   trial=pop[target].map((v,j)=>fix(rng()<.75?pop[a][j]+.7*(pop[b][j]-pop[c][j]):v,opt.decimals,opt.magnitude));
   const sc=score(trial);if(sc<scores[target]){pop[target]=trial;scores[target]=sc}
  }else if(id==='genetic'){
   const a=pop[best],b=pop[selectIndex()];trial=a.map((v,j)=>fix(rng()<.48?b[j]:(rng()<.35?v+(rng()*2-1)*Math.max(.001,opt.magnitude*.015):v),opt.decimals,opt.magnitude));
   const worst=scores.indexOf(Math.max(...scores)),sc=score(trial);if(sc<scores[worst]){pop[worst]=trial;scores[worst]=sc}
  }else{
   const temp=Math.max(.00001,1/(1+step/200)),a=pop[best];
   trial=a.map(v=>fix(v+(rng()*2-1)*Math.max(.001,opt.magnitude*.025)*temp,opt.decimals,opt.magnitude));
   const sc=score(trial);if(sc<scores[best]||rng()<Math.exp(Math.min(0,(scores[best]-sc)/Math.max(.00001,temp)))){pop[best]=trial;scores[best]=sc}
  }
  return get(pop[bestIndex()]);
 }
 if(id.startsWith('correction_'))return linearMethod(id,points,opt,rng()*5-.5);
 return linearMethod(id,points,opt);
}
export function methodConfig(input={}){
 const allowed=['logarithmic','exponential','polynomial','trigonometric'];
 return {n:cap(Math.trunc(+input.n||1000),1,100000),degree:cap(Math.trunc(+input.degree||2),1,5),denominator:cap(Math.trunc(+input.denominator||2),1,4),knots:cap(Math.trunc(+input.knots||8),3,16),harmonics:cap(Math.trunc(+input.harmonics||2),1,5),width:cap(+input.width||.6,.05,3),quantile:cap(+input.quantile||.5,.01,.99),decimals:cap(Math.trunc(+input.decimals||0),0,6),magnitude:Math.max(9,Math.min(999999,Math.abs(+input.magnitude||9999))),maxTerms:cap(Math.trunc(+input.maxTerms||3),1,3),maxX:cap(Math.trunc(+input.maxX||2),1,2),constant:input.constant!==false,generational:input.generational!==false,composition:['sum','product','pair_plus'].includes(input.composition)?input.composition:'sum',families:(input.families||allowed).filter(v=>allowed.includes(v)),bounds:input.bounds==='independent'?'independent':'shared',center:['auto','arithmetic','geometric','harmonic'].includes(input.center)?input.center:'auto',objective:['mape','max','mae','rmse','balanced'].includes(input.objective)?input.objective:'mape',validation:cap(+input.validation||0,0,40)};
}
export function evaluateMethod(methodId,train,all,opt={},rng=Math.random,iteration=1,session={}){
 const method=methodById(methodId);if(!method)return null;
 const cfg=methodConfig(opt),model=predictorModel(methodId,train,cfg,rng,iteration,session);
 if(!model||!model.latex||typeof model.predict!=='function')return null;
 const estimates=all.map(p=>model.predict(p[0])),metrics=statistics(all,estimates);
 const trainMetrics=statistics(train,train.map(p=>model.predict(p[0])));
 if(!Number.isFinite(objective(trainMetrics,cfg.objective)))return null;
 return {iteration,method:methodId,latex:model.latex,ztex:model.ztex||null,complexity:model.complexity||1,metrics,trainMetrics,score:objective(trainMetrics,cfg.objective),estimates,params:cfg,model:model.model||null};
}
