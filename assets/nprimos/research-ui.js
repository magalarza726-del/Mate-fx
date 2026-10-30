/** Additional interactive research views for nPrimos (GitHub Pages / browser). */
import {modelToLatex} from './generator-core.mjs';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nfmt=v=>Number.isFinite(v)?v.toLocaleString('es-EC',{maximumFractionDigits:4}):'—';
const formLabel=form=>({sum:'f₁ + f₂ + f₃',product:'f₁ · f₂ · f₃',pair_plus:'f₁ · f₂ + f₃'}[form]||'Suma (versión anterior)');
const familyNames={logarithmic:'Logarítmicas',exponential:'Exponenciales',polynomial:'Polinómicas',trigonometric:'Trigonométricas'};
const colors=['#2672ba','#e47c37','#269767','#aa51b3','#dd4e68','#e2af32','#31465e','#26a8b5','#a47c35'];
const state={project:'',history:[],best:null,worker:null,running:false,paused:false,done:0,total:0,seriesSelected:new Set(['y']),axis:'x',errorAxis:'y',chartType:'line',normalize:false,ranges:[],currentPoints:[],startedProject:'',pendingWrites:Promise.resolve(),hasStartedRun:false};
const snapshot=()=>window.__gmrResearchSnapshot?.(state.errorAxis)||null;
const project=()=>window.__gmrActiveProject?.()||{id:'default',name:'Investigación'};
function newButton(id,title,color){const b=document.createElement('button');b.id=id;b.type='button';b.textContent=title;document.body.appendChild(b);return b}
function dialog(id,title){
  const root=document.createElement('div');root.className='gmr-research-overlay';root.id=id;root.hidden=true;
  root.innerHTML=`<div class="gmr-research-window" role="dialog" aria-modal="true" aria-label="${safe(title)}"><div class="gmr-research-heading"><div><h2>${safe(title)}</h2><small id="${id}-source"></small></div><button type="button" aria-label="Cerrar">×</button></div><div class="gmr-research-body"></div></div>`;
  root.querySelector('.gmr-research-heading button').onclick=()=>{root.hidden=true};
  root.addEventListener('click',e=>{if(e.target===root)root.hidden=true});document.body.append(root);return root;
}
function chartSeries(snap){
  const available=[{key:'x',name:snap.source.xName+' (real)',get:r=>r.x},{key:'y',name:snap.source.yName+' (real)',get:r=>r.y}];
  snap.functions.forEach((fn,i)=>{
    available.push({key:'f'+i,name:fn.label+(state.errorAxis==='x'?'⁻¹(Y) (calculado)':'(X) (calculado)'),get:r=>r.values[i]?.estimate});
    available.push({key:'e'+i,name:'E en '+state.errorAxis.toUpperCase()+' de '+fn.label,get:r=>r.values[i]?.error});
    available.push({key:'p'+i,name:'%E en '+state.errorAxis.toUpperCase()+' de '+fn.label,get:r=>r.values[i]?.percent});
  });return available;
}
function chartView(){
  const snap=snapshot(),root=$('np-dashboard-panel');if(!snap)return;
  root.querySelector('[id$="-source"]').textContent=snap.source.sourceName+' · '+snap.source.points.length+' observaciones';
  const cols=chartSeries(snap),keys=new Set(cols.map(c=>c.key));state.seriesSelected=new Set([...state.seriesSelected].filter(k=>keys.has(k)));
  if(!state.seriesSelected.size)state.seriesSelected.add('y');
  const list=$('gmr-chart-series');list.replaceChildren();
  for(const [i,col] of cols.entries()){
    const label=document.createElement('label');const check=document.createElement('input');check.type='checkbox';check.checked=state.seriesSelected.has(col.key);
    check.onchange=()=>{if(check.checked)state.seriesSelected.add(col.key);else state.seriesSelected.delete(col.key);drawChart()};
    label.append(check,document.createTextNode(col.name));list.append(label);
  }
  const axis=$('gmr-chart-x');axis.replaceChildren();
  for(const [key,label] of [['x',snap.source.xName],['y',snap.source.yName],['index','N.º de fila']]){const o=new Option(label,key);axis.add(o)}axis.value=state.axis;
  drawChart();
}
function drawChart(){
  const snap=snapshot(),canvas=$('gmr-dashboard-canvas');if(!snap||!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1),W=Math.max(300,canvas.clientWidth),H=Math.max(250,canvas.clientHeight);
  canvas.width=Math.round(W*dpr);canvas.height=Math.round(H*dpr);ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
  const cols=chartSeries(snap).filter(c=>state.seriesSelected.has(c.key));
  const selected=snap.rows.map((row,i)=>({x:state.axis==='index'?i+1:state.axis==='y'?row.y:row.x,vals:cols.map(c=>c.get(row))}));
  const minInput=$('gmr-chart-min')?.value,maxInput=$('gmr-chart-max')?.value;
  const min=minInput!==''?Number(minInput):-Infinity,max=maxInput!==''?Number(maxInput):Infinity;
  const filtered=selected.filter(r=>Number.isFinite(r.x)&&r.x>=min&&r.x<=max).sort((a,b)=>a.x-b.x);
  const step=Math.max(1,Math.ceil(filtered.length/2200)),points=filtered.filter((_,i)=>i%step===0||i===filtered.length-1);
  const all=points.flatMap(r=>r.vals.filter(v=>Number.isFinite(v))),xs=points.map(r=>r.x);
  const info=$('gmr-chart-status');if(!cols.length||!points.length||!all.length){ctx.fillStyle='#64748b';ctx.font='15px system-ui';ctx.fillText('Selecciona al menos una serie con valores numéricos.',25,42);info.textContent='No hay datos graficables para la selección actual.';return}
  const margin={left:78,right:24,top:26,bottom:52},plotW=W-margin.left-margin.right,plotH=H-margin.top-margin.bottom;
  let xmin=Math.min(...xs),xmax=Math.max(...xs);if(xmax===xmin){xmin-=1;xmax+=1}
  const ranges=cols.map((_,j)=>{const v=points.map(r=>r.vals[j]).filter(Number.isFinite);return {min:Math.min(...v),max:Math.max(...v)}});
  let ymin=state.normalize?0:Math.min(...all),ymax=state.normalize?100:Math.max(...all);
  if(ymax===ymin){ymin-=1;ymax+=1}const pad=(ymax-ymin)*.06;ymin-=pad;ymax+=pad;
  const sx=x=>margin.left+(x-xmin)/(xmax-xmin)*plotW,sy=y=>margin.top+plotH-(y-ymin)/(ymax-ymin)*plotH;
  ctx.strokeStyle='#e5ecf3';ctx.lineWidth=1;ctx.font='11px system-ui';ctx.fillStyle='#53657d';
  for(let k=0;k<=5;k++){
    const x=margin.left+plotW*k/5,y=margin.top+plotH*k/5;
    ctx.beginPath();ctx.moveTo(x,margin.top);ctx.lineTo(x,margin.top+plotH);ctx.stroke();
    ctx.beginPath();ctx.moveTo(margin.left,y);ctx.lineTo(margin.left+plotW,y);ctx.stroke();
    ctx.fillText(nfmt(xmin+(xmax-xmin)*k/5),x-14,H-28);
    ctx.fillText(nfmt(ymax-(ymax-ymin)*k/5),10,y+4);
  }
  cols.forEach((col,j)=>{
    ctx.strokeStyle=colors[j%colors.length];ctx.fillStyle=colors[j%colors.length];ctx.lineWidth=2.2;
    let started=false;ctx.beginPath();
    const range=ranges[j];
    for(const r of points){
      const raw=r.vals[j];if(!Number.isFinite(raw)){started=false;continue}
      const y=state.normalize?(range.max===range.min?50:100*(raw-range.min)/(range.max-range.min)):raw;
      const xpix=sx(r.x),ypix=sy(y);
      if(state.chartType==='scatter'){ctx.beginPath();ctx.arc(xpix,ypix,Math.max(1.7,Math.min(3.8,50/Math.sqrt(points.length))),0,Math.PI*2);ctx.fill()}
      else if(!started){ctx.moveTo(xpix,ypix);started=true}
      else ctx.lineTo(xpix,ypix);
    }
    if(state.chartType!=='scatter')ctx.stroke();
  });
  const legend=$('gmr-chart-legend');legend.replaceChildren();cols.forEach((col,i)=>{
    const sp=document.createElement('span'),swatch=document.createElement('i');swatch.style.background=colors[i%colors.length];sp.append(swatch,document.createTextNode(col.name));legend.append(sp);
  });
  info.textContent=`${filtered.length.toLocaleString('es-EC')} filas · ${cols.length} series`+(state.normalize?' · Cada serie se normaliza por separado a 0–100 %':'');
}
function setupChart(){
  const box=dialog('np-dashboard-panel','Dash Boards · Investigación matemática');
  box.querySelector('.gmr-research-body').innerHTML=`<div class="gmr-research-grid"><section class="gmr-research-side">
    <div class="gmr-research-group"><strong>Columnas para comparar</strong><div id="gmr-chart-series" class="gmr-series-list"></div></div>
    <div class="gmr-research-group"><strong>Ejes y representación</strong><label>Error respecto de <select id="gmr-chart-error-axis"><option value="y">Y · vertical</option><option value="x">X · horizontal</option></select></label><label>Eje X <select id="gmr-chart-x"></select></label><label>Gráfico <select id="gmr-chart-type"><option value="line">Líneas</option><option value="scatter">Dispersión</option></select></label><label><span>Normalizar series 0–100 %</span><input id="gmr-chart-normalize" type="checkbox"></label></div>
    <div class="gmr-research-group"><strong>Filtrar eje horizontal</strong><label>Mínimo <input type="number" step="any" id="gmr-chart-min" placeholder="Todos"></label><label>Máximo <input type="number" step="any" id="gmr-chart-max" placeholder="Todos"></label></div>
    <button id="gmr-chart-png" class="gmr-research-btn">Exportar gráfico PNG</button></section>
    <section class="gmr-chart-wrap"><canvas id="gmr-dashboard-canvas" role="img" aria-label="Gráfico comparativo de datos y errores"></canvas><div id="gmr-chart-legend" class="gmr-legend"></div><p id="gmr-chart-status" class="gmr-research-note"></p></section></div>`;
  $('gmr-chart-x').onchange=e=>{state.axis=e.target.value;drawChart()};
  $('gmr-chart-error-axis').onchange=e=>{state.errorAxis=e.target.value;chartView()};
  $('gmr-chart-type').onchange=e=>{state.chartType=e.target.value;drawChart()};
  $('gmr-chart-normalize').onchange=e=>{state.normalize=e.target.checked;drawChart()};
  for(const id of ['gmr-chart-min','gmr-chart-max'])$(id).addEventListener('input',drawChart);
  $('gmr-chart-png').onclick=()=>{const a=document.createElement('a');a.download='dashboard_mate_fx.png';a.href=$('gmr-dashboard-canvas').toDataURL('image/png');a.click()};
  new ResizeObserver(()=>{if(!box.hidden)drawChart()}).observe($('gmr-dashboard-canvas'));
  newButton('np-dashboard-btn','▤ Ver Dash Boards').onclick=()=>{box.hidden=false;chartView()};
}
function openDatabase(){return new Promise(resolve=>{try{
  const req=indexedDB.open('gmr-generador-funciones',1);
  req.onupgradeneeded=()=>{const db=req.result;const store=db.createObjectStore('functions',{keyPath:['project','iteration']});store.createIndex('project','project')};
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);
}catch{resolve(null)}})}
const dbPromise=typeof indexedDB==='undefined'?Promise.resolve(null):openDatabase();
async function persistBatch(batch,projectId){
  if(!batch.length)return;const db=await dbPromise;if(!db){try{const k='gmr:functions:'+projectId;const all=JSON.parse(localStorage.getItem(k)||'[]');localStorage.setItem(k,JSON.stringify([...all,...batch.map(a=>({...a,project:projectId}))]))}catch{}return}
  return new Promise(resolve=>{const tx=db.transaction('functions','readwrite');const store=tx.objectStore('functions');for(const row of batch)store.put({...row,project:projectId});tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()});
}
async function loadHistory(projectId){
  const db=await dbPromise;if(!db){try{return JSON.parse(localStorage.getItem('gmr:functions:'+projectId)||'[]')}catch{return []}}
  return new Promise(resolve=>{const tx=db.transaction('functions','readonly');const req=tx.objectStore('functions').index('project').getAll(IDBKeyRange.only(projectId));req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>resolve([])});
}
function intervalRow(min='',max=''){
  const line=document.createElement('div');line.className='gmr-segment';line.innerHTML=`<span>Desde</span><input aria-label="Desde X" type="number" step="any" value="${safe(min)}"><span>hasta</span><input aria-label="Hasta X" type="number" step="any" value="${safe(max)}"><button type="button" title="Eliminar tramo">×</button>`;
  line.querySelector('button').onclick=()=>line.remove();$('gmr-intervals').append(line);
}
function segmentConfig(){return [...document.querySelectorAll('#gmr-intervals .gmr-segment')].map(row=>{const inputs=row.querySelectorAll('input');return {min:Number(inputs[0].value),max:Number(inputs[1].value)}})}
function historyRows(){
  const body=$('gmr-gen-history');body.replaceChildren();
  const sorted=[...state.history].sort((a,b)=>a.mape-b.mape).slice(0,80);
  const nSegments=Math.max(segmentConfig().length,...state.history.map(h=>(h.ranges||[]).length),0);
  $('gmr-gen-count').textContent=state.history.length.toLocaleString('es-EC')+' funciones válidas guardadas';
  for(const h of sorted){
    const tr=document.createElement('tr');const cells=[h.iteration,h.decimals??'—',h.maxInteger??'—',formLabel(h.composition),(h.families||[]).map(f=>familyNames[f]||f).join(', ')||'Todas',nfmt(h.mape)+' %',...Array.from({length:nSegments},(_,i)=>{const r=h.ranges?.[i],v=h.perRange?.[i];return r?(nfmt(r.min)+'–'+nfmt(r.max)+': '+(v==null?'—':nfmt(v)+' %')):'—'}),h.latex];
    for(const v of cells){const td=document.createElement('td');td.textContent=String(v);tr.append(td)}
    const action=document.createElement('td');const b=document.createElement('button');b.className='gmr-apply';b.textContent='Añadir a Desmos';b.onclick=()=>applyToDesmos(h.latex);action.append(b);tr.append(action);body.append(tr);
  }
  const head=$('gmr-gen-history-head');head.replaceChildren();['Iteración','Decimales','Límite entero','Estructura','Tendencias','MAPE global',...Array.from({length:nSegments},(_,i)=>`Tramo ${i+1} (X / %E)`),'Función','Acción'].forEach(label=>{const th=document.createElement('th');th.textContent=label;head.append(th)});
}
function showGenStatus(label){
  $('gmr-gen-status').textContent=label;$('gmr-gen-progress').value=state.done;
  $('gmr-gen-progress').max=Math.max(1,state.total);
  $('gmr-gen-progress-label').textContent=state.done+' / '+state.total;
  $('gmr-gen-start').disabled=state.running;
  $('gmr-gen-pause').disabled=!state.running||state.paused;
  $('gmr-gen-resume').disabled=!state.running||!state.paused;
  if(state.best){$('gmr-gen-best').innerHTML=`<strong>Mejor función encontrada · error medio ${safe(nfmt(state.best.mape))} %</strong><div><code>${safe(state.best.latex)}</code></div><button class="gmr-research-btn success" id="gmr-gen-apply-best" type="button">Añadir mejor a Desmos</button>`;
    $('gmr-gen-apply-best').onclick=()=>applyToDesmos(state.best.latex);
  }else{$('gmr-gen-best').textContent=state.running?'Buscando la primera función válida de esta generación…':'Todavía no hay una función ganadora en esta generación.';}
}
function applyToDesmos(latex){
  const calc=window.__nPrimosCalculator;if(!calc)return;
  const list=calc.getExpressions?.()||calc.getState()?.expressions?.list||[];
  const used=new Set(list.map(e=>String(e.latex||'').match(/f_\{(\d+)\}\s*\(/)?.[1]).filter(Boolean).map(Number));let n=1;while(used.has(n))n++;
  const id='gmr_generated_'+Date.now()+'_'+n;
  calc.setExpression({id,latex:`f_{${n}}(x)=${latex}`,color:'#21895d'});
  window.__gmrSaveNPrimos?.();window.dispatchEvent(new Event('gmr:analysis-refresh'));
  $('gmr-gen-status').textContent=`Función f₍${n}₎ añadida al gráfico y a la tabla de errores.`;
}
function exportHistory(){
  const count=Math.max(segmentConfig().length,...state.history.map(h=>(h.ranges||[]).length),0);
  const heads=['iteracion','decimales_maximos','limite_parte_entera','forma_funcion','tendencias_habilitadas','MAPE_global_%',...Array.from({length:count},(_,i)=>['tramo_'+(i+1)+'_x_min','tramo_'+(i+1)+'_x_max','tramo_'+(i+1)+'_MAPE_%']).flat(),'funcion_latex'];
  const rows=[heads,...state.history.map(item=>[item.iteration,item.decimals??'',item.maxInteger??'',item.composition||'sum',(item.families||[]).join('|'),item.mape,...Array.from({length:count},(_,i)=>[item.ranges?.[i]?.min??'',item.ranges?.[i]?.max??'',item.perRange?.[i]??'']).flat(),item.latex])];
  const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.download='historial_funciones_'+state.project+'.csv';a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function refreshProjectHistory(){
  const p=project();state.project=p.id;
  const snapshotId=p.id,history=await loadHistory(p.id);if(project().id!==snapshotId)return;
  state.history=history;if(!state.hasStartedRun)state.best=history.filter(a=>Number.isFinite(a.mape)).sort((a,b)=>a.mape-b.mape)[0]||null;
  historyRows();showGenStatus('Proyecto: '+p.name);
}
function stopGenerator(){if(state.worker){state.worker.terminate();state.worker=null}state.running=false;state.paused=false}
function runGenerator(){
  const snap=snapshot();if(!snap||snap.source.points.length<5){showGenStatus('Importa una tabla con al menos 5 puntos válidos antes de iniciar.');return}
  const ranges=segmentConfig();if(!ranges.length||ranges.some(r=>!Number.isFinite(r.min)||!Number.isFinite(r.max)||r.min>r.max)){showGenStatus('Revisa los tramos: mínimo debe ser menor o igual al máximo.');return}
  const families=[...document.querySelectorAll('.gmr-gen-family:checked')].map(ch=>ch.value);
  if(!families.length){showGenStatus('Selecciona al menos una tendencia: logarítmica, exponencial, polinómica o trigonométrica.');return}
  const composition=document.querySelector('input[name="gmr-gen-composition"]:checked')?.value||'sum';
  if(composition==='pair_plus'&&Number($('gmr-gen-terms').value)<3){showGenStatus('La estructura f₁·f₂ + f₃ necesita exactamente tres términos.');return}
  const config={n:Math.max(1,Math.min(100000,Number($('gmr-gen-n').value)||100)),generational:$('gmr-gen-learning').checked,maxTerms:Number($('gmr-gen-terms').value),maxX:Number($('gmr-gen-xs').value),constant:$('gmr-gen-c').checked,decimals:Number($('gmr-gen-decimals').value),maxInteger:Number($('gmr-gen-max-integer').value),families,composition,ranges};
  stopGenerator();const thisProject=project().id;state.startedProject=thisProject;state.done=0;state.total=config.n;state.running=true;state.paused=false;state.best=null;state.hasStartedRun=true;
  // Preserve prior runs in the history, but evaluate 'best' only for this run.
  state.worker=new Worker(new URL('./generator-worker.mjs',import.meta.url),{type:'module'});
  const worker=state.worker;
  worker.onmessage=event=>{
    if(worker!==state.worker||state.startedProject!==project().id)return;
    const data=event.data;
    if(data.type==='progress'){
      state.done=data.done;
      const items=data.batch.map(h=>({...h,iteration:h.iteration+iterationOffset}));
      state.history.push(...items);
      // Persist each completed batch under this run's stable project and iteration IDs.
      state.pendingWrites=state.pendingWrites.then(()=>persistBatch(items,thisProject));
      if(data.best&&(!state.best||data.best.mape<state.best.mape))state.best={...data.best,iteration:data.best.iteration+iterationOffset};
      showGenStatus('Buscando funciones…');historyRows();
    }else if(data.type==='complete'){state.done=data.done;state.running=false;state.paused=false;showGenStatus('Finalizado: '+data.done+' iteraciones.');worker.terminate();if(state.worker===worker)state.worker=null}
    else if(data.type==='paused'){showGenStatus('Pausado · puedes reanudar la búsqueda.')}
  };
  const iterationOffset=state.history.reduce((max,r)=>Math.max(max,r.iteration||0),0);
  worker.onerror=e=>{showGenStatus('Error en el motor: '+(e.message||'desconocido'));stopGenerator()};
  worker.postMessage({type:'start',points:snap.source.points,config});showGenStatus('Iniciando generación…');
}
function setupGenerator(){
  const box=dialog('np-generator-panel','Generador de funciones');
  box.querySelector('.gmr-research-body').innerHTML=`<div class="gmr-research-group"><strong>Configuración de búsqueda</strong><div class="gmr-generator-settings">
    <label>N.º de iteraciones (n) <input type="number" id="gmr-gen-n" min="1" max="100000" value="1000"></label>
    <label>Máximo de términos <select id="gmr-gen-terms"><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option></select></label>
    <label>Máximo de x por término <select id="gmr-gen-xs"><option value="1">1</option><option value="2" selected>2</option></select></label>
    <label>Aprendizaje generacional <input type="checkbox" id="gmr-gen-learning" checked></label>
    <label>Permitir constante +c <input type="checkbox" id="gmr-gen-c" checked></label>
  </div><p class="gmr-research-note">Estructura: h₁(x) + h₂(x) + h₃(x) + c. Cada hᵢ contiene 1–2 apariciones de x, independientemente del número de términos. Los coeficientes y parámetros se redondean al máximo de decimales elegido ANTES de evaluar y guardar cada función; los datos y errores mantienen su precisión original. Se ajustan los coeficientes por mínimos cuadrados y se compara el error relativo medio en Y (MAPE). Las filas con Y=0 no permiten porcentaje y se excluyen del promedio.</p></div>

  <div class="gmr-research-group"><strong>Preferencia de tendencias (elige una o varias)</strong><div class="gmr-family-choices">
    <label><input type="checkbox" class="gmr-gen-family" value="logarithmic" checked> Logarítmicas</label>
    <label><input type="checkbox" class="gmr-gen-family" value="exponential" checked> Exponenciales</label>
    <label><input type="checkbox" class="gmr-gen-family" value="polynomial" checked> Polinómicas</label>
    <label><input type="checkbox" class="gmr-gen-family" value="trigonometric" checked> Trigonométricas</label>
  </div><p class="gmr-research-note">Solo se utilizan términos de las familias seleccionadas. Polinómicas: potencias enteras de x; x·ln(x) pertenece a logarítmicas, x·sin(kx) a trigonométricas.</p></div>
  <div class="gmr-research-group"><strong>Forma de la función mayor</strong><div class="gmr-composition-choices" role="radiogroup" aria-label="Forma de la función mayor">
    <label><input type="radio" name="gmr-gen-composition" value="sum" checked> f(x) = f₁(x) + f₂(x) + f₃(x)</label>
    <label><input type="radio" name="gmr-gen-composition" value="product"> f(x) = f₁(x) · f₂(x) · f₃(x)</label>
    <label><input type="radio" name="gmr-gen-composition" value="pair_plus"> f(x) = f₁(x) · f₂(x) + f₃(x)</label>
  </div><p class="gmr-research-note">Suma y producto respetan el máximo de 1 a 3 términos. La forma mixta requiere tres términos. Con constante activada se añade +c al resultado final. Cada producto tiene un factor de escala ajustado por mínimos cuadrados.</p></div>
  <div class="gmr-research-group"><strong>Tramos editables de X (para error relativo promedio)</strong><div id="gmr-intervals" class="gmr-segments"></div><button class="gmr-research-btn secondary" type="button" id="gmr-add-interval">＋ Añadir tramo</button></div>
  <div class="gmr-research-group"><strong>Límites de los números generados</strong>
  <div class="gmr-generator-settings gmr-numeric-settings">
  <label>Decimales máximos <select id="gmr-gen-decimals"><option value="0">0 · enteros</option><option value="1">1 decimal</option><option value="2">2 decimales</option><option value="3" selected>3 decimales</option></select></label>
  <label>Magnitud máxima (parte entera) <select id="gmr-gen-max-integer"><option value="9">Unidades (0–9)</option><option value="99">Decenas (0–99)</option><option value="999">Centenas (0–999)</option><option value="9999" selected>Miles (0–9999)</option></select></label>
  </div><p class="gmr-research-note">El límite se aplica a coeficientes, exponentes, factores internos y constante; también a números negativos por su valor absoluto. Los valores observados y el cálculo de error conservan su precisión original.</p>
  <div class="gmr-research-buttons"><button class="gmr-research-btn success" id="gmr-gen-start">Iniciar n iteraciones</button><button class="gmr-research-btn secondary" id="gmr-gen-pause">Pausar</button><button class="gmr-research-btn secondary" id="gmr-gen-resume">Reanudar</button><button class="gmr-research-btn danger" id="gmr-gen-stop">Detener</button><button class="gmr-research-btn" id="gmr-gen-export">Exportar historial CSV</button></div><div class="gmr-status-line" style="margin-top:12px"><progress id="gmr-gen-progress" max="1" value="0"></progress><span id="gmr-gen-progress-label">0 / 0</span><strong id="gmr-gen-status">Listo</strong></div></div>
  <div id="gmr-gen-best" class="gmr-best">Todavía no hay una función ganadora.</div><div class="gmr-research-group"><strong>Historial · mejores funciones</strong><small id="gmr-gen-count"></small><div class="gmr-history"><table><thead><tr id="gmr-gen-history-head"></tr></thead><tbody id="gmr-gen-history"></tbody></table></div><p class="gmr-research-note">Se muestran las 80 funciones de menor error. El historial completo se conserva por proyecto en el navegador y se puede exportar en CSV.</p></div>`;
  const points=snapshot()?.source?.points||[],xs=points.map(p=>p[0]);const min=xs.length?Math.min(...xs):0,max=xs.length?Math.max(...xs):100;
  const delta=(max-min)/3;for(let i=0;i<3;i++)intervalRow(+(min+i*delta).toPrecision(6),+(i===2?max:min+(i+1)*delta).toPrecision(6));
  $('gmr-add-interval').onclick=()=>intervalRow(min,max);
  const termsField=$('gmr-gen-terms');
  const syncComposition=()=>{
    const pair=document.querySelector('input[name="gmr-gen-composition"]:checked')?.value==='pair_plus';
    if(pair)termsField.value='3';
    termsField.disabled=pair;
    termsField.title=pair?'La composición f₁·f₂ + f₃ requiere 3 términos.':'';
  };
  document.querySelectorAll('input[name="gmr-gen-composition"]').forEach(input=>input.addEventListener('change',syncComposition));
  syncComposition();
  $('gmr-gen-start').onclick=runGenerator;
  $('gmr-gen-pause').onclick=()=>{if(state.worker&&state.running){state.worker.postMessage({type:'pause'});state.paused=true;showGenStatus('Pausa solicitada…')}};
  $('gmr-gen-resume').onclick=()=>{if(state.worker&&state.running){state.worker.postMessage({type:'resume'});state.paused=false;showGenStatus('Reanudando…')}};
  $('gmr-gen-stop').onclick=()=>{stopGenerator();showGenStatus('Detenido manualmente.')};
  $('gmr-gen-export').onclick=exportHistory;
  newButton('np-generator-btn','⚙ Generador de funciones').onclick=()=>{box.hidden=false;if(!state.running)refreshProjectHistory()};
  window.addEventListener('gmr:project-switched',e=>{if(e.detail?.lab!=='prime')return;stopGenerator();state.history=[];state.best=null;state.hasStartedRun=false;state.done=0;state.total=0;refreshProjectHistory()});
  window.addEventListener('gmr:dataset-selection',e=>{if(e.detail?.lab==='prime'&&!state.running){const snap=snapshot(),xs=snap?.source.points.map(p=>p[0])||[];if(xs.length){$('gmr-intervals').replaceChildren();const lo=Math.min(...xs),hi=Math.max(...xs),d=(hi-lo)/3;for(let i=0;i<3;i++)intervalRow(+(lo+i*d).toPrecision(6),+(i===2?hi:lo+(i+1)*d).toPrecision(6))}}});
  refreshProjectHistory();
}
function setup(){if(!window.__nPrimosCalculator||!window.__gmrResearchSnapshot){setTimeout(setup,120);return}setupChart();setupGenerator()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();