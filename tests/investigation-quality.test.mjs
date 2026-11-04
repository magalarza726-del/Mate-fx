import test from 'node:test';
import assert from 'node:assert/strict';
import {physicalDomain,diagnosePhysicalModel,equivalentModelGroups} from '../assets/nprimos/investigation-quality.mjs';
import {plotSpecifications} from '../assets/nprimos/investigation-desmos.mjs';
const source={sourceName:'Tabla_A4_Agua_Saturada.csv',xName:'T (°C)',yName:'Psat (kPa)',
 points:[[0.01,0.6117],[20,2.3392],[100,101.325],[200,1554.9]]};
test('La presión de saturación activa verificaciones físicas, otros datos no',()=>{
 assert.equal(physicalDomain(source),'pressure');
 assert.equal(physicalDomain({yName:'Factor de rendimiento',sourceName:'prueba.csv'}),null);
});
test('Una ecuación con presión negativa o decreciente emite alertas, sin alterar resultados',()=>{
 const best={estimates:[-10,3,2,100],curvePoints:[[0.01,-10],[20,3],[100,2],[200,100]]};
 const original=best.estimates.slice();
 const d=diagnosePhysicalModel(source,best);
 assert.equal(d.status,'advertencia');assert.ok(d.nonpositive>=1);assert.ok(d.decreases>=1);
 assert.ok(d.warnings.some(w=>w.includes('no es positiva')));
 assert.deepEqual(best.estimates,original,'Las alertas no cambian ecuaciones ni métricas');
});
test('Una aproximación positiva y creciente no recibe advertencia física',()=>{
 const d=diagnosePhysicalModel(source,{estimates:[0.6,2.3,101,1540]});
 assert.equal(d.status,'sin_alertas');assert.equal(d.warnings.length,0);
});
test('La coincidencia numérica entre polinómica y Chebyshev NO se presenta como identidad algebraica',()=>{
 const groups=equivalentModelGroups([
  {id:'C2',best:{estimates:[0.6,2,20,200]}},
  {id:'C5',best:{estimates:[0.6,2,20,200]}},
  {id:'C6',best:{estimates:[0.6,3,40,200]}}
 ]);
 assert.deepEqual(groups,[['C2','C5']]);
});
test('La serie comparativa conserva el orden de entrada, con error cero y eje logarítmico no negativo',()=>{
 const entries=[
  {id:'C6',best:{complexity:13,metrics:{mape:2.5,maxape:10.3}}},
  {id:'C2',best:{complexity:5,metrics:{mape:10837,maxape:327099}}},
  {id:'C1',best:{complexity:2,metrics:{mape:29553,maxape:725937}}}
 ];
 const s=plotSpecifications(source,entries[0].best,'comparison',entries);
 assert.deepEqual(s.entryOrder,['C6','C2','C1']);
 assert.ok(s.nonnegativeY);
 assert.deepEqual(s.series[0].points.map(p=>p[0]),[1,2,3]);
 assert.ok(s.series[0].points[0][1]<s.series[0].points[2][1]);
 const zero=plotSpecifications(source,entries[0].best,'comparison',
  [{id:'Exacta',best:{metrics:{mape:0,maxape:0}}}]);
 assert.deepEqual(zero.series[0].points,[[1,0]]);
});
