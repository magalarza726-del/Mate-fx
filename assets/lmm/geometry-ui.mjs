/**
 * LMM · Vistas Clásica, Triangular 0°/90° y Circular 0°/90°.
 * Una sola calculadora Desmos; las figuras son expresiones auxiliares,
 * nunca otra escena independiente ni parte de las funciones del proyecto.
 */
import {LMM_MODES,normalizeGeometrySettings,sampleValues,
 geometryPaths,boundsForGeometry,geometryStatistics,geometryFromSamples} from './geometry-core.mjs';
import {desmosSources,helperLatex,helperValues,pathLatex} from './desmos-source.mjs';

const $=id=>document.getElementById(id);
const DEFAULT={xMin:1,xMax:6,step:1,angle:90,selectedX:4};
const sanitize=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const number=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:5}):'—';
const calc=window.__nPrimosCalculator;
const frame=document.querySelector('.gmr-graph-frame');
if(!calc||!frame)throw Error('El módulo de vistas LMM requiere Desmos.');
let settings={...DEFAULT},mode='classic',rows=[],helpers=[],sourceKey='',fitPending=false,refreshTimer=0;
let projectId='',scheduled=0,panelOpen=false,renderSerial=0;
const STORE_KEY='lmm:geometry:projects:v1';
const getProject=()=>window.__gmrActiveProject?.().id||'sin-proyecto';
function readStore(){
 try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch(_){return {}}
}
function save(){
 const all=readStore();
 all[projectId]={mode,settings};
 try{localStorage.setItem(STORE_KEY,JSON.stringify(all))}
 catch(error){console.warn('No se pudo conservar la vista:',error)}
}
function modeForOldProject(stored){
 const old=stored?.mode,angle=Number(stored?.settings?.angle)===0?0:90;
 if(old==='triangles')return angle===0?'triangle0':'triangle90';
 if(old==='ellipses')return angle===0?'circle0':'circle90';
 return LMM_MODES.some(m=>m.id===old)?old:'classic';
}
function restore(){
 projectId=getProject();
 const stored=readStore()[projectId];
 mode=modeForOldProject(stored);
 settings=viewSettings(stored?.settings||DEFAULT);
 chooseMode(mode,{fit:false,persist:false});
}
function viewSettings(input){
 const {xMin,xMax,step,angle,selectedX}=normalizeGeometrySettings(input);
 return {xMin,xMax,step,angle,selectedX};
}
function expressionList(){
 return calc.getExpressions?.()||calc.getState()?.expressions?.list||[];
}
function removeGenerated(){
 // Limpia también las tablas y la función de versiones anteriores.
 const ids=new Set([...rows,'__lmm_source',...expressionList()
  .map(e=>String(e.id||'')).filter(id=>id.startsWith('__lmm_'))]);
 rows=[];
 for(const id of ids)try{calc.removeExpression({id})}catch(_){}
}
function releaseHelpers(){
 for(const {helper} of helpers){
  try{helper.unobserve('listValue');helper.unobserve('numericValue')}catch(_){}
 }
 helpers=[];sourceKey='';
}
function currentSettings(){
 const read=id=>$('lmm-'+id)?.value;
 return viewSettings({xMin:read('min'),xMax:read('max'),step:read('step'),
  selectedX:read('selected'),angle:modeInfo()?.angle??settings.angle});
}
const modeInfo=()=>LMM_MODES.find(m=>m.id===mode);
function refreshInputs(){
 const v={min:settings.xMin,max:settings.xMax,step:settings.step,selected:settings.selectedX};
 for(const [id,value] of Object.entries(v)){
  const el=$('lmm-'+id);if(el)el.value=value;
 }
 const title=$('lmm-mode-title');if(title)title.textContent='Vista · '+modeInfo().name;
 const hint=$('lmm-mode-description');if(hint)hint.textContent=modeInfo().description;
 $('lmm-view-options')?.querySelectorAll('[data-lmm-mode]').forEach(button=>{
  const active=button.dataset.lmmMode===mode;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 const controls=$('lmm-settings-body');if(controls)controls.hidden=mode==='classic';
}
function updateReadout(models){
 const el=$('lmm-metrics');if(!el)return;
 if(!models.length){el.textContent='Ingresa una función en el editor de Desmos.';return}
 el.innerHTML=models.map(({source,model})=>{
  const g=geometryStatistics(model),label=sanitize(source.latex);
  if(!g)return '<strong>'+label+'</strong><span>Sin valores reales evaluables en este intervalo.</span>';
  return '<strong>'+label+'</strong>'+
   '<span>'+model.geometries.length+' de '+model.totalLines+' muestras · Δx = '+number(settings.step)+'</span>'+
   '<span>x = '+number(g.x)+'; f(x) = '+number(g.fx)+'</span>'+
   '<span>Q = ('+number(g.q[0])+', '+number(g.q[1])+')</span>'+
   '<span>x · f(x) = '+number(g.product)+'</span>'+
   '<span>Área orientada: '+number(g.area)+'</span>'+
   (modeInfo().kind==='circles'?'<span>Radios circulares: '+number(g.radiusPlus)+' / '+number(g.radiusMinus)+'</span>':'')+
   '<span>Distancias al cuadrado: d+² = '+number(g.dPlus2)+', d−² = '+number(g.dMinus2)+'</span>';
 }).join('<hr>');
}
function render(){
 const info=modeInfo();
 if(info.kind==='classic')return;
 const models=helpers.map(({source,xs,helper})=>({source,
  model:geometryFromSamples(settings,xs,helperValues(helper,xs.length))}));
 const expressions=[];
 for(const {source,model} of models){
  for(const shape of geometryPaths(model,mode,72)){
   expressions.push({id:'__lmm_geometry_'+expressions.length,
    type:'expression',latex:pathLatex(shape.points),secret:true,
    color:source.color||'#2877cb',lines:true,points:false,lineWidth:2.5});
  }
 }
 // Las expresiones de listas de puntos admiten secret; las tablas no.
 // Se actualizan sin tocar las funciones, los datos ni el editor de Desmos.
 const previous=rows;rows=expressions.map(e=>e.id);
 for(const id of previous.slice(rows.length))try{calc.removeExpression({id})}catch(_){}
 try{if(expressions.length)calc.setExpressions(expressions)}
 catch(error){console.warn('No se pudo dibujar la geometría:',error)}
 const error=$('lmm-error');
 if(error){
  const invalid=models.filter(({model})=>model.invalidXs.length);
  error.textContent=!models.length?'No hay funciones visibles y=f(x) en Desmos.':
   invalid.length?'Algunas muestras no tienen un valor real evaluable en Desmos; no se dibujan.':'';
 }
 updateReadout(models);
 if(fitPending&&models.some(({model})=>model.geometries.length)){
  const bounds=models.filter(({model})=>model.geometries.length).map(({model})=>boundsForGeometry(model,mode));
  const points=models.flatMap(({model})=>model.geometries);
  try{calc.setMathBounds({
   left:Math.min(...bounds.map(b=>b.left),...points.map(p=>p.x)),
   right:Math.max(...bounds.map(b=>b.right),...points.map(p=>p.x)),
   bottom:Math.min(...bounds.map(b=>b.bottom),...points.map(p=>p.fx)),
   top:Math.max(...bounds.map(b=>b.top),...points.map(p=>p.fx))
  })}catch(_){}
  fitPending=false;
 }
}
function schedule(fit=false){
 fitPending=fitPending||fit;
 if(scheduled)cancelAnimationFrame(scheduled);
 const serial=++renderSerial;
 scheduled=requestAnimationFrame(()=>{scheduled=0;if(serial===renderSerial)render()});
}
function syncSources(fit=false,force=false){
 if(mode==='classic'){
  fitPending=false;releaseHelpers();removeGenerated();
  const el=$('lmm-error');if(el)el.textContent='';
  return;
 }
 const sources=desmosSources(expressionList());
 let xs;
 try{xs=sampleValues(settings)}
 catch(error){
  releaseHelpers();removeGenerated();
  $('lmm-error').textContent=error.message;return;
 }
 const key=JSON.stringify([sources,xs]);
 if(force||key!==sourceKey){
  releaseHelpers();removeGenerated();sourceKey=key;
  if(typeof calc.HelperExpression!=='function'){
   $('lmm-error').textContent='El motor de Desmos no permite evaluar las funciones.';return;
  }
  for(const source of sources){
   try{
    const helper=calc.HelperExpression({latex:helperLatex(source,xs)});
    helpers.push({source,xs,helper});
    // El mismo motor resuelve parámetros, funciones dependientes y restricciones.
    helper.observe('listValue',()=>schedule());
    helper.observe('numericValue',()=>schedule());
   }catch(error){console.warn('No se pudo evaluar '+source.latex,error)}
  }
 }
 schedule(fit);
}
function chooseMode(next,{fit=true,persist=true}={}){
 const target=LMM_MODES.find(m=>m.id===next);if(!target)return;
 mode=target.id;
 if(target.angle!==null)settings.angle=target.angle;
 document.body.dataset.lmmMode=mode;
 refreshInputs();
 syncSources(fit);
 if(persist)save();
 window.dispatchEvent(new CustomEvent('lmm:mode-change',{detail:{mode,angle:target.angle}}));
}
function updateSettings(){
 settings=currentSettings();
 refreshInputs();syncSources();save();
}
function showPanel(open=true){
 panelOpen=Boolean(open);
 const panel=$('lmm-view-panel');
 if(panel)panel.hidden=!panelOpen;
 $('lmm-view-toggle')?.setAttribute('aria-expanded',String(panelOpen));
 if(panelOpen)refreshInputs();
}
function fit(){
 if(mode==='classic'){
  const active=window.__gmrActiveProject?.();
  if(active?.hasPrimes)$('fitPrimesBtn')?.click();
  else try{calc.setMathBounds({left:-10,right:20,bottom:-10,top:100})}catch(_){}
 }else schedule(true);
}
function preventProjectPollution(state){
 if(state?.expressions?.list)
  state.expressions.list=state.expressions.list.filter(e=>!String(e.id||'').startsWith('__lmm_'));
 return state;
}
function setup(){
 const actions=document.createElement('nav');actions.id='lmm-quick-rail';
 actions.setAttribute('aria-label','Herramientas de LMM');
 actions.innerHTML='<button type="button" data-lmm-quick="research" title="Investigación">⚗<small>Investigación</small></button>'+
  '<button type="button" data-lmm-quick="analysis" title="Análisis">▤<small>Análisis</small></button>'+
  '<button type="button" data-lmm-quick="data" title="Importar/Exportar datos">⇄<small>Datos</small></button>'+
  '<button type="button" data-lmm-quick="view" id="lmm-view-toggle" title="Cambiar vista" aria-expanded="false">◫<small>Vista</small></button>';
 frame.appendChild(actions);
 const panel=document.createElement('section');panel.id='lmm-view-panel';panel.hidden=true;
 panel.innerHTML='<div class="lmm-panel-head"><strong id="lmm-mode-title">Vista</strong>'+
  '<button type="button" id="lmm-view-close" aria-label="Cerrar Vista">×</button></div>'+
  '<div class="lmm-view-options" id="lmm-view-options" aria-label="Seleccionar vista">'+
  LMM_MODES.map(m=>'<button type="button" data-lmm-mode="'+m.id+
   '" aria-pressed="false">'+sanitize(m.name)+'</button>').join('')+'</div>'+
  '<p id="lmm-mode-description"></p>'+
  '<div id="lmm-settings-body"><div class="lmm-panel-divider">Configuración de líneas</div>'+
  '<p class="lmm-note">Fuente única: todas las funciones visibles del editor de Desmos. Modifica allí las funciones y sus parámetros.</p>'+
  '<div class="lmm-grid"><label>x mínimo <input id="lmm-min" type="number" min="-10000" max="10000" step="any" value="1"></label>'+
  '<label>x máximo <input id="lmm-max" type="number" min="-10000" max="10000" step="any" value="6"></label>'+
  '<label>Incremento Δx <input id="lmm-step" type="number" min="0.001" max="10000" step="any" value="1"></label>'+
  '<label>x a inspeccionar <input id="lmm-selected" type="number" step="any" value="4"></label></div>'+
  '<p class="lmm-note">Las figuras se generan en x mínimo, x mínimo + Δx, x mínimo + 2Δx, etc. Máximo 150 muestras por función para mantener fluidez. Solo se usan ángulos de 0° y 90°.</p>'+
  '<p id="lmm-error" role="status"></p><div class="lmm-metrics" id="lmm-metrics"></div></div>';
 frame.appendChild(panel);
 actions.addEventListener('click',event=>{
  const button=event.target.closest('[data-lmm-quick]');if(!button)return;
  const v=button.dataset.lmmQuick,tools=window.__lmmTools;
  if(v==='view'){showPanel(!panelOpen);return}
  if(v==='research')tools?.openResearch?.();
  if(v==='analysis')tools?.openAnalysis?.();
  if(v==='data')tools?.openData?.();
 });
 $('lmm-view-close').onclick=()=>showPanel(false);
 $('lmm-view-options').addEventListener('click',event=>{
  const button=event.target.closest('[data-lmm-mode]');
  if(button)chooseMode(button.dataset.lmmMode);
 });
 for(const key of ['min','max','step','selected'])
  $('lmm-'+key).addEventListener('change',updateSettings);
 window.addEventListener('gmr:project-switched',()=>{
  clearTimeout(refreshTimer);releaseHelpers();removeGenerated();restore();
 });
 calc.observeEvent?.('change.lmmGeometry',()=>{
  if(mode==='classic')return;
  // Incluye cambios programáticos del generador; la firma excluye las figuras auxiliares.
  clearTimeout(refreshTimer);
  refreshTimer=setTimeout(()=>{
   if(mode==='classic')return;
   const sources=desmosSources(expressionList());
   let xs;try{xs=sampleValues(settings)}catch(_){return}
   if(JSON.stringify([sources,xs])!==sourceKey)syncSources();
  },60);
 });
 restore();
 window.__lmmGeometry={
  setMode:chooseMode,getMode:()=>mode,getSettings:()=>({...settings}),
  fit,refresh:()=>syncSources(false,true),showPanel:()=>showPanel(true),
  clear:removeGenerated,preventProjectPollution
 };
 window.dispatchEvent(new Event('lmm:ready'));
}
setup();
