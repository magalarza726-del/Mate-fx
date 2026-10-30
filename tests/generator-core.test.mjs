import assert from 'node:assert/strict';
import {BASIS,makeCandidate,validCandidate,makeTerm,fitCandidate,scoreModel,predict,modelToLatex} from '../assets/nprimos/generator-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
assert.equal(BASIS.filter(e=>e.uses<=1).length,9);
const rng=(()=>{let i=0;return()=> ((++i*17)%101)/101})();
const config={maxTerms:3,maxX:2,constant:true};
for(let i=0;i<1000;i++){
  const m=makeCandidate(config,100,rng);
  assert.ok(validCandidate(m,config));
  assert.ok(m.terms.every(t=>t.uses<=2));
  const limited=makeCandidate({...config,maxTerms:1,maxX:1,constant:false},100,rng);
  assert.equal(limited.terms.length,1);assert.equal(limited.terms[0].uses,1);assert.equal(limited.constant,false);
}
const pts=Array.from({length:76},(_,i)=>[i+1,3*(i+1)+7]);
const fitted=fitCandidate({terms:[makeTerm('x',100)],constant:true},pts);
assert.ok(fitted);assert.ok(Math.abs(predict(fitted,70)-217)<1e-5);
const metrics=scoreModel(fitted,pts,[{min:1,max:25},{min:26,max:50},{min:51,max:76}]);
assert.ok(metrics.mape<1e-5);assert.equal(metrics.perRange.length,3);
const latex=modelToLatex(fitted);assert.ok(latex.includes('x'));
const evaluate=numericFunction('f_{1}(x)='+latex);assert.ok(evaluate,latex);
assert.ok(Math.abs(evaluate(70)-217)<1e-4);
const m=fitCandidate({terms:[makeTerm('xln',100)],constant:false},Array.from({length:20},(_,i)=>[i+1,3*(i+1)*Math.log(i+1)]));
assert.ok(m);assert.ok(modelToLatex(m).includes('\\ln(x)'));
assert.equal(scoreModel(fitted,[[1,0],[2,13]],[{min:1,max:2}]).perRange[0]!==null,true);
console.log('OK: restricciones, ajuste mínimos cuadrados, tramos, porcentaje y LaTex/Desmos');
