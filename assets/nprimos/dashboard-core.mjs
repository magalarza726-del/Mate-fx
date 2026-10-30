/** Pure dashboard aggregation, shared by the bar charts and tests. */
export function equalSegments(points, count=3) {
  const values=points.map(p=>p[0]).filter(Number.isFinite);
  if(!values.length)return [];
  const lo=Math.min(...values),hi=Math.max(...values),n=Math.min(100,Math.max(1,Math.trunc(count)||3));
  if(lo===hi)return [{min:lo,max:hi}];
  return Array.from({length:n},(_,i)=>({min:lo+(hi-lo)*i/n,max:lo+(hi-lo)*(i+1)/n}));
}
export function segmentSummary(snap,segments,mode='errors',metric='percent',errorAxis='y',filter={}) {
  const functions=snap?.functions||[],rows=snap?.rows||[];
  const first=Number.isFinite(filter.min)?filter.min:-Infinity,last=Number.isFinite(filter.max)?filter.max:Infinity;
  const unit=errorAxis==='x'?snap.source.xName:snap.source.yName;
  const series=mode==='errors'?functions.map(f=>({label:f.label+' · '+(metric==='percent'?'%E':'E'),unit:metric==='percent'?'%':unit})):
    [{label:unit+' (real)',unit},...functions.map(f=>({label:f.label+' (calculado)',unit}))];
  const groups=[];
  for(const [i,part] of segments.entries()){
    const min=Number(part.min),max=Number(part.max);
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)continue;
    const sums=series.map(()=>0),counts=series.map(()=>0);
    for(const row of rows){
      if(!Number.isFinite(row.x)||row.x<first||row.x>last||row.x<min||row.x>max)continue;
      // Compartir un extremo de dos tramos no debe contar dos veces.
      if(i<segments.length-1 && row.x===max && Number(segments[i+1].min)===max)continue;
      const values=mode==='errors'?functions.map((_,k)=>row.values?.[k]?.[metric]):
        [errorAxis==='x'?row.x:row.y,...functions.map((_,k)=>row.values?.[k]?.estimate)];
      values.forEach((value,k)=>{if(Number.isFinite(value)){sums[k]+=value;counts[k]++}});
    }
    groups.push({min,max,label:fmt(min)+'–'+fmt(max),values:sums.map((v,k)=>counts[k]?v/counts[k]:null),counts});
  }
  return {groups,series,mode,metric,unit};
}
function fmt(n){return Number(n.toFixed(4)).toLocaleString('es-EC',{maximumFractionDigits:4})}
