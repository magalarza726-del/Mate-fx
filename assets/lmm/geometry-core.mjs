/**
 * LMM · Modos geométricos en un mismo sistema cartesiano.
 * Reutiliza exactamente la construcción geométrica de Mate-fx.
 * Aquí solo se preparan puntos; el dibujo final lo realiza Desmos.
 */
import {evalGeometry,straightTrianglePoints,curvedPoints,geometryBounds} from '../matefx/src/geometry.js';
import {compileExpression} from '../matefx/src/math.js';

export const LMM_MODES=Object.freeze([
 {id:'classic',name:'Clásico',description:'Funciones, datos y expresiones habituales de Desmos.'},
 {id:'triangles',name:'Triángulos',description:'Unión rectilínea de puntos bajo la construcción original de Mate-fx.'},
 {id:'ellipses',name:'Elipses',description:'Cuartos de elipse en 90° y 270° y semicírculos en los ejes coincidentes.'}
]);

const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
export function normalizeGeometrySettings(settings={}){
 const num=(k,f)=>Number.isFinite(Number(settings[k]))?Number(settings[k]):f;
 const lower=clamp(Math.trunc(num('xMin',1)),1,50);
 const upper=clamp(Math.trunc(num('xMax',6)),1,50);
 return {
  expression:String(settings.expression||'x^2').trim().slice(0,250),
  xMin:Math.min(lower,upper),xMax:Math.max(lower,upper),
  angle:((num('angle',90)%360)+360)%360,
  n:clamp(num('n',3),-9999,9999),
  selectedX:clamp(Math.trunc(num('selectedX',4)),Math.min(lower,upper),Math.max(lower,upper))
 };
}
export function geometryForExpression(settings){
 const cfg=normalizeGeometrySettings(settings);
 const evaluate=compileExpression(cfg.expression);
 const geometries=[],invalidXs=[];
 for(let x=cfg.xMin;x<=cfg.xMax;x++){
  let fx=NaN;
  try{fx=evaluate(x,cfg.n)}catch(_){}
  if(!Number.isFinite(fx)||Math.abs(fx)>1e10){invalidXs.push(x);continue}
  geometries.push(evalGeometry(x,fx,cfg.angle));
 }
 return {settings:cfg,geometries,invalidXs,
  selected:geometries.find(g=>g.x===cfg.selectedX)||geometries[0]||null};
}
export function geometryPaths(model,mode='triangles',samples=70){
 if(mode!=='triangles'&&mode!=='ellipses')return [];
 const result=[],n=clamp(Math.trunc(samples),12,144);
 for(const g of model.geometries){
  const branches=mode==='triangles'?[straightTrianglePoints(g)]:[
   curvedPoints(g,1,n),curvedPoints(g,-1,n)
  ];
  branches.forEach((points,index)=>{
   const clean=points.filter(finitePoint);
   if(clean.length>=2)result.push({id:'__lmm_geometry_'+g.x+'_'+index,
    x:g.x,branch:index,mode,points:clean.map(p=>[p.x,p.y])});
  });
 }
 return result;
}
export function boundsForGeometry(model,mode){
 if(!model.geometries.length)return {left:-8,right:8,bottom:-8,top:8};
 const b=geometryBounds(model.geometries,mode==='ellipses'?'curves':'lines');
 const dx=Math.max(2,b.maxX-b.minX),dy=Math.max(2,b.maxY-b.minY);
 return {left:b.minX-dx*.16,right:b.maxX+dx*.16,
  bottom:b.minY-dy*.17,top:b.maxY+dy*.17};
}
export function geometryStatistics(model){
 const g=model.selected;
 if(!g)return null;
 return {x:g.x,fx:g.fx,angle:g.angleDeg,product:g.product,
  area:g.area,cosComponent:g.cosComponent,sinComponent:g.sinComponent,
  dPlus2:g.dPlus2,dMinus2:g.dMinus2,diff2:g.diff2,
  ellipseQuarterOriented:g.ellipseQuarterOriented,
  q:[g.q.x,g.q.y]};
}
