/* Mate-fx: interfaz de investigación reproducible. */
import {METHODS,methodById,methodConfig,cleanData} from './investigation-core.mjs';
import {methodReport,generalReport} from './investigation-report.mjs';
import {plotSpecifications,screenshotFromDesmos} from './investigation-desmos.mjs';
import {setupDashboards,refreshDashboards} from './investigation-dashboards.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?Number(n).toLocaleString('es-EC',{maximumFractionDigits:4}):'—';
const pct=n=>Number.isFinite(n)?fmt(n)+' %':'—';
const SYMBOLIC_KINDS=[['x','z'],['power','Potencias'],['ln','ln(z)'],['log1p','ln(1+z)'],['sqrt','Raíz'],['exp','Exponencial'],['sin','Seno'],['cos','Coseno'],['reciprocal','Recíproco'],['xln','z·ln(z)'],['xx','z^z'],['xexp','z·exp'],['xover','Cociente z/(z+p)'],['xsin','z·sin']];
const GROUP_ORDER=['Métodos clásicos de ajuste','Métodos de corrección de funciones','Métodos basados en restricciones y cotas','Métodos de interpolación','Métodos de aproximación avanzada','Métodos de búsqueda y optimización'];
const DEFAULT={n:10000,allowedKinds:SYMBOLIC_KINDS.map(k=>k[0]),decimals:3,magnitude:9999,degree:2,denominator:2,knots:8,harmonics:2,width:.6,quantile:.5,maxTerms:3,maxX:2,constant:true,generational:true,composition:'sum',families:['logarithmic','exponential','polynomial','trigonometric'],bounds:'shared',center:'auto',objective:'mape'};
const state={project:null,projectName:'',source:null,entries:[],history:new Map(),results:new Map(),worker:null,running:false,paused:false,mode:'manual',active:'',done:0,total:0,seq:0,lastDraw:0,lastGraph:0,graphSerial:0,exporting:false};
const select=(key,title,current,values)=>'<label>'+title+'<select data-setting="'+key+'">'+values.map(a=>'<option value="'+esc(a[0])+'"'+(String(a[0])===String(current)?' selected':'')+'>'+esc(a[1])+'</option>').join('')+'</select></label>';
const field=(key,title,current,min,max,step='1')=>'<label>'+title+'<input type="number" data-setting="'+key+'" value="'+esc(current)+'" min="'+min+'" max="'+max+'" step="'+step+'"></label>';
const methodsSelect=()=>GROUP_ORDER.map(group=>
 '<div class="inv-category"><h4>'+esc(group)+'</h4>'+METHODS.filter(m=>m.group===group).map(m=>
 '<label><input type="checkbox" data-method="'+m.id+'"'+(state.entries.some(e=>e.method===m.id)?' checked':'')+'> '+esc(m.name)+' <small title="'+(m.type==='direct'?'Cálculo directo':'Iterativo')+'">'+(m.type==='direct'?'●':'↻')+'</small></label>').join('')+'</div>').join('');
function entry(method){
 return {id:'C'+(++state.seq),method,config:{...DEFAULT,families:[...DEFAULT.families],allowedKinds:[...DEFAULT.allowedKinds]},seed:10103+state.seq};
}
function setMethodList(){
 $('inv-methods').innerHTML=methodsSelect();
 $('inv-methods').querySelectorAll('[data-method]').forEach(c=>c.onchange=()=>{
  if(state.running){c.checked=!c.checked;return}
  if(c.checked)state.entries.push(entry(c.dataset.method));
  else state.entries=state.entries.filter(e=>e.method!==c.dataset.method);
  cards();table();
 });
}
function getCard(e){
 const m=methodById(e.method),c=e.config;
 const limitedPrecision=['symbolic','constrained','envelope'].includes(m.id);
 let f=field('n','Iteraciones',c.n,1,100000)+select('decimals','Decimales',Math.min(c.decimals,limitedPrecision?3:6),Array.from({length:limitedPrecision?4:7},(_,i)=>[i,i.toString()]))+
 select('magnitude','Magnitud máxima',Math.min(c.magnitude,limitedPrecision?9999:999999),[[9,'9'],[99,'99'],[999,'999'],[9999,'9 999'],...(!limitedPrecision?[[99999,'99 999'],[999999,'999 999']]:[])])+
 select('objective','Criterio de selección',c.objective,[['mape','Error relativo medio'],['max','Error relativo máximo'],['mae','MAE'],['rmse','RMSE'],['balanced','Equilibrado']]);
 if(['polynomial','rational','pade','chebyshev','minimax','quantile','taylor','remez'].includes(m.id))f+=field('degree','Grado',c.degree,1,5);
 if(['rational','pade'].includes(m.id))f+=field('denominator','Grado denominador',c.denominator,1,4);
 if(['linear_interp','lagrange','newton','hermite','pchip','spline','rbf','gaussian'].includes(m.id))f+=field('knots','Nodos / centros',c.knots,3,16);
 if(m.id==='rbf'||m.id==='gaussian')f+=field('width','Ancho',c.width,.05,3,.05);
 if(m.id==='fourier')f+=field('harmonics','Armónicos',c.harmonics,1,5);
 if(m.id==='quantile')f+=field('quantile','Cuantil',c.quantile,.01,.99,.05);
 if(m.id==='symbolic'||m.id==='constrained'){
  f+=field('maxTerms','Máx. términos',c.maxTerms,1,3)+field('maxX','Máx. apariciones de z',c.maxX,1,2)+
   select('composition','Operaciones de combinación',c.composition,[['sum','Suma'],['product','Producto'],['pair_plus','Producto + suma']])+
   select('generational','Aprendizaje generacional',c.generational,[['true','Activado'],['false','Desactivado']])+
   select('constant','Constante aditiva',c.constant,[['true','Permitida'],['false','Prohibida']])+
   '<div class="inv-family">'+['logarithmic','exponential','polynomial','trigonometric'].map(k=>'<label><input type="checkbox" data-family="'+k+'"'+(c.families.includes(k)?' checked':'')+'> '+({logarithmic:'Log',exponential:'Exp',polynomial:'Pol',trigonometric:'Trig'}[k])+'</label>').join('')+'</div>'+ '<div class="inv-family inv-kind"><strong>Operaciones / bases permitidas:</strong>'+SYMBOLIC_KINDS.map(([k,label])=>'<label><input type="checkbox" data-kind="'+k+'"'+(c.allowedKinds?.includes(k)?' checked':'')+'> '+esc(label)+'</label>').join('')+'</div>';
 }
 if(m.id==='envelope')f+=select('bounds','Exponentes',c.bounds,[['shared','Compartidos'],['independent','Independientes']])+select('center','Promedio',c.center,[['auto','Automático'],['arithmetic','Aritmético'],['geometric','Geométrico'],['harmonic','Armónico']]);
 return '<article class="inv-card" data-id="'+e.id+'"><header><div><b>'+esc(m.name)+'</b><small>'+e.id+' · '+(m.type==='direct'?'Cálculo directo':'Iterativo')+'</small></div><span><button type="button" data-duplicate="'+e.id+'">⧉</button><button type="button" data-remove="'+e.id+'">×</button></span></header><div class="inv-settings">'+f+'</div><label class="inv-seed">Semilla<input type="number" data-seed="'+e.id+'" value="'+e.seed+'"></label></article>';
}
function cards(){
 $('inv-config-count').textContent=state.entries.length+' configuración(es)';
 $('inv-cards').innerHTML=state.entries.length?state.entries.map(getCard).join(''):'Selecciona métodos para investigar.';
 $('inv-cards').querySelectorAll('[data-setting]').forEach(ctrl=>ctrl.onchange=()=>{
  const e=state.entries.find(x=>x.id===ctrl.closest('[data-id]').dataset.id);
  if(!e)return;const key=ctrl.dataset.setting;
  e.config[key]=key==='generational'||key==='constant'?ctrl.value==='true':ctrl.type==='number'?Number(ctrl.value):ctrl.value;
 });
 $('inv-cards').querySelectorAll('[data-family]').forEach(ctrl=>ctrl.onchange=()=>{
  const e=state.entries.find(x=>x.id===ctrl.closest('[data-id]').dataset.id);
  if(e)e.config.families=[...ctrl.closest('.inv-family').querySelectorAll('input:checked')].map(x=>x.dataset.family);
 });
 $('inv-cards').querySelectorAll('[data-kind]').forEach(ctrl=>ctrl.onchange=()=>{
  const e=state.entries.find(x=>x.id===ctrl.closest('[data-id]').dataset.id);
  if(e)e.config.allowedKinds=[...ctrl.closest('.inv-kind').querySelectorAll('input:checked')].map(x=>x.dataset.kind);
 });
 $('inv-cards').querySelectorAll('[data-seed]').forEach(ctrl=>ctrl.onchange=()=>{
  const e=state.entries.find(x=>x.id===ctrl.dataset.seed);if(e)e.seed=Math.trunc(Number(ctrl.value)||12345);
 });
 $('inv-cards').querySelectorAll('[data-duplicate]').forEach(btn=>btn.onclick=()=>{
  if(state.running)return;const orig=state.entries.find(x=>x.id===btn.dataset.duplicate);
  const clone={id:'C'+(++state.seq),method:orig.method,config:{...orig.config,families:[...orig.config.families],allowedKinds:[...(orig.config.allowedKinds||DEFAULT.allowedKinds)]},seed:orig.seed+1};
  state.entries.splice(state.entries.indexOf(orig)+1,0,clone);cards();table();
 });
 $('inv-cards').querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=()=>{
  if(state.running)return;state.entries=state.entries.filter(x=>x.id!==btn.dataset.remove);setMethodList();cards();table();
 });
}
function table(){
 $('inv-winners').innerHTML=state.entries.map(e=>{
  const r=state.results.get(e.id)?.best,met=r?.metrics;
  return '<tr><td>'+esc(e.id)+'</td><td>'+esc(methodById(e.method)?.name)+'</td><td class="inv-latex">'+esc(r?.latex||'—')+'</td><td>'+pct(met?.mape)+'</td><td>'+pct(met?.maxape)+'</td><td>'+fmt(r?.complexity)+'</td><td><button data-show="'+e.id+'"'+(!r?' disabled':'')+'>Ver</button></td></tr>';
 }).join('');
 $('inv-winners').querySelectorAll('[data-show]').forEach(b=>b.onclick=()=>{state.active=b.dataset.show;graph()});
 const done=state.entries.filter(e=>state.results.get(e.id)?.best).length;
 $('inv-completed').textContent=done+' / '+state.entries.length+' con fórmula válida';
 $('inv-permethod').innerHTML=[...new Set(state.entries.filter(e=>state.history.has(e.id)).map(e=>e.method))].map(m=>
 '<button type="button" data-pdf="'+m+'">Reporte PDF · '+esc(methodById(m).name)+'</button>').join('');
 $('inv-permethod').querySelectorAll('[data-pdf]').forEach(b=>b.onclick=()=>reportMethod(b.dataset.pdf));
 $('inv-general').disabled=!done||state.exporting;$('inv-json').disabled=!state.history.size||state.exporting;
 refreshDashboards();
}
function reportState(){
 return {...state,entries:state.entries.map(e=>({...e,config:{...e.config}})),results:new Map(state.results),history:new Map(state.history),source:state.source};
}
async function generatePDF(task){
 if(state.exporting)return;
 state.exporting=true;buttons();table();
 try{
  const name=await task(s=>note(s));
  note('PDF descargado correctamente: '+name);
 }catch(error){console.error(error);note('Error al generar el PDF: '+(error.message||error))}
 finally{state.exporting=false;buttons();table()}
}
async function reportMethod(id){
 const snapshot=reportState();
 await generatePDF(notify=>methodReport(snapshot,id,methodById(id).name,notify));
}
async function reportGeneral(){
 const snapshot=reportState();
 await generatePDF(notify=>generalReport(snapshot,id=>methodById(id).name,notify));
}
async function graph(force=false){
 if(!state.source)return;
 const current=performance.now();if(!force&&current-state.lastGraph<1100)return;
 state.lastGraph=current;
 const best=state.results.get(state.active)?.best||[...state.results.values()].find(x=>x.best)?.best;
 const element=$('inv-preview');if(!element)return;
 const token=++state.graphSerial;
 if(!best){element.textContent='Los puntos y la curva se mostrarán aquí mediante el motor de Desmos.';return}
 const spec=plotSpecifications(state.source,best,'fit');
 $('inv-preview-caption').textContent=(state.active||'Ganadora')+' · Azul: puntos observados · naranja: estimación · Gráfica real de Desmos';
 try{
  const png=await screenshotFromDesmos(spec,{width:900,height:470,ratio:1.15,previewKey:'main'});
  if(token!==state.graphSerial||!element.isConnected)return;
  const img=new Image();img.src=png;img.alt='Captura real de Desmos mostrando los datos y la ecuación ganadora.';
  img.style.cssText='display:block;width:100%;height:auto;';element.replaceChildren(img);
 }catch(e){if(token===state.graphSerial){element.textContent='Desmos no pudo capturar el gráfico: '+e.message}}
}
function note(s){$('inv-status').textContent=s}
function buttons(){
 $('inv-start').disabled=state.running||state.exporting;$('inv-auto').disabled=state.running||state.exporting;
 $('inv-pause').disabled=!state.running||state.paused;$('inv-resume').disabled=!state.running||!state.paused;$('inv-stop').disabled=!state.running;
}
function progress(){
 $('inv-progress').max=Math.max(state.total,1);$('inv-progress').value=state.done;
 $('inv-counter').textContent=state.done.toLocaleString('es-EC')+' / '+state.total.toLocaleString('es-EC');
}
function stop(){
 state.worker?.terminate();state.worker=null;state.running=false;state.paused=false;buttons();
}
function finish(s){stop();table();graph();progress();note(s)}
function run(mode){
 if(state.running||state.exporting)return;
 const s=window.__gmrResearchSnapshot?.('y'),pts=cleanData(s?.source?.points);
 if(pts.length<5)return note('Importa datos con al menos 5 puntos distintos.');
 if(!state.entries.length)return note('Selecciona al menos un método.');
 if(state.entries.some(e=>['symbolic','constrained'].includes(e.method)&&(!e.config.families.length||!e.config.allowedKinds?.length)))return note('Selecciona al menos una familia y una operación de base en la configuración simbólica.');
 const validation=Number($('inv-validation').value),entries=state.entries.map(e=>({...e,config:methodConfig(e.config)}));
 const budget=entries.reduce((sum,e)=>sum+(methodById(e.method).type==='direct'?1:e.config.n),0);
 if(budget>300000&&!confirm('Vas a evaluar '+budget.toLocaleString('es-EC')+' intentos; los reportes de iteraciones pueden ser muy grandes. ¿Continuar?'))return;
 stop();state.source={...s.source,points:pts};state.project=window.__gmrActiveProject?.().id;state.projectName=window.__gmrActiveProject?.().name||'Investigación';state.running=true;state.mode=mode;
 state.history.clear();state.results.clear();state.done=0;state.total=budget;state.active='';buttons();table();graph();progress();
 const w=new Worker(new URL('./investigation-worker.mjs',import.meta.url),{type:'module'});state.worker=w;
 w.onmessage=evt=>{
  if(w!==state.worker||window.__gmrActiveProject?.().id!==state.project)return;
  const msg=evt.data;
  if(msg.type==='started')note(msg.methods+' configuración(es) · '+msg.trainCount+' puntos entrenamiento · '+msg.validationCount+' validación');
  if(msg.type==='method-start'){state.active=msg.entryId;note('Investigando: '+methodById(msg.method).name);}
  if(msg.type==='progress'){
   state.done=msg.done;
   const list=state.history.get(msg.entryId)||[];list.push(...msg.rows);state.history.set(msg.entryId,list);
   if(msg.best)state.results.set(msg.entryId,{id:msg.entryId,best:msg.best});
   if(performance.now()-state.lastDraw>250){state.lastDraw=performance.now();table();graph();progress()}
  }
  if(msg.type==='method-complete'){state.results.set(msg.entryId,msg.result);table();graph(true);refreshDashboards(true);progress()}
  if(msg.type==='paused'){state.paused=true;buttons();note('Pausado.')}
  if(msg.type==='resumed'){state.paused=false;buttons();note('Reanudado.')}
  if(msg.type==='warning')note('Advertencia '+msg.entryId+': '+msg.message);
  if(msg.type==='complete'){state.done=msg.done;finish('Experimentos terminados. Los reportes se descargan directamente como PDF.');if(mode==='automatic')reportGeneral()}
  if(msg.type==='error')finish('Error: '+msg.message);
 };
 w.onerror=e=>finish('Error en el motor: '+(e.message||'desconocido'));
 w.postMessage({type:'start',points:pts,entries,validation});
}
function exportJSON(){
 const document={version:1,date:new Date().toISOString(),project:state.projectName,source:state.source,entries:state.entries.map(e=>({...e,best:state.results.get(e.id)?.best||null,history:state.history.get(e.id)||[]}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(document)],{type:'application/json'}));
 const a=document.createElement('a');a.href=url;a.download='Matefx_investigacion_'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
function setup(){
 if(!window.__gmrResearchSnapshot||!window.__nPrimosCalculator){setTimeout(setup,100);return}
 if($('np-investigation-btn'))return;
 const b=document.createElement('button');b.type='button';b.id='np-investigation-btn';b.textContent='⌕ Investigación';document.body.append(b);
 const overlay=document.createElement('div');overlay.id='np-investigation-panel';overlay.className='gmr-research-overlay';overlay.hidden=true;
 overlay.innerHTML='<div class="gmr-research-window inv-window" role="dialog" aria-modal="true" aria-label="Investigación"><div class="gmr-research-heading"><div><h2>Investigación · Métodos de aproximación</h2><small id="inv-source"></small></div><button id="inv-close" type="button" aria-label="Cerrar">×</button></div><div class="gmr-research-body inv-layout">'+
 '<aside class="inv-sidebar"><h3>Métodos clasificados</h3><p class="gmr-research-note">● Directos · ↻ Iterativos</p><div id="inv-methods"></div><div class="inv-links"><b>Módulos existentes</b><button id="inv-original-generator">Generador original</button><button id="inv-original-envelope">Acotación original</button><button id="inv-original-dashboard">Dashboards</button></div></aside>'+
 '<main class="inv-content"><section class="gmr-research-group"><h3>Configuraciones por método · <small id="inv-config-count"></small></h3><p class="gmr-research-note">Cada configuración genera una fórmula ganadora. Duplica un método para comparar distintos decimales, límites y parámetros. En métodos simbólicos y acotación el motor admite hasta 3 decimales y 9 999 de magnitud; las constantes de normalización derivadas de z se declaran aparte.</p><div id="inv-cards"></div></section>'+
 '<section class="gmr-research-group"><div class="inv-actions"><label>Validación (%) <input id="inv-validation" type="number" min="0" max="40" step="5" value="20"></label><button id="inv-start">▶ Investigar en tiempo real</button><button id="inv-auto">▤ Reporte automático</button><button id="inv-pause">Pausar</button><button id="inv-resume">Reanudar</button><button id="inv-stop">Detener</button></div><div class="inv-status"><progress id="inv-progress" value="0" max="1"></progress><span id="inv-counter">0 / 0</span></div><p id="inv-status">Selecciona métodos para iniciar la investigación.</p></section>'+
 '<section class="gmr-research-group"><h3>Mejor curva en tiempo real</h3><div id="inv-preview"></div><small id="inv-preview-caption"></small></section>'+
 '<section class="gmr-research-group" id="inv-dashboards"></section>'+ 
 '<section class="gmr-research-group"><h3>Mejores fórmulas · <small id="inv-completed"></small></h3><div class="gmr-history"><table><thead><tr><th>Configuración</th><th>Método</th><th>Función LaTeX</th><th>MAPE</th><th>Error máximo</th><th>Complejidad</th><th>Gráfica</th></tr></thead><tbody id="inv-winners"></tbody></table></div></section>'+
 '<section class="gmr-research-group"><h3>Reportes</h3><p>Nuevo diseño académico A4: resumen, metodología, tabla comparativa, ecuaciones LaTeX y figuras Desmos con pies. Los reportes por método incorporan los errores, los datos y todas las iteraciones en anexos sin gráficas. El general incluye el catálogo comparativo.</p><div id="inv-permethod" class="inv-reports"></div><div class="inv-actions"><button id="inv-general">Reporte general · formato paper PDF</button><button id="inv-json">Exportar historial JSON</button></div><p class="gmr-research-note">Cada botón descarga directamente PDF. «Reporte automático» descarga solo el PDF general al finalizar. Los informes individuales se descargan manualmente desde el botón correspondiente a cada método. Las gráficas provienen de capturas PNG oficiales de Desmos. LaTeX se incluye en cada reporte; MathJax mejora su presentación cuando está disponible.</p></section></main></div></div>';
 document.body.append(overlay);
 setupDashboards(()=>state);
 document.addEventListener('gmr:inv-select',()=>graph(true));
 b.onclick=()=>{
  const s=window.__gmrResearchSnapshot?.('y'),p=window.__gmrActiveProject?.();
  if(!s)return;
  if(state.project!==p?.id){stop();state.project=p?.id;state.projectName=p?.name||'';state.entries=[];state.history.clear();state.results.clear();state.source=null;for(const id of ['linear','polynomial','exponential','rational','chebyshev','symbolic','envelope'])state.entries.push(entry(id))}
  state.source={...s.source,points:cleanData(s.source.points)};
  $('inv-source').textContent=(p?.name||'Proyecto')+' · '+s.source.sourceName+' · '+state.source.points.length+' puntos distintos';
  setMethodList();cards();table();graph(true);refreshDashboards(true);buttons();overlay.hidden=false;
 };
 $('inv-close').onclick=()=>overlay.hidden=true;overlay.onclick=e=>{if(e.target===overlay)overlay.hidden=true};
 $('inv-start').onclick=()=>run('manual');$('inv-auto').onclick=()=>run('automatic');
 $('inv-pause').onclick=()=>state.worker?.postMessage({type:'pause'});
 $('inv-resume').onclick=()=>state.worker?.postMessage({type:'resume'});
 $('inv-stop').onclick=()=>{stop();note('Detenido. Los resultados parciales permanecen disponibles.')};
 $('inv-general').onclick=reportGeneral;$('inv-json').onclick=exportJSON;
 for(const [a,b] of [['inv-original-generator','np-generator-btn'],['inv-original-envelope','np-envelope-btn'],['inv-original-dashboard','np-dashboard-btn']])
  $(a).onclick=()=>{overlay.hidden=true;$(b)?.click()};
 window.addEventListener('gmr:project-switched',e=>{if(e.detail?.lab!=='prime')return;stop();state.project=null;state.source=null;overlay.hidden=true});
 window.addEventListener('gmr:dataset-selection',e=>{if(e.detail?.lab==='prime'&&state.running){stop();note('Se detuvo la búsqueda: cambió el conjunto de datos.')}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
