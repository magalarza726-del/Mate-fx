'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseDataset,splitCSV,detectDelimiter,cleanRows}=require('../desktop/data-service.cjs');
test('CSV con comillas, comas y saltos de línea',()=>{
 assert.deepEqual(splitCSV('x,y\n1,"a,b"\n2,"línea\nsegunda"\n'),[['x','y'],['1','a,b'],['2','línea\nsegunda']]);
});
test('CSV punto y coma', async()=>{
 const input='Longitud;Altura\n1,5;2,4\n2,5;3,8\n';
 assert.equal(detectDelimiter(input),';');
 const dataset=await parseDataset('mediciones.csv',Buffer.from(input));
 assert.deepEqual(dataset.headers,['Longitud','Altura']);assert.equal(dataset.rows.length,2);
});
test('Encabezados repetidos y celdas vacías',()=>{
 const result=cleanRows([['x','x',''],['1','2','3'],['','','']], 'archivo.csv');
 assert.deepEqual(result.headers,['x','x (2)','Columna 3']);assert.equal(result.rows.length,1);
});
