import {prepareData,makeEnvelope,evaluateEnvelope,signature,takeBest} from './envelope-core.mjs';
let active=null;
function loop(){
  const s=active;if(!s||s.paused)return;
  const improvements=[];
  for(let j=0;j<16&&s.done<s.total;j++){
    s.done++;
    const part=(s.done-1)%s.groups.length;
    const e=makeEnvelope(s.groups[part].points,s.config);
    if(!e){s.invalid++;continue}
    const result=evaluateEnvelope(e,s.groups[part].points,s.config.center);
    if(!result){s.invalid++;continue}
    const key=part+':'+signature(result);
    if(s.known.has(key)){s.duplicates++;continue}
    s.known.add(key);s.valid++;
    if(!s.best[part]||result.rank<s.best[part].rank){
      const improvement={...result,range:s.groups[part].range,part,iteration:s.done};
      s.best[part]=takeBest(improvement,s.best[part]);improvements.push(improvement);
    }
  }
  postMessage({type:'progress',done:s.done,total:s.total,valid:s.valid,invalid:s.invalid,duplicates:s.duplicates,improvements,best:s.best});
  if(s.done>=s.total){postMessage({type:'complete',done:s.done,total:s.total,best:s.best});active=null}
  else setTimeout(loop,0);
}
onmessage=event=>{
  const data=event.data;
  if(data.type==='stop'){active=null;postMessage({type:'stopped'});return}
  if(data.type==='pause'){if(active)active.paused=true;postMessage({type:'paused'});return}
  if(data.type==='resume'){if(active){active.paused=false;setTimeout(loop,0)}return}
  if(data.type==='start'){
    const groups=(data.groups||[]).map(x=>({...x,points:prepareData(x.points)}));
    if(!groups.length||groups.some(g=>g.points.length<2||g.points.some(p=>p[1]<=0))){postMessage({type:'error',message:'Se requieren al menos dos puntos con Y>0 en cada tramo.'});return}
    active={groups,config:data.config,total:Math.max(1,Math.min(100000,Math.trunc(data.config.n)||1000)),done:0,valid:0,invalid:0,duplicates:0,known:new Set(),best:Array(groups.length).fill(null),paused:false};
    postMessage({type:'started',total:active.total});setTimeout(loop,0);
  }
};