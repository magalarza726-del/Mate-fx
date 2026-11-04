/* Investigación de Mate-fx: cálculos aislados para mantener la interfaz fluida. */
import {METHODS,methodById,methodConfig,splitData,evaluateMethod,statistics,objective} from './investigation-core.mjs';
let run=null;
function seeded(seed){let a=(seed>>>0)||1;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}
function summarize(r,validation){
 const out={iteration:r.iteration,latex:r.latex,ztex:r.ztex,complexity:r.complexity,metrics:r.metrics,trainMetrics:r.trainMetrics,score:r.score};
 if(validation.length){const map=new Map(r._all?.map((p,i)=>[p[0],r.estimates[i]])||[]);out.validationMetrics=statistics(validation,validation.map(p=>map.get(p[0])))}
 return out;
}
function next(){
 const s=run;if(!s||s.paused)return;
 if(s.index>=s.entries.length){postMessage({type:'complete',done:s.done,total:s.total,results:s.results});run=null;return}
 const entry=s.entries[s.index],cfg=entry.config,method=methodById(entry.method);
 if(!method){s.index++;setTimeout(next,0);return}
 const effective=method.type==='direct'?1:cfg.n;
 if(s.iteration===0){s.best=null;s.session={};s.rng=seeded((+entry.seed||28411)+s.index*10007);postMessage({type:'method-start',index:s.index,entryId:entry.id,method:entry.method,effective})}
 const rows=[];let passes=0;
 while(passes<12&&s.iteration<effective){
  passes++;s.iteration++;s.done++;
  let result=null;
  try{result=evaluateMethod(entry.method,s.split.train,s.split.all,cfg,s.rng,s.iteration,s.session)}
  catch(e){if(!s.errorCount++)postMessage({type:'warning',entryId:entry.id,message:String(e?.message||e)})}
  if(result){
   const validationMetrics=s.split.validation.length?statistics(s.split.validation,s.split.validation.map(p=>result.estimates[s.indexMap.get(p[0])])):null;
   const item={iteration:s.iteration,latex:result.latex,ztex:result.ztex,complexity:result.complexity,metrics:result.metrics,trainMetrics:result.trainMetrics,validationMetrics,score:result.score};
   rows.push(item);
   if(!s.best||result.score<s.best.score){s.best={...item,estimates:result.estimates};if(method.id==='symbolic'&&cfg.generational)s.session.elite=result}
  }else rows.push({iteration:s.iteration,latex:null,score:null,reason:'Sin ajuste válido bajo las restricciones'});
 }
 postMessage({type:'progress',index:s.index,entryId:entry.id,done:s.done,total:s.total,methodDone:s.iteration,methodTotal:effective,rows,best:s.best});
 if(s.iteration>=effective){
  s.results.push({id:entry.id,method:entry.method,config:cfg,best:s.best,iterations:s.iteration});
  postMessage({type:'method-complete',entryId:entry.id,index:s.index,result:s.results[s.results.length-1]});
  s.index++;s.iteration=0;s.errorCount=0;
 }
 setTimeout(next,0);
}
onmessage=e=>{
 const message=e.data||{};
 if(message.type==='stop'){run=null;postMessage({type:'stopped'});return}
 if(message.type==='pause'){if(run){run.paused=true;postMessage({type:'paused'})}return}
 if(message.type==='resume'){if(run){run.paused=false;postMessage({type:'resumed'});setTimeout(next,0)}return}
 if(message.type!=='start')return;
 const points=Array.isArray(message.points)?message.points:[];
 const split=splitData(points,message.validation??20);
 if(split.train.length<5){postMessage({type:'error',message:'Se requieren al menos cinco observaciones distintas para el experimento.'});return}
 const entries=(message.entries||[]).filter(e=>methodById(e.method)).map((e,i)=>({...e,id:String(e.id||('exp-'+i)),config:methodConfig(e.config)}));
 if(!entries.length){postMessage({type:'error',message:'Selecciona al menos un método.'});return}
 const indexMap=new Map(split.all.map((p,i)=>[p[0],i]));
 run={entries,split,indexMap,index:0,iteration:0,done:0,total:entries.reduce((a,e)=>a+(methodById(e.method).type==='direct'?1:e.config.n),0),results:[],paused:false,errorCount:0,session:{},rng:seeded(12),best:null};
 postMessage({type:'started',total:run.total,trainCount:split.train.length,validationCount:split.validation.length,methods:entries.length});
 setTimeout(next,0);
};
