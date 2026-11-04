/* Capturas REALES del motor Desmos v1.12 para Investigación (sin dibujar SVG/canvas propios). */
let calculator=null,container=null,tail=Promise.resolve();
let ticket=0;const latest=new Map();
const finite=p=>Array.isArray(p)&&p.length>=2&&Number.isFinite(+p[0])&&Number.isFinite(+p[1]);
const number=v=>String(Number(Number(v).toPrecision(13)));
export function plotSpecifications(source,best,kind='fit',entries=[]){
 const points=(source?.points||[]).filter(finite).map(p=>[+p[0],+p[1]]);
 if(kind==='fit'){
  const curve=(best?.curvePoints?.length?best.curvePoints:points.map((p,i)=>[p[0],best?.estimates?.[i]])).filter(finite).map(p=>[+p[0],+p[1]]);
  return {title:'Datos observados y ecuación ganadora',useX:true,curveRepresentation:'sampled-function',xName:source?.xName||'X',yName:source?.yName||'Y',series:[{points,color:'#2578c5',mode:'points'},{points:curve,color:'#e0782f',mode:'lines'}]};
 }
 if(kind==='residual'){
  const residual=points.map((p,i)=>[p[0],Number.isFinite(best?.estimates?.[i])?best.estimates[i]-p[1]:NaN]).filter(finite);
  return {title:'Residuos según x (estimado menos observado)',useX:true,xName:source?.xName||'X',yName:'Error',series:[{points:residual,color:'#c45061',mode:'points'}],zeroLine:true};
 }
 if(kind==='absolute'){
  const errors=points.map((p,i)=>[p[0],Number.isFinite(best?.estimates?.[i])?Math.abs(best.estimates[i]-p[1]):NaN]).filter(finite);
  return {title:'Error absoluto por x',useX:true,xName:source?.xName||'X',yName:'Error absoluto',series:[{points:errors,color:'#bd4b76',mode:'points'}]};
 }
 if(kind==='percentage'){
  const errors=points.map((p,i)=>[p[0],p[1]!==0&&Number.isFinite(best?.estimates?.[i])?100*Math.abs(best.estimates[i]-p[1])/Math.abs(p[1]):NaN]).filter(finite);
  return {title:'Error porcentual absoluto por x',useX:true,xName:source?.xName||'X',yName:'Error (%)',series:[{points:errors,color:'#a63f83',mode:'points'}]};
 }
 if(kind==='complexity'){
  const valid=entries.filter(e=>Number.isFinite(e.best?.metrics?.mape)&&e.best.metrics.mape>=0&&Number.isFinite(e.best.complexity));
  return {title:'Complejidad frente a log10(1+MAPE)',nonnegativeY:true,xName:'Complejidad',yName:'log10(1+MAPE %)',series:[
    {points:valid.map(e=>[e.best.complexity,Math.log10(1+e.best.metrics.mape)]),color:'#18669d',mode:'points'}]};
 }
 if(kind==='comparison'){
  const values=entries.map((e,i)=>({index:i+1,mape:e.best?.metrics?.mape,maxape:e.best?.metrics?.maxape}));
  const log=key=>values.filter(v=>Number.isFinite(v[key])&&v[key]>=0).map(v=>[v.index,Math.log10(1+v[key])]);
  return {title:'Comparación logarítmica de errores por configuración',nonnegativeY:true,entryOrder:entries.map(e=>e.id),xName:'Posición en la tabla (orden MAPE)',yName:'log10(1+Error %)',series:[
    {points:log('mape'),color:'#2578c5',mode:'lines+points'},
    {points:log('maxape'),color:'#df762f',mode:'lines+points'}]};
 }
 if(kind==='histogram'){
  const finiteErrors=points.map((p,i)=>p[1]!==0&&Number.isFinite(best?.estimates?.[i])?
   100*(best.estimates[i]-p[1])/Math.abs(p[1]):NaN).filter(Number.isFinite);
  if(!finiteErrors.length)return {title:'Distribución de errores relativos',series:[]};
  const sorted=[...finiteErrors].sort((a,b)=>a-b),low=sorted[Math.floor((sorted.length-1)*.025)],high=sorted[Math.ceil((sorted.length-1)*.975)];
  const range=Math.max(1e-9,high-low),bins=14,hist=Array(bins).fill(0);
  for(const v of finiteErrors){if(v<low||v>high)continue;hist[Math.min(bins-1,Math.floor((v-low)/range*bins))]++}
  return {title:'Distribución central de los errores relativos',nonnegativeY:true,xName:'Error relativo firmado (%)',yName:'Frecuencia',series:[
   {points:hist.map((count,i)=>[low+(i+.5)*range/bins,count]),color:'#377bb1',mode:'lines+points'}],
   trimInfo:{omitted:finiteErrors.filter(v=>v<low||v>high).length,total:finiteErrors.length}};
 }
 return {title:'Sin datos',series:[]};
}
function ensureCalculator(){
 if(!window.Desmos?.GraphingCalculator||window.Desmos.__gmrOfflineShim)throw Error('La API real de Desmos no está disponible; no se generará una gráfica recreada.');
 if(calculator)return calculator;
 container=document.createElement('div');container.setAttribute('aria-hidden','true');
 Object.assign(container.style,{position:'fixed',left:'-20000px',top:'0',width:'920px',height:'520px',visibility:'visible',pointerEvents:'none',zIndex:'-1',overflow:'hidden'});
 document.body.appendChild(container);
 calculator=window.Desmos.GraphingCalculator(container,{expressions:false,settingsMenu:false,zoomButtons:false,showResetButtonOnGraphpaper:false,lockViewport:true,expressionsCollapsed:true,keypad:false,projectorMode:false,border:false});
 return calculator;
}
function effectiveBounds(spec){
 const data=spec.series.flatMap(s=>s.points).filter(finite);if(!data.length)return {left:-1,right:1,bottom:-1,top:1};
 const xs=data.map(p=>p[0]),ys=data.map(p=>p[1]),a=Math.min(...xs),b=Math.max(...xs),c=Math.min(...ys),d=Math.max(...ys);
 const hx=Math.max(1e-7,(b-a)*.08),hy=Math.max(1e-7,(d-c)*.13);
 return {left:a-hx,right:b+hx,bottom:spec.nonnegativeY?0:c-hy,top:Math.max(spec.nonnegativeY?0:-(1e9),d+hy)};
}
function columns(points,id,color,mode){
 const safe=points.filter(finite).slice(0,3500);
 return {id:'inv_'+id,type:'table',columns:[
  {latex:'x_{'+id+'}',values:safe.map(p=>number(p[0]))},
  {latex:'y_{'+id+'}',values:safe.map(p=>number(p[1])),color,lines:mode.includes('lines'),points:mode.includes('points'),pointSize:'5',lineWidth:'3'}
 ]};
}
function capture(spec,opts={}){
 const calc=ensureCalculator();
 const series=(spec.series||[]).filter(s=>s.points?.some(finite));
 if(!series.length)throw Error('No hay puntos finitos disponibles para representar con Desmos.');
 calc.setBlank();
 calc.updateSettings?.({xAxisLabel:spec.useX?'x  ('+(spec.xName||'variable')+')':(spec.xName||''),yAxisLabel:spec.yName||''});
 const expressions=series.map((s,i)=>columns(s.points,100+i,s.color||'#206bb4',s.mode||'points'));
 if(spec.zeroLine)expressions.push({id:'inv_axis_0',latex:'y=0',color:'#6e8996',lineStyle:window.Desmos.Styles.DASHED});
 calc.setExpressions(expressions);
 const bounds=effectiveBounds(spec);
 return new Promise((resolve,reject)=>{
  try{
   calc.asyncScreenshot({width:opts.width||900,height:opts.height||490,targetPixelRatio:opts.ratio||1.35,
    mathBounds:bounds,mode:'stretch',format:'png',preserveAxisNumbers:true},uri=>{
      if(typeof uri==='string'&&uri.startsWith('data:image/png'))resolve(uri);
      else reject(Error('Desmos no pudo producir una captura PNG de los datos.'));
    });
  }catch(e){reject(e)}
 });
}
/** Serial queue to avoid simultaneous mutation of the dedicated Desmos screenshot calculator. */
export function screenshotFromDesmos(spec,opts={}){
 const key=opts.previewKey,token=++ticket;
 if(key)latest.set(key,token);
 const next=tail.catch(()=>{}).then(()=>{
  if(key&&latest.get(key)!==token)throw Error('Captura anterior sustituida por una nueva');
  return capture(spec,opts);
 });
 tail=next.then(()=>{},()=>{});return next;
}
export async function updateDesmosImage(element,spec,opts={}){
 if(!element)return;
 const image=await screenshotFromDesmos(spec,opts);
 if(!element.isConnected)return;
 element.replaceChildren();
 const img=document.createElement('img');
 img.alt='Gráfica calculada y capturada directamente desde Desmos: '+(spec.title||'');
 img.src=image;img.width=opts.width||900;img.height=opts.height||490;
 img.style.cssText='display:block;width:100%;height:auto;border-radius:8px;background:white';
 element.appendChild(img);
 return image;
}
export function disposeDesmosCapture(){
 if(calculator){calculator.destroy();calculator=null}
 if(container){container.remove();container=null}
}
