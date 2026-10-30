import assert from 'node:assert/strict';
import fs from 'node:fs';
import {makeEnvelope,evaluateEnvelope,encloses} from '../assets/nprimos/envelope-core.mjs';
const rows=fs.readFileSync(new URL('../assets/examples/agua_saturada_A4.csv',import.meta.url),'utf8').replace(/^\uFEFF/,'').trim().split(/\r?\n/).slice(1).map(line=>line.split(';').slice(0,2).map(Number)).filter(p=>p.every(Number.isFinite));
assert.equal(rows.length,76);
for (const bounds of ['shared','independent']){
  const sections=[rows.slice(0,26),rows.slice(26,51),rows.slice(51)];
  let valid=0, best=Infinity;
  for(let n=0;n<1000;n++){
    const group=n%3;
    const model=makeEnvelope(sections[group],{bounds,decimals:2,maxInteger:9999});
    if(!model)continue;
    valid++;
    assert.ok(encloses(model,sections[group]));
    const result=evaluateEnvelope(model,sections[group],'auto');
    assert.ok(result);
    best=Math.min(best,result.mape);
  }
  assert.ok(valid>100,`Candidatas no viables: ${bounds} ${valid}`);
  console.log(bounds+' | 1000 intentos repartidos en 3 tramos | '+valid+' válidas | mejor MAPE individual '+best.toFixed(3)+'%');
}