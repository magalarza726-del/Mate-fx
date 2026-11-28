/**
 * Laboratorio Matemático de Miguel: cinco vistas sobre una sola calculadora.
 * Las construcciones triangulares reutilizan la geometría original de Mate-fx;
 * las circulares emplean semicírculos verdaderos construidos sobre una cuerda.
 */
import {evalGeometry,straightTrianglePoints} from '../matefx/src/geometry.js';
import {compileExpression} from '../matefx/src/math.js';

export const MAX_GEOMETRY_LINES=150;
export const LMM_MODES=Object.freeze([
 {id:'classic',name:'Clásica',kind:'classic',angle:null,
  description:'Funciones, datos y expresiones en el plano original de Desmos.'},
 {id:'triangle0',name:'Triangular a 0°',kind:'triangles',angle:0,
  description:'Triángulos mediante los tres puntos de la construcción original a 0°.'},
 {id:'triangle90',name:'Triangular a 90°',kind:'triangles',angle:90,
  description:'Triángulos mediante los tres puntos de la construcción original a 90°.'},
 {id:'circle0',name:'Circular a 0°',kind:'circles',angle:0,
  description:'Semicírculos verdaderos con las cuerdas definidas por los ejes a 0°.'},
 {id:'circle90',name:'Circular a 90°',kind:'circles',angle:90,
  description:'Arcos circulares verdaderos entre ±x y Q=(0,f(x)); no elipses.'}
]);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const finitePoint=p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y);
const modeInfo=id=>LMM_MODES.find(m=>m.id===id);
const fmtNumber=n=>Number(n.toPrecision(12));
export function normalizeGeometrySettings(settings={}){
 const num=(key,fallback)=>settings[key]!==null&&settings[key]!==undefined&&
  settings[key]!==''&&Number.isFinite(Number(settings[key]))?Number(settings[key]):fallback;
 const x1=clamp(num('xMin',1),-10000,10000),x2=clamp(num('xMax',6),-10000,10000);
 const xMin=Math.min(x1,x2),xMax=Math.max(x1,x2);
 const step=clamp(Math.abs(num('step',1))||1,0.001,10000);
 const angle=num('angle',90)===0?0:90;
 return {expression:String(settings.expression||'x^2').trim().slice(0,250),
  xMin,xMax,step,angle,
  n:clamp(num('n',3),-9999,9999),
  selectedX:clamp(num('selectedX',4),xMin,xMax)};
}
export function sampleValues(settings={}){
 const cfg=normalizeGeometrySettings(settings);
 const count=Math.floor((cfg.xMax-cfg.xMin)/cfg.step+1e-9)+1;
 if(count>MAX_GEOMETRY_LINES)
  throw new RangeError('La configuración genera '+count+' líneas. El límite es '+
   MAX_GEOMETRY_LINES+'; aumenta el incremento Δx o reduce el intervalo.');
 const values=[];
 for(let i=0;i<count;i++){
  const x=fmtNumber(cfg.xMin+i*cfg.step);
  if(x<=cfg.xMax+cfg.step*1e-9)values.push(x);
 }
 return values;
}
/** Construcción a partir de valores ya evaluados por el motor de origen. */
export function geometryFromSamples(settings,xs,ys){
 const cfg=normalizeGeometrySettings(settings),geometries=[],invalidXs=[];
 for(let i=0;i<xs.length;i++){
  const x=xs[i],fx=ys[i];
  if(!Number.isFinite(fx)||Math.abs(fx)>1e10){invalidXs.push(x);continue}
  geometries.push(evalGeometry(x,fx,cfg.angle));
 }
 const selected=geometries.reduce((best,g)=>
  !best||Math.abs(g.x-cfg.selectedX)<Math.abs(best.x-cfg.selectedX)?g:best,null);
 return {settings:cfg,geometries,invalidXs,selected,totalLines:xs.length};
}
export function geometryForExpression(settings={}){
 const cfg=normalizeGeometrySettings(settings),xs=sampleValues(cfg);
 const evaluate=compileExpression(cfg.expression);
 return geometryFromSamples(cfg,xs,xs.map(x=>{
  try{return evaluate(x,cfg.n)}catch(_){return NaN}
 }));
}
/** Semicírculo exacto desde a hasta b, parametrizado por el ángulo central. */
export function circularArc(a,b,side=1,samples=72){
 const n=clamp(Math.floor(samples)||72,12,144);
 const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
 if(length<1e-12)return Array.from({length:n+1},()=>({...a}));
 const ux=dx/length,uy=dy/length,nx=-uy,ny=ux,cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,r=length/2;
 return Array.from({length:n+1},(_,i)=>{
  const t=Math.PI*i/n;
  return {x:cx-ux*r*Math.cos(t)+nx*r*Math.sin(t)*side,
   y:cy-uy*r*Math.cos(t)+ny*r*Math.sin(t)*side};
 });
}
export function geometryPaths(model,mode='triangle90',samples=72){
 const info=modeInfo(mode);
 if(!info||info.kind==='classic')return [];
 const out=[];
 for(let i=0;i<model.geometries.length;i++){
  const source=model.geometries[i];
  const g=source.angleDeg===info.angle?source:evalGeometry(source.x,source.fx,info.angle);
  const shapes=info.kind==='triangles'?[straightTrianglePoints(g)]:
   info.angle===0?[
    circularArc({x:g.x,y:0},{x:g.fx,y:0},1,samples),
    circularArc({x:-g.x,y:0},{x:-g.fx,y:0},-1,samples)
   ]:[
    circularArc({x:g.x,y:0},{x:0,y:g.fx},1,samples),
    circularArc({x:-g.x,y:0},{x:0,y:g.fx},-1,samples)
   ];
  shapes.forEach((points,branch)=>{
   const valid=points.filter(finitePoint);
   if(valid.length>1)out.push({id:'__lmm_geometry_'+i+'_'+branch,
    index:i,x:g.x,branch,mode,points:valid.map(p=>[p.x,p.y])});
  });
 }
 return out;
}
export function boundsForGeometry(model,mode){
 const data=geometryPaths(model,mode,48).flatMap(p=>p.points);
 if(!data.length)return {left:-8,right:8,bottom:-8,top:8};
 const xs=data.map(p=>p[0]),ys=data.map(p=>p[1]);
 const minX=Math.min(0,...xs),maxX=Math.max(0,...xs),
  minY=Math.min(0,...ys),maxY=Math.max(0,...ys);
 const dx=Math.max(2,maxX-minX),dy=Math.max(2,maxY-minY);
 return {left:minX-dx*.16,right:maxX+dx*.16,
  bottom:minY-dy*.17,top:maxY+dy*.17};
}
export function geometryStatistics(model){
 const g=model.selected;if(!g)return null;
 return {x:g.x,fx:g.fx,angle:g.angleDeg,product:g.product,
  area:g.area,cosComponent:g.cosComponent,sinComponent:g.sinComponent,
  dPlus2:g.dPlus2,dMinus2:g.dMinus2,diff2:g.diff2,
  ellipseQuarterOriented:g.ellipseQuarterOriented,
  radiusPlus:Math.sqrt(Math.max(0,g.dPlus2))/2,
  radiusMinus:Math.sqrt(Math.max(0,g.dMinus2))/2,
  q:[g.q.x,g.q.y]};
}
