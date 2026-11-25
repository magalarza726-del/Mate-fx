/* Mate-fx: Investigación + Análisis, una configuración global y una semilla compartida. */
import {METHODS,methodById,methodConfig,cleanData} from './investigation-core.mjs';
import {methodReport,generalReport,reportLatex} from './investigation-report.mjs';
import {plotSpecifications,screenshotFromDesmos} from './investigation-desmos.mjs';
import {setupDashboards,refreshDashboards} from './investigation-dashboards.mjs';
const $=id=>document.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:4}):'—';
const pct=v=>Number.isFinite(v)?fmt(v)+' %':'—';
const GROUP_ORDER=['Métodos clásicos de ajuste','Métodos de corrección de funciones','Métodos de acotación','Métodos basados en restricciones y cotas','Métodos de interpolación','Métodos de aproximación avanzada','Métodos de búsqueda y optimización','Métodos personalizados'];
const SYMBOLIC_KINDS=[['x','x'],['power','Potencias'],['ln','ln(x)'],['log1p','ln(1+x)'],['sqrt','Raíz'],['exp','Exponencial'],['sin','Seno'],['cos','Coseno'],['reciprocal','Recíproco'],['xln','x·ln(x)'],['xx','x^x'],['xexp','x·exp'],['xover','Cociente x/(x+p)'],['xsin','x·sin']];
const GLOBAL_DEFAULT={n:10000,decimals:3,magnitude:9999,degree:2,denominator:2,knots:8,harmonics:2,width:0.6,quantile:0.5,
 maxTerms:3,maxX:2,constant:true,generational:true,composition:'sum',
 families:['logarithmic','exponential','polynomial','trigonometric'],allowedKinds:SYMBOLIC_KINDS.map(v=>v[0]),
 bounds:'shared',center:'auto',objective:'mape',validation:20};
const state={project:null,projectName:'',source:null,entries:[],history:new Map(),results:new Map(),
 config:{...GLOBAL_DEFAULT,families:[...GLOBAL_DEFAULT.families],allowedKinds:[...GLOBAL_DEFAULT.allowedKinds]},
 seed:10103,worker:null,running:false,paused:false,exporting:false,mode:'manual',active:'',
 done:0,total:0,seq:0,lastTable:0,lastGraph:0,graphSerial:0,view:'research',tab:'methods',pointPage:0};
const field=(key,label,value,min,max,step='1')=>'<label>'+label+'<input type="number" data-global="'+key+'" value="'+esc(value)+'" min="'+min+'" max="'+max+'" step="'+step+'"></label>';
const select=(key,label,value,options)=>'<label>'+label+'<select data-global="'+key+'">'+options.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></label>';
function globalControls(){
 const c=state.config;
 return '<div class="inv-v2-settings">'+
 field('n','Intentos por método iterativo',c.n,1,100000)+field('seed','Semilla común',state.seed,1,2147483647)+
 select('decimals','Decimales máximos',c.decimals,Array.from({length:7},(_,i)=>[i,String(i)]))+
 select('magnitude','Magnitud máxima',c.magnitude,[[9,'9'],[99,'99'],[999,'999'],[9999,'9.999'],[99999,'99.999'],[999999,'999.999']])+
 select('objective','Optimizar',c.objective,[['mape','MAPE'],['max','MaxAPE'],['mae','MAE'],['rmse','RMSE'],['balanced','Equilibrado']])+
 field('validation','Validación (%)',c.validation,0,40,5)+
 '</div><details class="inv-v2-advanced"><summary>Parámetros matemáticos comunes y restricciones</summary><div class="inv-v2-settings">'+
 field('degree','Grado polinómico',c.degree,1,5)+field('denominator','Grado del denominador',c.denominator,1,4)+
 field('knots','Nodos / centros',c.knots,3,16)+field('harmonics','Armónicos',c.harmonics,1,5)+
 field('width','Anchura RBF',c.width,.05,3,.05)+field('quantile','Cuantil',c.quantile,.01,.99,.05)+
 field('maxTerms','Máximo de términos',c.maxTerms,1,3)+field('maxX','Máximo de apariciones de x',c.maxX,1,2)+
 select('composition','Combinación del generador',c.composition,[['sum','Suma'],['product','Producto'],['pair_plus','Producto + suma']])+
 select('constant','Constante aditiva',c.constant,[['true','Permitida'],['false','Prohibida']])+
 select('generational','Aprendizaje generacional',c.generational,[['true','Activado'],['false','Desactivado']])+
 select('bounds','Exponentes (acotación original)',c.bounds,[['shared','Compartidos'],['independent','Independientes']])+
 select('center','Centro de acotación',c.center,[['auto','Automático'],['arithmetic','Aritmético'],['geometric','Geométrico'],['harmonic','Armónico']])+'</div>'+
 '<div class="inv-v2-checks"><strong>Familias permitidas para métodos personalizados</strong>'+
 ['logarithmic','exponential','polynomial','trigonometric'].map(k=>'<label><input type="checkbox" data-family="'+k+'"'+(c.families.includes(k)?' checked':'')+'> '+({logarithmic:'Logarítmica',exponential:'Exponencial',polynomial:'Polinómica',trigonometric:'Trigonométrica'}[k])+'</label>').join('')+
 '</div><div class="inv-v2-checks"><strong>Bases/operaciones permitidas</strong>'+
 SYMBOLIC_KINDS.map(([k,name])=>'<label><input type="checkbox" data-kind="'+k+'"'+(c.allowedKinds.includes(k)?' checked':'')+'> '+esc(name)+'</label>').join('')+
 '</div><p class="gmr-research-note">Todos los métodos reciben la misma configuración y semilla. Cada algoritmo utiliza únicamente los parámetros pertinentes; los métodos deterministas ejecutan un ajuste por método. Los generadores simbólicos y las acotaciones exponenciales originales conservan sus límites internos de 3 decimales y magnitud 9.999.</p></details>';
}
function selectedIds(){return state.entries.map(e=>e.method)}
function entry(id){return {id:'C'+(++state.seq),method:id,config:{...state.config,families:[...state.config.families],allowedKinds:[...state.config.allowedKinds]},seed:state.seed}}
function methodSelector(){
 return GROUP_ORDER.map(group=>{
  const list=METHODS.filter(m=>m.group===group);if(!list.length)return '';
  return '<section class="inv-category"><h4>'+esc(group)+'</h4>'+
   list.map(m=>'<label><input type="checkbox" data-method="'+m.id+'"'+(selectedIds().includes(m.id)?' checked':'')+'> '+
    esc(m.name)+' <small>'+(m.type==='direct'?'●':'↻')+'</small></label>').join('')+'</section>';
 }).join('');
}
function applyGlobal(){
 const wasOpen=$('inv-v2-global').querySelector('details')?.open||false;
 $('inv-v2-global').innerHTML=globalControls();
 const advanced=$('inv-v2-global').querySelector('details');if(advanced)advanced.open=wasOpen;
 $('inv-v2-global').querySelectorAll('[data-global]').forEach(input=>input.onchange=()=>{
  if(state.running){renderSettings();return}
  const key=input.dataset.global;
  if(key==='seed'){state.seed=Math.max(1,Math.min(2147483647,Math.trunc(+input.value||10103)))}
  else state.config[key]=['constant','generational'].includes(key)?input.value==='true':input.type==='number'?Number(input.value):input.value;
  state.config=methodConfig(state.config);
  renderSettings();
 });
 for(const [selector,key] of [['[data-family]','families'],['[data-kind]','allowedKinds']]){
  $('inv-v2-global').querySelectorAll(selector).forEach(el=>el.onchange=()=>{
   if(state.running){renderSettings();return}
   state.config[key]=[...$('inv-v2-global').querySelectorAll(selector+':checked')].map(x=>x.dataset[key==='families'?'family':'kind']);
  });
 }
}
function renderSettings(){applyGlobal();$('inv-v2-global').querySelectorAll('input,select').forEach(x=>x.disabled=state.running)}
function renderMethods(){
 $('inv-v2-methods').innerHTML=methodSelector();
 $('inv-v2-method-count').textContent=state.entries.length+' métodos';
 $('inv-v2-methods').querySelectorAll('[data-method]').forEach(x=>x.onchange=()=>{
  if(state.running||state.exporting){x.checked=!x.checked;return}
  if(x.checked){state.entries.push(entry(x.dataset.method))}
  else state.entries=state.entries.filter(e=>e.method!==x.dataset.method);
  $('inv-v2-method-count').textContent=state.entries.length+' métodos';renderResults();
 });
}
function note(msg){$('inv-v2-status').textContent=msg}
function controls(){
 for(const k of ['inv-v2-start','inv-v2-auto'])$(k).disabled=state.running||state.exporting;
 $('inv-v2-pause').disabled=!state.running||state.paused;
 $('inv-v2-resume').disabled=!state.running||!state.paused;
 $('inv-v2-stop').disabled=!state.running;
 const count=state.entries.filter(e=>state.results.get(e.id)?.best).length;
 $('inv-v2-general').disabled=!count||state.exporting;
 $('inv-v2-json').disabled=!state.history.size||state.exporting;
}
function progress(){
 $('inv-v2-progress').max=Math.max(1,state.total);$('inv-v2-progress').value=state.done;
 $('inv-v2-counter').textContent=fmt(state.done)+' / '+fmt(state.total);
}
function snapshot(){
 return {...state,entries:state.entries.map(e=>({...e,config:{...e.config}})),source:state.source,
  results:new Map(state.results),history:new Map(state.history)};
}
async function savePDF(run){
 if(state.exporting)return;
 state.exporting=true;controls();
 try{const name=await run(msg=>note(msg));note('PDF descargado: '+name)}
 catch(error){console.error(error);note('Error al descargar PDF: '+error.message)}
 finally{state.exporting=false;controls()}
}
function individual(methodId){const copy=snapshot();return savePDF(cb=>methodReport(copy,methodId,methodById(methodId).name,cb))}
function general(){const copy=snapshot();return savePDF(cb=>generalReport(copy,id=>methodById(id)?.name||id,cb))}
function exportJSON(){
 const project={version:2,date:new Date().toISOString(),variableDisplay:'x',project:state.projectName,
  seed:state.seed,globalConfig:state.config,source:state.source,
  entries:state.entries.map(e=>({...e,best:state.results.get(e.id)?.best||null,
   result:state.results.get(e.id)||null,history:state.history.get(e.id)||[]}))};
 const url=URL.createObjectURL(new Blob([JSON.stringify(project)],{type:'application/json'})),a=document.createElement('a');
 a.href=url;a.download='Matefx_investigacion_'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function pointRows(){
 const source=state.source,box=$('inv-v2-point-data');if(!box||!source?.points?.length)return;
 const valid=state.entries.filter(e=>state.results.get(e.id)?.best),selector=$('inv-v2-point-method');
 const old=selector.value;
 selector.innerHTML=valid.map(e=>'<option value="'+e.id+'">'+esc(e.id+' · '+methodById(e.method).name)+'</option>').join('');
 const choice=valid.find(e=>e.id===old)||valid.find(e=>e.id===state.active)||valid[0];
 if(!choice){box.innerHTML='<p>Las observaciones aparecerán al encontrarse una ecuación.</p>';return}
 selector.value=choice.id;
 const best=state.results.get(choice.id).best,rows=source.points,perPage=120;
 state.pointPage=Math.max(0,Math.min(state.pointPage,Math.ceil(rows.length/perPage)-1));
 const start=state.pointPage*perPage,end=Math.min(rows.length,start+perPage);
 box.innerHTML='<table class="inv-v2-point-table"><thead><tr><th>Índice</th><th>x</th><th>Y observada</th><th>Y estimada</th><th>Error absoluto</th><th>Error %</th></tr></thead><tbody>'+
 rows.slice(start,end).map(([x,y],j)=>{
  const i=start+j,p=best.estimates?.[i],abs=Number.isFinite(p)?Math.abs(y-p):NaN,percentage=y!==0&&Number.isFinite(abs)?100*abs/Math.abs(y):NaN;
  return '<tr><td>'+fmt(i+1)+'</td><td>'+fmt(x)+'</td><td>'+fmt(y)+'</td><td>'+fmt(p)+'</td><td>'+fmt(abs)+'</td><td>'+pct(percentage)+'</td></tr>';
 }).join('')+'</tbody></table>';
 $('inv-v2-data-range').textContent=(start+1)+'–'+end+' de '+rows.length+' filas';
 $('inv-v2-data-back').disabled=state.pointPage===0;
 $('inv-v2-data-next').disabled=end>=rows.length;
}
function exportPointCSV(){
 const id=$('inv-v2-point-method')?.value,entry=state.entries.find(e=>e.id===id);
 if(!entry||!state.source)return;
 const best=state.results.get(entry.id)?.best;if(!best)return;
 const lines=['x,y_observada,y_estimada,error_absoluto,error_porcentual'];
 state.source.points.forEach(([x,y],i)=>{
  const p=best.estimates[i],diff=Number.isFinite(p)?Math.abs(y-p):NaN,ape=Number.isFinite(diff)&&y!==0?100*diff/Math.abs(y):NaN;
  lines.push([x,y,p,diff,ape].map(x=>Number.isFinite(x)?x:'').join(','))
 });
 const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}));
 const a=document.createElement('a');a.href=url;a.download='Matefx_'+entry.id+'_errores.csv';a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1500);
}
function renderResults(){
 const body=$('inv-v2-results'),have=state.entries.length;
 $('inv-v2-completed').textContent=state.entries.filter(e=>state.results.get(e.id)?.best).length+' / '+have+' ecuaciones';
 body.innerHTML=state.entries.map(e=>{
  const r=state.results.get(e.id)?.best,metrics=r?.metrics,hasHistory=state.history.has(e.id);
  const formatted=r?.latex?reportLatex(r.latex,r.ztex).latex:'—';
  return '<tr><td>'+esc(e.id)+'</td><td>'+esc(methodById(e.method)?.name||e.method)+'</td>'+
   '<td class="inv-latex">'+esc(formatted)+'</td><td>'+pct(metrics?.mape)+'</td><td>'+pct(metrics?.maxape)+'</td>'+
   '<td>'+fmt(r?.complexity)+'</td><td class="inv-v2-actions"><button data-see="'+e.id+'"'+(!r?' disabled':'')+'>Gráfica</button> '+
   '<button data-pdf="'+e.method+'"'+(!hasHistory||state.exporting?' disabled':'')+'>PDF individual</button></td></tr>';
 }).join('');
 body.querySelectorAll('[data-see]').forEach(el=>el.onclick=()=>{state.active=el.dataset.see;drawGraph(true);state.tab='dashboards';if(state.view==='analysis')showTab('dashboards')});
 body.querySelectorAll('[data-pdf]').forEach(el=>el.onclick=()=>individual(el.dataset.pdf));
 controls();pointRows();if(state.view==='analysis'&&state.tab==='dashboards')refreshDashboards(true);
}
async function drawGraph(force=false){
 if(!state.source)return;
 const stamp=performance.now();if(!force&&stamp-state.lastGraph<1200)return;state.lastGraph=stamp;
 const best=state.results.get(state.active)?.best||[...state.results.values()].find(v=>v.best)?.best;
 const root=$('inv-v2-preview');if(!best){root.textContent='Las gráficas de Desmos aparecerán al obtener una ecuación.';return}
 const token=++state.graphSerial;
 try{
  const spec=plotSpecifications(state.source,best,'fit');
  const img=await screenshotFromDesmos(spec,{width:1000,height:540,ratio:1.15,previewKey:'workspace'});
  if(token!==state.graphSerial||!root.isConnected)return;
  const element=new Image();element.src=img;element.alt='Gráfica del motor real Desmos con puntos y curva estimada';
  element.style.cssText='display:block;width:100%;height:auto';root.replaceChildren(element);
  $('inv-v2-preview-caption').textContent='Puntos observados (azul) y aproximación (naranja) · '+state.active;
 }catch(error){if(token===state.graphSerial&&!String(error.message).includes('anterior'))root.textContent='Desmos: '+error.message}
}
function stop(){state.worker?.terminate();state.worker=null;state.running=false;state.paused=false;controls();renderSettings()}
function finish(status){stop();renderResults();progress();drawGraph(true);refreshDashboards(true);note(status)}
function start(mode){
 if(state.running||state.exporting)return;
 const info=window.__gmrResearchSnapshot?.('y'),pts=cleanData(info?.source?.points);
 if(pts.length<5)return note('Importa primero al menos cinco puntos con coordenadas X diferentes.');
 if(!state.entries.length)return note('Selecciona al menos un método.');
 if(state.entries.some(e=>['symbolic','constrained','custom_sum','custom_product','custom_pair_plus'].includes(e.method))&&
   (!state.config.families.length||!state.config.allowedKinds.length))return note('Selecciona al menos una familia y una base para los métodos personalizados.');
 const common=methodConfig(state.config),entries=state.entries.map(e=>({...e,seed:state.seed,
  config:{...common,families:[...common.families],allowedKinds:[...(common.allowedKinds||[])]}}));
 const budget=entries.reduce((v,e)=>v+(methodById(e.method).type==='direct'?1:e.config.n),0);
 if(budget>250000&&!confirm('Son '+fmt(budget)+' intentos. Un PDF con todas las iteraciones puede ser muy grande. ¿Continuar?'))return;
 stop();state.entries=entries;state.source={...info.source,points:pts};state.project=window.__gmrActiveProject?.().id;
 state.projectName=window.__gmrActiveProject?.().name||'Investigación';state.mode=mode;
 state.running=true;state.history.clear();state.results.clear();state.active='';
 state.done=0;state.total=budget;renderSettings();controls();renderResults();progress();
 const worker=new Worker(new URL('./investigation-worker.mjs',import.meta.url),{type:'module'});state.worker=worker;
 worker.onmessage=event=>{
  if(state.worker!==worker||window.__gmrActiveProject?.().id!==state.project)return;
  const msg=event.data;
  if(msg.type==='started')note(msg.methods+' métodos · '+msg.trainCount+' puntos entrenamiento · '+msg.validationCount+' validación');
  if(msg.type==='method-start'){state.active=msg.entryId;note('Investigando: '+(methodById(msg.method)?.name||msg.method))}
  if(msg.type==='progress'){
   state.done=msg.done;const history=state.history.get(msg.entryId)||[];
   history.push(...msg.rows);state.history.set(msg.entryId,history);
   if(msg.best)state.results.set(msg.entryId,{best:msg.best,id:msg.entryId});
   if(performance.now()-state.lastTable>380){state.lastTable=performance.now();renderResults();progress();drawGraph()}
  }
  if(msg.type==='method-complete'){state.results.set(msg.entryId,msg.result);renderResults();drawGraph(true);refreshDashboards(true);progress()}
  if(msg.type==='paused'){state.paused=true;controls();note('Investigación pausada.')}
  if(msg.type==='resumed'){state.paused=false;controls();note('Investigación reanudada.')}
  if(msg.type==='warning')note('Advertencia '+msg.entryId+': '+msg.message);
  if(msg.type==='complete'){state.done=msg.done;finish('Investigación terminada.');if(mode==='automatic')general()}
  if(msg.type==='error')finish('Error: '+msg.message);
 };
 worker.onerror=e=>finish('Error en el motor: '+(e.message||'desconocido'));
 worker.postMessage({type:'start',points:pts,entries,validation:state.config.validation});
}
function showTab(tab){
 state.tab=tab;const panel=$('np-investigation-panel');panel.dataset.tab=tab;
 panel.querySelectorAll('[data-tab-target]').forEach(btn=>{
  const selected=btn.dataset.tabTarget===tab;
  btn.setAttribute('aria-selected',String(selected));btn.classList.toggle('active',selected)
 });
 if(tab==='dashboards')refreshDashboards(true);
}
function open(view){
 const panel=$('np-investigation-panel'),p=window.__gmrActiveProject?.(),s=window.__gmrResearchSnapshot?.('y');
 if(!s)return;
 if(state.project!==p?.id){
  stop();state.project=p?.id;state.projectName=p?.name||'';
  state.entries=['linear','polynomial','exponential','rational','chebyshev','symbolic','envelope'].map(entry);
  state.history.clear();state.results.clear();state.source=null;
 }
 state.source={...s.source,points:cleanData(s.source?.points)};
 state.view=view;panel.dataset.view=view;
 $('inv-v2-title').textContent=view==='analysis'?'Análisis · Métodos y resultados':'Investigación · Configuración global';
 $('inv-v2-source').textContent=state.projectName+' · '+state.source.sourceName+' · '+state.source.points.length+' observaciones';
 panel.hidden=false;showTab('methods');renderMethods();renderSettings();renderResults();drawGraph(true);
}
function setup(){
 if(!window.__gmrResearchSnapshot||!window.__nPrimosCalculator){setTimeout(setup,120);return}
 if($('np-investigation-panel'))return;
 const nav=document.createElement('nav');nav.id='mf-feature-navigation';nav.setAttribute('aria-label','Herramientas de Mate-fx');
 nav.innerHTML='<button type="button" id="np-investigation-btn">Investigación</button>'+
  '<button type="button" id="np-analysis-btn">Análisis</button>'+
  '<button type="button" id="np-data-main">Importar/Exportar Datos</button>';
 const header=document.querySelector('.top-actions')||document.querySelector('.topbar')||document.body;
 header.prepend(nav);
 const panel=document.createElement('div');panel.id='np-investigation-panel';panel.className='gmr-research-overlay inv-v2-overlay';
 panel.hidden=true;panel.dataset.view='research';panel.dataset.tab='methods';
 panel.innerHTML='<div class="gmr-research-window inv-v2-window" role="dialog" aria-modal="true" aria-label="Laboratorio de investigación">'+
 '<div class="gmr-research-heading"><div><h2 id="inv-v2-title">Investigación</h2><small id="inv-v2-source"></small></div><button id="inv-v2-close" type="button" aria-label="Cerrar">×</button></div>'+
 '<div class="inv-v2-tabs" role="tablist" aria-label="Pestañas de análisis"><button type="button" data-tab-target="methods">Métodos</button><button type="button" data-tab-target="table">Tabla</button><button type="button" data-tab-target="dashboards">Dashboards</button></div>'+
 '<div class="gmr-research-body inv-v2-layout">'+
 '<aside class="inv-v2-sidebar inv-v2-section-methods"><div class="inv-v2-sidebar-head"><h3>Selección de métodos</h3><small id="inv-v2-method-count"></small></div>'+
 '<p class="gmr-research-note">● Ajuste directo · ↻ Búsqueda iterativa</p><div id="inv-v2-methods"></div></aside>'+
 '<main class="inv-v2-main">'+
 '<section class="gmr-research-group inv-v2-section-methods"><h3>Configuración general para todos los métodos</h3><div id="inv-v2-global"></div></section>'+
 '<section class="gmr-research-group inv-v2-section-methods"><div class="inv-v2-controls">'+
 '<button id="inv-v2-start">▶ Investigar en tiempo real</button><button id="inv-v2-auto">▤ Reporte automático (PDF general)</button>'+
 '<button id="inv-v2-pause">Pausar</button><button id="inv-v2-resume">Reanudar</button><button id="inv-v2-stop">Detener</button></div>'+
 '<div class="inv-v2-progress"><progress id="inv-v2-progress" value="0" max="1"></progress><span id="inv-v2-counter">0 / 0</span></div><p id="inv-v2-status">Selecciona métodos para iniciar.</p></section>'+
 '<section class="gmr-research-group inv-v2-section-methods"><h3>Gráfica en tiempo real · Desmos</h3><div id="inv-v2-preview"></div><small id="inv-v2-preview-caption"></small></section>'+
 '<section id="inv-v2-table-section" class="gmr-research-group inv-v2-section-table"><h3>Resultados por método <small id="inv-v2-completed"></small></h3>'+
 '<p class="gmr-research-note">Cada fila permite abrir su gráfica y descargar el informe independiente de ese método. Solo el reporte general se descarga automáticamente.</p>'+
 '<div class="gmr-history"><table><thead><tr><th>ID</th><th>Método</th><th>Función LaTeX</th><th>MAPE</th><th>MaxAPE</th><th>Complejidad</th><th>Acciones</th></tr></thead><tbody id="inv-v2-results"></tbody></table></div><div class="inv-v2-raw"><h3>Tabla de observaciones y errores</h3><div class="inv-v2-data-controls"><label>Método <select id="inv-v2-point-method"></select></label><button id="inv-v2-data-back" type="button">Anterior</button><span id="inv-v2-data-range"></span><button id="inv-v2-data-next" type="button">Siguiente</button><button id="inv-v2-data-csv" type="button">Exportar errores CSV</button></div><div class="gmr-history" id="inv-v2-point-data"></div></div></section>'+
 '<section class="gmr-research-group inv-v2-section-dashboards" id="inv-dashboards"></section>'+
 '<section class="gmr-research-group inv-v2-section-downloads"><h3>Exportaciones</h3><p class="gmr-research-note">Los informes individuales están junto a las ecuaciones; aquí solo se exportan el PDF general y el historial JSON.</p>'+
 '<div class="inv-v2-controls"><button id="inv-v2-general">Descargar reporte general PDF</button><button id="inv-v2-json">Exportar investigación JSON</button></div></section>'+
 '</main></div></div>';
 document.body.append(panel);
 $('np-investigation-btn').onclick=()=>open('research');
 $('np-analysis-btn').onclick=()=>open('analysis');
 $('np-data-main').onclick=()=>{
  const legacy=document.querySelector('.gmr-data-open');
  if(!legacy){alert('Importador no disponible. Recarga el laboratorio.');return}
  legacy.click();
  const controls=document.querySelector('.gmr-data-dialog .gmr-data-controls');
  if(controls&&!document.getElementById('mf-prime-sample')){
   const button=document.createElement('button');button.id='mf-prime-sample';button.className='gmr-data-secondary';
   button.type='button';button.textContent='Activar números primos del proyecto';
   button.onclick=()=>{
    const original=document.getElementById('enablePrimesBtn');original?.click();
    const status=document.getElementById('ds-status');if(status)status.textContent='Se activaron los números primos en el proyecto. Usa el control de cantidad del laboratorio.';
   };
   controls.appendChild(button);
  }
 };
 $('inv-v2-close').onclick=()=>panel.hidden=true;
 panel.addEventListener('click',e=>{if(e.target===panel)panel.hidden=true});
 panel.querySelectorAll('[data-tab-target]').forEach(b=>b.onclick=()=>showTab(b.dataset.tabTarget));
 $('inv-v2-start').onclick=()=>start('manual');$('inv-v2-auto').onclick=()=>start('automatic');
 $('inv-v2-pause').onclick=()=>state.worker?.postMessage({type:'pause'});
 $('inv-v2-resume').onclick=()=>state.worker?.postMessage({type:'resume'});
 $('inv-v2-stop').onclick=()=>{stop();note('Detenido. Se conservan los resultados parciales.')};
 $('inv-v2-general').onclick=general;$('inv-v2-json').onclick=exportJSON;
 $('inv-v2-point-method').onchange=()=>{state.pointPage=0;pointRows()};
 $('inv-v2-data-back').onclick=()=>{state.pointPage--;pointRows()};
 $('inv-v2-data-next').onclick=()=>{state.pointPage++;pointRows()};
 $('inv-v2-data-csv').onclick=exportPointCSV;
 setupDashboards(()=>state);
 document.addEventListener('gmr:inv-select',e=>{state.active=e.detail.id;drawGraph(true)});
 window.addEventListener('gmr:project-switched',e=>{if(e.detail?.lab==='prime'){stop();state.project=null;panel.hidden=true}});
 window.addEventListener('gmr:dataset-selection',e=>{if(e.detail?.lab==='prime'&&state.running){stop();note('Investigación detenida: cambiaron los datos.') }});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
