/* Extensión de escritorio: CSV/XLSX -> puntos en la API oficial de Desmos. */
if (['mate','prime'].includes(document.body.dataset.gmrLab)) {
  const lab=document.body.dataset.gmrLab,desktop=window.matefxDesktop;
  let dataset=null,points=[],lastCalculator=null;
  const trigger=document.createElement('button');trigger.className='gmr-data-open';trigger.textContent='▦ Datos CSV / Excel';trigger.type='button';document.body.append(trigger);
  const overlay=document.createElement('div');overlay.className='gmr-data-overlay';overlay.hidden=true;
  overlay.innerHTML=`<section class="gmr-data-dialog" role="dialog" aria-modal="true" aria-label="Datos de investigación">
  <div class="gmr-data-top"><div><h2>Importar datos a la gráfica</h2><p>Selecciona un CSV o XLSX y decide qué columna utilizar en cada eje.</p></div><button id="ds-close" aria-label="Cerrar">×</button></div>
  <div class="gmr-data-controls"><button class="gmr-data-primary" id="ds-open">Abrir archivo CSV / XLSX</button><button class="gmr-data-secondary" id="ds-sample">Ejemplo: agua saturada A-4</button><button class="gmr-data-secondary" id="ds-export" disabled>Exportar CSV</button><button class="gmr-data-secondary" id="ds-export-json" disabled>JSON</button><small id="ds-filename">Sin archivo</small></div>
  <div class="gmr-data-controls"><label>Eje X<select id="ds-x" disabled></select></label><label>Eje Y<select id="ds-y" disabled></select></label><label>Estilo<select id="ds-lines"><option value="0">Solo puntos</option><option value="1">Puntos y líneas</option></select></label></div>
  <div class="gmr-data-controls"><button class="gmr-data-primary" id="ds-plot" disabled>Graficar en Desmos</button><button class="gmr-data-secondary" id="ds-fit" disabled>Encuadrar puntos</button><button class="gmr-data-secondary" id="ds-remove" disabled>Eliminar gráfica</button></div>
  <p id="ds-status" class="gmr-data-info" role="status">Carga un archivo para obtener una vista previa y graficar los puntos.</p>
  <canvas id="ds-preview" class="gmr-data-preview" width="800" height="180"></canvas><div id="ds-table" class="gmr-data-table"></div>
  <div class="gmr-data-controls"><label>Clave personal de Desmos<input id="ds-api" placeholder="Clave API (opcional para probar)" autocomplete="off"></label><button class="gmr-data-secondary" id="ds-save-key">Guardar clave</button></div>
  <span class="gmr-data-tip">Hasta 10 000 filas · ExcelJS se carga desde CDN para archivos XLSX · Se ignoran filas con coordenadas no numéricas · La vista previa funciona sin Internet. Desmos requiere conexión y una API key válida. Si cambias la clave, reinicia la aplicación.</span>
  </section>`;
  document.body.append(overlay);
  const $=id=>overlay.querySelector('#'+id);
  const status=t=>$('ds-status').textContent=t;
  const calc=()=>lab==='mate'?window.__matefxCalculator:window.__nPrimosCalculator;
  window.__gmrGetDatasetSelection=()=>dataset?{dataset,xColumn:$('ds-x').value,yColumn:$('ds-y').value,points:points.slice()}:null;
  const number=value=>{
    if(typeof value==='number')return Number.isFinite(value)?value:NaN;
    let s=String(value??'').trim().replace(/\s/g,'');if(!s)return NaN;
    if(/^[-+]?\d{1,3}(\.\d{3})+,\d+$/.test(s))s=s.replaceAll('.','').replace(',','.');
    else if(/^[-+]?\d+,\d+$/.test(s))s=s.replace(',','.');
    if(!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(s))return NaN;
    const n=Number(s);return Number.isFinite(n)?n:NaN;
  };
  function preview(){
    const canvas=$('ds-preview'),ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);ctx.font='12px system-ui';
    if(!points.length){ctx.fillStyle='#667';ctx.fillText('Vista previa de puntos',25,30);return}
    let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;
    points.forEach(([x,y])=>{x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)});
    const dx=x1-x0||1,dy=y1-y0||1,p=28;
    ctx.strokeStyle='#bdccdf';ctx.beginPath();ctx.moveTo(p,12);ctx.lineTo(p,h-p);ctx.lineTo(w-10,h-p);ctx.stroke();
    ctx.fillStyle='#496180';ctx.fillText(String(+x0.toPrecision(5)),p,h-7);ctx.fillText(String(+x1.toPrecision(5)),w-85,h-7);
    if($('ds-lines').value==='1'){
      ctx.beginPath();points.forEach(([x,y],i)=>{const a=p+(x-x0)/dx*(w-p-13),b=h-p-(y-y0)/dy*(h-p-14);i?ctx.lineTo(a,b):ctx.moveTo(a,b)});
      ctx.strokeStyle='#83a9df';ctx.stroke();
    }
    ctx.fillStyle='#275fc0';points.slice(0,10000).forEach(([x,y])=>{ctx.beginPath();ctx.arc(p+(x-x0)/dx*(w-p-13),h-p-(y-y0)/dy*(h-p-14),1.9,0,7);ctx.fill()});
  }
  function recalc(){
    if(!dataset)return;
    const x=$('ds-x').value,y=Number($('ds-y').value);points=[];
    dataset.rows.forEach((row,i)=>{const vx=x==='__index__'?i+1:number(row[+x]),vy=number(row[y]);if(Number.isFinite(vx)&&Number.isFinite(vy))points.push([vx,vy])});
    $('ds-plot').disabled=$('ds-fit').disabled=points.length===0;
    dataset.xColumn=x;dataset.yColumn=String(y);
    window.dispatchEvent(new CustomEvent('gmr:dataset-selection',{detail:{lab,dataset,xColumn:x,yColumn:String(y)}}));
    status(`${points.length} puntos válidos de ${dataset.rows.length} filas. Selección: X=${$('ds-x').selectedOptions[0]?.textContent}, Y=${$('ds-y').selectedOptions[0]?.textContent}.`);
    preview();
  }
  function populate(data, options = {}){
    if(!data?.headers?.length||!Array.isArray(data.rows))throw Error('El archivo no tiene encabezados.');
    dataset=data;
    $('ds-filename').textContent=`${data.filename}: ${data.rows.length} filas`;
    for(const id of ['ds-x','ds-y']){
      const select=$(id);select.disabled=false;select.replaceChildren();
      data.headers.forEach((name,i)=>{const opt=document.createElement('option');opt.value=i;opt.textContent=name;select.add(opt)})
    }
    const idx=document.createElement('option');idx.value='__index__';idx.textContent='Número de fila';$('ds-x').prepend(idx);
    const numeric=data.headers.map((_,i)=>({i,n:data.rows.slice(0,100).filter(row=>Number.isFinite(number(row[i]))).length})).filter(x=>x.n>0).sort((a,b)=>b.n-a.n);
    $('ds-x').value=data.xColumn!==undefined?String(data.xColumn):(numeric.length>=2?String(numeric[0].i):'__index__');
    $('ds-y').value=data.yColumn!==undefined?String(data.yColumn):String(numeric.length>=2?numeric[1].i:numeric[0]?.i??0);
    if(!$('ds-x').selectedOptions.length)$('ds-x').value='__index__';
    if(!$('ds-y').selectedOptions.length)$('ds-y').value=String(numeric[0]?.i??0);
    $('ds-export').disabled=$('ds-export-json').disabled=$('ds-remove').disabled=false;
    const table=document.createElement('table'),tr=document.createElement('tr');
    data.headers.forEach(s=>{const th=document.createElement('th');th.textContent=s;tr.append(th)});table.append(tr);
    data.rows.slice(0,8).forEach(r=>{const tr=document.createElement('tr');r.forEach(v=>{const td=document.createElement('td');td.textContent=v;tr.append(td)});table.append(tr)});
    $('ds-table').replaceChildren(table);recalc();
    if(lab==='prime' && document.body.dataset.graphEngine==='desmos' && points.length) plot();
    if (options.notify !== false) window.dispatchEvent(new CustomEvent('gmr:dataset-imported',{detail:{lab,dataset:data}}));
  }
  function resetDataset() {
    removePlots();
    lastCalculator=null;dataset=null;points=[];
    window.dispatchEvent(new CustomEvent('gmr:dataset-selection',{detail:{lab,dataset:null,xColumn:'__index__',yColumn:0}}));
    $('ds-filename').textContent='Sin archivo';
    ['ds-export','ds-export-json','ds-plot','ds-fit','ds-remove'].forEach(k=>$(k).disabled=true);
    ['ds-x','ds-y'].forEach(k=>{$(k).replaceChildren();$(k).disabled=true});
    $('ds-table').replaceChildren();
    status('Proyecto sin datos. Importa un CSV/XLSX o utiliza el archivo de ejemplo.');
    preview();
  }
  function csvCell(v) {
    const s=String(v??''); return /[;"\r\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }
  function exportCsv(data) {
    const rows=[data.headers,...data.rows];
    const body='\uFEFF'+rows.map(r=>r.map(csvCell).join(';')).join('\r\n')+'\r\n';
    const b=new Blob([body],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(b),a=document.createElement('a');
    a.href=url;a.download=(data.filename||'investigacion').replace(/\.(xlsx|xls|csv|json)$/i,'')+'.csv';
    a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.addEventListener('gmr:project-switched', e=>{
    if(e.detail?.lab!==lab)return;
    if(e.detail.dataset)populate(e.detail.dataset,{notify:false}); else resetDataset();
  });
  if(lab==='prime')window.dispatchEvent(new CustomEvent('gmr:dataset-request',{
    detail:{lab,respond:d=>{if(d)populate(d,{notify:false});else resetDataset();}}
  }));
  const id='__gmr_data_plot_';
  let renderedChunks=0;
  function removePlots(){
    const c=lastCalculator||calc();if(!c)return;
    for(let i=0;i<Math.max(40,renderedChunks);i++)try{c.removeExpression({id:id+i})}catch(_){}
    try{c.removeExpression({id:'gmr_dataset_desktop'})}catch(_){}
    renderedChunks=0;
  }
  function plot(){
    if(!points.length)return;
    const c=calc();
    if(!c||(lab==='mate'&&!document.body.classList.contains('gmr-real-desmos'))||(lab==='prime'&&document.body.dataset.graphEngine!=='desmos')){
      status('Vista previa local lista. Activa «Desmos» en el laboratorio para graficar los puntos en el plano principal.');return;
    }
    try{
      lastCalculator=c;
      removePlots();
      const chunkSize=250;
      const required=Math.ceil(points.length/chunkSize);
      for(let chunk=0;chunk<required;chunk++){
        const subset=points.slice(chunk*chunkSize,(chunk+1)*chunkSize);
        const xs=subset.map(p=>String(+p[0].toPrecision(12)));
        const ys=subset.map(p=>String(+p[1].toPrecision(12)));
        c.setExpression({id:id+chunk,secret:true,
          latex:`([${xs.join(',')}],[${ys.join(',')}])`,
          color:'#2d70db',points:true,lines:$('ds-lines').value==='1'});
      }
      renderedChunks=required;
      status(`✓ ${points.length} puntos graficados en Desmos. La tabla se consulta desde el botón rojo «Ver tabla».`);
    }catch(e){status('No fue posible graficar: '+e.message)}
  }
  function fit(){
    const c=calc();if(!points.length||!c)return;
    const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),x0=Math.min(...xs),x1=Math.max(...xs),y0=Math.min(...ys),y1=Math.max(...ys);
    const dx=(x1-x0||1)*.08,dy=(y1-y0||1)*.08;
    try{c.setMathBounds({left:x0-dx,right:x1+dx,bottom:y0-dy,top:y1+dy})}catch(e){status(e.message)}
  }
  function parseCsv(text){
    text=text.replace(/^\uFEFF/,'');const header=text.split(/\r?\n/,1)[0],sep=[',',';','\t'].sort((a,b)=>header.split(b).length-header.split(a).length)[0];
    const all=[];let row=[],cell='',quoted=false;
    for(let i=0;i<text.length;i++){
      const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++}else quoted=!quoted}
      else if(c===sep&&!quoted){row.push(cell);cell=''}
      else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))all.push(row);row=[];cell='';if(all.length>10000)break}
      else cell+=c;
    }
    row.push(cell);if(row.some(v=>v.trim()))all.push(row);
    if(all.length<2)throw Error('Archivo sin datos suficientes');return all;
  }
  // GitHub Pages no dispone del proceso Node.js de Electron. Se utiliza
  // ExcelJS en el navegador para importar XLSX sin enviar archivos a servidores.
  let excelJsPromise;
  function loadExcelJS(){
    if(window.ExcelJS?.Workbook)return Promise.resolve(window.ExcelJS);
    if(excelJsPromise)return excelJsPromise;
    excelJsPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const sources=[
        'https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',
        'https://unpkg.com/exceljs@4.4.0/dist/exceljs.min.js'
      ];
      let index=0;
      const next=()=>{
        if(index>=sources.length){excelJsPromise=null;reject(new Error('No se pudo descargar el lector de Excel. Comprueba tu conexión.'));return}
        script.src=sources[index++];
      };
      script.onload=()=>window.ExcelJS?.Workbook?resolve(window.ExcelJS):next();
      script.onerror=next;
      document.head.append(script);
      next();
    });
    return excelJsPromise;
  }
  function excelCellValue(cell){
    const v=cell?.value;
    if(v==null)return '';
    if(v instanceof Date)return v.toISOString();
    if(typeof v==='object'){
      if('result' in v)return String(v.result??'');
      if('text' in v)return String(v.text??'');
      if('richText' in v)return v.richText.map(x=>x.text||'').join('');
      if('error' in v)return String(v.error||'');
      return String(cell.text||'');
    }
    return String(v);
  }
  async function parseXlsx(file){
    if(file.size>20*1024*1024)throw Error('El archivo excede el límite de 20 MB');
    const ExcelJS=await loadExcelJS();
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const sheet=workbook.worksheets.find(s=>s.actualRowCount>0);
    if(!sheet)throw Error('El libro no contiene hojas con datos.');
    const ncols=Math.min(sheet.columnCount||0,50);
    if(!ncols)throw Error('La hoja seleccionada no tiene columnas.');
    const headers=Array.from({length:ncols},(_,i)=>excelCellValue(sheet.getRow(1).getCell(i+1))||`Columna ${i+1}`);
    const rows=[];
    const end=Math.min(sheet.rowCount,10001);
    for(let i=2;i<=end;i++){
      const row=sheet.getRow(i);
      if(!row.hasValues)continue;
      const cells=Array.from({length:ncols},(_,j)=>excelCellValue(row.getCell(j+1)));
      if(cells.some(v=>v.trim()))rows.push(cells);
    }
    if(!rows.length)throw Error('La hoja no contiene registros debajo de la cabecera.');
    return {filename:file.name,headers,rows,sheet:sheet.name};
  }
  trigger.onclick=()=>{overlay.hidden=false;preview()};
  $('ds-close').onclick=()=>overlay.hidden=true;
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.hidden=true});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)overlay.hidden=true});
  $('ds-open').onclick=async()=>{
    try{
      if(desktop){const data=await desktop.openDataset();if(data)populate(data)}
      else{
        const input=document.createElement('input');input.type='file';input.accept='.csv,.xlsx';
        input.onchange=async()=>{
          try{
            const file=input.files?.[0];if(!file)return;
            if(file.size>20*1024*1024)throw Error('El archivo excede el límite de 20 MB');
            if(file.name.toLowerCase().endsWith('.xlsx')){status('Leyendo Excel en el navegador…');populate(await parseXlsx(file));return}
            const all=parseCsv(await file.text());populate({filename:file.name,headers:all[0],rows:all.slice(1),sheet:''});
          }catch(e){status('Error: '+e.message)}
        };input.click();
      }
    }catch(e){status('No se pudo cargar el archivo: '+e.message)}
  };
  $('ds-export-json').onclick=async()=>{
    if(!dataset)return;
    try{if(desktop)await desktop.exportDataset(dataset);
    else{const b=new Blob([JSON.stringify(dataset,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='investigacion.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}}catch(e){status(e.message)}
  };
  $('ds-export').onclick=()=>{if(dataset)exportCsv(dataset)};
  $('ds-sample').onclick=async()=>{
    try {
      const url=new URL('../examples/agua_saturada_A4.csv', import.meta.url);
      const response=await fetch(url);
      if(!response.ok)throw Error('No se pudo leer la tabla de ejemplo');
      const all=parseCsv(await response.text());
      populate({filename:'agua_saturada_A4.csv',headers:all[0],rows:all.slice(1),sheet:'Tabla A-4'});
      status('Ejemplo cargado: tabla A-4 de agua saturada. Elige temperatura T (°C) como X y Psat (kPa) como Y.');
    }catch(error){status(error.message)}
  };
  $('ds-plot').onclick=plot;$('ds-fit').onclick=fit;
  $('ds-remove').onclick=()=>{try{removePlots();lastCalculator=null;status('Tabla de datos eliminada del graficador.');resetDataset();window.dispatchEvent(new CustomEvent('gmr:dataset-removed',{detail:{lab}}))}catch(e){status(e.message)}};
  ['ds-x','ds-y','ds-lines'].forEach(id=>$(id).addEventListener('change',()=>{recalc();
    if(lab==='prime')window.dispatchEvent(new CustomEvent('gmr:dataset-imported',{detail:{lab,dataset}}));
    if(lastCalculator===calc()&&points.length)plot();
  }));
  $('ds-api').value=localStorage.getItem('gmr:desmos:key')||'';
  $('ds-save-key').onclick=()=>{const key=$('ds-api').value.trim();if(key)localStorage.setItem('gmr:desmos:key',key);else localStorage.removeItem('gmr:desmos:key');status('Clave guardada localmente. Reinicia la aplicación para aplicarla.')};
}