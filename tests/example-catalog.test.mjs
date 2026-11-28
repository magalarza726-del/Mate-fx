import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../assets/examples/catalog/',import.meta.url);
const read=async file=>JSON.parse(await readFile(new URL(file,root),'utf8'));
test('Catálogo: 5 tablas estadísticas y 9 termodinámicas, datos rectangulares y procedencia',async()=>{
 const index=await read('index.json');
 assert.equal(index.filter(e=>e.group==='prob').length,5);
 assert.equal(index.filter(e=>e.group==='termo').length,9);
 for(const e of index){const d=await read(e.id+'.json');assert.equal(d.rows.length,e.rows);assert.equal(d.headers.length,e.columns);assert.ok(d.rows.every(r=>r.length===d.headers.length));assert.ok(d.source&&d.pages.length);}
 const a4=await read('termo-a4.json');const row=a4.rows.find(r=>+r[0]===100);assert.equal(+row[1],101.42);assert.equal(+row[8],2256.4);
 const a5=await read('termo-a5.json');assert.equal(a5.headers[0],'P (kPa)');assert.equal(+a5.rows[0][1],6.97);
 const normal=await read('prob-a.json');assert.equal(+normal.rows.find(r=>r[0]===0)[1],.5);
 const fisher=await read('prob-d.json');assert.equal(+fisher.rows[0][1],39.86);
});
