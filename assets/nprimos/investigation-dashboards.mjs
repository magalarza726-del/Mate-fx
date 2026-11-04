/* Investigación · dashboards comparativos vinculados al motor real Desmos. */
import {methodById} from './investigation-core.mjs';
import {plotSpecifications,screenshotFromDesmos} from './investigation-desmos.mjs';
const $=id=>document.getElementById(id);
const fmt=n=>Number.isFinite(n)?Number(n).toLocaleString('es-EC',{maximumFractionDigits:4}):'—';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const GROUPS=['Todos','Métodos clásicos de ajuste','Métodos de corrección de funciones','Métodos basados en restricciones y cotas','Métodos de interpolación','Métodos de aproximación avanzada','Métodos de búsqueda y optimización'];
const MODES=[['comparison','Errores por configuración'],['complexity','Complejidad y precisión'],['percentage','Error porcentual por X'],['residual','Residuos por X'],['fit','Datos y función Desmos']];
let stateProvider=null,plotIndex=0,plotBusy=false,lastRun=0,renderCount=0;
const byScore=(a,b)=>Number.isFinite(a.best?.metrics?.mape)?a.best.metrics.mape:Infinity;
const all=()=>{
 const state=stateProvider?.();if(!state)return [];
 return state.entries.map(entry=>({...entry,best:state.results.get(entry.id)?.best||null,elapsedMs:state.results.get(entry.id)?.elapsedMs||0})).filter(e=>e.best);
};
function currentEntries(){
 const group=$('inv-dash-group')?.value||'Todos',sort=$('inv-dash-sort')?.value||'mape';
 const entries=all().filter(e=>group==='Todos'||methodById(e.method)?.group===group);
 const score=e=>sort==='complexity'?e.best.complexity:sort==='maxape'?e.best.metrics?.maxape:sort==='time'?e.elapsedMs:sort==='validation'?e.best.validationMetrics?.mape:e.best.metrics?.mape;
 return entries.sort((a,b)=>(Number.isFinite(score(a))?score(a):Infinity)-(Number.isFinite(score(b))?score(b):Infinity));
}
function dashboardTable(entries){
 const tbody=$('inv-dash-rows');if(!tbody)return;
 tbody.innerHTML=entries.slice(0,100).map(e=>'<tr><td>'+esc(e.id)+'</td><td>'+esc(methodById(e.method)?.name||e.method)+'</td><td>'+fmt(e.best.metrics?.mape)+' %</td><td>'+fmt(e.best.metrics?.maxape)+' %</td><td>'+fmt(e.best.complexity)+'</td><td>'+fmt(e.best.validationMetrics?.mape)+' %</td><td>'+fmt(e.elapsedMs/1000)+' s</td><td><button type="button" data-choose="'+esc(e.id)+'">Ver</button></td></tr>').join('');
 tbody.querySelectorAll('[data-choose]').forEach(btn=>btn.onclick=()=>{
  const state=stateProvider();state.active=btn.dataset.choose;
  document.dispatchEvent(new CustomEvent('gmr:inv-select',{detail:{id:state.active}}));
  $('inv-dash-chart-mode').value='percentage';refreshDashboards(true);
 });
}
function renderKPIs(entries){
 const best=[...entries].sort((a,b)=>(a.best.metrics?.mape??Infinity)-(b.best.metrics?.mape??Infinity))[0];
 const simple=[...entries].sort((a,b)=>a.best.complexity-b.best.complexity)[0];
 const max=entries.reduce((m,e)=>Math.max(m,e.best.metrics?.maxape||0),0);
 $('inv-dash-kpis').innerHTML=[
 ['Resultados válidos',String(entries.length)],
 ['Mejor MAPE',best?fmt(best.best.metrics?.mape)+' %':'—'],
 ['Menor complejidad',simple?fmt(simple.best.complexity)+' ('+simple.id+')':'—'],
 ['Mayor error máximo observado',entries.length?fmt(max)+' %':'—'],
 ['Mejor ecuación',best?methodById(best.method).name:'—']
 ].map(([a,b])=>'<div class="inv-kpi"><small>'+esc(a)+'</small><strong>'+esc(b)+'</strong></div>').join('');
}
async function plot(entries,force=false){
 const element=$('inv-dash-plot'),state=stateProvider?.();
 if(!element||!state?.source||!entries.length)return;
 if(!force&&performance.now()-lastRun<1600)return;
 lastRun=performance.now();
 const mode=$('inv-dash-chart-mode').value;
 const chosen=entries.find(e=>e.id===state.active)||entries[0],selected=chosen.best,version=++plotIndex;
 $('inv-dash-caption').textContent=mode==='comparison'?'Azul: MAPE · naranja: error máximo. Orden según tabla.':mode==='complexity'?'Cada punto representa una configuración y su ganadora.':'Ecuación '+chosen.id+' · '+methodById(chosen.method).name;
 element.setAttribute('aria-busy','true');
 try{
  const spec=plotSpecifications(state.source,selected,mode,entries);
  const png=await screenshotFromDesmos(spec,{width:860,height:445,ratio:1.15,previewKey:'dashboard'});
  if(version!==plotIndex||!element.isConnected)return;
  const img=document.createElement('img');img.src=png;img.alt='Dashboard graficado y capturado directamente en Desmos: '+spec.title;
  img.style.cssText='display:block;width:100%;height:auto;';element.replaceChildren(img);
 }catch(e){if(version===plotIndex){element.textContent='No fue posible generar el dashboard con Desmos: '+e.message;console.warn(e)}}
 finally{element.removeAttribute('aria-busy')}
}
export function refreshDashboards(force=false){
 if(!$('inv-dashboards'))return;
 const entries=currentEntries();
 renderKPIs(entries);dashboardTable(entries);
 $('inv-dash-total').textContent=entries.length+' configuraciones terminadas';
 if(!entries.length){$('inv-dash-plot').textContent='Ejecuta primero al menos un experimento para activar el dashboard de Desmos.';return}
 plot(entries,force);
}
export function setupDashboards(getState){
 stateProvider=getState;
 const root=$('inv-dashboards');
 if(!root)return;
 root.innerHTML='<h3>Dashboards de investigación <small id="inv-dash-total"></small></h3>'+
 '<div class="inv-dashboard-filters"><label>Familia <select id="inv-dash-group">'+GROUPS.map(g=>'<option>'+esc(g)+'</option>').join('')+'</select></label>'+
 '<label>Ordenar <select id="inv-dash-sort"><option value="mape">Menor error medio</option><option value="maxape">Menor error máximo</option><option value="complexity">Menor complejidad</option><option value="validation">Mejor validación</option><option value="time">Menor tiempo</option></select></label>'+
 '<label>Gráfica Desmos <select id="inv-dash-chart-mode">'+MODES.map(([id,name])=>'<option value="'+id+'">'+esc(name)+'</option>').join('')+'</select></label></div>'+
 '<div class="inv-dashboard-kpis" id="inv-dash-kpis"></div>'+
 '<div id="inv-dash-plot" class="inv-dashboard-plot"></div><p class="gmr-research-note" id="inv-dash-caption">Todos los gráficos de esta sección se capturan desde Desmos.</p>'+
 '<div class="gmr-history inv-dash-table"><table><thead><tr><th>Config.</th><th>Método</th><th>MAPE</th><th>MaxAPE</th><th>Complejidad</th><th>Validación</th><th>Tiempo</th><th></th></tr></thead><tbody id="inv-dash-rows"></tbody></table></div>';
 for(const id of ['inv-dash-group','inv-dash-sort','inv-dash-chart-mode'])$(id).onchange=()=>refreshDashboards(true);
 refreshDashboards();
}
