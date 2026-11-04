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
  const node=await mj.tex2svgPromise(String(latex).replace(/^f\(x\)=/,'f(x)='),{display:true});
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
function dataOf(state){
 const entries=(state.entries||[]).map(entry=>{
  const result=state.results.get(entry.id);
  return {...entry,best:result?.best||null,elapsedMs:result?.elapsedMs||0,iterations:state.history.get(entry.id)?.length||0,
   label:methodById(entry.method)?.name||entry.method,group:methodById(entry.method)?.group||'Método'};
 });
 return entries.filter(e=>e.best);
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
  this.ensure(45);this.kicker('Documento técnico automatizado');
  this.setFont('times','bold',21,NAVY);
  const lines=this.pdf.splitTextToSize(txt(title),INNER);
  this.pdf.text(lines,L,this.y);this.y+=lines.length*9+5;
  if(subtitle){this.setFont('times','italic',11,GRAY);this.writeLines(subtitle,11,4.7)}
  this.separator();
 }
 heading(title,n=1){
  this.ensure(n===1?16:13);
  this.setFont('times','bold',n===1?14:11,NAVY);this.pdf.text(txt(title),L,this.y);
  this.y+=n===1?10:8;
 }
 writeLines(text,size=10,line=4.5,color=NAVY,maxWidth=INNER,indent=L){
  this.setFont('times','normal',size,color);
  const lines=this.pdf.splitTextToSize(txt(text),maxWidth);
  for(const one of lines){this.ensure(line+1);this.pdf.text(one,indent,this.y);this.y+=line}
  this.y+=3;
 }
 caption(text){
  this.setFont('times','italic',8.3,GRAY);
  const lines=this.pdf.splitTextToSize(txt(text),INNER-4);
  for(const line of lines){this.ensure(4.5);this.pdf.text(line,L+2,this.y);this.y+=4.3}
  this.y+=5;
 }
 field(label,value){
  this.ensure(6);this.setFont('helvetica','bold',8,GRAY);this.pdf.text(txt(label),L+1,this.y);
  this.setFont('times','normal',9,NAVY);
  const lines=this.pdf.splitTextToSize(txt(value),INNER-57);
  lines.forEach((line,i)=>{if(i)this.ensure(5);this.pdf.text(line,L+56,this.y);if(i)this.y+=4.5});
  this.y+=7;
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
  const best=entry.best||entry,raw=best?.latex||'',z=best?.ztex||'',long=raw.length>175||raw.includes('\\begin{cases}');
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
    const h=Math.min(compact?16:21,Math.max(8,(INNER-14)/img.ratio));
    this.ensure(h+7);
    this.pdf.setFillColor(247,250,251);this.pdf.roundedRect(L+2,this.y-3,INNER-4,h+6,1.5,1.5,'F');
    this.pdf.addImage(img.data,'PNG',L+6,this.y,Math.min(INNER-14,h*img.ratio),h);
    this.y+=h+6;
   }else{
    this.writeLines(raw,8.7,4.4,NAVY,INNER-8,L+4);
   }
  }
  if(z&&!compact){this.writeLines('Variable normalizada: z = '+z,8.2,3.9,GRAY)}
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
 metricGrid(best){
  if(!best)return;
  const vals=[
   ['MAPE',percent(best.metrics?.mape)],['Error máximo',percent(best.metrics?.maxape)],
   ['MAE',norm(best.metrics?.mae)],['Complejidad',norm(best.complexity)]
  ];
  this.ensure(20);const cell=INNER/4,p=this.pdf;
  vals.forEach(([label,value],i)=>{
   const x=L+i*cell;p.setDrawColor(...LIGHT);p.rect(x,this.y-5,cell-1,17,'S');
   this.setFont('helvetica','normal',7.5,GRAY);p.text(label,x+3,this.y);
   this.setFont('times','bold',11,NAVY);p.text(value,x+3,this.y+7);
  });
  this.y+=23;
 }
 async winnerCard(entry,index,total,state){
  const topLine=entry.label+' · '+entry.id;
  const best=entry.best;
  // Each card occupies its natural height; no mandatory page break.
  this.ensure(118);
  this.heading(String(index+1)+'. '+topLine,2);
  await this.displayEquation(entry,{compact:true});
  this.metricGrid(best);
  await this.figure(plotSpecifications(state.source,best,'fit'),
   'Valores de referencia (puntos azules) y valores calculados (trazo naranja). '+txt(state.source.xName)+' frente a '+txt(state.source.yName)+'.',
   {width:INNER,height:55});
 }
 annexLatex(entry){
  const raw=entry.best?.latex||'';
  if(!raw)return;
  this.ensure(20);this.heading(entry.id+' - '+entry.label,2);
  if(entry.best.ztex)this.writeLines('z = '+entry.best.ztex,8.2,4,GRAY);
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
   const it=items[i],raw=(it.ztex?'z='+it.ztex+'; ':'')+(it.latex||it.reason||'Intento no válido');
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
 paper.heading('Resumen');
 paper.writeLines('Se presenta un catálogo de las mejores ecuaciones encontradas por método y configuración, a partir de un conjunto de datos definido por el usuario. Se conservan las restricciones del experimento y se comparan la precisión y la complejidad de cada expresión. Los resultados no implican el descubrimiento de una ley física ni garantizan una aproximación fuera del intervalo estudiado.',10.2,4.8);
 paper.heading('Datos y alcance');
 paper.field('Proyecto',state.projectName||'Sin título');
 paper.field('Fuente proporcionada',state.source?.sourceName||'Datos importados');
 paper.field('Variable independiente',state.source?.xName||'X');
 paper.field('Propiedad aproximada',state.source?.yName||'Y');
 paper.field('Observaciones',String(r.observations));
 paper.field('Intervalo observado',norm(r.xmin)+' a '+norm(r.xmax));
 paper.field('Configuraciones',r.configs+' ('+r.methods+' métodos distintos)');
 paper.field('Iteraciones registradas',String(r.runs));
 paper.heading('Criterios de lectura');
 paper.writeLines('MAPE: error porcentual absoluto medio, calculado solo donde el valor observado es distinto de cero. MaxAPE: mayor error porcentual absoluto. MAE: error absoluto medio en las unidades de la propiedad. El índice de complejidad describe la expresión generada y no representa un costo de CPU medido experimentalmente.',9.5,4.5);
 paper.writeLines('Los resultados proceden del proyecto de Mate-fx indicado arriba. La validez física, la incertidumbre de los datos de referencia y las extrapolaciones deben evaluarse antes del uso ingenieril.',9,4.3,GRAY);
 paper.separator();
 paper.kicker('Documento generado automáticamente | No revisado por pares');
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
}
async function comparisonFigures(paper,state,entries,progress){
 if(!entries.length)return;
 const chartEntries=entries.map(e=>({id:e.id,best:e.best}));
 paper.heading('3. Análisis visual');
 progress?.('Capturando el dashboard de comparación directamente desde Desmos');
 await paper.figure(plotSpecifications(state.source,entries[0].best,'complexity',chartEntries),
  'Relación entre el índice de complejidad de las expresiones y el error medio porcentual.',{height:79});
 progress?.('Capturando la comparación de errores desde Desmos');
 await paper.figure(plotSpecifications(state.source,entries[0].best,'comparison',chartEntries),
  'Error medio y error máximo de las configuraciones, en el orden mostrado.',{height:79});
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
 const extended=entries.filter(e=>e.best?.latex&&(e.best.latex.length>175||e.best.latex.includes('\\begin{cases}')));
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
 await comparison(paper,state,entries);
 await comparisonFigures(paper,state,entries,onProgress);
 await winners(paper,state,entries,onProgress);
 const file='Matefx_Paper_Catalogo_General_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 return finalize(pdf,file,onProgress);
}
export async function methodReport(state,id,name,onProgress=()=>{}){
 const entries=dataOf(state).filter(e=>e.method===id);
 if(!entries.length)throw Error('No hay resultados válidos registrados para el método seleccionado.');
 const ctor=await PDFConstructor(),pdf=new ctor({orientation:'portrait',unit:'mm',format:'a4',compress:true});
 pdf.setProperties({title:'Mate-fx - '+name,creator:'Mate-fx',subject:'Informe de método e historial de iteraciones'});
 const paper=new Paper(pdf,name);
 const scoped={...state,entries:state.entries.filter(e=>e.method===id)};
 await cover(paper,scoped,entries,'Estudio del método '+name);
 await methodology(paper,scoped);
 paper.heading('2. Configuraciones analizadas');
 paper.table(['ID','Semilla','Iteraciones','MAPE','MaxAPE','Complejidad'],
  entries.map(e=>[e.id,e.seed,e.iterations,percent(e.best.metrics?.mape),percent(e.best.metrics?.maxape),norm(e.best.complexity)]),
  [20,27,35,34,35,23],{font:8.8});
 for(const e of entries){
  paper.next();paper.heading('3. Resultados de '+e.label+' - '+e.id);
  paper.field('Configuración',JSON.stringify(e.config));
  paper.field('Semilla de ejecución',e.seed);
  paper.field('Intentos registrados',e.iterations);
  paper.field('Tiempo de cálculo',norm(e.elapsedMs/1000)+' s');
  await paper.displayEquation(e);
  paper.heading('3.1 Indicadores de ajuste',2);
  paper.table(['Indicador','Valor'],metricRows(e.best),[114,60],{font:9});
  paper.heading('3.2 Observaciones y curva',2);
  onProgress('Capturando gráfica real de Desmos: '+e.id);
  await paper.figure(plotSpecifications(state.source,e.best,'fit'),
   'Observaciones originales frente a la ecuación ganadora de '+e.id+'. '+txt(state.source.xName)+' / '+txt(state.source.yName)+'.',{height:83});
  paper.heading('3.3 Distribución de errores',2);
  await paper.figure(plotSpecifications(state.source,e.best,'percentage'),
   'Error porcentual absoluto según el valor de '+txt(state.source.xName)+'.',{height:83});
  paper.table(['Intervalo de X','N.º puntos','MAPE','MaxAPE'],perInterval(state.source.points,e.best.estimates),
   [61,27,43,43],{font:8.5});
  paper.heading('3.4 Valores observados y estimados',2);
  paper.table(['X','Y real','Y calculada','Error abs.','Error (%)'],
   allValueErrors(state.source.points,e.best.estimates),[30,35,38,36,35],{font:8});
  paper.next();paper.heading('Anexo. Ecuación completa en LaTeX');
  paper.annexLatex(e);
  await paper.iterationTable(state.history.get(e.id)||[],e.id,onProgress);
 }
 const filename='Matefx_Paper_'+slug(name)+'_'+slug(state.projectName)+'_'+new Date().toISOString().slice(0,10)+'.pdf';
 return finalize(pdf,filename,onProgress);
}
