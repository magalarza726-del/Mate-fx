import test from 'node:test';
import assert from 'node:assert/strict';

const downloads=[],images=[],desmosCalls=[];
class FakePDF{
 constructor(){this.pages=1}
 setProperties(){}setFillColor(){}rect(){}setTextColor(){}setFontSize(){}setFont(){}text(){}
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

const {methodReport,generalReport}=await import('../assets/nprimos/investigation-report.mjs');
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
});

test('Dashboards para errores y complejidad usan series de datos para Desmos',()=>{
 const entries=[{id:'C1',best}];
 const comparison=plotSpecifications(state.source,best,'comparison',entries);
 const complexity=plotSpecifications(state.source,best,'complexity',entries);
 assert.equal(comparison.series.length,2);
 assert.equal(complexity.series.length,1);
 assert.equal(complexity.series[0].points[0][0],3);
});
