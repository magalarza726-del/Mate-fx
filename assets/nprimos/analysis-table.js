/** nPrimos 4.3 — research results stay outside Desmos' expressions sidebar. */
import {readNumber, numericFunction, buildRows} from './analysis-core.mjs';

const $=id=>document.getElementById(id);
const calculatorReady=()=>window.__nPrimosCalculator;
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatNumber=n=>!Number.isFinite(n)?'—':Math.abs(n)>1e8||Math.abs(n)>0&&Math.abs(n)<1e-5?n.toExponential(5):n.toLocaleString('es-EC',{maximumFractionDigits:6});
const formatPercent=n=>Number.isFinite(n)?n.toLocaleString('es-EC',{minimumFractionDigits:3,maximumFractionDigits:3})+' %':'—';
const functionRegex=/^\s*((?:[a-zA-Z]|\\[a-zA-Z]+)(?:_\{[^}]+\})?)\s*(?:\\left)?\(\s*x\s*(?:\\right)?\)\s*=/;
const state={calculator:null,source:null,mode:'y',sortKey:'index',sortDir:1,order:[],filters:{},page:0,pageSize:100,raw:[],columns:[],tableKey:'',scheduled:0,known:new Set(),labelTimer:0};
const excelData={dataset:null,xColumn:'__index__',yColumn:0};
let allData=[];
let currentTableLabel='';

function definitions(){
  const list=state.calculator?.getState()?.expressions?.list || [];
  return list.filter(e=>e&&e.type==='expression'&&e.latex&&!e.secret&&!String(e.id).startsWith('__'))
    .map(e=>{const match=String(e.latex).match(functionRegex);
      return match?{id:String(e.id),name:match[1],label:match[1].replace(/_\{(\d+)\}/g,(_,n)=>String(n).replace(/0/g,'₀').replace(/1/g,'₁').replace(/2/g,'₂').replace(/3/g,'₃').replace(/4/g,'₄').replace(/5/g,'₅').replace(/6/g,'₆').replace(/7/g,'₇').replace(/8/g,'₈').replace(/9/g,'₉')).replace(/\\/g,''),latex:String(e.latex),evaluate:numericFunction(e.latex)}:null;
    }).filter(Boolean);
}

function nextOrdinal(items){
  const used=new Set();
  for(const item of items){const m=String(item.latex||'').match(/f_\{(\d+)\}\s*\(/);if(m)used.add(+m[1])}
  let i=1;while(used.has(i))i++;return i;
}
function normalizeExpressions(){
  const c=state.calculator;if(!c)return;
  const items=c.getState()?.expressions?.list||[];
  let next=nextOrdinal(items);
  for(const item of items){
    const id=String(item.id||'');if(!id||id.startsWith('__'))continue;
    if(item.type==='table' || (item.type==='expression' && item.latex && !functionRegex.test(item.latex) && !state.known.has(id))) {
      if(item.type==='table'){
        if(!item.secret){try{c.setExpression({id,secret:true})}catch(e){console.warn('No se pudo ocultar tabla en Desmos',e)}}
        state.known.add(id);continue;
      }
      const latex=String(item.latex||'').trim();
      // A parameter (a=...) remains a hidden dependency; a formula is assigned f_i(x).
      if(/^(?!y\s*=)[a-zA-Z](?:_\{[^}]+\})?\s*=/.test(latex)) {
        try{c.setExpression({id,secret:true})}catch(_){}
      }else if(latex&&!/^(?:\(|\\left\()/.test(latex)) {
        let body=latex.replace(/^y\s*=/,'');
        try{c.setExpression({id,latex:`f_{${next++}}(x)=${body}`,secret:false})}catch(_){}
      }
    }
    state.known.add(id);
  }
  updateSoon(140);
}
function storeKnown(){
  state.known=new Set((state.calculator?.getState()?.expressions?.list||[]).map(x=>String(x.id||'')));
  // Legacy tables, point lists and auxiliary parameters keep affecting the plot,
  // but the left Desmos editor displays user functions only.
  for(const e of state.calculator?.getState()?.expressions?.list||[]) {
    const nonFunction=e.type==='expression' && e.latex && !functionRegex.test(e.latex);
    if((e.type==='table'||nonFunction)&&!e.secret)
      try{state.calculator.setExpression({id:e.id,secret:true})}catch(_){}
  }
}
function updateSoon(ms=130){clearTimeout(state.scheduled);state.scheduled=setTimeout(refresh,ms)}
function currentDataset(){return excelData.dataset || null}
function primeSource(){
  const count=Math.max(0,Math.min(10000,Number.parseInt($('primeCountInput')?.value||'0',10)||0));
  const primes=window.__gmrPrimeValues?.(count)||[];
  return {points:primes.map((y,i)=>[i+1,y]),xName:'n',yName:'pₙ',sourceName:'Números primos'};
}
function dataSource(){
  if(currentDataset()){
    const {dataset,xColumn,yColumn}=excelData;
    const xi=xColumn,yi=+yColumn;
    const points=[];
    for(let i=0;i<dataset.rows.length;i++){
      const row=dataset.rows[i];
      const x=xi==='__index__'?i+1:readNumber(row[+xi]);const y=readNumber(row[yi]);
      if(Number.isFinite(x)&&Number.isFinite(y))points.push([x,y]);
    }
    return {points,xName:xi==='__index__'?'Número de fila':dataset.headers[+xi],yName:dataset.headers[yi],sourceName:dataset.filename||'Datos importados'};
  }
  if(document.body.dataset.primeProject!=='blank')return primeSource();
  return {points:[],xName:'X',yName:'Y',sourceName:'Proyecto sin datos'};
}
function columnsFor(functions,source){
  const cols=state.mode==='x'?[{key:'y',name:source.yName,role:'Y observado'},{key:'x',name:source.xName,role:'X observado'}]:[{key:'x',name:source.xName,role:'X observado'},{key:'y',name:source.yName,role:'Y observado'}];
  for(let i=0;i<functions.length;i++){
    const label=functions[i].label;
    cols.push({key:`f${i}`,name:state.mode==='x'?`${label}⁻¹(y)`:`${label}(x)`,role:`Función ${label}`,fn:i});
    cols.push({key:`e${i}`,name:'E',role:`Error absoluto · ${label}`,fn:i});
    cols.push({key:`p${i}`,name:'%E',role:`Error porcentual · ${label}`,fn:i});
  }
  return cols;
}
function getValue(row,key){
  if(key==='index')return row.index;
  if(key==='x'||key==='y')return row[key];
  const m=key.match(/^([fep])(\d+)$/),v=m&&row.values[+m[2]];
  return v?(m[1]==='f'?v.estimate:m[1]==='e'?v.error:v.percent):NaN;
}
function applyFilterAndSort(rows){
  const filters=Object.entries(state.filters).filter(([,a])=>a.min!==''||a.max!=='');
  const arr=rows.filter(row=>filters.every(([key,a])=>{
    const n=getValue(row,key);if(!Number.isFinite(n))return false;
    const min=a.min!==''?readNumber(a.min):NaN,max=a.max!==''?readNumber(a.max):NaN;
    return (!Number.isFinite(min)||n>=min)&&(!Number.isFinite(max)||n<=max);
  }));
  const key=state.sortKey,dir=state.sortDir;
  arr.sort((a,b)=>{
    const x=getValue(a,key),y=getValue(b,key);
    if(!Number.isFinite(x))return Number.isFinite(y)?1:0;
    if(!Number.isFinite(y))return -1;
    return (x-y)*dir||a.index-b.index;
  });
  return arr;
}
function buildHeader(cols){
  const head=$('primeTableBody').closest('table').querySelector('thead');
  head.replaceChildren();
  const r=document.createElement('tr'),f=document.createElement('tr');f.className='np-filters';
  for(const col of cols){
    const th=document.createElement('th');th.draggable=true;th.dataset.key=col.key;
    th.title=col.role+' · Arrastra para mover la columna';
    th.innerHTML=`<div class="np-heading"><button type="button" class="np-sort" data-sort="${col.key}" title="Ordenar esta columna">${escapeHtml(col.name)} <small>${state.sortKey===col.key?(state.sortDir===1?'▲':'▼'):'↕'}</small></button><span class="np-shift"><button type="button" data-move="-1" aria-label="Mover columna a la izquierda">‹</button><button type="button" data-move="1" aria-label="Mover columna a la derecha">›</button></span></div><div class="np-col-role">${escapeHtml(col.role)}</div>`;
    th.querySelector('.np-sort').addEventListener('click',()=>{if(state.sortKey===col.key)state.sortDir*=-1;else{state.sortKey=col.key;state.sortDir=1}state.page=0;updateSoon(0)});
    th.querySelectorAll('[data-move]').forEach(button=>button.addEventListener('click',()=>moveCol(col.key,+button.dataset.move)));
    th.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',col.key);e.dataTransfer.effectAllowed='move'});
    th.addEventListener('dragover',e=>e.preventDefault());
    th.addEventListener('drop',e=>{e.preventDefault();moveTo(e.dataTransfer.getData('text/plain'),col.key)});
    r.append(th);
    const cell=document.createElement('th');cell.className='np-filter-cell';
    const filter=state.filters[col.key]||{min:'',max:''};
    for(const type of ['min','max']){
      const inp=document.createElement('input');inp.type='text';inp.inputMode='decimal';inp.placeholder=type==='min'?'Mín.':'Máx.';
      inp.value=filter[type];inp.setAttribute('aria-label',`${type==='min'?'Mínimo':'Máximo'} para ${col.name} (${col.role})`);
      inp.addEventListener('input',()=>{state.filters[col.key]??={min:'',max:''};state.filters[col.key][type]=inp.value;state.page=0;updateSoon(190)});
      cell.append(inp);
    }
    f.append(cell);
  }
  head.append(r,f);
}
function moveCol(key,offset){
  const i=state.order.indexOf(key);if(i<0)return;
  const to=Math.min(state.order.length-1,Math.max(0,i+offset));if(to===i)return;
  state.order.splice(i,1);state.order.splice(to,0,key);state.tableKey='';updateSoon(0);
}
function moveTo(from,to){if(from===to||!state.order.includes(from)||!state.order.includes(to))return;
  const a=state.order.indexOf(from);state.order.splice(a,1);state.order.splice(state.order.indexOf(to),0,from);state.tableKey='';updateSoon(0);
}
function updateFooter(total,visible){
  const pages=Math.max(1,Math.ceil(total/state.pageSize));state.page=Math.min(state.page,pages-1);
  $('np-counter').textContent=`${total.toLocaleString('es-EC')} filas filtradas de ${visible.toLocaleString('es-EC')} · Página ${state.page+1} / ${pages}`;
  $('np-prev').disabled=state.page<=0;$('np-next').disabled=state.page>=pages-1;
}
function renderBody(rows){
  const tbody=$('primeTableBody');const start=state.page*state.pageSize;
  const frag=document.createDocumentFragment();
  for(const row of rows.slice(start,start+state.pageSize)){
    const tr=document.createElement('tr');
    for(const col of state.columns){const cell=document.createElement('td');const v=getValue(row,col.key);cell.textContent=col.key[0]==='p'&&/^p\d+$/.test(col.key)?formatPercent(v):formatNumber(v);cell.title=`${col.role}: ${Number.isFinite(v)?v:'No calculable'}`;tr.append(cell)}
    frag.append(tr);
  }
  tbody.replaceChildren(frag);
}
function refresh(){
  const live=window.__gmrGetDatasetSelection?.();
  if(live?.dataset){excelData.dataset=live.dataset;excelData.xColumn=live.xColumn;excelData.yColumn=live.yColumn}
  const panel=$('primeTablePanel');if(!panel?.classList.contains('open')||!state.calculator)return;
  const source=dataSource();
  const fns=definitions();
  const functions=fns.map(fn=>({...fn,values:[]}));
  // Evaluate supported expressions locally (including inverse roots). Unsupported
  // Desmos-only expressions show an explicit unavailable result instead of a false zero.
  const rows=buildRows(source.points,functions,state.mode);
  state.raw=rows;state.source=source;
  const cols=columnsFor(functions,source);
  const keys=cols.map(c=>c.key);
  state.order=[...state.order.filter(k=>keys.includes(k)),...keys.filter(k=>!state.order.includes(k))];
  state.columns=state.order.map(k=>cols.find(c=>c.key===k));
  const schema=state.mode+'|'+state.columns.map(c=>c.key+':'+c.name).join('|')+'|'+state.sortKey+':'+state.sortDir;
  if(schema!==state.tableKey){buildHeader(state.columns);state.tableKey=schema}
  const filtered=applyFilterAndSort(rows);updateFooter(filtered.length,rows.length);renderBody(filtered);
  $('tableSubtitle').textContent=`${source.sourceName} · ${functions.length} función(es) · Error en ${state.mode.toUpperCase()}`;
  const unsupported=functions.filter(f=>!f.evaluate);
  $('np-note').textContent=unsupported.length?`No se pueden calcular numéricamente: ${unsupported.map(f=>f.label).join(', ')}. Comprueba la sintaxis o las dependencias. No se inventan resultados.`:
    state.mode==='x'?'Error en X: se resuelve fᵢ(x̂)=Y y se calcula E=|x̂−X|; si hay varias raíces, se toma la más próxima a X.':'Error en Y: E=|fᵢ(X)−Y|. En ambos casos %E=100·E/|valor real|. Para valor real 0, %E no está definido.';
  currentTableLabel=source.sourceName;
}
function downloadAnalysis(){
  const rows=applyFilterAndSort(state.raw);const header=state.columns.map(c=>c.name);const data=[header,...rows.map(r=>state.columns.map(c=>{const v=getValue(r,c.key);return Number.isFinite(v)?(c.key[0]==='p'&&/^p\d+$/.test(c.key)?v.toFixed(3):String(v)):''}))];
  const csv='\uFEFF'+data.map(row=>row.map(v=>{const s=String(v??'');return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}).join(';')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='analisis_'+currentTableLabel.replace(/[^a-z\d_-]+/gi,'_')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function setup(){
  const calc=calculatorReady();if(!calc){setTimeout(setup,100);return}state.calculator=calc;
  const button=document.createElement('button');button.type='button';button.id='np-view-table';button.textContent='▦ Ver tabla';button.setAttribute('aria-controls','primeTablePanel');
  document.body.append(button);
  const panel=$('primeTablePanel');const header=panel?.querySelector('.panel-header h2');
  if(!panel)return;
  header.textContent='Tabla de investigación';
  const toolbar=document.createElement('div');toolbar.className='np-toolbar';toolbar.innerHTML=`
    <label>Error respecto de <select id="np-error-axis"><option value="y">Y · vertical</option><option value="x">X · horizontal</option></select></label>
    <label>Filas por página <select id="np-pages"><option>50</option><option selected>100</option><option>250</option><option>500</option><option>1000</option></select></label>
    <button type="button" id="np-clear-filters">Limpiar filtros</button>
    <button type="button" id="np-download">Exportar análisis CSV</button>`;
  const footer=document.createElement('div');footer.className='np-footer';footer.innerHTML='<span id="np-counter"></span><div><button type="button" id="np-prev">← Anterior</button><button type="button" id="np-next">Siguiente →</button></div>';
  const note=document.createElement('p');note.id='np-note';note.className='np-note';
  panel.querySelector('.panel-header').after(toolbar,note);
  panel.querySelector('.table-wrap').after(footer);
  $('tableBtn')?.classList.add('np-hide-old-table-btn');
  button.addEventListener('click',()=>{$('tableBtn')?.click();button.setAttribute('aria-expanded',String(panel.classList.contains('open')))});
  $('closeTableBtn')?.addEventListener('click',()=>button.setAttribute('aria-expanded','false'));
  $('np-error-axis').addEventListener('change',e=>{state.mode=e.target.value;state.page=0;state.tableKey='';updateSoon(0)});
  $('np-pages').addEventListener('change',e=>{state.pageSize=Number(e.target.value)||100;state.page=0;updateSoon(0)});
  $('np-clear-filters').addEventListener('click',()=>{state.filters={};state.page=0;state.tableKey='';updateSoon(0)});
  $('np-download').addEventListener('click',downloadAnalysis);
  $('np-prev').addEventListener('click',()=>{state.page--;updateSoon(0)});
  $('np-next').addEventListener('click',()=>{state.page++;updateSoon(0)});
  const obs=new MutationObserver(()=>{if(panel.classList.contains('open'))updateSoon(0)});
  obs.observe(panel,{attributes:true,attributeFilter:['class']});
  calc.observeEvent('change.gmrAnalysis',(_name,event)=>{
    if(event?.isUserInitiated){clearTimeout(state.labelTimer);state.labelTimer=setTimeout(normalizeExpressions,850)}
    updateSoon(200);
  });
  document.addEventListener('change',e=>{if(e.target?.id==='primeCountInput'||e.target?.id==='primeCountSlider')updateSoon(80)});
  window.addEventListener('gmr:dataset-selection',e=>{
    if(e.detail?.lab!=='prime')return;
    excelData.dataset=e.detail.dataset||null;
    excelData.xColumn=e.detail.xColumn??'__index__';excelData.yColumn=e.detail.yColumn??0;
    state.page=0;state.order=[];state.filters={};state.tableKey='';updateSoon(0);
  });
  window.addEventListener('gmr:project-switched',e=>{
    if(e.detail?.lab!=='prime')return;
    excelData.dataset=e.detail.dataset||null;
    state.page=0;state.order=[];state.filters={};state.tableKey='';
    setTimeout(()=>{storeKnown();updateSoon(40)},180);
  });
  window.addEventListener('gmr:analysis-refresh',()=>updateSoon(40));
  const initial=window.__gmrGetDatasetSelection?.();
  if(initial?.dataset){excelData.dataset=initial.dataset;excelData.xColumn=initial.xColumn;excelData.yColumn=initial.yColumn}
  storeKnown();updateSoon(200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();