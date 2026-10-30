import assert from 'node:assert/strict';
import {decimalLimit,roundNumber,makeCandidate,fitCandidate,modelToLatex,scoreModel,predict} from '../assets/nprimos/generator-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
assert.equal(decimalLimit(0),0);assert.equal(decimalLimit(3),3);assert.equal(decimalLimit(10),3);
assert.equal(roundNumber(1.2345,2),1.23);
const points=Array.from({length:35},(_,i)=>[i+1,(i+1)*1.23456+6.78912]);
const rng=(()=>{let i=1;return()=>((i++*37)%1001)/1001})();
for(let d=0;d<=3;d++){
  const cfg={maxTerms:3,maxX:2,constant:true,decimals:d};
  let valid=0;
  for(let i=0;i<160;i++){
    const shape=makeCandidate(cfg,100,rng);
    for(const term of shape.terms) {
      const digits=String(term.p).split('.')[1]?.length??0;
      assert.ok(digits<=d,'Parámetro '+term.p+': '+digits+' decimales, máximo '+d);
    }
    const m=fitCandidate(shape,points,d);
    if(!m)continue;
    valid++;
    const latex=modelToLatex(m);
    assert.ok(latex);
    for(const match of latex.matchAll(/\d+\.(\d+)/g))assert.ok(match[1].length<=d,latex);
    const f=numericFunction('f_{1}(x)='+latex);
    assert.ok(f,latex);
    for(const x of [1,2,3]){
      const original=predict(m,x),actual=f(x);
      if(Number.isFinite(original)&&Number.isFinite(actual))
        assert.ok(Math.abs(original-actual)<1e-5*Math.max(1,Math.abs(original)),latex);
    }
  }
  assert.ok(valid>5,'Ninguna función representable con '+d+' decimales');
}
const m=fitCandidate({terms:[{kind:'x',uses:1,p:0}],constant:true},points,0);
assert.deepEqual(m.coefs,[1,7]);
assert.ok(scoreModel(m,points,[]).mape>0.01);
console.log('OK: límites decimales y errores calculados sobre coeficientes publicados');
