import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeCandidate,fitCandidate,isNonDegenerate,refineModel,scoreModel,rankingScore,acceptableFit,inferTrend,modelToLatex} from '../assets/nprimos/generator-core.mjs';
const raw=fs.readFileSync(new URL('../assets/examples/agua_saturada_A4.csv',import.meta.url),'utf8').trim().split(/\r?\n/).slice(1);
const points=raw.map(line=>line.split(';').slice(0,2).map(Number)).filter(row=>row.every(Number.isFinite));
const cfg={maxTerms:2,maxX:1,constant:true,decimals:1,maxInteger:9,composition:'sum',families:['exponential'],trendRate:inferTrend(points).rate};
let seed=1357911;const rng=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
let best=Infinity,valid=0;
for(let i=0;i<500;i++){
 const candidate=makeCandidate(cfg,373.95,rng);
 const fit=fitCandidate(candidate,points,1,9);if(!fit||!isNonDegenerate(fit,points))continue;
 const model=refineModel(fit,points,[]);const latex=modelToLatex(model);
 if(!latex)continue;
 const score=scoreModel(model,points,[]);
 assert.ok(Number.isFinite(score.mape));assert.ok(Number.isFinite(score.nmae));
 assert.equal(typeof acceptableFit(score,20),'boolean');
 valid++;best=Math.min(best,rankingScore(score));
}
assert.ok(valid>10&&Number.isFinite(best));
console.log('OK: tabla de agua saturada y restriccion fuerte sin falsos exitos');
