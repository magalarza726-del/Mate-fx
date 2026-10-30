import assert from 'node:assert/strict';
import {makeCandidate,fitCandidate,isNonDegenerate,modelToLatex,basisValue} from '../assets/nprimos/generator-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
const config={maxTerms:3,maxX:1,constant:true,decimals:1,maxInteger:99,composition:'sum',families:['exponential']};
const points=Array.from({length:76},(_,i)=>[.01+373.94*i/75,.6117*Math.exp(Math.log(22064/.6117)*i/75)]);
let valid=0;
for(let i=0;i<250;i++){
  const shape=makeCandidate(config,373.95);
  for(const term of shape.terms){assert.ok(term.scale>=1&&term.scale<=99);assert.notEqual(term.p,0);}
  const model=fitCandidate(shape,points,1,99);
  if(!model||!isNonDegenerate(model,points))continue;
  const latex=modelToLatex(model),fn=numericFunction('f_{1}(x)='+latex);
  assert.ok(fn,latex);
  for(const x of [1,100,300]){
    const y=model.terms.reduce((total,t,j)=>total+model.coefs[j]*basisValue(t,x),model.constant?model.coefs[model.terms.length]:0);
    assert.ok(Math.abs(y-fn(x))<Math.max(1,Math.abs(y))*1e-5,latex);
  }
  valid++;
}
assert.ok(valid>=10);
assert.equal(isNonDegenerate({terms:[{kind:'exp',uses:1,p:0,scale:99}],coefs:[99.9,99.9],constant:true},points),false);
console.log('OK: parámetros no degenerados, escala X y equivalencia con Desmos');