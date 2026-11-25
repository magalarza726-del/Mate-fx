/**
 * LMM · Vistas Clásica, Triangular 0°/90° y Circular 0°/90°.
 * Una sola calculadora Desmos; las figuras son expresiones auxiliares,
 * nunca otra escena independiente ni parte de las funciones del proyecto.
 */
import {LMM_MODES,normalizeGeometrySettings,sampleValues,geometryForExpression,
 geometryPaths,boundsForGeometry,geometryStatistics} from './geometry-core.mjs';
import {compileExpression} from '../matefx/src/math.js';

const $=id=>document.getElementById(id);
const DEFAULT={expression:'x^2',xMin:1,xMax:6,step:1,angle:90,n:3,selectedX:4};
const sanitize=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const number=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:5}):'—';
const calc=window.__nPrimosCalculator;
const frame=document.querySelector('.gmr-graph-frame');
if(!calc||!frame)throw Error('El módulo de vistas LMM requiere Desmos.');
let settings={...DEFAULT},mode='classic',rows=[],isExisting=false;
let projectId='',scheduled=0,panelOpen=false,renderSerial=0;
const STORE_KEY='lmm:geometry:projects:v1';
const getProject=()=>window.__gmrActiveProject?.().id||'sin-proyecto';
function readStore(){
 try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')||{}}catch(_){return {}}
}
function save(){
 const all=readStore();
 all[projectId]={mode,settings,isExisting};
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
 settings=normalizeGeometrySettings(stored?.settings||DEFAULT);
 isExisting=Boolean(stored?.isExisting);
 chooseMode(mode,{fit:false,persist:false});
}
function removeGenerated(){
 for(const id of rows){try{calc.removeExpression({id})}catch(_){}}
 rows=[];
}
function prepareTable(index,points,color){
 // Un subíndice exclusivamente numérico evita colisiones al usar pasos decimales.
 const sub=910000+index;
 return {id:'__lmm_geometry_'+index,type:'table',secret:true,
  columns:[
   {latex:'u_{'+sub+'}',values:points.map(p=>String(Number(p[0].toPrecision(12))))},
   {latex:'v_{'+sub+'}',values:points.map(p=>String(Number(p[1].toPrecision(12)))),
    color,lines:true,points:false,lineWidth:'3'}
  ]};
}
function sourceToAscii(latex){
 let s=String(latex||'').replace(/^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=/,'').trim();
 for(let i=0;i<8;i++){
  const before=s;s=s.replace(/\\(?:dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/g,'($1)/($2)');
  if(before===s)break
 }
 return s.replace(/\\(?:left|right)/g,'')
  .replace(/\\(?:cdot|times)/g,'*')
  .replace(/\\(?:sin|cos|tan|ln|log|exp|sqrt|pi)\b/g,m=>m.slice(1))
  .replace(/\{([^{}]*)\}/g,'($1)').replace(/\s+/g,'').replace(/−/g,'-');
}
function availableExpressions(){
 const list=typeof calc.getExpressions==='function'?calc.getExpressions():
  calc.getState()?.expressions?.list||[];
 return list.filter(e=>!String(e.id||'').startsWith('__')&&
  /^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=/.test(String(e.latex||''))&&
  e.type!=='table'&&!e.hidden)
  .map(e=>({id:e.id,latex:e.latex,ascii:sourceToAscii(e.latex)}));
}
function syncSelection(){
 const select=$('lmm-source-list');if(!select)return;
 const prior=select.value;
 const available=availableExpressions();
 select.innerHTML='<option value="">Expresión propia</option>'+
  available.map(e=>'<option value="'+sanitize(e.id)+'">'+sanitize(e.latex.slice(0,85))+'</option>').join('');
 if(available.some(x=>x.id===prior))select.value=prior;
}
function currentSettings(){
 const read=id=>$('lmm-'+id)?.value;
 return normalizeGeometrySettings({
  expression:read('formula')||settings.expression,
  xMin:read('min'),xMax:read('max'),step:read('step'),
  n:read('param'),selectedX:read('selected'),
  angle:modeInfo()?.angle??settings.angle
 });
}
const modeInfo=()=>LMM_MODES.find(m=>m.id===mode);
function refreshInputs(){
 const v={formula:settings.expression,min:settings.xMin,max:settings.xMax,
  step:settings.step,param:settings.n,selected:settings.selectedX};
 for(const [id,value] of Object.entries(v)){
  const el=$('lmm-'+id);if(el)el.value=value;
 }
 const title=$('lmm-mode-title');if(title)title.textContent='Vista · '+modeInfo().name;
 const hint=$('lmm-mode-description');if(hint)hint.textContent=modeInfo().description;
 const options=$('lmm-view-options');
 options?.querySelectorAll('[data-lmm-mode]').forEach(button=>{
  const active=button.dataset.lmmMode===mode;
  button.classList.toggle('active',active);
  button.setAttribute('aria-pressed',String(active));
 });
 const controls=$('lmm-settings-body');if(controls)controls.hidden=mode==='classic';
 syncSelection();
}
function clearSource(){
 try{calc.removeExpression({id:'__lmm_source'})}catch(_){}
}
function updateSource(){
 if(isExisting){clearSource();return}
 try{calc.setExpression({id:'__lmm_source',
  latex:'h_{LMM}(x)='+settings.expression,color:'#537fae',secret:true,lineWidth:2})}
 catch(error){console.warn('No se pudo renderizar la expresión auxiliar:',error)}
}
function updateReadout(model){
 const el=$('lmm-metrics');if(!el)return;
 const g=geometryStatistics(model);
 if(!g){el.textContent='Ninguna línea evaluable en el intervalo seleccionado.';return}
 el.innerHTML='<strong>'+model.totalLines+' líneas con Δx = '+number(settings.step)+'</strong>'+
  '<span>Seleccionado x = '+number(g.x)+'; f(x) = '+number(g.fx)+'</span>'+
  '<span>Q = ('+number(g.q[0])+', '+number(g.q[1])+')</span>'+
  '<span>x · f(x) = '+number(g.product)+'</span>'+
  '<span>Área orientada: '+number(g.area)+'</span>'+
  (modeInfo().kind==='circles'?'<span>Radios circulares: '+number(g.radiusPlus)+' / '+number(g.radiusMinus)+'</span>':'')+
  '<span>Distancias al cuadrado: d+² = '+number(g.dPlus2)+', d−² = '+number(g.dMinus2)+'</span>';
}
function render(fit=false){
 const info=modeInfo();
 if(info.kind==='classic'){
  removeGenerated();clearSource();
  const el=$('lmm-error');if(el)el.textContent='';
  return;
 }
 let model;
 try{model=geometryForExpression(settings)}
 catch(error){
  const field=$('lmm-error');if(field)field.textContent=error.message;
  removeGenerated();clearSource();return;
 }
 const error=$('lmm-error');
 if(error)error.textContent=model.invalidXs.length?
  'No se pudo evaluar x = '+model.invalidXs.slice(0,8).map(number).join(', ')+
  (model.invalidXs.length>8?' ...':''):'';
 const shapes=geometryPaths(model,mode,72);
 removeGenerated();updateSource();
 const expressions=shapes.map((shape,i)=>prepareTable(i,shape.points,
  info.kind==='triangles'?'#2877cb':i%2?'#e18b38':'#239c85'));
 if(expressions.length){
  try{calc.setExpressions(expressions);rows=expressions.map(e=>e.id)}
  catch(error){console.error('No se pudo dibujar en Desmos:',error);
   if($('lmm-error'))$('lmm-error').textContent='Desmos rechazó algunas líneas: '+error.message}
 }
 updateReadout(model);
 if(fit)try{calc.setMathBounds(boundsForGeometry(model,mode))}catch(_){}
}
function schedule(fit=false){
 if(scheduled)cancelAnimationFrame(scheduled);
 const serial=++renderSerial;
 scheduled=requestAnimationFrame(()=>{scheduled=0;if(serial===renderSerial)render(fit)});
}
function chooseMode(next,{fit=true,persist=true}={}){
 const target=LMM_MODES.find(m=>m.id===next);if(!target)return;
 mode=target.id;
 if(target.angle!==null)settings.angle=target.angle;
 document.body.dataset.lmmMode=mode;
 refreshInputs();
 schedule(fit);
 if(persist)save();
 window.dispatchEvent(new CustomEvent('lmm:mode-change',{detail:{mode,angle:target.angle}}));
}
function updateSettings(){
 if(isExisting){
  const selected=availableExpressions().find(e=>e.id===$('lmm-source-list')?.value);
  if(selected)settings.expression=selected.ascii;
 }
 settings=currentSettings();
 refreshInputs();schedule();save();
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
  '<label>Función existente en Desmos <select id="lmm-source-list"><option value="">Expresión propia</option></select></label>'+
  '<label>Expresión de f(x) <input id="lmm-formula" type="text" spellcheck="false" value="x^2"></label>'+
  '<div class="lmm-grid"><label>x mínimo <input id="lmm-min" type="number" min="-10000" max="10000" step="any" value="1"></label>'+
  '<label>x máximo <input id="lmm-max" type="number" min="-10000" max="10000" step="any" value="6"></label>'+
  '<label>Incremento Δx <input id="lmm-step" type="number" min="0.001" max="10000" step="any" value="1"></label>'+
  '<label>Parámetro n <input id="lmm-param" type="number" step="any" value="3"></label>'+
  '<label>x a inspeccionar <input id="lmm-selected" type="number" step="any" value="4"></label></div>'+
  '<p class="lmm-note">Las figuras se generan en x mínimo, x mínimo + Δx, x mínimo + 2Δx, etc. Máximo 150 líneas por vista para mantener fluidez. Solo se usan ángulos de 0° y 90°.</p>'+
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
 $('lmm-source-list').addEventListener('focus',syncSelection);
 $('lmm-source-list').onchange=()=>{
  const selected=availableExpressions().find(e=>e.id===$('lmm-source-list').value);
  isExisting=Boolean(selected);
  if(selected){settings.expression=selected.ascii;$('lmm-formula').value=selected.ascii}
  updateSettings();
 };
 for(const key of ['formula','min','max','step','param','selected'])
  $('lmm-'+key).addEventListener('change',()=>{
   if(key==='formula')isExisting=false;
   updateSettings();
  });
 window.addEventListener('gmr:project-switched',()=>{
  removeGenerated();clearSource();restore();
 });
 calc.observeEvent?.('change.lmmGeometry',(_name,event)=>{
  if(!event?.isUserInitiated||mode==='classic'||!isExisting)return;
  const selection=availableExpressions().find(e=>e.id===$('lmm-source-list')?.value);
  if(selection&&selection.ascii!==settings.expression){
   try{compileExpression(selection.ascii);settings.expression=selection.ascii;
    $('lmm-formula').value=selection.ascii;schedule()}catch(_){}
  }
 });
 restore();
 window.__lmmGeometry={
  setMode:chooseMode,getMode:()=>mode,getSettings:()=>({...settings}),
  fit,refresh:()=>schedule(),showPanel:()=>showPanel(true),
  clear:removeGenerated,preventProjectPollution
 };
 window.dispatchEvent(new Event('lmm:ready'));
}
setup();
