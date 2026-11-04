/* Reportes PDF DIRECTOS · Mate-fx: fórmulas LaTeX y capturas de Desmos. */
import {plotSpecifications,screenshotFromDesmos} from './investigation-desmos.mjs';
const fmt=n=>Number.isFinite(n)?Number(n).toLocaleString('es-EC',{maximumFractionDigits:5}):'—';
const ascii=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
const slug=v=>String(v||'reporte').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,70);
let jspdfLoading,mathjaxLoading;const sleep=()=>new Promise(r=>setTimeout(r,0));
function inject(url){
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=url;script.async=true;
  script.onload=()=>resolve();script.onerror=()=>{script.remove();reject(Error('No se pudo cargar '+url))};
  document.head.append(script);
 });
}
async function loadJsPDF(){
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 jspdfLoading??=(async()=>{
  for(const url of ['https://cdn.jsdelivr.net/npm/jspdf@4.2.1/dist/jspdf.umd.min.js','https://unpkg.com/jspdf@4.2.1/dist/jspdf.umd.min.js','https://cdnjs.cloudflare.com/ajax/libs/jspdf/3.0.3/jspdf.umd.min.js']){
   try{await inject(url);if(window.jspdf?.jsPDF)return window.jspdf.jsPDF}catch(e){console.warn(e)}
  }
  throw Error('No se ha podido cargar jsPDF; no generé un archivo de otro formato.');
 })().catch(error=>{jspdfLoading=null;throw error});
 return jspdfLoading;
}
async function tryMathJax(){
 if(window.MathJax?.tex2svgPromise)return window.MathJax;
 if(!mathjaxLoading){
  mathjaxLoading=(async()=>{
   window.MathJax={tex:{packages:{'[+]':['ams']}},svg:{fontCache:'none'}};
   try{await inject('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js')}catch(e){console.warn('MathJax no disponible',e);return null}
   if(window.MathJax?.startup?.promise)await window.MathJax.startup.promise;
   return window.MathJax?.tex2svgPromise?window.MathJax:null;
  })().catch(()=>null);
 }
 return mathjaxLoading;
}
async function mathImage(raw){
 const mj=await tryMathJax();if(!mj)return null;
 try{
  const elm=await mj.tex2svgPromise(String(raw).replace(/^f\(x\)=/,'f(x)='),{display:true});
  const svg=elm.querySelector('svg');if(!svg)return null;
  const temp=document.createElement('div');Object.assign(temp.style,{position:'fixed',left:'-30000px',top:'0',background:'white',zIndex:'-1'});
  temp.append(elm);document.body.append(temp);
  const b=svg.getBoundingClientRect();const width=Math.min(2200,Math.max(220,Math.ceil(b.width*2))),height=Math.min(900,Math.max(45,Math.ceil(b.height*2)));
  const clone=svg.cloneNode(true);clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.setAttribute('width',width+'px');clone.setAttribute('height',height+'px');clone.setAttribute('style','background:white');
  temp.remove();
  const source=new XMLSerializer().serializeToString(clone),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml'}));
  const img=new Image();
  const loaded=await new Promise((resolve,reject)=>{img.onload=()=>resolve(true);img.onerror=reject;img.src=url});
  if(!loaded)return null;
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,width,height);ctx.drawImage(img,0,0,width,height);
  const data=canvas.toDataURL('image/png');URL.revokeObjectURL(url);return {data,width,height};
 }catch(e){console.warn('Fórmula como LaTeX literal:',e);return null}
}
function makePdf(jsPDF,title){
 const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title,subject:'Investigación matemática de Mate-fx',creator:'Mate-fx'});
 return pdf;
}
class Report{
 constructor(pdf,title){this.pdf=pdf;this.title=title;this.y=18;this.page=1;this._head()}
 _head(){
  const p=this.pdf;p.setFillColor(25,50,78);p.rect(0,0,210,12,'F');
  p.setTextColor(255,255,255);p.setFontSize(8);p.setFont('helvetica','bold');p.text('MATE-FX  /  INVESTIGACION MATEMATICA',13,8);
  p.setTextColor(25,50,78);p.setDrawColor(208,218,228);p.line(13,286,197,286);
  p.setFontSize(8);p.setFont('helvetica','normal');p.text('Mate-fx  |  '+ascii(this.title).slice(0,75),13,291);
  p.text('Pagina '+this.page,196,291,{align:'right'});
 }
 newPage(){this.pdf.addPage();this.page++;this.y=19;this._head()}
 ensure(h=8){if(this.y+h>280)this.newPage()}
 heading(text,size=16){
  this.ensure(17);const p=this.pdf;p.setFont('helvetica','bold');p.setFontSize(size);p.setTextColor(22,53,85);
  const lines=p.splitTextToSize(ascii(text),183);p.text(lines,13,this.y);this.y+=lines.length*(size*.43)+4;
  p.setDrawColor(218,228,237);p.line(13,this.y,197,this.y);this.y+=6;
 }
 text(text,size=9,indent=13,color=[41,61,80]){
  const p=this.pdf;p.setFont('helvetica','normal');p.setFontSize(size);p.setTextColor(...color);
  const lines=p.splitTextToSize(ascii(text),197-indent-2);
  for(const line of lines){this.ensure(4.8);p.text(line,indent,this.y);this.y+=size*.47+1.1}
  this.y+=2;
 }
 badge(label,value){
  this.ensure(11);const p=this.pdf;p.setFontSize(8);p.setFont('helvetica','bold');p.setTextColor(43,79,108);
  p.text(ascii(label).slice(0,27),15,this.y);p.setFont('helvetica','normal');p.setTextColor(25,37,55);p.text(ascii(value).slice(0,65),95,this.y);this.y+=6;
 }
 latex(raw){
  if(!raw)return;
  this.ensure(12);const p=this.pdf;p.setFont('courier','normal');p.setFontSize(7.6);p.setTextColor(18,49,82);
  const lines=p.splitTextToSize(String(raw),177);for(const l of lines){this.ensure(4);p.text(ascii(l),17,this.y);this.y+=3.7}this.y+=4;
 }
 async equation(best){
  if(!best?.latex){this.text('Sin ecuacion valida');return}
  const tex=best.ztex?'z='+best.ztex+'; '+best.latex:best.latex;
  const img=await mathImage(best.latex.replace(/^f\(x\)=/,''));
  if(img){
   const h=Math.min(31,178*(img.height/img.width));this.ensure(h+7);
   this.pdf.setFillColor(246,249,253);this.pdf.roundedRect(13,this.y-2,184,h+6,2,2,'F');
   this.pdf.addImage(img.data,'PNG',16,this.y,Math.min(176,img.width/img.height*h),h);this.y+=h+9;
  }
  this.latex(tex);
 }
 async graph(spec,{height=85}={}){
  this.ensure(height+12);
  const png=await screenshotFromDesmos(spec,{width:860,height:440,ratio:1.25});
  const p=this.pdf;p.setDrawColor(211,222,235);p.roundedRect(13,this.y-2,184,height+5,2,2,'S');
  p.addImage(png,'PNG',15,this.y,180,height);this.y+=height+10;
  this.text('Grafica original capturada con la API oficial de Desmos.',8,13,[83,108,128]);
 }
 table(head,rows,widths=[32,38,40,40,30]){
  const p=this.pdf,baseX=13;this.ensure(10);
  const drawHeader=()=>{p.setFillColor(232,241,249);p.rect(13,this.y-4,184,7,'F');p.setFont('helvetica','bold');p.setFontSize(8);p.setTextColor(38,69,95);let x=baseX;head.forEach((h,i)=>{p.text(ascii(h).slice(0,23),x+2,this.y);x+=widths[i]||30});this.y+=7};
  drawHeader();p.setFont('helvetica','normal');p.setFontSize(8);p.setTextColor(30,49,66);
  for(const row of rows){if(this.y+5>279){this.newPage();drawHeader();p.setFont('helvetica','normal');p.setFontSize(8);p.setTextColor(30,49,66)}
   let x=baseX;row.forEach((cell,i)=>{const ww=widths[i]||30;p.text(ascii(cell).slice(0,Math.floor(ww*2.3)),x+2,this.y);x+=ww});
   p.setDrawColor(238,243,248);p.line(13,this.y+1,197,this.y+1);this.y+=5.4
  }
  this.y+=5;
 }
 async iterationTable(items,entryId,onProgress){
  this.newPage();this.heading('Historial de iteraciones - '+entryId,14);
  this.text('Formulas en codigo LaTeX. Estas paginas NO contienen graficas.',9);
  const p=this.pdf;
  for(let i=0;i<items.length;i++){
   const r=items[i];const code=(r.ztex?'z='+r.ztex+'; ':'')+(r.latex||r.reason||'Intento invalido');
   const fontSize=7.15,rowHeight=4.1;
   p.setFont('courier','normal');p.setFontSize(fontSize);
   const lines=p.splitTextToSize(code,171);
   const needed=lines.length*rowHeight+11;
   if(this.y+needed>280)this.newPage();
   p.setTextColor(36,80,116);p.setFont('helvetica','bold');p.setFontSize(8);
   p.text('#'+r.iteration+'  |  MAPE '+fmt(r.metrics?.mape)+' %  |  MaxAPE '+fmt(r.metrics?.maxape)+' %  |  MAE '+fmt(r.metrics?.mae)+'  |  C '+fmt(r.complexity),14,this.y);this.y+=5;
   p.setTextColor(40,54,67);p.setFont('courier','normal');p.setFontSize(fontSize);
   for(const line of lines){this.ensure(rowHeight);p.text(ascii(line),15,this.y);this.y+=rowHeight}
   p.setDrawColor(236,242,247);p.line(14,this.y+1,195,this.y+1);this.y+=5;
   if(i%130===0){onProgress?.('Maquetando iteraciones '+fmt(i+1)+' / '+fmt(items.length));await sleep()}
  }
 }
}
function rowsWithErrors(points,estimates){
 return points.map(([x,y],i)=>{const pred=estimates?.[i],error=Number.isFinite(pred)?Math.abs(pred-y):null,percentage=Number.isFinite(error)&&y!==0?100*error/Math.abs(y):null;
  return [fmt(x),fmt(y),fmt(pred),fmt(error),fmt(percentage)]});
}
function rangeStats(points,values,count=5){
 if(!points?.length||!values?.length)return [];
 const lo=points[0][0],hi=points[points.length-1][0],span=Math.max(1e-9,hi-lo);
 const chunks=Array.from({length:count},(_,i)=>({min:lo+i*span/count,max:lo+(i+1)*span/count,errors:[]}));
 points.forEach((p,i)=>{const idx=Math.max(0,Math.min(count-1,Math.floor((p[0]-lo)/span*count)));
  if(p[1]!==0&&Number.isFinite(values[i]))chunks[idx].errors.push(100*Math.abs(p[1]-values[i])/Math.abs(p[1]))});
 return chunks.map(a=>[fmt(a.min)+' - '+fmt(a.max),String(a.errors.length),fmt(a.errors.length?a.errors.reduce((s,x)=>s+x,0)/a.errors.length:null),fmt(a.errors.length?Math.max(...a.errors):null)]);
}
export async function methodReport(state,id,name,onProgress=()=>{}){
 const entries=state.entries.filter(e=>e.method===id&&state.history.has(e.id));
 if(!entries.length)throw Error('No hay iteraciones registradas para este método.');
 const jsPDF=await loadJsPDF();const pdf=makePdf(jsPDF,name),doc=new Report(pdf,name);
 for(const e of entries){
  const r=state.results.get(e.id),best=r?.best;
  doc.newPage();doc.heading('Investigacion: '+name,17);
  doc.text('Proyecto: '+state.projectName+'  |  Archivo: '+state.source.sourceName);
  doc.text('Eje X: '+state.source.xName+'  |  Eje Y: '+state.source.yName+'  |  Observaciones: '+state.source.points.length);
  doc.text('Configuracion '+e.id+'  |  Semilla '+e.seed+'  |  '+(state.history.get(e.id)||[]).length+' iteraciones  |  '+fmt((r?.elapsedMs||0)/1000)+' s');
  doc.text('Configuracion completa: '+JSON.stringify(e.config),7.5);
  doc.heading('Ecuacion ganadora',13);await doc.equation(best);
  if(best){
   const v=best.metrics||{},t=best.trainMetrics||{},a=best.validationMetrics||{};
   [['MAPE medio',fmt(v.mape)+' %'],['Error maximo relativo',fmt(v.maxape)+' %'],
    ['Error maximo absoluto',fmt(v.maxAbs)],['MAE',fmt(v.mae)],['RMSE',fmt(v.rmse)],
    ['Percentil 95',fmt(v.p95)+' %'],['Complejidad',fmt(best.complexity)],
    ['MAPE entrenamiento',fmt(t.mape)+' %'],['MAPE validacion',fmt(a.mape)+' %'],
    ['Error maximo validacion',fmt(a.maxape)+' %'],['Predicciones finitas',fmt(v.valid)],
    ['Predicciones invalidas',fmt(v.invalid)]].forEach(([k,val])=>doc.badge(k,val));
   doc.heading('Puntos observados y ecuacion',13);
   onProgress('Capturando grafica real de Desmos: '+name+' / '+e.id);
   await doc.graph(plotSpecifications(state.source,best,'fit'),{height:88});
   doc.heading('Error porcentual absoluto por X',12);
   await doc.graph(plotSpecifications(state.source,best,'percentage'),{height:67});
   doc.heading('Resumen por intervalos de X',13);
   doc.table(['Rango de X','Puntos','MAPE %','MaxAPE %'],rangeStats(state.source.points,best.estimates),[62,28,46,46]);
   doc.heading('Datos observados, prediccion y errores',13);
   doc.text('Valores y errores de TODAS las observaciones usadas para la evaluacion.',8);
   const rows=rowsWithErrors(state.source.points,best.estimates);
   for(let i=0;i<rows.length;i+=250){doc.table(['X','Y real','Y calculada','Error abs.','Error %'],rows.slice(i,i+250),[32,40,42,38,32]);if(i%500===0){onProgress('Datos '+fmt(i+rows.slice(i,i+250).length)+' / '+fmt(rows.length));await sleep()}}
  }else doc.text('No se encontro una ecuacion valida bajo estas restricciones.');
  await doc.iterationTable(state.history.get(e.id)||[],e.id,onProgress);
 }
 const namefile='Matefx_'+slug(name)+'_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 onProgress('Descargando '+namefile);pdf.save(namefile);return namefile;
}
export async function generalReport(state,nameOf,onProgress=()=>{}){
 const entries=state.entries.filter(e=>state.results.get(e.id)?.best);
 if(!entries.length)throw Error('No hay ecuaciones ganadoras para el reporte general.');
 const jsPDF=await loadJsPDF(),pdf=makePdf(jsPDF,'Catalogo general'),doc=new Report(pdf,'Catalogo general');
 doc.heading('Catalogo general de ecuaciones',19);
 doc.text('Proyecto: '+state.projectName+'  |  Fuente: '+state.source.sourceName);
 doc.text('Se presenta una ecuacion ganadora por metodo y configuracion, con su grafica original de Desmos.');
 for(let i=0;i<entries.length;i++){
  const e=entries[i],best=state.results.get(e.id).best;
  if(i>0)doc.newPage();
  doc.heading(nameOf(e.method)+'  /  '+e.id,15);
  onProgress('Formulas y graficas '+fmt(i+1)+' / '+fmt(entries.length));
  await doc.equation(best);
  await doc.graph(plotSpecifications(state.source,best,'fit'),{height:109});
  if(i%5===0)await sleep();
 }
 const filename='Matefx_Catalogo_General_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 onProgress('Descargando '+filename);pdf.save(filename);return filename;
}
