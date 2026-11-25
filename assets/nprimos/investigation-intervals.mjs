/* Análisis genérico de error por intervalos iguales de la variable X. */
const valid=x=>Number.isFinite(x);
export function intervalDiagnostics(points=[],predictions=[],n=6){
 const rows=Array.isArray(points)?points:[],count=Math.max(1,Math.min(100,Math.trunc(Number(n)||6)));
 if(!rows.length)return [];
 const xs=rows.map(p=>Number(p[0])).filter(valid);
 if(!xs.length)return [];
 const min=Math.min(...xs),max=Math.max(...xs),span=Math.max(1e-12,max-min),width=span/count;
 const sections=Array.from({length:count},(_,i)=>({
  index:i+1,from:min+i*width,to:i===count-1?max:min+(i+1)*width,
  observations:0,valid:0,percentCount:0,zeroY:0,invalid:0,
  sumAbs:0,sumSquares:0,sumPct:0,maxPct:0,sumBias:0
 }));
 rows.forEach(([rawX,rawY],i)=>{
  const x=+rawX,y=+rawY;if(!valid(x)||!valid(y))return;
  const idx=Math.min(count-1,Math.max(0,Math.floor((x-min)/span*count))),s=sections[idx];s.observations++;
  const calculated=predictions[i];
  if(!valid(calculated)){s.invalid++;return}
  s.valid++;const diff=calculated-y,abs=Math.abs(diff);
  s.sumAbs+=abs;s.sumSquares+=diff*diff;s.sumBias+=diff;
  if(y===0){s.zeroY++;return}
  const ape=100*abs/Math.abs(y);s.percentCount++;s.sumPct+=ape;s.maxPct=Math.max(s.maxPct,ape);
 });
 return sections.map(s=>({
  index:s.index,from:s.from,to:s.to,observations:s.observations,valid:s.valid,
  percentCount:s.percentCount,zeroY:s.zeroY,invalid:s.invalid,
  mape:s.percentCount?s.sumPct/s.percentCount:null,
  maxape:s.percentCount?s.maxPct:null,
  mae:s.valid?s.sumAbs/s.valid:null,
  rmse:s.valid?Math.sqrt(s.sumSquares/s.valid):null,
  bias:s.valid?s.sumBias/s.valid:null,
  coverage:s.observations?s.valid/s.observations:0
 }));
}
export function intervalLabel(s,format=v=>Number(v).toFixed(3)){return format(s.from)+' – '+format(s.to)}
export const INTERVAL_NOTE='Tramos de igual amplitud en X. MAPE y MaxAPE excluyen Y real igual a cero. MAE usa las estimaciones finitas. Las estimaciones inválidas se contabilizan por separado.';
