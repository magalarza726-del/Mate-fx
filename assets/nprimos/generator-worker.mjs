import {makeCandidate,fitCandidate,scoreModel,modelToLatex,subsample,chosenFamilies,isNonDegenerate} from './generator-core.mjs';
let session=null;
const pause=()=>{if(session)session.paused=true};
const tick=()=>{
  const s=session;if(!s||s.paused)return;
  const batch=[];
  for(let i=0;i<10&&s.done<s.config.n&&!s.paused;i++){
    s.done++;
    const elite=s.config.generational&&s.elites.length&&Math.random()<.8?s.elites[Math.floor(Math.random()*Math.min(6,s.elites.length))].model:null;
    const shape=makeCandidate(s.config,s.maxAbsX,Math.random,elite);
    const model=fitCandidate(shape,s.fitPoints,s.config.decimals,s.config.maxInteger);
    if(!model||!isNonDegenerate(model,s.scorePoints))continue;
    const scoring=scoreModel(model,s.scorePoints,s.config.ranges);
    if(!Number.isFinite(scoring.mape))continue;
    const latex=modelToLatex(model);if(!latex||s.seen.has(latex))continue;
    s.seen.add(latex);
    const item={iteration:s.done,decimals:model.decimals,maxInteger:model.maxInteger,composition:model.composition,families:chosenFamilies(s.config),latex,mape:scoring.mape,perRange:scoring.perRange,ranges:s.config.ranges,model};
    batch.push(item);
    if(!s.best||item.mape<s.best.mape)s.best=item;
    if(s.config.generational){
      s.elites.push(item);s.elites.sort((a,b)=>a.mape-b.mape);s.elites.length=Math.min(s.elites.length,12);
    }
  }
  postMessage({type:'progress',done:s.done,total:s.config.n,batch,best:s.best});
  if(s.done>=s.config.n){postMessage({type:'complete',done:s.done,total:s.config.n,best:s.best});session=null}
  else setTimeout(tick,0); // yield: pause messages can interrupt between small batches
};
onmessage=e=>{
  const {type}=e.data;
  if(type==='pause'){pause();postMessage({type:'paused',done:session?.done??0});return}
  if(type==='resume'&&session){session.paused=false;setTimeout(tick,0);return}
  if(type==='stop'){session=null;postMessage({type:'stopped'});return}
  if(type==='start'){
    const {points,config}=e.data;
    const maxAbsX=Math.max(1,...points.map(p=>Math.abs(p[0])));
    session={config,done:0,best:null,seen:new Set(),elites:[],paused:false,maxAbsX,fitPoints:subsample(points,350),scorePoints:points};
    postMessage({type:'started',total:config.n});setTimeout(tick,0);
  }
};
