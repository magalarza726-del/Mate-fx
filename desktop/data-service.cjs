'use strict';
const path=require('node:path');
const LIMIT_ROWS=10000, LIMIT_COLUMNS=50;

function detectDelimiter(text){
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).slice(0,5);
  const candidates=[',',';','\t','|'];
  let winner=',',max=-Infinity;
  for(const sep of candidates){
    let scores=lines.filter(Boolean).map(s=>splitCSV(s,sep)[0].length);
    if(!scores.length)continue;
    const average=scores.reduce((a,b)=>a+b,0)/scores.length;
    const inconsistency=Math.max(...scores)-Math.min(...scores);
    const rank=average-inconsistency*2;
    if(rank>max){max=rank;winner=sep}
  }
  return winner;
}
function splitCSV(text, sep=','){
  const rows=[];let row=[],cell='',inside=false;
  for(let i=0;i<text.length;i++){
    const c=text[i];
    if(c==='"'){
      if(inside&&text[i+1]==='"'){cell+='"';i++} else inside=!inside;
    }else if(c===sep&&!inside){row.push(cell);cell=''}
    else if((c==='\n'||c==='\r')&&!inside){
      if(c==='\r'&&text[i+1]==='\n')i++;
      row.push(cell); if(row.some(v=>v.trim()!==''))rows.push(row);
      row=[];cell='';if(rows.length>LIMIT_ROWS+1)break;
    }else cell+=c;
  }
  row.push(cell);if(row.some(v=>v.trim()!==''))rows.push(row);
  return rows;
}
function sanitizeCell(cell){
  if(cell==null)return '';
  if(cell instanceof Date)return cell.toISOString();
  if(typeof cell==='object')return String(cell.result??cell.text??cell.hyperlink??'');
  return String(cell);
}
function cleanRows(all, filename, sheet=''){
  if(all.length<2)throw new Error('El archivo necesita encabezados y al menos una fila de datos.');
  const original=all[0].slice(0,LIMIT_COLUMNS).map((x,i)=>sanitizeCell(x).trim()||`Columna ${i+1}`);
  const counts=new Map();
  const headers=original.map(n=>{let count=counts.get(n)||0;counts.set(n,count+1);return count?`${n} (${count+1})`:n});
  const rows=all.slice(1,LIMIT_ROWS+1).map(row=>headers.map((_,i)=>sanitizeCell(row[i]))).filter(row=>row.some(v=>v.trim()!==''));
  if(!rows.length)throw new Error('No hay filas de datos.');
  return {filename:path.basename(filename),sheet,headers,rows,truncated:all.length>LIMIT_ROWS+1};
}
async function parseDataset(filePath,buffer){
  const ext=path.extname(filePath).toLowerCase();
  if(ext==='.csv'){
    const text=buffer.toString('utf8').replace(/^\uFEFF/,'');
    return cleanRows(splitCSV(text,detectDelimiter(text)),filePath);
  }
  if(ext==='.xlsx'){
    const ExcelJS=require('exceljs');
    const wb=new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    const ws=wb.worksheets[0];
    if(!ws)throw new Error('El libro no contiene hojas.');
    const all=[];
    ws.eachRow({includeEmpty:false}, row=>{
      if(all.length<=LIMIT_ROWS+1){
        const cells=[];
        row.eachCell({includeEmpty:true},(cell,col)=>{if(col<=LIMIT_COLUMNS)cells[col-1]=cell.value});
        all.push(cells);
      }
    });
    return cleanRows(all,filePath,ws.name);
  }
  throw new Error('Formato no admitido: solo CSV y XLSX.');
}
module.exports={parseDataset,splitCSV,detectDelimiter,cleanRows};
