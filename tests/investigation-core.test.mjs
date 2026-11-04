import test from 'node:test';
import assert from 'node:assert/strict';
import {METHODS,methodById,methodConfig,splitData,statistics,evaluateMethod} from '../assets/nprimos/investigation-core.mjs';
import {makeCandidate,validCandidate} from '../assets/nprimos/generator-core.mjs';
import {plotSpecifications} from '../assets/nprimos/investigation-desmos.mjs';

const points=Array.from({length:34},(_,i)=>[i+1,7+2.5*(i+1)+0.3*(i+1)**2]);
const groups=[
 'Métodos clásicos de ajuste',
 'Métodos de corrección de funciones',
 'Métodos basados en restricciones y cotas',
 'Métodos de interpolación',
 'Métodos de aproximación avanzada',
 'Métodos de búsqueda y optimización'
];

test('Catálogo: 6 secciones, métodos únicos y completos',()=>{
 assert.equal(METHODS.length,38);
 assert.deepEqual(new Set(METHODS.map(m=>m.group)),new Set(groups));
 assert.equal(new Set(METHODS.map(m=>m.id)).size,METHODS.length);
 for(const id of ['linear','polynomial','exponential','logarithmic','power','rational',
 'correction_poly','correction_exp','correction_rational','correction_power','correction_sigmoid',
 'least_squares','least_absolute','minimax','quantile','envelope','constrained',
 'linear_interp','spline','pchip','newton','hermite','lagrange',
 'chebyshev','remez','pade','taylor','fourier','symbolic','gaussian',
 'levenberg','differential','genetic','annealing','bayesian'])assert.ok(methodById(id),'Falta '+id);
 assert.equal(methodById('symbolic').group,'Métodos de aproximación avanzada');
 assert.equal(methodById('bayesian').group,'Métodos de búsqueda y optimización');
});

test('Entrenamiento y validación mantienen observaciones disjuntas',()=>{
 const split=splitData(points,20);
 assert.ok(split.validation.length>0);
 assert.equal(split.train.length+split.validation.length,points.length);
 const ids=new Set(split.train.map(p=>p[0]));
 assert.ok(split.validation.every(p=>!ids.has(p[0])));
});

test('Métricas MAPE, errores absolutos y valores cero',()=>{
 const data=[[1,10],[2,20],[3,0]];
 const s=statistics(data,[9,22,3]);
 assert.ok(Math.abs(s.mape-10)<1e-10);
 assert.equal(s.maxAbs,3);
 assert.equal(s.maxape,10);
 assert.equal(s.valid,3);
 assert.equal(s.zeroY,1);
});

test('Polinomio recupera relación cuadrática y conserva fórmula LaTeX',()=>{
 const result=evaluateMethod('polynomial',points,points,{degree:2,decimals:3,magnitude:9999});
 assert.ok(result);
 assert.ok(result.trainMetrics.mape<0.001);
 assert.ok(result.latex.startsWith('f(x)='));
 assert.ok(result.ztex.includes('\\frac'));
});

test('Las operaciones simbólicas permitidas se aplican al generar candidatos',()=>{
 const cfg={maxTerms:3,maxX:1,constant:false,composition:'sum',families:['polynomial','logarithmic'],allowedKinds:['power'],decimals:3,maxInteger:99};
 for(let i=0;i<80;i++){
  const candidate=makeCandidate(cfg,40,Math.random);
  assert.ok(candidate.terms.every(x=>x.kind==='power'));
  assert.ok(validCandidate(candidate,cfg));
 }
});

test('Interpolación por tramos y Padé devuelven funciones evaluables y fórmulas',()=>{
 for(const id of ['linear_interp','spline','pchip','lagrange','newton','pade','taylor']){
  const r=evaluateMethod(id,points,points,{degree:2,denominator:2,knots:8,decimals:4,magnitude:9999});
  assert.ok(r,id+' debe producir una fórmula');
  assert.equal(r.estimates.length,points.length);
  assert.ok(r.estimates.every(Number.isFinite),id+' no debe producir NaN');
  assert.ok(r.latex.includes('f(x)='));
 }
});

test('Optimización configurable conserva decimales y límites de búsqueda',()=>{
 const cfg=methodConfig({n:10000,degree:2,decimals:6,magnitude:999999,maxTerms:3,maxX:2,allowedKinds:['sin','cos']});
 assert.equal(cfg.n,10000);
 assert.equal(cfg.decimals,6);
 assert.equal(cfg.magnitude,999999);
 assert.deepEqual(cfg.allowedKinds,['sin','cos']);
});

test('La representación de datos y ganadora requiere series para la API oficial de Desmos',()=>{
 const predicted=points.map(([x])=>7+2.5*x+0.3*x*x);
 const spec=plotSpecifications({points,xName:'Temperatura',yName:'Presión'},
  {estimates:predicted,curvePoints:points.map((p,i)=>[p[0],predicted[i]])},'fit');
 assert.equal(spec.series.length,2);
 assert.equal(spec.series[0].mode,'points');
 assert.equal(spec.series[1].mode,'lines');
 assert.equal(spec.series[0].points.length,points.length);
 assert.deepEqual(spec.series[1].points[0],[points[0][0],predicted[0]]);
});

