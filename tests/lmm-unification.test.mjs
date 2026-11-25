import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LMM_MODES,normalizeGeometrySettings,geometryForExpression,
 geometryPaths,boundsForGeometry,geometryStatistics} from '../assets/lmm/geometry-core.mjs';

test('Solo tres visualizaciones sobre los mismos ejes: Clásico, Triángulos, Elipses',()=>{
 assert.deepEqual(LMM_MODES.map(m=>m.id),['classic','triangles','ellipses']);
 const model=geometryForExpression({expression:'x^2',xMin:1,xMax:6,angle:90,selectedX:4});
 assert.equal(model.geometries.length,6);
 assert.equal(model.selected.x,4);
 assert.equal(model.selected.fx,16);
 assert.equal(geometryPaths(model,'classic').length,0);
 assert.equal(geometryPaths(model,'triangles').length,6);
 assert.equal(geometryPaths(model,'ellipses').length,12);
});

test('Los triángulos y cuartos de elipse conservan la geometría original de Mate-fx',()=>{
 const model=geometryForExpression({expression:'x^2',xMin:4,xMax:4,angle:90});
 const triangle=geometryPaths(model,'triangles')[0].points;
 assert.deepEqual(triangle,[[-4,0],[0,16],[4,0]]);
 const positive=geometryPaths(model,'ellipses',72)[0].points;
 assert.ok(Math.abs(positive[0][0]-4)<1e-10);
 assert.ok(Math.abs(positive[0][1])<1e-10);
 assert.ok(Math.abs(positive.at(-1)[0])<1e-10);
 assert.ok(Math.abs(positive.at(-1)[1]-16)<1e-10);
 const stats=geometryStatistics(model);
 assert.equal(stats.product,64);
 assert.ok(Math.abs(stats.ellipseQuarterOriented-16*Math.PI)<1e-10);
 const bounds=boundsForGeometry(model,'ellipses');
 assert.ok(bounds.left<0&&bounds.right>0&&bounds.top>=16);
});

test('La configuración se normaliza y las expresiones matemáticas se evalúan sin eval JS',()=>{
 const a=normalizeGeometrySettings({xMin:9,xMax:3,angle:450,n:5,selectedX:4});
 assert.equal(a.xMin,3);
 assert.equal(a.xMax,9);
 assert.equal(a.angle,90);
 const m=geometryForExpression({expression:'2x+sin(x)',xMin:1,xMax:3});
 assert.equal(m.geometries.length,3);
 assert.ok(Math.abs(m.geometries[0].fx-(2+Math.sin(1)))<1e-10);
 assert.equal(m.invalidXs.length,0);
});

test('Solo se crea UNA calculadora Desmos: los modos añaden series en ella',async()=>{
 const s=await readFile(new URL('../assets/lmm/geometry-ui.mjs',import.meta.url),'utf8');
 assert.match(s,/window\.__nPrimosCalculator/);
 assert.doesNotMatch(s,/GraphingCalculator\s*\(/);
 assert.match(s,/calc\.setExpressions\(expressions\)/);
 assert.match(s,/calc\.removeExpression/);
 assert.match(s,/gmr:project-switched/);
 assert.match(s,/localStorage/);
});
test('LMM es la entrada unificada y se conserva compatibilidad con vínculos antiguos',async()=>{
 const root=await readFile(new URL('../index.html',import.meta.url),'utf8');
 const oldMate=await readFile(new URL('../assets/matefx/index.html',import.meta.url),'utf8');
 const page=await readFile(new URL('../assets/lmm/index.html',import.meta.url),'utf8');
 const boot=await readFile(new URL('../assets/nprimos/boot.js',import.meta.url),'utf8');
 assert.match(root,/assets\/lmm\/index\.html/);
 assert.match(oldMate,/\.\.\/lmm\/index\.html/);
 assert.match(page,/Laboratorio Matemático de Miguel/);
 assert.match(page,/<base href="\.\.\/nprimos\/">/);
 assert.match(boot,/geometry-ui\.mjs/);
});
test('Proyectos genéricos por defecto; 10.000 primos solo como ejemplo conservado',async()=>{
 const app=await readFile(new URL('../assets/nprimos/app.js',import.meta.url),'utf8');
 assert.match(app,/makeProject\('Nueva investigación',0,false\)/);
 assert.match(app,/Ejemplo · 10 000 números primos/);
 assert.match(app,/store\.currentId=general\.id/);
 assert.match(app,/startsWith\('__lmm_'\)/);
 const lib=await readFile(new URL('../assets/shared/lab.js',import.meta.url),'utf8');
 assert.match(lib,/LMM ·/);
 assert.match(lib,/__lmmGeometry\.showPanel/);
});
test('Los botones laterales son persistentes y el botón superior está en la barra visible',async()=>{
 const ui=await readFile(new URL('../assets/lmm/geometry-ui.mjs',import.meta.url),'utf8');
 const research=await readFile(new URL('../assets/nprimos/investigation-ui-v2.js',import.meta.url),'utf8');
 assert.match(ui,/id='lmm-mode-rail'/);
 assert.match(ui,/id='lmm-quick-rail'/);
 for(const mode of ['classic','triangles','ellipses'])assert.match(ui,new RegExp(''+mode));
 assert.match(research,/document\.querySelector\('\.gmr-toolbar'\)/);
 const css=await readFile(new URL('../assets/lmm/lmm.css',import.meta.url),'utf8');
 assert.match(css,/#lmm-mode-rail/);
 assert.match(css,/#lmm-quick-rail/);
});
test('La metodología del PDF detalla una suma ponderada verificable de complejidad',async()=>{
 const src=await readFile(new URL('../assets/nprimos/investigation-paper.mjs',import.meta.url),'utf8');
 assert.match(src,/C = Nnum/);
 assert.match(src,/Cantidad/);
 assert.match(src,/Subtotal/);
 assert.match(src,/categories\.map/);
 assert.match(src,/Los pesos son convenciones/);
});
