/* Mate-fx · reportes científicos imprimibles (LaTeX y gráficos vectoriales). */
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const f=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:5}):'—';
const p=v=>Number.isFinite(v)?f(v)+' %':'—';
const style='<style>@page{size:A4;margin:15mm 12mm}body{margin:0;color:#182b42;font:11px/1.42 system-ui,Arial}h1{font-size:23px}h2{font-size:16px;border-bottom:2px solid #c4d6e7;padding:5px 0}h3{font-size:14px}.muted{color:#52677a}.sheet{break-after:page;page-break-after:always}.sheet:last-child{break-after:auto}.break{break-before:page;page-break-before:always}.metrics{display:flex;flex-wrap:wrap;gap:8px}.metrics span{display:block;border:1px solid #d5dfe9;padding:8px;border-radius:6px;min-width:95px}.metrics b{display:block;font-size:14px}.formula{padding:11px;background:#f0f5fa;border-radius:7px;overflow-wrap:anywhere}.tex{font:10px/1.4 monospace;color:#52677a;overflow-wrap:anywhere}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}th,td{border-bottom:1px solid #e0e7f0;padding:6px 3px;text-align:left;vertical-align:top}th{background:#ebf2fa}td.tex{overflow-wrap:anywhere}thead{display:table-header-group}tr{break-inside:avoid}.toolbar{position:sticky;top:0;background:#132f4d;color:#fff;padding:12px;display:flex;gap:14px;z-index:10}.toolbar button{padding:8px 14px}.chart{max-width:100%}@media print{.toolbar{display:none}.sheet{break-after:page}}</style>';
function metrics(m){
 if(!m)return '';
 const rows=[['MAPE',p(m.metrics?.mape)],['Error máximo relativo',p(m.metrics?.maxape)],['Error máximo absoluto',f(m.metrics?.maxAbs)],['MAE',f(m.metrics?.mae)],['RMSE',f(m.metrics?.rmse)],['P95',p(m.metrics?.p95)],['Complejidad',f(m.complexity)],['MAPE entrenamiento',p(m.trainMetrics?.mape)],['MAPE validación',p(m.validationMetrics?.mape)],['Error máx. validación',p(m.validationMetrics?.maxape)],['Puntos válidos',f(m.metrics?.valid)],['Sin predicción finita',f(m.metrics?.invalid)]];
 return '<div class="metrics">'+rows.map(([a,b])=>'<span><small>'+esc(a)+'</small><b>'+esc(b)+'</b></span>').join('')+'</div>';
}
function latex(m){
 if(!m?.latex)return '<p>Sin ecuación válida.</p>';
 const raw=(m.ztex?'z='+m.ztex+'; ':'')+m.latex;
 return '<div class="formula"><div>\\('+esc(m.latex)+'\\)</div>'+(m.ztex?'<div>\\(z='+esc(m.ztex)+'\\)</div>':'')+'<div class="tex">LaTeX: '+esc(raw)+'</div></div>';
}
export function graphSVG(points,estimates=[],w=700,h=275){
 if(!points?.length)return '<p>No hay puntos.</p>';
 const y=[...points.map(q=>q[1]),...estimates.filter(Number.isFinite)],xl=Math.min(...points.map(q=>q[0])),xr=Math.max(...points.map(q=>q[0])),yl=Math.min(...y),yr=Math.max(...y);
 const X=x=>50+(x-xl)/Math.max(1e-9,xr-xl)*(w-70),Y=v=>h-33-(v-yl)/Math.max(1e-9,yr-yl)*(h-51);
 const circles=points.map(q=>'<circle cx="'+X(q[0]).toFixed(2)+'" cy="'+Y(q[1]).toFixed(2)+'" r="2.2" fill="#2878bb"/>').join('');
 const segments=[];let current=[];for(let i=0;i<points.length;i++){if(Number.isFinite(estimates[i]))current.push([X(points[i][0]),Y(estimates[i])]);else if(current.length){segments.push(current);current=[]}}if(current.length)segments.push(current);
 const lines=segments.map(seg=>'<polyline points="'+seg.map(a=>a.map(v=>v.toFixed(2)).join(',')).join(' ')+'" fill="none" stroke="#da742f" stroke-width="2"/>').join('');
 return '<svg class="chart" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Puntos observados y curva ajustada"><rect width="'+w+'" height="'+h+'" fill="#fff"/><path d="M50 18V'+(h-33)+'H'+(w-20)+'" fill="none" stroke="#718197"/>'+lines+circles+'<g fill="#52657a" font-size="10"><text x="50" y="'+(h-8)+'">'+esc(f(xl))+'</text><text x="'+(w-77)+'" y="'+(h-8)+'">'+esc(f(xr))+'</text><text x="2" y="14">'+esc(f(yr))+'</text><text x="2" y="'+(h-35)+'">'+esc(f(yl))+'</text></g></svg>';
}
function header(state,title){
 return '<h1>'+esc(title)+'</h1><p class="muted">Mate-fx · Investigación matemática · '+esc(new Date().toLocaleString('es-EC'))+'</p><p><b>Proyecto:</b> '+esc(state.projectName)+' · <b>Fuente:</b> '+esc(state.source.sourceName)+' · <b>Ejes:</b> '+esc(state.source.xName)+' / '+esc(state.source.yName)+' · <b>Datos:</b> '+state.source.points.length+'</p>';
}
function segmentErrors(points,predictions,n=5){
 if(!points?.length||!predictions?.length)return '';
 const xmin=points[0][0],xmax=points[points.length-1][0],span=Math.max(1e-12,xmax-xmin);
 const sections=Array.from({length:n},(_,i)=>({lo:xmin+span*i/n,hi:xmin+span*(i+1)/n,values:[]}));
 for(let i=0;i<points.length;i++){
  const p=points[i],estimate=predictions[i],index=Math.max(0,Math.min(n-1,Math.floor((p[0]-xmin)/span*n)));
  if(Number.isFinite(estimate))sections[index].values.push(p[1]===0?null:100*Math.abs(p[1]-estimate)/Math.abs(p[1]));
 }
 return '<h2>Errores por tramos de X</h2><table><thead><tr><th>Tramo</th><th>Observaciones</th><th>MAPE</th><th>MaxAPE</th></tr></thead><tbody>'+
 sections.map((a,i)=>{const valid=a.values.filter(Number.isFinite),mean=valid.length?valid.reduce((s,v)=>s+v,0)/valid.length:null;
  return '<tr><td>'+f(a.lo)+' — '+f(a.hi)+'</td><td>'+a.values.length+'</td><td>'+p(mean)+'</td><td>'+p(valid.length?Math.max(...valid):null)+'</td></tr>'}).join('')+'</tbody></table>';
}
function summary(state,e,title){
 const item=state.results.get(e.id),m=item?.best,h=state.history.get(e.id)||[];
 return '<section class="sheet">'+header(state,title)+'<h2>Resumen · '+esc(e.id)+'</h2>'+
  '<p><b>Configuración:</b> '+esc(JSON.stringify(e.config))+' · <b>Semilla:</b> '+esc(e.seed)+' · <b>Intentos:</b> '+h.length+' · <b>Tiempo:</b> '+f((item?.elapsedMs||0)/1000)+' s</p>'+
  latex(m)+metrics(m)+'<h2>Datos y mejor ecuación</h2>'+graphSVG(state.source.points,m?.estimates)+
  segmentErrors(state.source.points,m?.estimates)+
  '<p class="muted">Azul: datos observados. Naranja: ecuación estimada. Los errores porcentuales excluyen valores reales iguales a cero. Las constantes para normalizar X derivan del dominio de los datos y se declaran por separado; las cotas elegidas se aplican a los coeficientes ajustados.</p></section>';
}
function detailed(state,e){
 const h=state.history.get(e.id)||[];
 let out='<section class="break"><h2>Iteraciones · '+esc(e.id)+'</h2><p class="muted">Fórmulas en código LaTeX. Sin gráficas en estas páginas.</p><table><thead><tr><th style="width:8%">N.º</th><th style="width:58%">Función LaTeX</th><th>MAPE</th><th>Error máximo</th><th>MAE</th><th>Complejidad</th></tr></thead><tbody>';
 for(const m of h)out+='<tr><td>'+m.iteration+'</td><td class="tex">'+esc((m.ztex?'z='+m.ztex+'; ':'')+(m.latex||m.reason||'Intento inválido'))+'</td><td>'+p(m.metrics?.mape)+'</td><td>'+p(m.metrics?.maxape)+'</td><td>'+f(m.metrics?.mae)+'</td><td>'+f(m.complexity)+'</td></tr>';
 return out+'</tbody></table></section>';
}
function page(title,body){
 return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(title)+'</title>'+style+'<script>window.MathJax={tex:{inlineMath:[["\\\\(","\\\\)"]]},svg:{fontCache:"global"}};<\/script><script async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js"><\/script></head><body><div class="toolbar"><strong>'+esc(title)+'</strong><button onclick="window.print()">Guardar como PDF / Imprimir</button><span>En la impresora elige Guardar como PDF.</span></div>'+body+'</body></html>';
}
function open(title,body){
 const popup=window.open('','_blank');
 if(!popup)return false;
 popup.document.open();popup.document.write(page(title,body));popup.document.close();return true;
}
export function methodReport(state,id,name){
 const entries=state.entries.filter(e=>e.method===id&&state.history.has(e.id));
 return !!entries.length&&open('Mate-fx · '+name,entries.map(e=>summary(state,e,name)+detailed(state,e)).join(''));
}
export function generalReport(state,lookup){
 const entries=state.entries.filter(e=>state.results.get(e.id)?.best);
 return !!entries.length&&open('Mate-fx · Catálogo general',header(state,'Catálogo general de ecuaciones')+
 entries.map(e=>{const best=state.results.get(e.id).best;return '<section class="sheet"><h2>'+esc(lookup(e.method))+' · '+esc(e.id)+'</h2>'+latex(best)+graphSVG(state.source.points,best.estimates,700,325)+'</section>'}).join(''));
}
