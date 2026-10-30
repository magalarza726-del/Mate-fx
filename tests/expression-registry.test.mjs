import assert from 'node:assert/strict';
import {getFunctionDefinition, planAutomaticNames} from '../assets/nprimos/expression-registry.mjs';
import {numericFunction, buildRows} from '../assets/nprimos/analysis-core.mjs';
const existing = [
  {id:'1',type:'expression',latex:'1.05^{x}-0.4'},
  {id:'2',type:'expression',latex:''},
  {id:'points',type:'table',columns:[]},
  {id:'__gmr_data_plot_0',type:'expression',latex:'([1,2],[3,4])',secret:true},
];
const changes=planAutomaticNames(existing);
assert.deepEqual(changes,[{id:'1',latex:'f_{1}(x)=1.05^{x}-0.4'}]);
assert.equal(getFunctionDefinition(changes[0].latex).label,'f₁');
assert.deepEqual(planAutomaticNames(existing.map(e=>({...e,latex:e.id==='1'?changes[0].latex:e.latex}))),[]);
assert.deepEqual(planAutomaticNames([{id:'1',latex:'f_{1}(x)=x^2'},{id:'2',latex:'y=2x'},{id:'3',latex:'g(x)=x+1'}]),[{id:'2',latex:'f_{2}(x)=2x'}]);
assert.deepEqual(planAutomaticNames([{id:'1',latex:'g(x)=x^2'},{id:'2',latex:'x^{2}+1'},{id:'3',latex:'a=3'},{id:'4',latex:'x^2+y^2=1'}]),[{id:'2',latex:'f_{1}(x)=x^{2}+1'}]);
assert.deepEqual(planAutomaticNames([{id:'1',latex:'x^'},{id:'2',latex:'(1,2)'},{id:'3',latex:'\\left(1,2\\right)'}]),[]);
const fn=numericFunction(changes[0].latex);
assert.ok(fn);
const y=fn(100);assert.ok(Math.abs(y-(1.05**100-.4))<1e-5);
const rows=buildRows([[100,140]],[{evaluate:fn}]);
assert.ok(Number.isFinite(rows[0].values[0].estimate));
assert.ok(Number.isFinite(rows[0].values[0].error));
console.log('OK: Desmos expresión anónima -> f₁(x) -> tabla/errores con el mismo ID.');
