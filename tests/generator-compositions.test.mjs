import assert from 'node:assert/strict';
import {FAMILIES,makeCandidate,fitCandidate,validCandidate,predict,modelToLatex,featureCount} from '../assets/nprimos/generator-core.mjs';
import {numericFunction} from '../assets/nprimos/analysis-core.mjs';
const points=Array.from({length:30},(_,i)=>[i+1,4*(i+1)+6]);
for(const family of Object.keys(FAMILIES)){
  for(const composition of ['sum','product','pair_plus']){
    for(const maxX of [1,2]){
      const config={maxTerms:3,maxX,constant:true,families:[family],composition,decimals:3,maxInteger:9999};
      let ok=0;
      for(let i=0;i<130;i++){
        const m=makeCandidate(config,40);
        assert.ok(validCandidate(m,config));
        assert.ok(m.terms.every(t=>FAMILIES[family].includes(t.kind)));
        if(composition==='pair_plus')assert.equal(m.terms.length,3);
        if(composition==='product')assert.equal(featureCount(m),2);
        if(composition==='pair_plus')assert.equal(featureCount(m),3);
        const fitted=fitCandidate(m,points,3,9999);
        if(!fitted)continue;
        const latex=modelToLatex(fitted);assert.ok(latex);
        const fn=numericFunction('f_{1}(x)='+latex);assert.ok(fn,latex);
        for(const x of [1,3,5]) {
          const a=predict(fitted,x),b=fn(x);
          if(Number.isFinite(a)&&Number.isFinite(b))assert.ok(Math.abs(a-b)<Math.max(1,Math.abs(a))*1e-6,latex);
        }
        ok++;
      }
      assert.ok(ok>0,'No hay funciones válidas para '+family+'/'+composition+'/x='+maxX);
    }
  }
}
assert.throws(()=>makeCandidate({families:[],maxTerms:3,maxX:2},40),/tendencia/);
assert.throws(()=>makeCandidate({families:['polynomial'],composition:'pair_plus',maxTerms:2,maxX:2},40),/3 términos/);
console.log('OK: 4 familias × 3 estructuras, límites de x y lectura de funciones en Desmos');
