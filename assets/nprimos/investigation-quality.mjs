/* Comprobaciones posteriores al ajuste: diagnósticos informativos, no alteran las ecuaciones. */
const finite = v => Number.isFinite(v);
const ordered = points => (points || []).filter(p=>Array.isArray(p)&&finite(+p[0])&&finite(+p[1]))
  .map(p=>[+p[0],+p[1]]).sort((a,b)=>a[0]-b[0]);

export function physicalDomain(source = {}) {
 const label=[source.yName,source.sourceName].filter(Boolean).join(' ');
 // Se limita a presión de saturación / absoluta; no se infiere el dominio de otras columnas.
 return /psat|p[_\s-]*sat\b|presi[oó]n(?:\s+absoluta|\s+de\s+saturaci[oó]n)?|(?:saturation|absolute|saturated)\s+pressure|vapou?r\s+pressure/i.test(label)
  && !/(?:volume|volumen|vapor\s+espec[ií]fico)/i.test(String(source.yName||'')) ? 'pressure' : null;
}

export function diagnosePhysicalModel(source = {}, best = null) {
 const domain = physicalDomain(source), points=ordered(source.points);
 const sampled = ordered(best?.curvePoints?.length ? best.curvePoints :
  points.map((p,i)=>[p[0],best?.estimates?.[i]]));
 if (!best) return {domain, status:'sin_modelo',warnings:[],nonpositive:0,decreases:0,invalid:0};
 if (!domain) return {domain:null,status:'no_aplica',warnings:[],nonpositive:0,decreases:0,invalid:0};
 const warnings=[],values=sampled.map(p=>p[1]);
 const nonpositive=values.filter(v=>finite(v)&&v<=0).length;
 const invalid=(best?.estimates||[]).filter(v=>!finite(v)).length;
 const scale=Math.max(1,...values.filter(finite).map(Math.abs));
 const eps=scale*1e-7;
 let decreases=0;
 for(let i=1;i<sampled.length;i++){
  if (sampled[i][1]<sampled[i-1][1]-eps) decreases++;
 }
 // También comprobar todos los puntos originales; un muestreo fino no debe ocultar extremos.
 const original=(best.estimates||[]).filter(finite);
 const originalNonpositive=original.filter(v=>v<=0).length;
 if(Math.max(nonpositive,originalNonpositive)>0)
  warnings.push('La presión absoluta estimada no es positiva en '+Math.max(nonpositive,originalNonpositive)+' puntos del intervalo.');
 if(decreases>0)
  warnings.push('La presión calculada disminuye en '+decreases+' tramos consecutivos del intervalo muestreado.');
 if(invalid>0)
  warnings.push('El modelo no produce un valor finito en '+invalid+' observaciones.');
 return {domain,status:warnings.length?'advertencia':'sin_alertas',warnings,
  nonpositive:Math.max(nonpositive,originalNonpositive),decreases,invalid};
}

/** Similaridad numérica en el conjunto de datos, no equivalencia simbólica global. */
export function equivalentModelGroups(entries=[],tolerance=1e-8) {
 const groups=[],used=new Set();
 for(let i=0;i<entries.length;i++){
  if(used.has(i))continue;
  const a=entries[i]?.best?.estimates;if(!Array.isArray(a)||!a.length)continue;
  const ids=[entries[i].id]; 
  for(let j=i+1;j<entries.length;j++){
   if(used.has(j))continue;
   const b=entries[j]?.best?.estimates;
   if(!Array.isArray(b)||b.length!==a.length)continue;
   if(a.every((v,k)=>finite(v)&&finite(b[k])&&Math.abs(v-b[k])<=tolerance*Math.max(1,Math.abs(v),Math.abs(b[k])))){
    ids.push(entries[j].id);used.add(j);
   }
  }
  if(ids.length>1)groups.push(ids);
 }
 return groups;
}
