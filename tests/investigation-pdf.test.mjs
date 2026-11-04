import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const downloads=[],images=[],desmosCalls=[],printedText=[];
class FakePDF{
 constructor(){this.pages=1}
 setProperties(){}setFillColor(){}rect(){}setTextColor(){}setFontSize(){}setFont(){}text(s){printedText.push(String(s))} 
 setDrawColor(){}line(){}roundedRect(){}
 splitTextToSize(value){return String(value).match(/.{1,95}/g)||['']}
 addPage(){this.pages++}
 addImage(...args){images.push(args)}
 save(name){downloads.push({name,pages:this.pages})}
}
const fakeCalculator={
 setBlank(){},setExpressions(items){desmosCalls.push(items)},
 asyncScreenshot(opts,cb){cb('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/FF4AAAAASUVORK5CYII=')},
 destroy(){}
};
globalThis.window={
 jspdf:{jsPDF:FakePDF},
 Desmos:{GraphingCalculator:()=>fakeCalculator,Styles:{DASHED:'DASHED'}},
 MathJax:{tex2svgPromise:async()=>{throw Error('MathJax mock intentionally omitted')}}
};
globalThis.document={
 createElement:()=>({style:{},setAttribute(){},append(){},appendChild(){},remove(){}}),
 body:{appendChild(){}}
};

const {methodReport,generalReport,reportLatex}=await import('../assets/nprimos/investigation-report.mjs');
const {plotSpecifications}=await import('../assets/nprimos/investigation-desmos.mjs');
const points=Array.from({length:11},(_,i)=>[i+1,i*2+4]);
const metrics={mape:0,maxape:0,maxAbs:0,mae:0,rmse:0,p95:0,valid:11,invalid:0};
const best={latex:'f(x)=2x+2',complexity:3,metrics,trainMetrics:metrics,validationMetrics:metrics,
 estimates:points.map(p=>p[1]),curvePoints:points};
const state={
 entries:[{id:'C1',method:'linear',seed:100,config:{n:3,decimals:3}}],
 projectName:'Ensayo',
 source:{points,xName:'T',yName:'P',sourceName:'Tabla A4'},
 history:new Map([['C1',[{iteration:1,latex:best.latex,metrics,complexity:3}]]]),
 results:new Map([['C1',{best,elapsedMs:100}]])
};

test('Los reportes individuales y generales descargan archivos .pdf directamente',async()=>{
 const method=await methodReport(state,'linear','Regresion lineal');
 const general=await generalReport(state,()=> 'Regresion lineal');
 assert.match(method,/\.pdf$/);
 assert.match(general,/\.pdf$/);
 assert.equal(downloads.length,2);
 assert.ok(downloads.every(p=>p.name.endsWith('.pdf')));
 assert.ok(downloads[0].pages>=2);
 assert.ok(images.length>=3,'El PDF incluye dos gráficos Desmos de método y uno general');
 assert.ok(desmosCalls.length>=3);
 assert.equal(desmosCalls[0][0].type,'table');
 assert.equal(desmosCalls[0][0].columns[1].points,true);
 assert.equal(desmosCalls[0][1].columns[1].lines,true);
 assert.ok(printedText.some(x=>x.includes('Resumen ejecutivo')),'El PDF incluye un resumen ejecutivo de estilo paper');
 assert.ok(printedText.some(x=>x.includes('Metodología')),'El PDF documenta la metodología');
 assert.ok(printedText.some(x=>x.includes('Resultados comparativos')),'Incluye resultados comparativos');
 assert.ok(printedText.some(x=>x.includes('Catálogo de ecuaciones')),'Incluye el catálogo de ganadoras');
 assert.ok(printedText.some(x=>x.includes('Hallazgos clave')),'Incluye hallazgos de mejor precisión y menor complejidad');
 assert.ok(printedText.some(x=>x.includes('Configuración del experimento')),'Incluye el panel de experimento de método');
 assert.ok(printedText.some(x=>x.includes('Anexo de iteraciones')),'El método conserva el historial');
 assert.ok(!printedText.some(x=>x.includes('about:blank')),'No muestra encabezados de impresión web');
});

test('Dashboards para errores y complejidad usan series de datos para Desmos',()=>{
 const entries=[{id:'C1',best}];
 const comparison=plotSpecifications(state.source,best,'comparison',entries);
 const complexity=plotSpecifications(state.source,best,'complexity',entries);
 assert.equal(comparison.series.length,2);
 assert.equal(complexity.series.length,1);
 assert.equal(complexity.series[0].points[0][0],3);
});

test('Las ecuaciones del informe usan x y mantienen z para normalización',()=>{
 const plain=reportLatex('f(x)=(1.5)x^{2}+3');
 assert.equal(plain.latex,'f(x)=(1.5)x^{2}+3');
 assert.equal(plain.definition,'');
 const normalized=reportLatex('f(x)=(4336.801)+(8776.749)\\cdot z','\\frac{x-(186.98)}{186.97}');
 assert.equal(normalized.latex,'f(x)=(4336.801)+(8776.749)\\cdot z');
 assert.equal(normalized.definition,'z=\\frac{x-(186.98)}{186.97}');
});

test('El modo automático solamente inicia la descarga del reporte general',async()=>{
 const src=await readFile(new URL('../assets/nprimos/investigation-ui.js',import.meta.url),'utf8');
 assert.match(src,/if\(mode==='automatic'\)reportGeneral\(\)/);
 assert.doesNotMatch(src,/reportAll\(\)/);
 assert.match(src,/data-pdf/,'Los informes individuales siguen disponibles mediante descarga manual');
});
