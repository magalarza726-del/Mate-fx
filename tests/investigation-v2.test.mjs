import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {METHODS,methodById,evaluateMethod} from '../assets/nprimos/investigation-core.mjs';
import {equationComplexity,complexityExplanation,COMPLEXITY_WEIGHTS} from '../assets/nprimos/investigation-complexity.mjs';
import {intervalDiagnostics} from '../assets/nprimos/investigation-intervals.mjs';
import {sampleForDesmos,plotSpecifications} from '../assets/nprimos/investigation-desmos.mjs';

const points=Array.from({length:24},(_,i)=>[i+1,6+3*(i+1)+.12*(i+1)**2]);
const config={n:35,degree:2,decimals:3,magnitude:9999,
 maxTerms:2,maxX:1,families:['polynomial'],allowedKinds:['x','power'],center:'arithmetic'};
function seeded(n){let a=n>>>0;return ()=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296}}

test('Una regla de complejidad documentada se aplica a todas las familias',()=>{
 const e=equationComplexity('f(x)=(2.915)x^{1.141}');
 assert.equal(e.value,4);
 assert.equal(e.terms.numeric,2);
 assert.equal(e.terms.power,1);
 assert.equal(COMPLEXITY_WEIGHTS.transcendental,3);
 assert.equal(complexityExplanation().length,7);
 const fitted=evaluateMethod('linear',points,points,config,seeded(55));
 assert.equal(fitted.complexity,fitted.complexityDetail.value);
 assert.equal(fitted.complexityDetail.version,2);
});

test('Errores por tramos: MAE, MAPE, MaxAPE, conteos y exclusión de Y=0',()=>{
 const series=[[0,10],[1,20],[2,0],[3,30]];
 const d=intervalDiagnostics(series,[11,16,5,45],2);
 assert.equal(d.length,2);
 assert.equal(d.reduce((n,x)=>n+x.observations,0),4);
 assert.equal(d.reduce((n,x)=>n+x.zeroY,0),1);
 assert.equal(d.reduce((n,x)=>n+x.percentCount,0),3);
 assert.ok(Math.abs(d[0].mape-15)<1e-12);
 assert.equal(d[1].maxape,50);
 assert.equal(d[1].mae,10);
});

test('Seis clases de cotas producen inferior/centro/superior reproducibles',()=>{
 const kinds=['bound_linear','bound_polynomial','bound_exponential','bound_logarithmic','bound_power','bound_rational'];
 for(const name of kinds){
  const r=evaluateMethod(name,points,points,config,seeded(171));
  assert.ok(r,'No se obtuvo una fórmula de '+name);
  assert.ok(r.bounds?.lowerTex.startsWith('L(x)='));
  assert.ok(r.bounds?.upperTex.startsWith('U(x)='));
  assert.equal(r.bounds.coverage,r.bounds.total);
  assert.equal(r.bounds.total,points.length);
  assert.equal(r.bounds.guaranteedBetweenSamples,false);
  assert.ok(r.metrics.mape>=0);
 }
 for(const name of ['bound_linear','bound_polynomial','bound_logarithmic'])
  assert.equal(methodById(name).type,'direct');
});

test('Las tres formas originales del generador están dentro de Métodos personalizados',()=>{
 for(const id of ['custom_sum','custom_product','custom_pair_plus']){
  assert.equal(methodById(id).group,'Métodos personalizados');
  let found=null;
  const random=seeded(514);
  for(let i=0;i<50&&!found;i++)found=evaluateMethod(id,points,points,config,random,i+1,{});
  assert.ok(found,'La familia '+id+' debe encontrar una candidata en 50 intentos');
 }
});

test('Desmos muestra de forma uniforme TODO el rango y conserva el último dato',()=>{
 const large=Array.from({length:10000},(_,i)=>[i+1,i*3]);
 const sampled=sampleForDesmos(large,3500);
 assert.equal(sampled.length,3500);
 assert.deepEqual(sampled[0],large[0]);
 assert.deepEqual(sampled.at(-1),large.at(-1));
 assert.ok(sampled[1700][0]>4000);
 const graph=plotSpecifications({points:large}, {estimates:large.map(x=>x[1])}, 'fit');
 assert.equal(graph.series[0].points.length,10000); // los datos se reducen solo al enviarlos a Desmos
});

test('Navegación: solo Investigación, Análisis e Importar/Exportar Datos',async()=>{
 const src=await readFile(new URL('../assets/nprimos/investigation-ui-v2.js',import.meta.url),'utf8');
 const boot=await readFile(new URL('../assets/nprimos/boot.js',import.meta.url),'utf8');
 assert.ok(src.includes("window.__lmmTools="));
 assert.ok(src.includes("openResearch:()=>open('research')"));
 assert.ok(src.includes("openAnalysis:()=>open('analysis')"));
 assert.ok(src.includes("openData"));
 assert.ok(!src.includes('mf-feature-navigation'),'No duplicar la barra superior');
 assert.ok(src.includes('data-tab-target="methods"'));
 assert.ok(src.includes('data-tab-target="table"'));
 assert.ok(src.includes('data-tab-target="dashboards"'));
 assert.ok(src.includes('data-pdf'));
 assert.ok(!src.includes('inv-cards'));
 assert.ok(boot.includes("investigation-ui-v2.js"));
 assert.ok(!boot.includes("await import('./envelopes-ui.js')"));
 assert.ok(!boot.includes("await import('./research-ui.js')"));
});

test('Semilla única también se aplica al generador de trabajadores',async()=>{
 const ui=await readFile(new URL('../assets/nprimos/investigation-ui-v2.js',import.meta.url),'utf8');
 const worker=await readFile(new URL('../assets/nprimos/investigation-worker.mjs',import.meta.url),'utf8');
 assert.match(ui,/seed:state\.seed/);
 assert.match(worker,/seeded\(\(\+entry\.seed\|\|28411\)\)/);
 assert.doesNotMatch(worker,/s\.index\*10007/);
});

test('Reporte y análisis de intervalos cuentan con archivos propios',async()=>{
 const report=await readFile(new URL('../assets/nprimos/investigation-paper.mjs',import.meta.url),'utf8');
 assert.ok(report.includes('complexityExplanation()'));
 assert.ok(report.includes('intervalRows('));
 assert.ok(report.includes('Semilla común:'));
 assert.ok(report.includes('{height:83}'));
 assert.ok(report.includes('Muestra de observaciones (tabla bajo la gráfica)'));
 assert.ok(report.includes('Configuración del experimento'));
 assert.ok(report.includes('Cotas del método'));
});
