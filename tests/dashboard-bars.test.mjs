import assert from 'node:assert/strict';
import {segmentSummary,equalSegments} from '../assets/nprimos/dashboard-core.mjs';
const snap={source:{xName:'T °C',yName:'Presión kPa',points:[[0,10],[1,20],[2,30],[3,40]]},
functions:[{label:'f₁'},{label:'f₂'}],
rows:[
{x:0,y:10,values:[{estimate:12,error:2,percent:20},{estimate:11,error:1,percent:10}]},
{x:1,y:20,values:[{estimate:22,error:2,percent:10},{estimate:18,error:2,percent:10}]},
{x:2,y:30,values:[{estimate:33,error:3,percent:10},{estimate:31,error:1,percent:100/30}]},
{x:3,y:40,values:[{estimate:35,error:5,percent:12.5},{estimate:39,error:1,percent:2.5}]}]};
const ranges=[{min:0,max:2},{min:2,max:3}];
const e=segmentSummary(snap,ranges,'errors','percent','y');
assert.deepEqual(e.groups.map(g=>g.counts[0]),[2,2]);
assert.equal(e.groups[0].values[0],15);
assert.equal(e.groups[1].values[0],11.25);
assert.deepEqual(segmentSummary(snap,ranges,'errors','error','y').groups.map(g=>g.values[0]),[2,4]);
assert.deepEqual(segmentSummary(snap,ranges,'actual','percent','y').groups[0].values,[15,17,14.5]);
assert.deepEqual(segmentSummary(snap,ranges,'actual','percent','y').groups[1].values,[35,34,35]);
assert.equal(equalSegments(snap.source.points,3).length,3);
console.log('OK: barras por tramos, doble conteo evitado, real frente a calculado');