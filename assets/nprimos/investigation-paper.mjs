/*
 * Mate-fx | Informes científicos A4.
 * Diseño editorial, figuras capturadas con la API real de Desmos y descarga PDF directa.
 * Los informes no se presentan como artículos revisados por pares.
 */
import {plotSpecifications,screenshotFromDesmos} from './investigation-desmos.mjs';
import {methodById} from './investigation-core.mjs';

const W=210, H=297, L=18, R=18, RIGHT=W-R, BOTTOM=277, INNER=W-L-R;
const NAVY=[28,50,69], BLUE=[34,83,118], GRAY=[86,101,112], PALE=[237,244,248], LIGHT=[218,226,231];
const txt=v=>String(v??'').replace(/[\u2010-\u2015]/g,'-').replace(/\u00a0/g,' ').replace(/[^\u0009\u000A\u000D\u0020-\u00FF]/g,'?');
const norm=v=>Number.isFinite(v)?Number(v).toLocaleString('es-EC',{maximumFractionDigits:4}):'N/D';
const percent=v=>Number.isFinite(v)?norm(v)+' %':'N/D';
const slug=v=>String(v||'Reporte').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9_-]+/gi,'_').slice(0,72);
const idle=()=>new Promise(resolve=>setTimeout(resolve,0));
const scalar=v=>Number.isFinite(v)?v:Infinity;

/** Present the independent variable as z without changing the numerical engine's x values.
 * The engine's old normalized variable z becomes u to prevent ambiguous formulas. */
export function reportLatex(latex='',ztex=''){
 const renameIndependent=source=>String(source||'').replace(/\bx_/g,'z_').replace(/\bx\b/g,'z');
 if(ztex){
  const renamed=String(latex).replace(/\bz\b/g,'u');
  return {latex:renameIndependent(renamed),definition:'u='+renameIndependent(ztex)};
 }
 return {latex:renameIndependent(latex),definition:''};
}
const namedZ=(name='')=>String(name||'Variable')+' [z]';
const sampleIndices=(n,count=4)=>[...new Set(Array.from({length:Math.min(n,count)},(_,i)=>Math.round(i*(n-1)/Math.max(1,Math.min(n,count)-1))))];


let loadingPDF,loadingMath;
async function loadScript(src){
 await new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;
  script.onload=resolve;script.onerror=()=>{script.remove();reject(Error('No se pudo cargar '+src))};
  document.head.append(script);
 });
}
async function PDFConstructor(){
 if(window.jspdf?.jsPDF)return window.jspdf.jsPDF;
 loadingPDF??=(async()=>{
  for(const uri of [new URL('../shared/vendor/jspdf.umd.min.js',import.meta.url).href,
   'https://cdn.jsdelivr.net/npm/jspdf@3.0.3/dist/jspdf.umd.min.js']){
   try{await loadScript(uri);if(window.jspdf?.jsPDF)return window.jspdf.jsPDF}catch(error){console.warn(error)}
  }
  throw Error('El generador PDF no pudo inicializarse.');
 })().catch(error=>{loadingPDF=null;throw error});
 return loadingPDF;
}
async function mathJax(){
 if(window.MathJax?.tex2svgPromise)return window.MathJax;
 loadingMath??=(async()=>{
  if(!window.MathJax)window.MathJax={tex:{packages:{'[+]':['ams']}},svg:{fontCache:'none'}};
  try{
   await loadScript('https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js');
   if(window.MathJax?.startup?.promise)await window.MathJax.startup.promise;
   return window.MathJax?.tex2svgPromise?window.MathJax:null;
  }catch(error){console.warn('LaTeX: renderizado visual no disponible',error);return null}
 })();
 return loadingMath;
}
async function equationPNG(latex){
 const mj=await mathJax();
 if(!mj)return null;
 let url=null,holder=null;
 try{
  const node=await mj.tex2svgPromise(String(latex),{display:true});
  const svg=node.querySelector('svg');if(!svg)return null;
  holder=document.createElement('div');
  Object.assign(holder.style,{position:'fixed',left:'-30000px',top:'0',background:'#fff'});
  holder.append(node);document.body.append(holder);
  const box=svg.getBoundingClientRect();
  const width=Math.max(180,Math.min(2600,Math.round(box.width*2)));
  const height=Math.max(48,Math.min(900,Math.round(box.height*2)));
  const clone=svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  clone.setAttribute('width',width+'px');clone.setAttribute('height',height+'px');
  const markup=new XMLSerializer().serializeToString(clone);
  url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml;charset=utf-8'}));
  const image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  return {data:canvas.toDataURL('image/png'),ratio:width/height};
 }catch(error){console.warn('Fórmula LaTeX representada como código legible:',error);return null}
 finally{if(holder)holder.remove();if(url)URL.revokeObjectURL(url)}
}
function dataOf(state,validOnly=true){
 const entries=(state.entries||[]).map(entry=>{
  const result=state.results.get(entry.id);
  return {...entry,best:result?.best||null,elapsedMs:result?.elapsedMs||0,iterations:state.history.get(entry.id)?.length||0,
   label:methodById(entry.method)?.name||entry.method,group:methodById(entry.method)?.group||'Método'};
 });
 return validOnly?entries.filter(e=>e.best):entries;
}
function metricRows(result){
 const m=result?.metrics||{},t=result?.trainMetrics||{},v=result?.validationMetrics||{};
 return [
  ['Error relativo medio (MAPE)',percent(m.mape)],['Error relativo máximo (MaxAPE)',percent(m.maxape)],
  ['Error absoluto medio (MAE)',norm(m.mae)],['Raíz del error cuadrático (RMSE)',norm(m.rmse)],
  ['Percentil 95 del error relativo',percent(m.p95)],['Complejidad computacional (índice)',norm(result?.complexity)],
  ['MAPE - entrenamiento',percent(t.mape)],['MAPE - validación',percent(v.mape)],
  ['Error máximo - validación',percent(v.maxape)],['Estimaciones finitas',norm(m.valid)]
 ];
}
function byMape(a,b){return scalar(a.best?.metrics?.mape)-scalar(b.best?.metrics?.mape)}
function reproducibility(state){
 const all=state.entries||[],run=all.reduce((sum,e)=>sum+(state.history.get(e.id)?.length||0),0);
 const source=state.source||{},points=source.points||[];
 return {configs:all.length,methods:new Set(all.map(e=>e.method)).size,observations:points.length,
  runs:run,xmin:points.length?Math.min(...points.map(p=>p[0])):null,
  xmax:points.length?Math.max(...points.map(p=>p[0])):null};
}
function allValueErrors(points,predictions){
 return (points||[]).map(([x,y],i)=>{
  const predicted=predictions?.[i],abs=Number.isFinite(predicted)?Math.abs(predicted-y):null;
  return [norm(x),norm(y),norm(predicted),norm(abs),y!==0&&Number.isFinite(abs)?percent(abs/Math.abs(y)*100):'N/D'];
 });
}
function perInterval(points,predictions,count=6){
 if(!points?.length||!predictions?.length)return [];
 const min=points[0][0],max=points[points.length-1][0],span=Math.max(1e-10,max-min);
 const intervals=Array.from({length:count},(_,i)=>({a:min+span*i/count,b:min+span*(i+1)/count,e:[],n:0}));
 points.forEach(([x,y],i)=>{const j=Math.min(count-1,Math.max(0,Math.floor((x-min)/span*count))),it=intervals[j];it.n++;
  if(y!==0&&Number.isFinite(predictions[i]))it.e.push(Math.abs(predictions[i]-y)/Math.abs(y)*100)});
 return intervals.map(it=>[norm(it.a)+' a '+norm(it.b),it.n,
  it.e.length?percent(it.e.reduce((a,b)=>a+b,0)/it.e.length):'N/D',
  it.e.length?percent(Math.max(...it.e)):'N/D']);
}

class Paper{
 constructor(pdf,title){
  this.pdf=pdf;this.title=title;this.y=29;this.page=1;this.figureNumber=0;
  this.createChrome();
 }
 setFont(kind='times',weight='normal',size=10,color=NAVY){
  const p=this.pdf;p.setFont(kind,weight);p.setFontSize(size);p.setTextColor(...color)
 }
 createChrome(){
  const p=this.pdf;
  p.setDrawColor(...LIGHT);p.line(L,17,RIGHT,17);
  this.setFont('helvetica','bold',8,BLUE);p.text('MATE-FX   /   INVESTIGACIÓN COMPUTACIONAL',L,13);
  this.setFont('helvetica','normal',8,GRAY);p.text('INFORME TÉCNICO',RIGHT,13,{align:'right'});
  p.setDrawColor(...LIGHT);p.line(L,284,RIGHT,284);
  this.setFont('helvetica','normal',8,GRAY);
  p.text('Catálogo de aproximaciones | '+txt(this.title).slice(0,46),L,289);
  p.text(String(this.page),RIGHT,289,{align:'right'});
 }
 next(){
  this.pdf.addPage();this.page++;this.y=29;this.createChrome();
 }
 ensure(mm=10){if(this.y+mm>BOTTOM)this.next()}
 separator(){this.ensure(5);this.pdf.setDrawColor(...LIGHT);this.pdf.line(L,this.y,RIGHT,this.y);this.y+=4}
 kicker(text){
  this.ensure(8);this.setFont('helvetica','bold',8,BLUE);this.pdf.text(txt(text).toUpperCase(),L,this.y);this.y+=8;
 }

 titleBlock(title,subtitle=''){
  this.ensure(44);
  const p=this.pdf,start=this.y;
  p.setFillColor(...BLUE);p.rect(L,start-2,2.4,23,'F');
  this.setFont('times','bold',21,NAVY);
  const lines=p.splitTextToSize(txt(title),INNER-10);
  p.text(lines,L+7,this.y+3);this.y+=lines.length*8.6+7;
  if(subtitle){this.setFont('times','italic',11,GRAY);this.writeLines(subtitle,11,4.7,GRAY,INNER-10,L+7)}
  this.y+=5;
 }
 heading(title,n=1){
  const p=this.pdf;this.ensure(n===1?16:13);
  p.setFillColor(...BLUE);p.rect(L,this.y-4,n===1?2.4:2,7,'F');
  this.setFont('times','bold',n===1?14.5:11.4,NAVY);
  const label=p.splitTextToSize(txt(title),INNER-10);
  for(const line of label){this.ensure(7);p.text(line,L+6,this.y);this.y+=n===1?8.2:6.5}
  if(n===1){p.setDrawColor(...LIGHT);p.line(L+6,this.y-3,RIGHT,this.y-3);this.y+=4}else this.y+=2;
 }
 writeLines(text,size=10,line=4.5,color=NAVY,maxWidth=INNER,indent=L){
  this.setFont('times','normal',size,color);
  const lines=this.pdf.splitTextToSize(txt(text),maxWidth);
  for(const one of lines){this.ensure(line+1);this.pdf.text(one,indent,this.y);this.y+=line}
  this.y+=3;
 }
 caption(text){
  this.setFont('times','italic',8.1,GRAY);
  const lines=this.pdf.splitTextToSize(txt(text),INNER-5);
  for(const line of lines){this.ensure(4.5);this.pdf.text(line,L+2,this.y);this.y+=4.3}
  this.y+=4;
 }
 field(label,value){
  const p=this.pdf,val=txt(value),column=INNER-59;
  this.setFont('times','normal',9,NAVY);
  const lines=p.splitTextToSize(val,column),lineH=4.8;
  this.ensure(Math.max(8,lines.length*lineH+4));
  this.setFont('helvetica','bold',8,GRAY);p.text(txt(label),L+1,this.y);
  this.setFont('times','normal',9,NAVY);
  for(const [i,line] of lines.entries())p.text(line,L+57,this.y+i*lineH);
  this.y+=Math.max(8,lines.length*lineH+3);
 }
 infoTiles(fields,columns=2){
  const p=this.pdf,gap=3,cw=(INNER-gap*(columns-1))/columns;
  for(let i=0;i<fields.length;i+=columns){
   this.ensure(19);const row=fields.slice(i,i+columns),y=this.y;
   row.forEach(([label,value],j)=>{
    const x=L+j*(cw+gap);
    p.setFillColor(248,251,253);p.setDrawColor(...LIGHT);
    p.roundedRect(x,y-4,cw,17,1.4,1.4,'FD');
    p.setFillColor(...PALE);p.rect(x+1.2,y-3,11,15,'F');
    p.setDrawColor(...BLUE);p.line(x+15,y-2,x+15,y+11);
    this.setFont('helvetica','bold',6.6,GRAY);p.text(txt(label).toUpperCase(),x+18,y+1);
    this.setFont('times','normal',9.1,NAVY);
    const fitted=p.splitTextToSize(txt(value),cw-21);
    fitted.slice(0,2).forEach((line,k)=>p.text(line,x+18,y+7+k*3.6));
   });
   this.y+=20.4;
  }
  this.y+=3;
 }
 criteriaCards(definitions){
  const p=this.pdf,gap=2.2,cw=(INNER-gap*(definitions.length-1))/definitions.length;
  this.ensure(34);
  for(let i=0;i<definitions.length;i++){
   const [name,definition]=definitions[i],x=L+i*(cw+gap),start=this.y;
   p.setDrawColor(...LIGHT);p.roundedRect(x,start-4,cw,29,1.5,1.5,'S');
   p.setFillColor(...BLUE);p.rect(x,start-4,cw,7,'F');
   this.setFont('helvetica','bold',8,[255,255,255]);p.text(name,x+2,start+0.8);
   this.setFont('times','normal',7.4,NAVY);
   const lines=p.splitTextToSize(txt(definition),cw-4);
   lines.slice(0,5).forEach((line,k)=>p.text(line,x+2,start+7+k*3.5));
  }
  this.y+=36;
 }
 highlightNote(title,body){
  const p=this.pdf;
  this.setFont('times','normal',8.8,NAVY);
  const lines=p.splitTextToSize(txt(body),INNER-44),height=Math.max(15,lines.length*4.3+6);
  this.ensure(height+4);const y=this.y;
  p.setFillColor(...PALE);p.roundedRect(L,y-3,INNER,height,2,2,'F');
  p.setDrawColor(...BLUE);p.line(L+6,y,L+6,y+height-7);
  this.setFont('times','bold',10,BLUE);p.text(txt(title),L+10,y+4);
  this.setFont('times','normal',8.6,NAVY);
  lines.forEach((line,k)=>p.text(line,L+44,y+4+k*4.3));
  this.y+=height+5;
 }
 // Dense, clean scientific table with variable-height rows and repeated headers.
 table(headers,rows,widths,{font=8,number=null}={}){
  if(number)this.caption(number);
  const p=this.pdf,x0=L,pad=2;
  const drawHead=()=>{
   this.ensure(10);p.setFillColor(...PALE);p.rect(L,this.y-4,INNER,8,'F');
   this.setFont('helvetica','bold',7.4,NAVY);let x=x0;
   headers.forEach((head,j)=>{p.text(txt(head),x+pad,this.y);x+=widths[j]});
   this.y+=8;
  };
  drawHead();
  for(let i=0;i<rows.length;i++){
   this.setFont('times','normal',font,NAVY);
   const pieces=rows[i].map((cell,j)=>p.splitTextToSize(txt(cell),Math.max(6,widths[j]-pad*2)));
   const n=Math.max(1,...pieces.map(v=>v.length)),height=Math.max(7,n*(font*.45)+2.5);
   if(this.y+height>BOTTOM){this.next();drawHead()}
   if(i%2===1){p.setFillColor(250,251,252);p.rect(L,this.y-4,INNER,height,'F')}
   let x=x0;
   for(let j=0;j<headers.length;j++){
    this.setFont('times','normal',font,NAVY);
    const arr=pieces[j];arr.forEach((line,k)=>p.text(line,x+pad,this.y+k*(font*.45)));
    x+=widths[j]
   }
   p.setDrawColor(233,238,242);p.line(L,this.y+height-4,RIGHT,this.y+height-4);
   this.y+=height;
  }
  this.y+=4;
 }
 async displayEquation(entry,{compact=false}={}){
  const best=entry.best||entry,display=reportLatex(best?.latex,best?.ztex),raw=display.latex,z=best?.ztex||'',long=raw.length>105||raw.includes('\\begin{cases}');
  if(!raw){this.writeLines('No se encontró una expresión válida.',9);return}
  const title='Ecuación '+(entry.id||'')+(long?' (expresión extensa)':'');
  this.ensure(long?28:24);
  this.setFont('times','italic',9,GRAY);this.pdf.text(txt(title),L+2,this.y);this.y+=6;
  if(long){
   const no=raw.match(/\\\\/g)?.length||0;
   const note=raw.includes('\\begin{cases}')?
    'Función definida por tramos ('+(no+1)+' expresiones). Se reproduce completa en el anexo de fórmulas.':
    'Expresión extensa. El código LaTeX íntegro se conserva en el anexo de fórmulas.';
   this.writeLines(note,9,4.2,GRAY,INNER-10,L+5);
  }else{
   const img=await equationPNG(raw);
   if(img){
    const displayWidth=Math.min(INNER-14,(compact?16:21)*img.ratio);
    const h=displayWidth/img.ratio;
    this.ensure(h+7);
    this.pdf.setFillColor(247,250,251);this.pdf.roundedRect(L+2,this.y-3,INNER-4,h+6,1.5,1.5,'F');
    this.pdf.addImage(img.data,'PNG',L+6,this.y,displayWidth,h);
    this.y+=h+6;
   }else{
    this.writeLines(raw,8.7,4.4,NAVY,INNER-8,L+4);
   }
  }
  if(z){this.writeLines('Normalización: '+reportLatex('',z).definition,compact?7.2:8.2,compact?3.3:3.9,GRAY)}
 }
 async figure(spec,description,{width=INNER,height=76}={}){
  this.ensure(height+19);
  const captureHeight=Math.max(270,Math.round(920*height/width));
  const png=await screenshotFromDesmos(spec,{width:920,height:captureHeight,ratio:1.22});
  const displayedHeight=width*captureHeight/920;
  this.pdf.addImage(png,'PNG',L,this.y,width,displayedHeight);
  this.y+=displayedHeight+4;
  this.figureNumber++;
  this.caption('Figura '+this.figureNumber+'. '+description+' (gráfica capturada directamente de Desmos).');
 }
 metricGrid(best,{six=false}={}){
  if(!best)return;
  const vals=six?[
   ['MAPE',percent(best.metrics?.mape)],['MaxAPE',percent(best.metrics?.maxape)],
   ['MAE',norm(best.metrics?.mae)],['RMSE',norm(best.metrics?.rmse)],
   ['Validación',percent(best.validationMetrics?.mape)],['Complejidad',norm(best.complexity)]
  ]:[
   ['MAPE',percent(best.metrics?.mape)],['Error máximo',percent(best.metrics?.maxape)],
   ['MAE',norm(best.metrics?.mae)],['Complejidad',norm(best.complexity)]
  ];
  this.ensure(23);
  const p=this.pdf,cell=INNER/vals.length,start=this.y;
  vals.forEach(([label,value],i)=>{
   const x=L+i*cell;
   p.setFillColor(249,251,252);p.setDrawColor(...LIGHT);
   p.roundedRect(x+.4,start-4,cell-1.2,19.5,1.4,1.4,'FD');
   p.setFillColor(...BLUE);p.rect(x+.4,start-4,cell-1.2,5.3,'F');
   this.setFont('helvetica','bold',six?6.6:7.3,[255,255,255]);
   p.text(txt(label),x+2,start-.3);
   const size=value.length>15?7.4:value.length>11?8.3:10.4;
   this.setFont('times','bold',size,NAVY);p.text(value,x+2,start+9);
  });
  this.y+=23;
 }
 miniObservations(source,best,x,y,w){
  const points=source?.points||[],p=this.pdf;
  p.setFillColor(...BLUE);p.rect(x,y,w,7,'F');
  this.setFont('helvetica','bold',7,[255,255,255]);p.text('Muestra de observaciones',x+2,y+4.8);
  const cols=[x+1,x+16,x+37];
  this.setFont('helvetica','bold',6.7,BLUE);
  ['z','Observado','Estimado'].forEach((lab,i)=>p.text(lab,cols[i],y+12));
  sampleIndices(points.length,4).forEach((index,j)=>{
   const [z,observed]=points[index],estimated=best.estimates?.[index],yy=y+18+j*7.1;
   if(j%2===0){p.setFillColor(244,248,251);p.rect(x,yy-4.7,w,6.8,'F')}
   this.setFont('times','normal',7.3,NAVY);
   [norm(z),norm(observed),norm(estimated)].forEach((v,i)=>p.text(v.slice(0,i===0?9:11),cols[i],yy));
  });
  p.setDrawColor(...LIGHT);p.rect(x,y,w,49,'S');
 }
 async winnerCard(entry,index,total,state){
  const p=this.pdf,summary=entry.best;
  this.ensure(113);
  const top=this.y;
  // Pale section title with restrained navy rule; two cards can share one A4 page.
  p.setFillColor(...PALE);p.roundedRect(L,top-5,INNER,11,1.7,1.7,'F');
  p.setFillColor(...BLUE);p.rect(L+2,top-3,2.5,7,'F');
  this.setFont('times','bold',12,NAVY);
  p.text(String(index+1)+'. '+txt(entry.label)+' - '+txt(entry.id),L+9,top+2.1);
  this.y=top+13;
  await this.displayEquation(entry,{compact:true});
  this.metricGrid(summary);
  const graphY=this.y+1,chartW=105,chartH=49;
  const png=await screenshotFromDesmos(plotSpecifications(state.source,summary,'fit'),{
   width:790,height:370,ratio:1.25
  });
  this.ensure(chartH+11);
  p.setDrawColor(...LIGHT);p.roundedRect(L,graphY-1,chartW+1,chartH+2,1.3,1.3,'S');
  p.addImage(png,'PNG',L+1,graphY,chartW-1,chartH);
  this.miniObservations(state.source,summary,L+chartW+6,graphY+1,INNER-chartW-6);
  this.y=graphY+chartH+4;
  this.figureNumber++;
  this.caption('Figura '+this.figureNumber+'. Datos de '+txt(state.source.xName)+' y curva calculada para '+entry.id+' (Desmos).');
  this.y+=1;
 }
 async methodSummary(entry,state,progress){
  const best=entry.best,p=this.pdf,src=state.source||{};
  this.next();this.heading('3. Resultados: '+entry.label+' - '+entry.id);
  this.heading('Configuración del experimento',2);
  this.infoTiles([
   ['Método',entry.label],['Semilla',String(entry.seed)],
   ['Intentos',String(entry.iterations)],['Duración',norm(entry.elapsedMs/1000)+' s']
  ],4);
  if(!best){
   this.highlightNote('Sin ecuación','No hubo una función válida con las restricciones indicadas. El historial se conserva en los anexos.');
   return;
  }
  this.heading('Ecuación del modelo ('+entry.id+')',2);
  await this.displayEquation(entry,{compact:true});
  this.heading('Indicadores de ajuste',2);
  this.metricGrid(best,{six:true});
  this.heading('Observaciones y distribución de errores',2);
  const a=plotSpecifications(src,best,'fit'),b=plotSpecifications(src,best,'histogram');
  this.ensure(53);
  const top=this.y;
  progress?.('Gráfica Desmos de '+entry.id);
  const left=await screenshotFromDesmos(a,{width:740,height:320,ratio:1.2});
  const right=await screenshotFromDesmos(b,{width:600,height:370,ratio:1.2});
  p.setDrawColor(...LIGHT);
  p.roundedRect(L,top-2,104,46,1.5,1.5,'S');
  p.addImage(left,'PNG',L+1,top,102,42);
  p.roundedRect(L+108,top-2,INNER-108,46,1.5,1.5,'S');
  p.addImage(right,'PNG',L+109,top,INNER-110,42);
  this.y=top+49;
  this.figureNumber+=2;
  this.writeLines('Izquierda: referencia y curva estimada de '+txt(src.yName||'Y')+'. Derecha: distribución central del error relativo firmado, con valores extremos excluidos de la visualización (sin excluirlos de las métricas). Figuras capturadas en Desmos.',7.9,3.7,GRAY);
  this.heading('Valores observados y estimados (muestra)',2);
  const selected=sampleIndices(src.points.length,4).map(i=>{
   const pt=src.points[i],estimated=best.estimates?.[i];
   return [norm(pt[0]),norm(pt[1]),norm(estimated),
     pt[1]!==0&&Number.isFinite(estimated)?percent(100*(estimated-pt[1])/Math.abs(pt[1])):'N/D'];
  });
  this.table(['z','Y observada','Y estimada','Error rel. firmado'],selected,[31,49,49,45],{font:8.4});
  const m=best.metrics||{};
  this.highlightNote('Lectura técnica','MAPE '+percent(m.mape)+'; MaxAPE '+percent(m.maxape)+
   '; complejidad '+norm(best.complexity)+'. El modelo requiere validación física dentro del intervalo de datos.');
 }
 annexLatex(entry){
  const formula=reportLatex(entry.best?.latex,entry.best?.ztex),raw=formula.latex;
  if(!raw)return;
  this.ensure(20);this.heading(entry.id+' - '+entry.label,2);
  if(formula.definition)this.writeLines(formula.definition,8.2,4,GRAY);
  // Code lines remain exact, but are wrapped on page so no symbols are clipped.
  this.setFont('courier','normal',7.2,NAVY);
  const lines=this.pdf.splitTextToSize(raw,INNER-8);
  for(const str of lines){this.ensure(4.6);this.setFont('courier','normal',7.2,NAVY);this.pdf.text(txt(str),L+4,this.y);this.y+=3.9}
  this.y+=5;
 }
 async iterationTable(items,id,progress){
  this.next();this.heading('Anexo de iteraciones: '+id);
  this.writeLines('Cada registro conserva la fórmula LaTeX y sus errores. Este anexo no incorpora gráficas.',9);
  const p=this.pdf;
  for(let i=0;i<items.length;i++){
   const it=items[i],formatted=reportLatex(it.latex||'',it.ztex),raw=formatted.latex?(formatted.definition?formatted.definition+'; ':'')+formatted.latex:(it.reason||'Intento no válido');
   this.setFont('courier','normal',7.2,NAVY);
   const lines=p.splitTextToSize(raw,INNER-10),h=11+lines.length*3.85;
   this.ensure(h);
   this.setFont('helvetica','bold',7.8,BLUE);
   p.text('#'+it.iteration+'    MAPE '+percent(it.metrics?.mape)+'    MaxAPE '+percent(it.metrics?.maxape)+
    '    MAE '+norm(it.metrics?.mae)+'    C '+norm(it.complexity),L+2,this.y);
   this.y+=5;
   this.setFont('courier','normal',7.2,NAVY);
   for(const line of lines){this.ensure(4);p.text(txt(line),L+4,this.y);this.y+=3.85}
   p.setDrawColor(...LIGHT);p.line(L,this.y,RIGHT,this.y);this.y+=5;
   if(i%150===0){progress?.('Maquetando iteraciones '+(i+1)+' / '+items.length);await idle()}
  }
 }
}
function coverText(state,reportKind,entries){
 const r=reproducibility(state),src=state.source||{};
 const title='Evaluación comparativa de métodos de aproximación matemática';
 const subtitle=reportKind+' para '+txt(src.yName||'Y')+' en función de '+txt(src.xName||'X');
 return {title,subtitle,r};
}
async function cover(paper,state,entries,kind){
 const {title,subtitle,r}=coverText(state,kind,entries);
 paper.titleBlock(title,subtitle);
 paper.heading('Resumen ejecutivo');
 paper.writeLines('Se presenta un catálogo de las mejores ecuaciones encontradas por método y configuración a partir de los datos proporcionados. Se documentan restricciones, parámetros, precisión y complejidad para facilitar la selección de modelos. Ninguna curva se interpreta automáticamente como ley física ni se garantiza su extrapolación.',9.7,4.4);
 paper.heading('Datos del estudio');
 paper.infoTiles([
  ['Proyecto',state.projectName||'Sin título'],
  ['Fuente',state.source?.sourceName||'Datos importados'],
  ['Variable independiente',namedZ(state.source?.xName||'Variable')],
  ['Propiedad aproximada',state.source?.yName||'Y'],
  ['Observaciones',String(r.observations)],
  ['Intervalo observado',norm(r.xmin)+' a '+norm(r.xmax)],
  ['Configuraciones',String(r.configs)],
  ['Iteraciones registradas',String(r.runs)]
 ]);
 paper.heading('Criterios de lectura');
 paper.criteriaCards([
  ['MAPE','Error porcentual absoluto medio, sin valores reales cero.'],
  ['MaxAPE','Mayor error porcentual absoluto observado.'],
  ['MAE','Error absoluto medio en las unidades de la propiedad.'],
  ['Complejidad','Índice de estructura de la expresión, no costo de CPU.']
 ]);
 paper.highlightNote('Nota científica','Informe automatizado; no revisado por pares. La validez física y los límites del intervalo deben comprobarse.');
}

async function methodology(paper,state){
 paper.next();paper.heading('1. Metodología');
 paper.writeLines('Se evaluaron los métodos y configuraciones seleccionados en Mate-fx. Los métodos deterministas obtienen una solución por configuración; los procedimientos estocásticos exploran los candidatos autorizados durante las iteraciones disponibles. Se registra la mejor ecuación encontrada para cada configuración, no necesariamente el óptimo global.',10.2,4.7);
 const entries=state.entries||[];
 const sets=new Set(entries.map(e=>e.method));
 paper.field('Familias / métodos distintos',sets.size);
 paper.field('Configuraciones ejecutadas',entries.length);
 paper.field('Criterios y límites','Decimales, magnitud máxima, operadores, grados y restricciones propios de cada configuración.');
 paper.heading('1.1 Indicadores de evaluación',2);
 paper.table(['Indicador','Descripción'],[
  ['MAPE (%)','Promedio de 100 * |y calculada - y real| / |y real|, con y real distinto de cero.'],
  ['MaxAPE (%)','Máximo de los errores porcentuales absolutos definidos.'],
  ['MAE','Media de los errores absolutos.'],
  ['RMSE','Raíz cuadrada de la media de errores al cuadrado.'],
  ['Complejidad','Índice interno de estructura de la función.'],
  ['Validación','Error en puntos retenidos cuando la ejecución dispuso de partición de validación.']
 ],[39,135],{font:9});
 paper.heading('1.2 Reproducibilidad',2);
 paper.writeLines('Para reproducir cada ecuación, el reporte individual incluye el método, identificador, parámetros, semilla y número de iteraciones. Las tablas comparativas conservan una fila por configuración, incluso cuando dos métodos producen fórmulas iguales o equivalentes.',9.5);
}
async function comparison(paper,state,entries){
 paper.heading('2. Resultados comparativos');
 const sorted=[...entries].sort(byMape),winners=sorted.filter(e=>Number.isFinite(e.best?.metrics?.mape));
 if(winners.length){
  const best=winners[0],easy=[...winners].sort((a,b)=>a.best.complexity-b.best.complexity)[0];
  paper.writeLines('Se documentaron '+entries.length+' ecuaciones ganadoras. El menor MAPE observado corresponde a '+
   best.id+' ('+best.label+'): '+percent(best.best.metrics?.mape)+
   '. La expresión menos compleja en este conjunto es '+easy.id+' ('+easy.label+'), con complejidad '+norm(easy.best.complexity)+'. Estas comparaciones describen los resultados de la ejecución, no la superioridad universal de los algoritmos.',9.4,4.5);
 }
 const rows=sorted.map(e=>[e.id,e.label,percent(e.best?.metrics?.mape),percent(e.best?.metrics?.maxape),
  norm(e.best?.metrics?.mae),norm(e.best?.complexity)]);
 paper.table(['ID','Método','MAPE','MaxAPE','MAE','C'],rows,[15,67,24,26,24,18],{font:8});
 paper.caption('Tabla 1. Mejores ecuaciones por configuración, ordenadas por MAPE. Los valores de error son los de la evaluación realizada por el motor.');
 if(sorted.length){
  const best=[...sorted].find(e=>Number.isFinite(e.best?.metrics?.mape));
  const simple=[...sorted].sort((a,b)=>scalar(a.best?.complexity)-scalar(b.best?.complexity))[0];
  const stable=[...sorted].sort((a,b)=>scalar(a.best?.metrics?.maxape)-scalar(b.best?.metrics?.maxape))[0];
  paper.heading('Hallazgos clave',2);
  paper.infoTiles([
   ['Menor MAPE',best?best.id+' | '+percent(best.best.metrics.mape):'N/D'],
   ['Menor complejidad',simple?simple.id+' | '+norm(simple.best.complexity):'N/D'],
   ['Menor MaxAPE',stable?stable.id+' | '+percent(stable.best.metrics.maxape):'N/D']
  ],3);
 }

}
async function comparisonFigures(paper,state,entries,progress){
 if(!entries.length)return;
 const chartEntries=entries.map(e=>({id:e.id,best:e.best}));
 paper.heading('3. Análisis visual');
 progress?.('Capturando el dashboard de comparación directamente desde Desmos');
 await paper.figure(plotSpecifications(state.source,entries[0].best,'complexity',chartEntries),
  'Relación entre complejidad y log10(MAPE %), para visualizar errores de órdenes de magnitud diferentes.',{height:65});
 progress?.('Capturando la comparación de errores desde Desmos');
 await paper.figure(plotSpecifications(state.source,entries[0].best,'comparison',chartEntries),
  'log10(MAPE %) y log10(MaxAPE %) por configuración. Ambas series son porcentuales y no se mezclan con MAE.',{height:65});
 paper.writeLines('Las figuras comparativas deben interpretarse junto con la Tabla 1: una curva visualmente cercana a los puntos no garantiza un MAPE bajo ni un comportamiento físicamente válido.',9.4,4.5);
}
async function winners(paper,state,entries,progress){
 paper.next();paper.heading('4. Catálogo de ecuaciones ganadoras');
 paper.writeLines('Se conserva una ecuación por método y configuración. Las gráficas son capturas auténticas de Desmos, mientras que las métricas proceden de la evaluación numérica de Mate-fx.',9.3);
 for(let i=0;i<entries.length;i++){
  progress?.('Diagramando ecuaciones '+(i+1)+' / '+entries.length);
  await paper.winnerCard(entries[i],i,entries.length,state);
  if(i%4===0)await idle();
 }
 const extended=entries.filter(e=>e.best?.latex&&(e.best.latex.length>105||e.best.latex.includes('\\begin{cases}')));
 if(extended.length){
  paper.next();paper.heading('Anexo A. Expresiones LaTeX extensas');
  paper.writeLines('Las ecuaciones extensas y por tramos se reproducen aquí de forma íntegra para evitar que queden microscópicas sobre las gráficas.',9);
  extended.forEach(e=>paper.annexLatex(e));
 }
}
function finalize(pdf,file,onProgress){
 onProgress?.('Descargando '+file);
 pdf.save(file);
 return file;
}
export async function generalReport(state,nameOf,onProgress=()=>{}){
 const entries=dataOf(state);
 if(!entries.length)throw Error('No hay ecuaciones válidas para el reporte general.');
 // Respect public callback name; the method registry supplies the category.
 if(typeof nameOf==='function')entries.forEach(e=>e.label=nameOf(e.method)||e.label);
 const ctor=await PDFConstructor(),pdf=new ctor({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title:'Mate-fx - Estudio comparativo de aproximaciones',creator:'Mate-fx',subject:'Catálogo de ecuaciones con métricas'});
 const paper=new Paper(pdf,'Catálogo general');
 await cover(paper,state,entries,'Estudio comparativo');
 await methodology(paper,state);
 paper.next();
 await comparison(paper,state,entries);
 await comparisonFigures(paper,state,entries,onProgress);
 await winners(paper,state,entries,onProgress);
 const file='Matefx_Paper_Catalogo_General_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 return finalize(pdf,file,onProgress);
}
export async function methodReport(state,id,name,onProgress=()=>{}){
 const entries=dataOf(state,false).filter(e=>e.method===id&&state.history.has(e.id));
 if(!entries.length)throw Error('No hay resultados válidos registrados para el método seleccionado.');
 const ctor=await PDFConstructor(),pdf=new ctor({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title:'Mate-fx - '+name,creator:'Mate-fx',subject:'Informe de método e historial de iteraciones'});
 const paper=new Paper(pdf,name);
 const scoped={...state,entries:state.entries.filter(e=>e.method===id)};
 await cover(paper,scoped,entries,'Estudio del método '+name);
 await methodology(paper,scoped);
 paper.heading('2. Configuraciones analizadas');
 paper.table(['ID','Semilla','Iteraciones','MAPE','MaxAPE','Complejidad'],
  entries.map(e=>[e.id,e.seed,e.iterations,percent(e.best?.metrics?.mape),percent(e.best?.metrics?.maxape),norm(e.best?.complexity)]),
  [20,27,35,34,35,23],{font:8.8});
 for(const e of entries){
  await paper.methodSummary(e,state,onProgress);
  paper.next();paper.heading('Anexo A. Configuración completa y resultados - '+e.id);
  paper.field('Método',e.label);
  paper.field('Configuración',JSON.stringify(e.config));
  paper.field('Semilla',String(e.seed));
  paper.field('Tiempo',norm(e.elapsedMs/1000)+' s');
  paper.heading('Errores y validación',2);
  paper.table(['Indicador','Valor'],metricRows(e.best),[114,60],{font:9});
  if(e.best){
   paper.heading('Errores por intervalos de z',2);
   paper.table(['Intervalo de z','N.º puntos','MAPE','MaxAPE'],
    perInterval(state.source.points,e.best.estimates),[61,27,43,43],{font:8.5});
   paper.heading('Datos observados y calculados',2);
   paper.table(['z','Y real','Y calculada','Error abs.','Error (%)'],
    allValueErrors(state.source.points,e.best.estimates),[30,35,38,36,35],{font:8});
   paper.next();paper.heading('Anexo B. Ecuación completa en LaTeX');
   paper.annexLatex(e);
  }
  await paper.iterationTable(state.history.get(e.id)||[],e.id,onProgress);
 }
 const filename='Matefx_Paper_'+slug(name)+'_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 return finalize(pdf,filename,onProgress);
}
