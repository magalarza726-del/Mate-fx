import assert from 'node:assert/strict';
import {numericFunction,readNumber,inverseClosest,absoluteError,percentageError,buildRows} from '../assets/nprimos/analysis-core.mjs';
assert.equal(readNumber('1,7057'),1.7057);
assert.equal(readNumber('1.705,7'),1705.7);
assert.ok(Number.isNaN(readNumber('sin dato')));
assert.equal(absoluteError(200,220),20);
assert.equal(percentageError(200,220),10);
assert.ok(Number.isNaN(percentageError(0,0)));
for(const [latex,x,expected] of [
  ['f_{1}(x)=-0.4+1.052^{x}',100,-.4+1.052**100],
  ['f(x)=x^{\\frac{1000}{707}}+x^{\\frac{1}{8}}',2,2**(1000/707)+2**(1/8)],
  ['g(x)=x(\\ln(x)+\\ln(\\ln(x))-1)',10,10*(Math.log(10)+Math.log(Math.log(10))-1)],
]) {
  const fn=numericFunction(latex);assert.ok(fn,latex);
  assert.ok(Math.abs(fn(x)-expected)<1e-8,latex);
}
assert.ok(Math.abs(inverseClosest(x=>x*x,3,16)-4)<1e-6);
assert.ok(Math.abs(inverseClosest(x=>x*x,-3,16)+4)<1e-6);
const fn=numericFunction('f_{1}(x)=2x');
const byY=buildRows([[2,5],[3,6]],[{evaluate:fn}],'y');
assert.deepEqual([byY[0].values[0].estimate,byY[0].values[0].error,byY[0].values[0].percent],[4,1,20]);
const byX=buildRows([[2,6]],[{evaluate:fn}],'x');
assert.ok(Math.abs(byX[0].values[0].estimate-3)<1e-6);
assert.ok(Math.abs(byX[0].values[0].percent-50)<1e-6);
console.log('OK: coordenadas, funciones, inversas, errores absolutos y porcentuales');