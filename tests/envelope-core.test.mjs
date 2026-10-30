import assert from 'node:assert/strict';
import {makeEnvelope,encloses,evaluateEnvelope,centerValue,envelopeValues,logSlope,normalizedRate,expressionFor} from '../assets/nprimos/envelope-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
const observations=Array.from({length:55},(_,i)=>[i,2*Math.exp(0.065*i)*(1+0.06*Math.sin(i/5))]);
assert.ok(Math.abs(logSlope(observations)-0.065)<0.01);
let valid=0,champ=null;for(let i=0;i<1500;i++){
  const env=makeEnvelope(observations,{decimals:2,maxInteger:99,bounds:i%2?'shared':'independent'});
  if(!env)continue;valid++;
  assert.ok(encloses(env,observations));
  for(const [x,y] of observations){const [l,u]=envelopeValues(env,x);assert.ok(l<=y+1e-7 && u>=y-1e-7)}
  const result=evaluateEnvelope(env,observations,'auto');assert.ok(result&&result.mape>=0);
  if(!champ||result.rank<champ.rank)champ=result;
  for(const kind of ['lower','upper','center']){
    const source=expressionFor(result,kind);
    const numeric=numericFunction(`f_{1}(x)=${source}`);
    assert.ok(numeric,'No se analiza '+source);
    const x=10,[l,u]=envelopeValues(result,x),expected=kind==='lower'?l:kind==='upper'?u:centerValue(l,u,result.method);
    assert.ok(Math.abs(numeric(x)-expected)/Math.max(1,Math.abs(expected))<1e-6,source);
  }
}
assert.ok(valid>25,`Pocas envolventes válidas: ${valid}`);
assert.ok(champ.mape<30,`No se logra una aproximación razonable: ${champ.mape}`);
for(let d=0;d<=3;d++)for(const max of [9,99,999,9999]){
  for(let i=0;i<40;i++){
    const env=makeEnvelope(observations,{decimals:d,maxInteger:max,bounds:'shared'});
    if(!env)continue;
    for(const coeff of [env.aL,env.aU,env.pL,env.pU]){
      assert.ok(Math.abs(Math.trunc(coeff))<=max,`${coeff} > ${max}`);
      assert.ok(Math.abs(coeff*10**d-Math.round(coeff*10**d))<1e-7,`${coeff} has extra decimals`)
    }
  }
}
const dataZero=[[0,0],[1,3],[2,5]];assert.equal(makeEnvelope(dataZero,{}),null);
assert.equal(normalizedRate(0,99,1,99,()=>0.9),0.1);
console.log('OK: '+valid+' envolventes válidas, MAPE mejor='+champ.mape.toFixed(3)+' %, redondeo, límite, Desmos');