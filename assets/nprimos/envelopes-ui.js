/** Independent Exponential Envelope Lab for nPrimos; deliberately separate from the existing generator. */
import {centerValue,envelopeValues,expressionFor} from './envelope-core.mjs';
const $=id=>document.getElementById(id);
const num=v=>Number.isFinite(v)?v.toLocaleString('es-EC',{maximumFractionDigits:3}):'—';
const state={worker:null,project:null,running:false,paused:false,n:0,done:0,best:[],history:[],groups:[],lastProgress:0};
const current=()=>window.__gmrActiveProject?.()||{id:'default',name:'Investigación'};
const snap=()=>window.__gmrResearchSnapshot?.('y');
const storeKey=id=>'gmr:envelope-history:'+id;
function stop(){state.worker?.terminate();state.worker=null;state.running=false;state.paused=false}
function save(){try{localStorage.setItem(storeKey(state.project),JSON.stringify(state.history.slice(-250)))}catch(err){console.warn('Historial de envolventes no guardado',err)}}
function load(){try{state.history=JSON.parse(localStorage.getItem(storeKey(state.project))||'[]')}catch{state.history=[]}drawHistory()}
function rangesFromGenerator(){return [...document.querySelectorAll('#gmr-intervals .gmr-segment')].map(el=>{
  const v=el.querySelectorAll('input');return {min:Number(v[0]?.value),max:Number(v[1]?.value)}
}).filter(r=>Number.isFinite(r.min)&&Number.isFinite(r.max)&&r.max>r.min)}
function parts(points){
  const data=points.filter(p=>Number.isFinite(+p[0])&&Number.isFinite(+p[1])).map(p=>[+p[0],+p[1]]).sort((a,b)=>a[0]-b[0]);
  if($('env-scope').value==='global')return [{range:{min:data[0]?.[0],max:data[data.length-1]?.[0]},points:data}];
  const r=rangesFromGenerator();if(!r.length)throw Error('Primero configura los tramos X en el Generador de funciones.');
  return r.map((range,i)=>({range,points:data.filter(([x])=>x>=range.min&&(i===r.length-1?x<=range.max:x<range.max))}));
}
function buildExpression(model,type,domain,variable){
  const expr=expressionFor(model,type);
  if(!domain||!Number.isFinite(domain.min)||!Number.isFinite(domain.max))return `${variable}(x)=${expr}`;
  const a=domain.min,b=domain.max;
  return `${variable}(x)=${expr}\\left\\{${a}\\le x\\le ${b}\\right\\}`;
}
function putInDesmos(result,segmentIndex){
  const calc=window.__nPrimosCalculator;if(!calc){window.alert('Desmos no está disponible.');return}
  const expressions=calc.getExpressions?.()||calc.getState?.()?.expressions?.list||[];
  const used=new Set(expressions.map(e=>String(e.latex||'').match(/^f_\{(\d+)\}\s*\(/)?.[1]).filter(Boolean).map(Number));
  let i=1;while(used.has(i))i++;
  const token=Date.now()+'_'+segmentIndex;
  const [l,u,m]=[`L_{${i}}`,`U_{${i}}`,`f_{${i}}`];
  const domain=result.scope==='sections'?result.range:null;
  for(const [type,name,color] of [['lower',l,'#cc5a45'],['upper',u,'#2b9366'],['center',m,'#2d6bcb']]){
    calc.setExpression({id:'gmr-envelope-'+token+'-'+type,latex:buildExpression(result,type,domain,name),color});
  }
  window.__gmrSaveNPrimos?.();window.dispatchEvent(new Event('gmr:analysis-refresh'));
  $('env-status').textContent='Cotas y función central añadidas a Desmos para el tramo '+(segmentIndex+1)+'.';
}
function close(){$('np-envelope-panel').hidden=true}
function showStatus(text){
  $('env-status').textContent=text;$('env-progress').max=Math.max(1,state.n);$('env-progress').value=state.done;
  $('env-progress-label').textContent=state.done.toLocaleString('es-EC')+' / '+state.n.toLocaleString('es-EC');
  $('env-start').disabled=state.running;$('env-pause').disabled=!state.running||state.paused;
  $('env-resume').disabled=!state.running||!state.paused;
}
function drawHistory(){
  const body=$('env-history');if(!body)return;body.replaceChildren();
  $('env-history-count').textContent=state.history.length+' mejoras conservadas (últimas 250)';
  const sorted=[...state.history].sort((a,b)=>a.rank-b.rank).slice(0,70);
  for(const h of sorted){
    const tr=document.createElement('tr');
    for(const val of [h.iteration,h.part+1,h.method,num(h.mape)+' %',num(h.meanWidth)+' %',h.aL,h.aU,h.pL+'/'+h.scale,h.pU+'/'+h.scale]){
      const td=document.createElement('td');td.textContent=val;tr.append(td);
    }
    const td=document.createElement('td'),btn=document.createElement('button');btn.type='button';btn.textContent='A Desmos';btn.onclick=()=>putInDesmos(h,h.part);td.append(btn);tr.append(td);body.append(tr);
  }
}
function drawResult(){
  const root=$('env-results');root.replaceChildren();
  if(!state.best.some(Boolean)){root.textContent='Todavía no hay cotas válidas. Una búsqueda puede terminar sin resultados bajo límites demasiado estrictos.';drawGraph();return}
  state.best.forEach((m,i)=>{
    if(!m)return;
    const card=document.createElement('div');card.className='env-best-card';
    const h=document.createElement('h3');h.textContent=`Tramo ${i+1} · ${num(m.range.min)} a ${num(m.range.max)}`;card.append(h);
    const p=document.createElement('p');p.textContent=`Centro: ${({arithmetic:'aritmético',geometric:'geométrico',harmonic:'armónico'})[m.method]} · MAPE ${num(m.mape)} % · amplitud relativa media ${num(m.meanWidth)} % · ${m.count} puntos`;card.append(p);
    for(const [name,type] of [['Cota inferior','lower'],['Cota superior','upper'],['Centro','center']]){
      const code=document.createElement('code');code.textContent=name+': '+expressionFor(m,type);card.append(code);
    }
    const btn=document.createElement('button');btn.className='gmr-research-btn success';btn.textContent='Añadir las tres curvas a Desmos';btn.onclick=()=>putInDesmos(m,i);card.append(btn);root.append(card);
  });drawGraph();
}
function drawGraph(){
  const canvas=$('env-preview'),snapData=snap();if(!canvas||!snapData)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const W=Math.max(300,canvas.clientWidth||850),H=canvas.clientHeight||290,dpr=Math.min(2,devicePixelRatio||1);
  canvas.width=W*dpr;canvas.height=H*dpr;ctx.scale(dpr,dpr);ctx.clearRect(0,0,W,H);
  const points=snapData.source.points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1]));
  if(!points.length)return;
  let xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const xlo=Math.min(...xs),xhi=Math.max(...xs);let ylo=Math.min(0,...ys),yhi=Math.max(...ys);
  for(const r of state.best.filter(Boolean))for(let t=0;t<=30;t++){
    const x=r.range.min+(r.range.max-r.range.min)*t/30;const [l,u]=envelopeValues(r,x);
    if(Number.isFinite(l)&&Number.isFinite(u)){ylo=Math.min(ylo,l);yhi=Math.max(yhi,u)}
  }
  const dx=Math.max(1e-9,xhi-xlo),dy=Math.max(1e-9,yhi-ylo),px=x=>40+(x-xlo)/dx*(W-60),py=y=>H-27-(y-ylo)/dy*(H-53);
  ctx.strokeStyle='#e2e8f0';for(let i=0;i<=5;i++){const y=26+i*(H-53)/5;ctx.beginPath();ctx.moveTo(40,y);ctx.lineTo(W-20,y);ctx.stroke()}
  for(const [mode,color] of [['lower','#c95a45'],['upper','#259260'],['center','#2c6fca']]){
    ctx.strokeStyle=color;ctx.lineWidth=2.1;
    for(const r of state.best.filter(Boolean)){
      ctx.beginPath();let begun=false;
      for(let j=0;j<=160;j++){
        const x=r.range.min+j/160*(r.range.max-r.range.min),[l,u]=envelopeValues(r,x);
        const y=mode==='lower'?l:mode==='upper'?u:centerValue(l,u,r.method);
        if(!Number.isFinite(y))continue;
        if(!begun){ctx.moveTo(px(x),py(y));begun=true}else ctx.lineTo(px(x),py(y));
      }ctx.stroke();
    }
  }
  ctx.fillStyle='#3165af';for(const [x,y] of points){ctx.beginPath();ctx.arc(px(x),py(y),2.5,0,2*Math.PI);ctx.fill()}
  ctx.fillStyle='#54657a';ctx.font='11px system-ui';ctx.fillText(num(xlo),36,H-6);ctx.fillText(num(xhi),W-64,H-6);ctx.fillText(num(yhi),4,20);
}
function start(){
  const observed=snap();if(!observed){showStatus('Importa datos o selecciona un proyecto con puntos.');return}
  const data=observed.source.points;
  let groups;try{groups=parts(data)}catch(e){showStatus(e.message);return}
  if(groups.some(g=>g.points.length<2)||groups.some(g=>g.points.some(([,y])=>y<=0))){showStatus('Cada tramo debe contener al menos dos puntos y todos sus valores Y deben ser positivos.');return}
  const n=Math.min(100000,Math.max(1,Math.trunc(Number($('env-n').value)||1000)));
  const cfg={n,bounds:$('env-bounds').value,center:$('env-center').value,decimals:+$('env-decimals').value,maxInteger:+$('env-maxint').value};
  stop();state.running=true;state.paused=false;state.done=0;state.n=n;state.groups=groups;state.best=Array(groups.length).fill(null);
  state.worker=new Worker(new URL('./envelope-worker.mjs',import.meta.url),{type:'module'});
  const thisWorker=state.worker,projectId=state.project;
  thisWorker.onmessage=e=>{
    if(thisWorker!==state.worker||projectId!==current().id)return;
    const msg=e.data;
    if(msg.type==='progress'){
      state.done=msg.done;
      if(msg.improvements?.length){
        state.best=msg.best.map(row=>row?{...row,scope:state.scope}:null);
        state.history.push(...msg.improvements.map(row=>({...row,runId:state.runId,scope:state.scope}))); 
        state.history=state.history.slice(-250);save();
      }
      if(Date.now()-state.lastProgress>180){drawResult();drawHistory();state.lastProgress=Date.now()}
      showStatus(`Probadas ${msg.done} / ${state.n} · ${msg.valid} válidas · ${msg.invalid} inválidas · ${msg.duplicates} repetidas`);
    }else if(msg.type==='complete'){
      state.done=msg.done;stop();drawResult();drawHistory();save();showStatus(`Finalizado: ${msg.done} de ${n} iteraciones totales, repartidas entre ${groups.length} tramo(s).`)
    }else if(msg.type==='paused'){showStatus('Pausado · puedes reanudar.')}
    else if(msg.type==='error'){stop();showStatus(msg.message)}
  };
  thisWorker.onerror=e=>{stop();showStatus('Error de cálculo: '+e.message)};
  state.scope=$('env-scope').value;state.runId=Date.now();drawResult();showStatus(`Iniciando ${n} iteraciones totales…`);
  thisWorker.postMessage({type:'start',groups,config:cfg});
}
function exportCSV(){
  const columns=['iteracion','tramo','x_min','x_max','modelo','promedio','MAPE_%','anchura_relativa_%','a_inferior','a_superior','p_inferior','p_superior','escala'];
  const rows=[columns,...state.history.map(h=>[h.iteration,h.part+1,h.range.min,h.range.max,h.bounds,h.method,h.mape,h.meanWidth,h.aL,h.aU,h.pL,h.pU,h.scale])];
  const csv='\uFEFF'+rows.map(row=>row.map(s=>'"'+String(s??'').replaceAll('"','""')+'"').join(';')).join('\r\n');
  const link=document.createElement('a'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));link.href=url;link.download='acotacion_exponencial_'+state.project+'.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function setup(){
  if(!window.__nPrimosCalculator||!window.__gmrResearchSnapshot){setTimeout(setup,130);return}
  state.project=current().id;
  const overlay=document.createElement('div');overlay.id='np-envelope-panel';overlay.className='gmr-research-overlay';overlay.hidden=true;
  overlay.innerHTML=`<div class="gmr-research-window" role="dialog" aria-modal="true" aria-label="Acotación exponencial">
    <div class="gmr-research-heading"><div><h2>Acotación exponencial</h2><small>Buscar dos curvas que encierren los datos y optimizar su promedio</small></div><button id="env-close" type="button" aria-label="Cerrar">×</button></div>
    <div class="gmr-research-body">
      <section class="gmr-research-group"><strong>Configuración de búsqueda</strong><div class="gmr-generator-settings">
        <label>N.º máximo de iteraciones (n)<input id="env-n" type="number" min="1" max="100000" step="1" value="1000"></label>
        <label>Cotas <select id="env-bounds"><option value="shared">Mismo exponente</option><option value="independent" selected>Exponentes independientes</option></select></label>
        <label>Centro <select id="env-center"><option value="auto" selected>Comparar los tres</option><option value="arithmetic">Aritmético</option><option value="geometric">Geométrico</option><option value="harmonic">Armónico</option></select></label>
        <label>Alcance <select id="env-scope"><option value="global" selected>Todos los datos</option><option value="sections">Tramos del generador</option></select></label>
        <label>Decimales máximos <select id="env-decimals"><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3" selected>3</option></select></label>
        <label>Máx. parte entera <select id="env-maxint"><option value="9">Unidades (9)</option><option value="99">Decenas (99)</option><option value="999">Centenas (999)</option><option value="9999" selected>Miles (9999)</option></select></label>
      </div><p class="gmr-research-note"><strong>n es el total de iteraciones:</strong> si utilizas tres tramos, los intentos se reparten entre ellos. Las cotas encierran las observaciones con Y&gt;0; no garantizan los valores entre observaciones. Una búsqueda con restricciones demasiado estrictas puede no encontrar ninguna pareja válida.</p></section>
      <section class="gmr-research-group"><div class="gmr-research-buttons"><button id="env-start" class="gmr-research-btn success">Iniciar n iteraciones</button><button id="env-pause" class="gmr-research-btn secondary" disabled>Pausar</button><button id="env-resume" class="gmr-research-btn secondary" disabled>Reanudar</button><button id="env-stop" class="gmr-research-btn danger">Detener</button><button id="env-export" class="gmr-research-btn">Exportar historial CSV</button><button id="env-clear" class="gmr-research-btn danger">Limpiar historial</button></div><div class="gmr-status-line"><progress id="env-progress" max="1" value="0"></progress><span id="env-progress-label">0 / 0</span><strong id="env-status">Listo.</strong></div></section>
      <section class="gmr-research-group"><strong>Vista previa · azul: datos y centro; rojo: cota inferior; verde: superior</strong><canvas id="env-preview" aria-label="Cotas exponenciales y puntos observados"></canvas></section>
      <section class="gmr-research-group"><strong>Mejores cotas de esta generación</strong><div id="env-results" class="env-results"></div></section>
      <section class="gmr-research-group"><strong>Historial por proyecto</strong> <span id="env-history-count"></span><div class="gmr-history"><table><thead><tr><th>Iteración</th><th>Tramo</th><th>Promedio</th><th>MAPE</th><th>Anchura</th><th>a inf.</th><th>a sup.</th><th>p inf.</th><th>p sup.</th><th>Desmos</th></tr></thead><tbody id="env-history"></tbody></table></div></section>
    </div></div>`;
  document.body.append(overlay);
  overlay.querySelector('#env-close').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  $('env-start').onclick=start;
  $('env-pause').onclick=()=>{if(state.worker){state.paused=true;state.worker.postMessage({type:'pause'});showStatus('Pausa solicitada…')}};
  $('env-resume').onclick=()=>{if(state.worker){state.paused=false;state.worker.postMessage({type:'resume'});showStatus('Reanudando…')}};
  $('env-stop').onclick=()=>{stop();showStatus('Detenido manualmente. Se conservan las mejoras obtenidas.')};
  $('env-export').onclick=exportCSV;
  $('env-clear').onclick=()=>{if(!confirm('¿Borrar el historial de acotación exponencial de este proyecto?'))return;stop();state.history=[];state.best=[];save();drawResult();drawHistory();showStatus('Historial borrado.')};
  const button=document.createElement('button');button.id='np-envelope-btn';button.type='button';button.textContent='◈ Acotación exponencial';document.body.append(button);
  button.onclick=()=>{if(state.project!==current().id){stop();state.project=current().id;state.best=[];load()}overlay.hidden=false;drawGraph()};
  window.addEventListener('gmr:project-switched',e=>{if(e.detail?.lab!=='prime')return;stop();state.project=current().id;state.best=[];state.n=0;state.done=0;load();drawResult();showStatus('Proyecto: '+current().name)});
  window.addEventListener('gmr:dataset-selection',e=>{if(e.detail?.lab==='prime') {stop();state.best=[];drawResult()}});
  load();drawResult();showStatus('Listo para iniciar.');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();