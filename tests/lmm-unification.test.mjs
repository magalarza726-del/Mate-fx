import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LMM_MODES,MAX_GEOMETRY_LINES,sampleValues,normalizeGeometrySettings,
 geometryForExpression,geometryPaths,boundsForGeometry,geometryStatistics,geometryFromSamples,normalizeCountSettings,sampleCountValues} from '../assets/lmm/geometry-core.mjs';

test('El selector Vista contiene exactamente cinco opciones con ángulos 0° y 90°',()=>{
 assert.deepEqual(LMM_MODES.map(m=>m.id),
  ['classic','triangle0','triangle90','circle0','circle90']);
 assert.deepEqual(LMM_MODES.map(m=>m.name),
  ['Clásica','Triangular a 0°','Triangular a 90°','Circular a 0°','Circular a 90°']);
 assert.deepEqual(new Set(LMM_MODES.map(m=>m.angle)),new Set([null,0,90]));
 const model=geometryForExpression({expression:'x^2',xMin:1,xMax:6,angle:90,step:1,selectedX:4});
 assert.equal(model.geometries.length,6);
 assert.equal(model.selected.x,4);
 assert.equal(model.selected.fx,16);
 assert.equal(geometryPaths(model,'classic').length,0);
 for(const mode of ['triangle0','triangle90'])assert.equal(geometryPaths(model,mode).length,6);
 for(const mode of ['circle0','circle90'])assert.equal(geometryPaths(model,mode).length,12);
});

test('Triangular 0° y 90° reutilizan exactamente la geometría de Mate-fx',()=>{
 const model=geometryForExpression({expression:'x^2',xMin:4,xMax:4,step:1,angle:90});
 assert.deepEqual(geometryPaths(model,'triangle0')[0].points,[[4,0],[10,10],[16,0]]);
 assert.deepEqual(geometryPaths(model,'triangle90')[0].points,[[-4,0],[0,16],[4,0]]);
 const stats=geometryStatistics(model);
 assert.equal(stats.product,64);
 assert.ok(Math.abs(stats.ellipseQuarterOriented-16*Math.PI)<1e-10);
 const bounds=boundsForGeometry(model,'triangle90');
 assert.ok(bounds.left<0&&bounds.right>0&&bounds.top>=16);
});

test('Circular 0° y 90° producen arcos de circunferencia exacta, no elipses',()=>{
 const model=geometryForExpression({expression:'x^2',xMin:4,xMax:4,angle:90});
 const circle0=geometryPaths(model,'circle0',72)[0].points;
 assert.deepEqual(circle0[0],[4,0]);
 assert.ok(Math.abs(circle0.at(-1)[0]-16)<1e-10);
 assert.ok(Math.abs(circle0[36][0]-10)<1e-10);
 assert.ok(Math.abs(Math.abs(circle0[36][1])-6)<1e-10);
 const circle90=geometryPaths(model,'circle90',72)[0].points;
 assert.deepEqual(circle90[0],[4,0]);
 assert.ok(Math.abs(circle90.at(-1)[0])<1e-10);
 assert.ok(Math.abs(circle90.at(-1)[1]-16)<1e-10);
 const center=[2,8],radius=Math.hypot(4-0,0-16)/2;
 for(const p of circle90){
  assert.ok(Math.abs(Math.hypot(p[0]-center[0],p[1]-center[1])-radius)<1e-8);
 }
 const bounds=boundsForGeometry(model,'circle90');
 assert.ok(bounds.left<=-6&&bounds.top>=16);
});

test('El incremento Δx acepta valores decimales, extremos decimales y no acumula error',()=>{
 const settings={expression:'2x+sin(x)',xMin:1.1,xMax:2.1,step:0.25,angle:90,selectedX:1.6};
 const model=geometryForExpression(settings);
 assert.deepEqual(sampleValues(settings),[1.1,1.35,1.6,1.85,2.1]);
 assert.deepEqual(model.geometries.map(g=>g.x),[1.1,1.35,1.6,1.85,2.1]);
 assert.equal(model.selected.x,1.6);
 assert.ok(Math.abs(model.selected.fx-(2*1.6+Math.sin(1.6)))<1e-10);
 assert.equal(model.invalidXs.length,0);
 const quarter=sampleValues({xMin:0,xMax:1,step:.1});
 assert.equal(quarter.length,11);
 assert.equal(quarter.at(-1),1);
});

test('Máximo de 150 líneas con advertencia explícita en lugar de truncar',()=>{
 assert.equal(MAX_GEOMETRY_LINES,150);
 assert.equal(sampleValues({xMin:0,xMax:149,step:1}).length,150);
 assert.throws(()=>sampleValues({xMin:0,xMax:1,step:0.001}),/límite es 150/);
 const a=normalizeGeometrySettings({xMin:9.25,xMax:3.25,angle:450,n:5,selectedX:4.75,step:.5});
 assert.equal(a.xMin,3.25);
 assert.equal(a.xMax,9.25);
 assert.equal(a.angle,90);
 assert.equal(a.step,.5);
 assert.equal(a.selectedX,4.75);
});

test('Solo existe una calculadora real: las vistas generan series temporales de Desmos',async()=>{
 const s=await readFile(new URL('../assets/lmm/geometry-ui.mjs',import.meta.url),'utf8');
 assert.match(s,/window\.__nPrimosCalculator/);
 assert.doesNotMatch(s,/GraphingCalculator\s*\(/);
 assert.match(s,/calc\.setExpressions\(expressions\)/);
 assert.match(s,/calc\.removeExpression/);
 assert.match(s,/gmr:project-switched/);
 assert.match(s,/localStorage/);
 assert.match(s,/type:'expression'/);
 assert.match(s,/secret:true/);
 assert.doesNotMatch(s,/type:'table'|lmm-formula|lmm-source-list|sourceToAscii/);
 assert.match(s,/calc\.HelperExpression/);
 assert.match(s,/helper\.observe\('listValue'/);
});

test('LMM conserva rutas antiguas y el proyecto de ejemplo de números primos',async()=>{
 const root=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const oldMate=await readFile(new URL('../assets/matefx/index.html',import.meta.url),'utf8');
 const page=await readFile(new URL('../assets/lmm/index.html',import.meta.url),'utf8');
 const boot=await readFile(new URL('../assets/nprimos/boot.js',import.meta.url),'utf8');
 const app=await readFile(new URL('../assets/nprimos/app.js',import.meta.url),'utf8');
 assert.match(root,/assets\/lmm\/index\.html/);
 assert.match(oldMate,/\.\.\/lmm\/index\.html/);
 assert.match(page,/Laboratorio Matemático de Miguel/);
 assert.match(page,/<base href="\.\.\/nprimos\/">/);
 assert.match(boot,/geometry-ui\.mjs/);
 assert.match(app,/makeProject\('Nueva investigación',0,false\)/);
 assert.match(app,/Ejemplo · 10 000 números primos/);
 assert.match(app,/startsWith\('__lmm_'\)/);
});

test('Navegación sin duplicados: derecha solo Investigación, Análisis, Datos y Vista',async()=>{
 const ui=await readFile(new URL('../assets/lmm/geometry-ui.mjs',import.meta.url),'utf8');
 const research=await readFile(new URL('../assets/nprimos/investigation-ui-v2.js',import.meta.url),'utf8');
 const css=await readFile(new URL('../assets/lmm/lmm.css',import.meta.url),'utf8');
 assert.equal((ui.match(/data-lmm-quick="/g)||[]).length,4);
 assert.match(ui,/data-lmm-quick="view"/);
 assert.match(ui,/data-lmm-quick="research"/);
 assert.match(ui,/data-lmm-quick="analysis"/);
 assert.match(ui,/data-lmm-quick="data"/);
 assert.match(ui,/id='lmm-view-panel'/);
 assert.match(ui,/id="lmm-count"/);
 assert.doesNotMatch(ui,/id="lmm-step"|id="lmm-selected"/);
 assert.match(ui,/LMM_MODES\.map/);
 assert.doesNotMatch(ui,/data-lmm-quick="(?:settings|fit|example)"/);
 assert.doesNotMatch(ui,/lmm-mode-rail|lmm-animate|lmm-angleText/);
 assert.doesNotMatch(research,/mf-feature-navigation|np-investigation-btn/);
 assert.match(research,/window\.__lmmTools=/);
 assert.match(css,/#lmm-quick-rail/);
 assert.match(css,/#lmm-view-panel/);
 assert.doesNotMatch(css,/#lmm-mode-rail/);
 const lib=await readFile(new URL('../assets/shared/lab.js',import.meta.url),'utf8');
 assert.match(lib,/__lmmTools\.openAnalysis/);
});

test('El PDF general sigue explicando el índice de complejidad con subtotales',async()=>{
 const src=await readFile(new URL('../assets/nprimos/investigation-paper.mjs',import.meta.url),'utf8');
 assert.match(src,/C = Nnum/);
 assert.match(src,/Cantidad/);
 assert.match(src,/Subtotal/);
 assert.match(src,/categories\.map/);
 assert.match(src,/Los pesos son convenciones/);
});


test('Las cinco vistas usan los valores evaluados por Desmos, no una fórmula de respaldo',async()=>{
 const {desmosSources,helperLatex,helperValues,pathLatex}=await import('../assets/lmm/desmos-source.mjs');
 const sources=desmosSources([
  {id:'1',latex:'f_{1}\\left(x\\right)=a\\cdot x',color:'#ff0000'},
  {id:'2',latex:'g_{abc}(x)=f_{1}(x)+2',color:'#0000ff'},
  {id:'3',latex:'y=3x+1'},
  {id:'4',latex:'a=5'},
  {id:'5',latex:'h(x)=x^2',hidden:true},
  {id:'__lmm_source',latex:'h_{LMM}(x)=x^2'},
  {id:'__lmm_geometry_0',latex:'[(1,2),(3,4)]'},
  {id:'6',type:'table',columns:[]}
 ]);
 assert.deepEqual(sources.map(s=>s.id),['1','2','3']);
 assert.equal(helperLatex(sources[0],[1,2]),'f_{1}\\left(\\left[1,2\\right]\\right)');
 assert.match(helperLatex(sources[2],[1,2]),/operatorname\{with\}x=/);
 assert.deepEqual(helperValues({listValue:[5,10]},2),[5,10]);
 assert.deepEqual(helperValues({numericValue:3},2),[3,3]);
 assert.ok(helperValues({},2).every(Number.isNaN));
 const a=geometryFromSamples({angle:90,selectedX:2},[1,2],[5,10]);
 const b=geometryFromSamples({angle:90,selectedX:2},[1,2],[7,12]);
 assert.equal(a.selected.fx,10);assert.equal(b.selected.fx,12);
 assert.deepEqual(geometryPaths(a,'triangle90')[1].points,[[-2,0],[0,10],[2,0]]);
 assert.deepEqual(geometryPaths(b,'triangle90')[1].points,[[-2,0],[0,12],[2,0]]);
 for(const mode of ['triangle0','triangle90','circle0','circle90']){
  assert.ok(geometryPaths(a,mode).length);
  assert.notDeepEqual(geometryPaths(a,mode),geometryPaths(b,mode));
 }
 assert.equal(geometryFromSamples({angle:90},[1,2],[NaN,10]).geometries.length,1);
 assert.match(pathLatex([[0,1],[1,2]]),/\\left\[/);
});


test('Regresión: las funciones generadas desde Investigación también son fuentes de las cinco vistas',async()=>{
 const {desmosSources,helperLatex}=await import('../assets/lmm/desmos-source.mjs');
 const generated={id:'gmr_generated_1795830000000_1',type:'expression',latex:'f_{1}(x)=(-11.524)\\cdot x\\cdot e^{0.565\\cdot x/93}+(-58.2)',color:'#21895d'};
 const sources=desmosSources([
  generated,
  {id:'gmr_generated_1795830000000_2',type:'expression',latex:'f_{2}(x)=f_{1}(x)+1'},
  {id:'manual_1',latex:'g(x)=x^2'},
  {id:'__lmm_geometry_0',latex:'[(0,0),(1,2)]',secret:true},
  {id:'gmr_dataset_desktop',type:'table'},
  {...generated,id:'gmr_generated_hidden',hidden:true},
  {id:'__np_n',latex:'N_{primos}=[1,2]',secret:true}
 ]);
 assert.deepEqual(sources.map(s=>s.id),[generated.id,'gmr_generated_1795830000000_2','manual_1']);
 assert.equal(sources[0].color,generated.color);
 assert.equal(helperLatex(sources[0],[1,2,3]),'f_{1}\\left(\\left[1,2,3\\right]\\right)');
 const model=geometryFromSamples({angle:90},[1,2,3],[0.7,0.8,0.9]);
 for(const mode of ['triangle0','triangle90','circle0','circle90'])assert.ok(geometryPaths(model,mode).length);
});

test('Cantidad automática: el intervalo 1 a 50 nunca bloquea el dibujo',()=>{
 const migrated=normalizeCountSettings({xMin:1,xMax:50,step:.1});
 assert.equal(migrated.count,150);
 const config=normalizeCountSettings({xMin:1,xMax:50,count:50});
 assert.equal(config.step,1);
 assert.deepEqual(sampleCountValues(config),Array.from({length:50},(_,i)=>i+1));
 const twenty=sampleCountValues({xMin:1,xMax:50,count:20});
 assert.equal(twenty.length,20);assert.equal(twenty[0],1);assert.equal(twenty.at(-1),50);
 assert.deepEqual(sampleCountValues({xMin:50,xMax:1,count:3}),[1,25.5,50]);
 assert.deepEqual(sampleCountValues({xMin:2,xMax:2,count:20}),[2]);
 assert.deepEqual(sampleCountValues({xMin:1,xMax:50,count:1}),[1]);
 assert.equal(sampleCountValues({xMin:1,xMax:50,count:999}).length,150);
 assert.equal(sampleCountValues({xMin:1,xMax:50,count:0}).length,1);
 const model=geometryFromSamples(config,sampleCountValues(config),Array.from({length:50},(_,i)=>2*(i+1)));
 assert.equal(geometryPaths(model,'triangle0').length,50);
 assert.equal(geometryPaths(model,'triangle90').length,50);
 assert.equal(geometryPaths(model,'circle0').length,100);
 assert.equal(geometryPaths(model,'circle90').length,100);
});
