/**
 * LMM: tres modos de representación en un ÚNICO calculador Desmos.
 * No crea una segunda calculadora y no reemplaza las expresiones del usuario.
 */
import {LMM_MODES,normalizeGeometrySettings,geometryForExpression,
 geometryPaths,boundsForGeometry,geometryStatistics} from './geometry-core.mjs';
import {compileExpression} from '../matefx/src/math.js';

const $=id=>document.getElementById(id);
const DEFAULT={expression:'x^2',xMin:1,xMax:6,angle:90,n:3,selectedX:4};
const sanitize=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const number=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:4}):'—';
const calc=window.__nPrimosCalculator;
const frame=document.querySelector('.gmr-graph-frame');
if(!calc||!frame)throw Error('LMM requiere la calculadora de Desmos activa.');
let settings={...DEFAULT},mode='classic',rows=[],isExisting=false;
let projectId='',scheduled=0,animation=0,previousFrame=0,lastRender=0,renderVersion=0;
let modalOpen=false;
const STORE_KEY='lmm:geometry:projects:v1';
const q=name=>document.querySelector(name);
function getProject(){return window.__gmrActiveProject?.().id||'sin-proyecto'}
function readStore(){
 try{return JSON.parse(localStorage.getItem(STORE_KEY)||'{}')}catch(_){return {}}
}
function save(){
 const all=readStore();
 all[projectId]={mode,settings,isExisting};
 try{localStorage.setItem(STORE_KEY,JSON.stringify(all))}catch(error){console.warn('No se pudo guardar configuración geométrica:',error)}
}
function restore(){
 projectId=getProject();
 const stored=readStore()[projectId];
 mode=LMM_MODES.some(m=>m.id===stored?.mode)?stored.mode:'classic';
 settings=normalizeGeometrySettings(stored?.settings||DEFAULT);
 isExisting=!!stored?.isExisting;
 refreshInputs();
 chooseMode(mode,{fit:false,persist:false});
}
function removeGenerated(){
 rows.forEach(id=>{try{calc.removeExpression({id})}catch(_){}});
 rows=[];
}
function ensureUnique(id,samples,color){
 const x='u_{'+id+'}',y='v_{'+id+'}';
 return {id:'__lmm_geometry_'+id,type:'table',secret:true,
  columns:[
   {latex:x,values:samples.map(p=>String(Number(p[0].toPrecision(12))))},
   {latex:y,values:samples.map(p=>String(Number(p[1].toPrecision(12)))),
    color,lines:true,points:false,lineWidth:3}
  ]};
}
function sourceToAscii(latex){
 let s=String(latex||'').replace(/^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=/,'').trim();
 for(let i=0;i<8;i++){
  const old=s;s=s.replace(/\\(?:dfrac|frac)\{([^{}]*)\}\{([^{}]*)\}/g,'($1)/($2)');
  if(s===old)break
 }
 return s.replace(/\\(?:left|right)/g,'')
  .replace(/\\(?:cdot|times)/g,'*').replace(/\\(?:sin|cos|tan|ln|log|exp|sqrt|pi)\b/g,m=>m.slice(1))
  .replace(/\{([^{}]*)\}/g,'($1)').replace(/\s+/g,'').replace(/−/g,'-');
}
function availableExpressions(){
 const list=typeof calc.getExpressions==='function'?calc.getExpressions():
  calc.getState()?.expressions?.list||[];
 return list.filter(e=>!String(e.id||'').startsWith('__')&&
  /^\s*(?:[A-Za-z]\s*\(\s*x\s*\)|y)\s*=/.test(String(e.latex||''))&&
  e.type!=='table'&&!e.hidden).map(e=>({id:e.id,latex:e.latex,ascii:sourceToAscii(e.latex)}));
}
function syncSelection(){
 const el=$('lmm-source-list');if(!el)return;
 const active=el.value,list=availableExpressions();
 el.innerHTML='<option value="">Escribir expresión propia</option>'+
  list.map(e=>'<option value="'+sanitize(e.id)+'">'+sanitize(e.latex.slice(0,105))+'</option>').join('');
 if(list.some(e=>e.id===active))el.value=active;
}
function currentSettings(){
 const get=(key)=>$('lmm-'+key);
 return normalizeGeometrySettings({
  expression:get('formula')?.value||settings.expression,
  xMin:get('min')?.value||settings.xMin,xMax:get('max')?.value||settings.xMax,
  angle:get('angle')?.value??settings.angle,n:get('param')?.value??settings.n,
  selectedX:get('selected')?.value??settings.selectedX
 });
}
function refreshInputs(){
 const fields={formula:settings.expression,min:settings.xMin,max:settings.xMax,
  angle:settings.angle,angleText:settings.angle,param:settings.n,selected:settings.selectedX};
 for(const [key,value] of Object.entries(fields)){
  const input=$('lmm-'+key);if(input)input.value=value
 }
 const show=$('lmm-angle-label');if(show)show.textContent=number(settings.angle)+'°';
 syncSelection();
 const text=$('lmm-mode-title');if(text)text.textContent=
  mode==='classic'?'Clásico · Desmos':mode==='triangles'?'Triángulos · Mate-fx':'Elipses · Mate-fx';
}
function clearSource(){
 try{calc.removeExpression({id:'__lmm_source'})}catch(_){}
}
function updateSource(){
 if(isExisting){clearSource();return}
 const latex='h_{LMM}(x)='+settings.expression;
 try{
  calc.setExpression({id:'__lmm_source',latex,color:'#5b79b5',lineWidth:2,secret:true});
 }catch(e){console.warn('La expresión se dibujará mediante tablas geométricas',e)}
}
function updateReadout(model){
 const el=$('lmm-metrics');if(!el)return;
 const stat=geometryStatistics(model);
 if(!stat){el.textContent='No hay valores finitos en el rango elegido.';return}
 el.innerHTML='<strong>x = '+number(stat.x)+'; f(x) = '+number(stat.fx)+'</strong>'+
  '<span>Q = ('+number(stat.q[0])+', '+number(stat.q[1])+')</span>'+
  '<span>x · f(x) = '+number(stat.product)+'</span>'+
  '<span>Área orientada: '+number(stat.area)+'</span>'+
  '<span>¼ elipse orientada: '+number(stat.ellipseQuarterOriented)+'</span>'+
  '<span>Distancias al cuadrado: d+² = '+number(stat.dPlus2)+', d−² = '+number(stat.dMinus2)+'</span>'+
  '<span>Δd² = '+number(stat.diff2)+'</span>';
}
function render(fit=false){
 if(mode==='classic'){removeGenerated();clearSource();$('lmm-metrics').textContent='Modo clásico: expresa funciones directamente en Desmos.';return}
 let model;
 try{model=geometryForExpression(settings)}
 catch(error){
  $('lmm-error').textContent='Expresión no compatible con el evaluador geométrico: '+error.message;
  removeGenerated();return
 }
 $('lmm-error').textContent=model.invalidXs.length?
  'No evaluable en x = '+model.invalidXs.join(', '):'';
 const paths=geometryPaths(model,mode,72);
 removeGenerated();
 updateSource();
 const expressions=paths.map((path,i)=>ensureUnique('g'+path.x+'_'+path.branch,path.points,
   mode==='triangles'?'#2b73cf':i%2?'#e29431':'#2b9b82'));
 rows=expressions.map(e=>e.id);
 if(expressions.length)try{calc.setExpressions(expressions)}
 catch(error){console.error('No se pudo representar la geometría con Desmos',error)}
 updateReadout(model);
 if(fit)try{calc.setMathBounds(boundsForGeometry(model,mode))}catch(_){}
}
function schedule(fit=false){
 if(scheduled)cancelAnimationFrame(scheduled);
 scheduled=requestAnimationFrame(()=>{scheduled=0;render(fit)});
}
function chooseMode(value,{fit=false,persist=true}={}){
 if(!LMM_MODES.some(m=>m.id===value))return;
 mode=value;
 document.body.dataset.lmmMode=mode;
 frame.querySelectorAll('[data-lmm-mode]').forEach(b=>{
  const active=b.dataset.lmmMode===value;
  b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));
 });
 const panel=$('lmm-geometry-panel');
 if(panel)panel.hidden=mode==='classic'||!modalOpen;
 const help=$('lmm-mode-description');
 if(help)help.textContent=LMM_MODES.find(x=>x.id===value).description;
 refreshInputs();schedule(fit);
 if(persist)save();
 window.dispatchEvent(new CustomEvent('lmm:mode-change',{detail:{mode}}));
}
function updateSettings(){
 if(isExisting){const selected=availableExpressions().find(e=>e.id===$('lmm-source-list')?.value);
  if(selected){settings.expression=selected.ascii;const field=$('lmm-formula');if(field)field.value=settings.expression}
 }
 settings=currentSettings();
 $('lmm-angleText').value=String(settings.angle);
 $('lmm-angle-label').textContent=number(settings.angle)+'°';
 schedule();save();
}
function setVisible(open){
 modalOpen=Boolean(open);
 const panel=$('lmm-geometry-panel');panel.hidden=!modalOpen||mode==='classic';
 $('lmm-settings-toggle').setAttribute('aria-expanded',String(!panel.hidden));
}
function showExample(){
 if(window.__gmrActiveProject?.().hasPrimes){
  window.dispatchEvent(new Event('lmm:open-example-controls'));return
 }
 $('projectsBtn')?.click();
 const list=$('projectList');
 const example=list?.querySelector('[data-id="ejemplo-10000-primos"] [data-action="open"]');
 if(example){
  example.click();
  window.dispatchEvent(new Event('lmm:open-example-controls'));
  return
 }
 $('lmm-status').textContent='Abre el proyecto “Ejemplo · 10 000 números primos” desde Proyectos.';
}
function fit(){
 if(mode==='classic'){
  const existing=window.__gmrActiveProject?.();
  if(existing?.hasPrimes)$('fitPrimesBtn')?.click();
  else try{calc.setMathBounds({left:-10,right:20,bottom:-10,top:100})}catch(_){}
 }else schedule(true)
}
function toggleAnimation(){
 const btn=$('lmm-animate');
 if(animation){cancelAnimationFrame(animation);animation=0;btn.textContent='▶ Animar';return}
 if(mode==='classic')chooseMode('triangles');
 btn.textContent='⏸ Pausar';
 previousFrame=0;
 const frameUpdate=time=>{
  if(!previousFrame)previousFrame=time;
  const delta=Math.min(.1,(time-previousFrame)/1000);previousFrame=time;
  settings.angle=(settings.angle+delta*22)%360;
  $('lmm-angle').value=settings.angle;
  $('lmm-angleText').value=settings.angle.toFixed(1);
  $('lmm-angle-label').textContent=settings.angle.toFixed(1)+'°';
  if(time-lastRender>100){schedule();lastRender=time}
  animation=requestAnimationFrame(frameUpdate);
 };
 animation=requestAnimationFrame(frameUpdate);
}
function preventProjectPollution(state){
 // Dibujos geométricos y fuente auxiliar nunca deben guardarse en proyectos del usuario.
 const next=state;
 if(next?.expressions?.list)next.expressions.list=next.expressions.list.filter(
  e=>!String(e.id||'').startsWith('__lmm_'));
 return next;
}
function setup(){
 const modes=document.createElement('nav');modes.id='lmm-mode-rail';modes.setAttribute('aria-label','Visualización geométrica');
 modes.innerHTML=LMM_MODES.map((m,i)=>
  '<button type="button" data-lmm-mode="'+m.id+'" aria-pressed="false" title="'+sanitize(m.description)+'"><span>'+['ƒ','△','◯'][i]+'</span><small>'+m.name+'</small></button>').join('');
 frame.appendChild(modes);
 const actions=document.createElement('nav');actions.id='lmm-quick-rail';actions.setAttribute('aria-label','Herramientas del laboratorio');
 actions.innerHTML='<button data-lmm-quick="research" title="Investigación">⚗<small>Investigar</small></button>'+
  '<button data-lmm-quick="analysis" title="Análisis">▤<small>Análisis</small></button>'+
  '<button data-lmm-quick="data" title="Importar/Exportar">⇄<small>Datos</small></button>'+
  '<button data-lmm-quick="settings" id="lmm-settings-toggle" title="Configurar geometría" aria-expanded="false">⚙<small>Geometría</small></button>'+
  '<button data-lmm-quick="fit" title="Ajustar">⌖<small>Ajustar</small></button>'+
  '<button data-lmm-quick="example" title="Números primos de ejemplo">◇<small>Ejemplos</small></button>';
 frame.appendChild(actions);
 const panel=document.createElement('section');panel.id='lmm-geometry-panel';panel.hidden=true;
 panel.innerHTML='<div class="lmm-panel-head"><strong id="lmm-mode-title">Geometría</strong><button id="lmm-geometry-close" aria-label="Cerrar configuración">×</button></div>'+
  '<p id="lmm-mode-description"></p><label>Usar fórmula existente en Desmos <select id="lmm-source-list"><option value="">Escribir expresión propia</option></select></label>'+
  '<label>Expresión de f(x) <input id="lmm-formula" spellcheck="false" type="text" value="x^2" placeholder="x^2, sin(x), 2x + 1"></label>'+
  '<div class="lmm-grid"><label>x mínimo <input type="number" id="lmm-min" value="1" min="1" max="50"></label>'+
  '<label>x máximo <input type="number" id="lmm-max" value="6" min="1" max="50"></label>'+
  '<label>Parámetro n <input type="number" id="lmm-param" value="3" step="0.1"></label>'+
  '<label>x seleccionado <input type="number" id="lmm-selected" value="4" min="1" max="50"></label></div>'+
  '<label>Ángulo de ejes θ <span id="lmm-angle-label">90°</span><input id="lmm-angle" type="range" min="0" max="360" step="1" value="90"></label>'+
  '<div class="lmm-angle-row"><input id="lmm-angleText" type="number" min="0" max="360" step="0.1" value="90">'+
  '<button id="lmm-animate">▶ Animar</button><button id="lmm-fit">Ajustar geometría</button></div>'+
  '<p class="lmm-note">Mismo plano Desmos: los modos solo añaden o retiran construcciones. En ángulos intermedios se utiliza la interpolación geométrica original de Mate-fx.</p>'+
  '<p id="lmm-error" role="status"></p><div class="lmm-metrics" id="lmm-metrics"></div>';
 frame.appendChild(panel);
 const status=document.createElement('div');status.id='lmm-status';frame.appendChild(status);
 modes.addEventListener('click',event=>{const btn=event.target.closest('[data-lmm-mode]');if(!btn)return;chooseMode(btn.dataset.lmmMode);if(btn.dataset.lmmMode!=='classic')setVisible(true);else setVisible(false)});
 actions.addEventListener('click',event=>{
  const button=event.target.closest('[data-lmm-quick]');if(!button)return;
  const v=button.dataset.lmmQuick;
  if(v==='research')$('np-investigation-btn')?.click();
  if(v==='analysis')$('np-analysis-btn')?.click();
  if(v==='data')$('np-data-main')?.click();
  if(v==='settings'){if(mode==='classic')chooseMode('triangles');setVisible(!modalOpen)}
  if(v==='fit')fit();
  if(v==='example')showExample();
 });
 $('lmm-geometry-close').onclick=()=>setVisible(false);
 $('lmm-source-list').addEventListener('focus',syncSelection);
 $('lmm-source-list').onchange=()=>{
  const selected=availableExpressions().find(e=>e.id===$('lmm-source-list').value);
  isExisting=Boolean(selected);
  if(selected){$('lmm-formula').value=selected.ascii;settings.expression=selected.ascii}
  updateSettings();
 };
 for(const key of ['formula','min','max','param','selected'])
  $('lmm-'+key).addEventListener('change',()=>{isExisting=false;updateSettings()});
 $('lmm-angle').addEventListener('input',()=>{
  settings.angle=Number($('lmm-angle').value);
  $('lmm-angleText').value=settings.angle;
  $('lmm-angle-label').textContent=settings.angle+'°';schedule();
 });
 $('lmm-angle').addEventListener('change',()=>save());
 $('lmm-angleText').addEventListener('change',()=>{
  settings.angle=Number($('lmm-angleText').value);settings=normalizeGeometrySettings(settings);
  $('lmm-angle').value=settings.angle;updateSettings()
 });
 $('lmm-animate').onclick=toggleAnimation;
 $('lmm-fit').onclick=()=>schedule(true);
 frame.addEventListener('dblclick',e=>{if(e.target.closest('#lmm-mode-rail'))setVisible(true)});
 window.addEventListener('gmr:project-switched',()=>{
  if(animation){cancelAnimationFrame(animation);animation=0;$('lmm-animate').textContent='▶ Animar'}
  removeGenerated();clearSource();restore()
 });
 calc.observeEvent?.('change.lmmGeometry',(_name,event)=>{
  if(!event?.isUserInitiated||mode==='classic'||!isExisting)return;
  const selected=availableExpressions().find(e=>e.id===$('lmm-source-list').value);
  if(selected&&selected.ascii!==settings.expression){
   try{compileExpression(selected.ascii);settings.expression=selected.ascii;
    $('lmm-formula').value=selected.ascii;schedule()}catch(_){}
  }
 });
 restore();
 window.__lmmGeometry={setMode:chooseMode,getMode:()=>mode,getSettings:()=>({...settings}),fit,
  refresh:()=>schedule(),showPanel:()=>{if(mode==='classic')chooseMode('triangles');setVisible(true)},
  clear:removeGenerated,preventProjectPollution};
 window.dispatchEvent(new Event('lmm:ready'));
}
setup();
