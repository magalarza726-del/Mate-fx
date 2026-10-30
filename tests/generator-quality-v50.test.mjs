import assert from 'node:assert/strict';
import {inferTrend,makeCandidate,fitCandidate,refineModel,scoreModel,rankingScore,acceptableFit,modelToLatex} from '../assets/nprimos/generator-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
const points=Array.from({length:76},(_,i)=>[i*2,Math.exp(.04*i*2)]);
const trend=inferTrend(points);assert.ok(trend.rate>.03&&trend.rate<.05);
const flat={terms:[{kind:'exp',uses:1,p:-1,scale:9}],constant:true,coefs:[-1,2],decimals:1,maxInteger:9};
const bad=scoreModel(flat,points,[]);
assert.ok(bad.trendPenalty>20);assert.equal(acceptableFit(bad,20),false);
const exact={terms:[{kind:'exp',uses:1,p:0.4,scale:10}],constant:true,coefs:[1,0],decimals:1,maxInteger:99};
const good=scoreModel(exact,points,[]);
assert.ok(good.mape<1e-8);assert.ok(good.nmae<1e-8);
assert.equal(acceptableFit(good,20),true);assert.ok(rankingScore(good)<rankingScore(bad));
const cfg={maxTerms:2,maxX:1,constant:true,decimals:1,maxInteger:99,families:['exponential'],composition:'sum',trendRate:trend.rate};
let seed=8675309;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
let improved=0,positive=0,accepted=0;
for(let i=0;i<550;i++){
  const candidate=makeCandidate(cfg,152,rng);
  if(candidate.terms.some(t=>t.kind==='exp'&&t.p>0))positive++;
  const initial=fitCandidate(candidate,points,1,99);if(!initial)continue;
  const before=rankingScore(scoreModel(initial,points,[]));
  const result=refineModel(initial,points,[]);
  const after=rankingScore(scoreModel(result,points,[]));
  assert.ok(after<=before+1e-7);
  if(after<before-1e-7)improved++;
  if(acceptableFit(scoreModel(result,points,[]),20))accepted++;
  assert.ok(numericFunction('f_{1}(x)='+modelToLatex(result)));
}
assert.ok(positive>50&&improved>0&&accepted>0);
console.log('OK: tendencia guiada, refinamiento, NMAE, MAPE y calidad configurable');
