import {loadDesmos} from '../shared/desmos-loader.js';
const params=new URLSearchParams(location.search);
const mode=params.get('engine')||localStorage.getItem('gmr:nprimos:engine')||'desmos';
async function offline(error){
 document.body.dataset.graphEngine='local';
 if(error){document.body.dataset.desmosFallback='1';console.warn('Desmos no disponible. Motor local activado.',error)}
 await import('./offline.js');
}
if(mode==='local')await offline();
else{
 document.body.dataset.graphEngine='loading';
 try{
   await loadDesmos();
   document.body.dataset.graphEngine='desmos';
   await import('./analysis-table.js');
   await import('./app.js');
   await import('../shared/lab.js');
   await import('./research-ui.js');
   await import('./envelopes-ui.js');
 }catch(error){await offline(error)}
}